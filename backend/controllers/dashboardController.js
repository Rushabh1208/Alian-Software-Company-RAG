const { getAdminOverviewMetrics, getUserAnalytics, seedAnalytics } = require("../services/analyticsService");
const { getUserStats, getAllUserStats } = require("../services/conversationService");
const { getWidgetSettings, saveWidgetSettings } = require("../services/widgetSettingsService");
const { listWidgets, listWidgetsByOwner } = require("../services/widgetService");
const { listWebsites } = require("../services/web_ingestion/websiteService");
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
    seedAnalytics();
    const analytics    = getUserAnalytics(userId);
    const userStats    = getUserStats(userId);

    return res.json({
      totalWebsites:  websites.length,
      totalQueries:   userStats.total_queries,
      totalTokens:    userStats.total_tokens,
      queriesToday:   analytics.queriesToday ?? 0,
      // Today's token consumption for this user, sourced from analytics_daily
      tokensToday:    analytics.tokensToday  ?? 0,
      activeWidgets:  widgets.filter((w) => w.status === "active").length,
      recentActivity: [
        ...widgets.slice(0, 2).map((item) => ({ label: item.displayName, type: "Widget",       timestamp: item.updatedAt  || item.createdAt  })),
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load dashboard metrics." });
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
      widget_title: "WebGenius Assistant",
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



    // Group allDaily by date for platform-wide analytics
    const dailyGrouped = {};
    allDaily.forEach((r) => {
      const date = r.date;
      if (!date) return;
      if (!dailyGrouped[date]) {
        dailyGrouped[date] = { date, label: r.label, queries: 0, chats: 0, tokens: 0 };
      }
      dailyGrouped[date].queries += (r.queries || 0);
      dailyGrouped[date].chats += (r.chats || 0);
      dailyGrouped[date].tokens += (r.tokens || 0);
    });
    const dailyAnalytics = Object.values(dailyGrouped)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    // Group allMonthly by month for platform-wide analytics
    const allMonthly = readTable("analytics_monthly");
    const monthlyGrouped = {};
    allMonthly.forEach((r) => {
      const month = r.month;
      if (!month) return;
      if (!monthlyGrouped[month]) {
        monthlyGrouped[month] = { month, label: r.label, queries: 0, chats: 0, tokens: 0 };
      }
      monthlyGrouped[month].queries += (r.queries || 0);
      monthlyGrouped[month].chats += (r.chats || 0);
      monthlyGrouped[month].tokens += (r.tokens || 0);
    });
    const monthlyAnalytics = Object.values(monthlyGrouped)
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    // Summary of collections/websites
    const websitesSummary = allWebsites.map((site) => ({
      id: site.id || site.collection_name,
      domain: site.domain || site.collection_name,
      pageCount: site.page_count || 0,
      status: site.status || "active",
    })).sort((a, b) => b.pageCount - a.pageCount);

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
      },
      dailyAnalytics,
      monthlyAnalytics,
      websitesSummary,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load overview." });
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
    seedAnalytics();
    const analytics     = getUserAnalytics(userId);
    const userStats     = getUserStats(userId);

    return res.json({
      user:          toPublicUser(targetUser),
      totalWebsites: websites.length,
      totalQueries:  userStats.total_queries,
      totalTokens:   userStats.total_tokens,
      queriesToday:  analytics.queriesToday ?? 0,
      tokensToday:   analytics.tokensToday  ?? 0,
      activeWidgets: widgets.filter((w) => w.status === "active").length,
      totalWidgets:  widgets.length,
      widgets,
      websites,
      recentActivity: [
        ...widgets.slice(0, 5).map((item) => ({ label: item.displayName, type: "Widget",       timestamp: item.updatedAt  || item.createdAt  })),
      ],
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load user metrics." });
  }
}

module.exports = {
  adminOverviewController,
  analyticsController,
  dashboardMetricsController,
  saveWidgetSettingsController,
  userMetricsController,
  widgetSettingsController,
};