const { getAdminOverviewMetrics, getUserAnalytics, seedAnalytics } = require("../services/analyticsService");
const { listConversations, listChatMessages, seedConversationStats, getUserStats, getAllUserStats } = require("../services/conversationService");
const { getWidgetSettings, saveWidgetSettings } = require("../services/widgetSettingsService");
const { listIndexingJobs, seedJobs } = require("../services/indexingJobService");
const { listWidgets, listWidgetsByOwner } = require("../services/widgetService");
const { listWebsites } = require("../services/web_ingestion/websiteService");
const { listPlans, getUserSubscription } = require("../services/subscriptionService");
const { readTable } = require("../utils/dbStore");
const { isSharedCollection, listWebsiteIdsForOwner } = require("../services/websiteOwnershipService");
const { getUserById, toPublicUser } = require("../services/authService");

function userIdFromAuth(req) {
  return req.auth?.sub || req.auth?.userId || null;
}

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
        return isSharedCollection(id) || ownedIds.has(id);
      });
    }
    const widgets = userId ? listWidgetsByOwner(userId) : listWidgets();
    seedConversationStats();
    seedAnalytics();
    const analytics = getUserAnalytics(userId);
    const conversations = listConversations(userId);
    const userStats = getUserStats(userId);
    return res.json({
      totalWebsites: websites.length,
      totalChats: conversations.length,
      totalQueries: userStats.total_queries,
      totalTokens: userStats.total_tokens,
      queriesToday: analytics.queriesToday ?? 0,
      activeWidgets: widgets.filter((widget) => widget.status === "active").length,
      recentActivity: [
        ...conversations.slice(0, 3).map((item) => ({ label: item.title, type: "Conversation", timestamp: item.updated_at || item.created_at })),
        ...widgets.slice(0, 2).map((item) => ({ label: item.displayName, type: "Widget", timestamp: item.updatedAt || item.createdAt })),
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load dashboard metrics." });
  }
}

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

async function analyticsController(req, res) {
  try {
    const userId = userIdFromAuth(req);
    seedAnalytics();
    return res.json(getUserAnalytics(userId));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load analytics." });
  }
}

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

async function adminOverviewController(_req, res) {
  try {
    const metrics = getAdminOverviewMetrics();
    const subscriptions = listPlans();
    return res.json({
      metrics,
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

async function adminJobsController(_req, res) {
  try {
    seedJobs();
    return res.json({ jobs: listIndexingJobs() });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load jobs." });
  }
}

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

async function adminSubscriptionsController(_req, res) {
  try {
    const plans = listPlans();
    const subscription = getUserSubscription("user_seed");
    return res.json({ plans, subscription });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load subscriptions." });
  }
}

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
      return isSharedCollection(id) || ownedIds.has(id);
    });

    const widgets = listWidgetsByOwner(userId);
    seedConversationStats();
    seedAnalytics();
    const analytics = getUserAnalytics(userId);
    const conversations = listConversations(userId);
    const userStats = getUserStats(userId);

    return res.json({
      user: toPublicUser(targetUser),
      totalWebsites: websites.length,
      totalChats: conversations.length,
      totalQueries: userStats.total_queries,
      totalTokens: userStats.total_tokens,
      queriesToday: analytics.queriesToday ?? 0,
      activeWidgets: widgets.filter((widget) => widget.status === "active").length,
      totalWidgets: widgets.length,
      widgets,
      websites,
      conversations,
      recentActivity: [
        ...conversations.slice(0, 5).map((item) => ({ label: item.title, type: "Conversation", timestamp: item.updated_at || item.created_at })),
        ...widgets.slice(0, 5).map((item) => ({ label: item.displayName, type: "Widget", timestamp: item.updatedAt || item.createdAt })),
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load user metrics." });
  }
}

module.exports = {
  adminHealthController,
  adminJobsController,
  adminOverviewController,
  adminSubscriptionsController,
  analyticsController,
  conversationsController,
  dashboardMetricsController,
  saveWidgetSettingsController,
  userMetricsController,
  widgetSettingsController,
};