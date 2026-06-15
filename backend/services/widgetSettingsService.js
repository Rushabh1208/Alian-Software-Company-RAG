const { ensureSeeded, nextId, readTable, writeTable } = require("../utils/dbStore");

function getWidgetSettings(userId) {
  ensureSeeded();
  return readTable("widget_settings").find((item) => item.user_id === userId) || null;
}

function saveWidgetSettings(userId, payload) {
  ensureSeeded();
  const rows = readTable("widget_settings");
  const now = new Date().toISOString();
  const next = {
    id: nextId("widget_settings"),
    user_id: userId,
    theme: payload.theme || "dark",
    welcome_message: payload.welcomeMessage || "",
    suggested_questions: Array.isArray(payload.suggestedQuestions) ? payload.suggestedQuestions : [],
    widget_title: payload.widgetTitle || "WebGenius Assistant",
    accent_color: payload.accentColor || "#00d992",
    updated_at: now,
  };
  const index = rows.findIndex((item) => item.user_id === userId);
  if (index >= 0) rows[index] = next; else rows.push(next);
  writeTable("widget_settings", rows);
  return next;
}

module.exports = { getWidgetSettings, saveWidgetSettings };
