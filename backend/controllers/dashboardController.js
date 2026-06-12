const { getAdminOverviewMetrics, getUserAnalytics, seedAnalytics } = require("../services/analyticsService");
const { listConversations, listChatMessages, seedConversationStats, getUserStats, getAllUserStats } = require("../services/conversationService");
const { getWidgetSettings, saveWidgetSettings } = require("../services/widgetSettingsService");
const { listWidgets, listWidgetsByOwner } = require("../services/widgetService");
const { listWebsites } = require("../services/web_ingestion/websiteService");
const { listPlans, getUserSubscription } = require("../services/subscriptionService");
const { readTable } = require("../utils/dbStore");
const { listWebsiteIdsForOwner } = require("../services/websiteOwnershipService");
const { getUserById, toPublicUser } = require("../services/authService");

function userIdFromAuth(req) {
  return req.auth?.sub || req.auth?.userId || null;
}

// ── User dashboard metrics ────────────────────────────────────────────────────
async function dashboardMetricsController(req, res) {
  try {
    const userId = userIdFromAuth(req);
    const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";
    const websitesPayload = await listWebsites();
    const allWebsites = Array.isArray(websitesPayload?.websites) ? websitesPayload.websites : [];
    let websites = allWebsites;
    if (!isAdmin) {
      const ownedIds = new Set(listWebsiteIdsForOwner(userId));
      websites = allWebsites.filter((site) => {
        const id = String(site.id || site.collection_name || "");
        return ownedIds.has(id);
      });
    }
    const widgets = userId ? listWidgetsByOwner(userId) : listWidgets();
    seedConversationStats();
    seedAnalytics();
    const analytics    = getUserAnalytics(userId);
    const conversations = listConversations(userId);
    const userStats    = getUserStats(userId);

    return res.json({
      totalWebsites:  websites.length,
      totalChats:     conversations.length,
      totalQueries:   userStats.total_queries,
      totalTokens:    userStats.total_tokens,
      queriesToday:   analytics.queriesToday ?? 0,
      // Today's token consumption for this user, sourced from analytics_daily
      tokensToday:    analytics.tokensToday  ?? 0,
      activeWidgets:  widgets.filter((w) => w.status === "active").length,
      recentActivity: [
        ...conversations.slice(0, 3).map((item) => ({ label: item.title, type: "Conversation", timestamp: item.updated_at || item.created_at })),
        ...widgets.slice(0, 2).map((item) => ({ label: item.displayName, type: "Widget",       timestamp: item.updatedAt  || item.createdAt  })),
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load dashboard metrics." });
  }
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function conversationsController(req, res) {
  try {
    const userId = userIdFromAuth(req);
    const items = listConversations(userId).map((conversation) => ({
      ...conversation,
      messages: listChatMessages(conversation.id),
    }));
    return res.json({ conversations: items });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load conversations." });
  }
}

// ── User analytics ────────────────────────────────────────────────────────────
async function analyticsController(req, res) {
  try {
    const userId = userIdFromAuth(req);
    seedAnalytics();
    return res.json(getUserAnalytics(userId));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load analytics." });
  }
}

// ── Widget settings ───────────────────────────────────────────────────────────
async function widgetSettingsController(req, res) {
  try {
    const userId = userIdFromAuth(req);
    const settings = getWidgetSettings(userId) || {
      theme: "dark",
      welcome_message: "Hi, how can I help?",
      suggested_questions: ["How do I index a site?", "How do widgets work?"],
      widget_title: "Voltagent Assistant",
      accent_color: "#00d992",
    };
    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load widget settings." });
  }
}

async function saveWidgetSettingsController(req, res) {
  try {
    const userId = userIdFromAuth(req);
    const settings = saveWidgetSettings(userId, req.body || {});
    return res.json({ settings });
  } catch (error) {
    return res.status(400).json({ error: error.message || "Failed to save widget settings." });
  }
}

// ── Admin overview ────────────────────────────────────────────────────────────
async function adminOverviewController(_req, res) {
  try {
    // Users — exclude admins
    const allUsers       = readTable("users");
    const nonAdminUsers  = allUsers.filter((u) => String(u.role_id || "").toLowerCase() !== "role_admin");
    const totalUsers     = nonAdminUsers.length;
    const thirtyDaysAgo  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const activeUsers    = nonAdminUsers.filter(
      (u) => u.status === "active" && u.last_login_at && u.last_login_at >= thirtyDaysAgo
    ).length;

    // Active user IDs (non-disabled, non-admin) for widget filtering
    const activeUserIds = new Set(
      nonAdminUsers.filter((u) => u.status === "active").map((u) => u.id)
    );

    // Collections
    const websitesPayload  = await listWebsites();
    const allWebsites      = Array.isArray(websitesPayload?.websites) ? websitesPayload.websites : [];
    const totalCollections = allWebsites.length;

    // Widgets — active only when owner account is also active
    const allWidgets   = listWidgets();
    const totalWidgets = allWidgets.length;
    const activeWidgets = allWidgets.filter(
      (w) => w.status === "active" && activeUserIds.has(String(w.ownerId || ""))
    ).length;

    // Today's totals across ALL users — sum tokens + queries from analytics_daily
    const today        = new Date().toISOString().slice(0, 10);
    const allDaily     = readTable("analytics_daily");
    const todayRows    = allDaily.filter((r) => r.date === today);
    const totalTokensToday  = todayRows.reduce((sum, r) => sum + (r.tokens  || 0), 0);
    const totalQueriesToday = todayRows.reduce((sum, r) => sum + (r.queries || 0), 0);

    // All-time totals from user_stats
    const allUserStats       = readTable("user_stats");
    const totalTokensAllTime  = allUserStats.reduce((sum, s) => sum + (s.total_tokens  || 0), 0);
    const totalQueriesAllTime = allUserStats.reduce((sum, s) => sum + (s.total_queries || 0), 0);

    // Conversations
    const totalChats = readTable("conversations").length;

    const subscriptions = listPlans();

    return res.json({
      metrics: {
        totalUsers,
        activeUsers,
        totalCollections,
        totalWidgets,
        activeWidgets,
        totalTokensToday,
        totalQueriesToday,
        totalTokensAllTime,
        totalQueriesAllTime,
        totalChats,
      },
      subscriptions,
      revenueSummary: {
        monthlyRevenue: 12540,
        mrr: 12540,
        activeSubscribers: 1948,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load overview." });
  }
}

// ── Admin system health ───────────────────────────────────────────────────────
async function adminHealthController(_req, res) {
  try {
    return res.json({
      nodeApi: "operational",
      fastApi: "operational",
      chromaDb: "operational",
      queue: "operational",
      storageUsage: 68,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load system health." });
  }
}

// ── Admin subscriptions ───────────────────────────────────────────────────────
async function adminSubscriptionsController(_req, res) {
  try {
    const plans = listPlans();
    const subscription = getUserSubscription("user_seed");
    return res.json({ plans, subscription });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load subscriptions." });
  }
}

// ── Per-user metrics (admin view) ─────────────────────────────────────────────
async function userMetricsController(req, res) {
  try {
    const { id: userId } = req.params;
    const targetUser = getUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const websitesPayload = await listWebsites();
    const allWebsites = Array.isArray(websitesPayload?.websites) ? websitesPayload.websites : [];
    const ownedIds = new Set(listWebsiteIdsForOwner(userId));
    const websites = allWebsites.filter((site) => {
      const id = String(site.id || site.collection_name || "");
      return ownedIds.has(id);
    });

    const widgets = listWidgetsByOwner(userId);
    seedConversationStats();
    seedAnalytics();
    const analytics     = getUserAnalytics(userId);
    const conversations = listConversations(userId);
    const userStats     = getUserStats(userId);

    return res.json({
      user:          toPublicUser(targetUser),
      totalWebsites: websites.length,
      totalChats:    conversations.length,
      totalQueries:  userStats.total_queries,
      totalTokens:   userStats.total_tokens,
      queriesToday:  analytics.queriesToday ?? 0,
      tokensToday:   analytics.tokensToday  ?? 0,
      activeWidgets: widgets.filter((w) => w.status === "active").length,
      totalWidgets:  widgets.length,
      widgets,
      websites,
      conversations,
      recentActivity: [
        ...conversations.slice(0, 5).map((item) => ({ label: item.title, type: "Conversation", timestamp: item.updated_at || item.created_at })),
        ...widgets.slice(0, 5).map((item) => ({ label: item.displayName, type: "Widget",       timestamp: item.updatedAt  || item.createdAt  })),
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load user metrics." });
  }
}

module.exports = {
  adminHealthController,
  adminOverviewController,
  adminSubscriptionsController,
  analyticsController,
  conversationsController,
  dashboardMetricsController,
  saveWidgetSettingsController,
  userMetricsController,
  widgetSettingsController,
};