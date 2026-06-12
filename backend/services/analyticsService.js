const { ensureSeeded, nextId, readTable, writeTable } = require("../utils/dbStore");

function getAdminOverviewMetrics() {
  ensureSeeded();
  return {
    totalUsers: readTable("users").length,
    totalWebsites: readTable("websites").length,
    totalChats: readTable("conversations").length,
    activeJobs: readTable("indexing_jobs").filter((job) => job.status === "active").length,
    revenue: 12540,
  };
}

// Record one query event for a user on today's date
function recordDailyQuery(userId) {
  if (!userId) return;
  ensureSeeded();
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const label = new Date().toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
  const rows = readTable("analytics_daily");
  const idx = rows.findIndex((r) => r.user_id === userId && r.date === today);
  if (idx >= 0) {
    rows[idx].queries = (rows[idx].queries || 0) + 1;
    rows[idx].chats = (rows[idx].chats || 0) + 1;
  } else {
    rows.push({
      id: nextId("adly"),
      user_id: userId,
      date: today,
      label,
      queries: 1,
      chats: 1,
    });
  }
  writeTable("analytics_daily", rows);

  // Also update monthly bucket
  const monthKey = today.slice(0, 7); // "YYYY-MM"
  const monthLabel = new Date().toLocaleDateString("en", { month: "short", year: "numeric" });
  const monthly = readTable("analytics_monthly");
  const mi = monthly.findIndex((r) => r.user_id === userId && r.month === monthKey);
  if (mi >= 0) {
    monthly[mi].queries = (monthly[mi].queries || 0) + 1;
    monthly[mi].chats = (monthly[mi].chats || 0) + 1;
  } else {
    monthly.push({
      id: nextId("amly"),
      user_id: userId,
      month: monthKey,
      label: monthLabel,
      queries: 1,
      chats: 1,
    });
  }
  writeTable("analytics_monthly", monthly);
}

function getUserAnalytics(userId) {
  ensureSeeded();
  const today = new Date().toISOString().slice(0, 10);

  // Daily — last 14 days, most recent last
  const allDaily = readTable("analytics_daily")
    .filter((row) => row.user_id === userId)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const daily = allDaily.slice(-14);

  // Weekly — group daily into 7-day buckets
  const weekly = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    weekly.push({
      id: `week_${i}`,
      label: `Week ${Math.floor(i / 7) + 1}`,
      queries: chunk.reduce((s, r) => s + (r.queries || 0), 0),
      chats: chunk.reduce((s, r) => s + (r.chats || 0), 0),
    });
  }

  // Monthly
  const monthly = readTable("analytics_monthly")
    .filter((row) => row.user_id === userId)
    .sort((a, b) => (a.month || "").localeCompare(b.month || ""))
    .slice(-6);

  // queriesToday
  const todayRow = allDaily.find((r) => r.date === today);
  const queriesToday = todayRow?.queries || 0;

  return { daily, weekly, monthly, queriesToday };
}

function seedAnalytics() {
  // No-op: we no longer seed fake data. Real data comes from recordDailyQuery.
}

module.exports = { getAdminOverviewMetrics, getUserAnalytics, recordDailyQuery, seedAnalytics };