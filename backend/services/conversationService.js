const { nextId, readTable, writeTable, ensureSeeded } = require("../utils/dbStore");
const { recordDailyQuery } = require("./analyticsService");

// ── User stats helpers ─────────────────────────────────────────────────────────

function ensureUserStatsTable() {
  ensureSeeded();
  // readTable safely returns [] if the file doesn't exist yet
}

function getUserStats(userId) {
  ensureUserStatsTable();
  const rows = readTable("user_stats");
  const stat = rows.find((r) => r.user_id === userId) || { user_id: userId, total_queries: 0, total_tokens: 0 };

  // Self-healing: Ensure lifetime stats are at least the sum of daily analytics
  const dailyRows = readTable("analytics_daily").filter((r) => r.user_id === userId);
  const dailyTokensSum = dailyRows.reduce((sum, r) => sum + (r.tokens || 0), 0);
  const dailyQueriesSum = dailyRows.reduce((sum, r) => sum + (r.queries || 0), 0);

  if (dailyTokensSum > stat.total_tokens || dailyQueriesSum > stat.total_queries) {
    stat.total_tokens = Math.max(stat.total_tokens, dailyTokensSum);
    stat.total_queries = Math.max(stat.total_queries, dailyQueriesSum);

    const idx = rows.findIndex((r) => r.user_id === userId);
    if (idx >= 0) {
      rows[idx].total_tokens = stat.total_tokens;
      rows[idx].total_queries = stat.total_queries;
      rows[idx].updated_at = new Date().toISOString();
      writeTable("user_stats", rows);
    } else {
      rows.push({
        id: nextId("stat"),
        user_id: userId,
        total_queries: stat.total_queries,
        total_tokens: stat.total_tokens,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      writeTable("user_stats", rows);
    }
  }
  return stat;
}

function incrementUserStats(userId, { queries = 0, tokens = 0 }) {
  ensureUserStatsTable();
  const rows = readTable("user_stats");
  const idx = rows.findIndex((r) => r.user_id === userId);
  if (idx >= 0) {
    rows[idx].total_queries += queries;
    rows[idx].total_tokens += tokens;
    rows[idx].updated_at = new Date().toISOString();
  } else {
    rows.push({
      id: nextId("stat"),
      user_id: userId,
      total_queries: queries,
      total_tokens: tokens,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  writeTable("user_stats", rows);
}

function getAllUserStats() {
  ensureUserStatsTable();
  return readTable("user_stats");
}

// Rough token estimator: ~4 chars per token (GPT-style approximation)
function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}


function ensureConversationData() {
  ensureSeeded();
}

// ── List ──────────────────────────────────────────────────────────────────────

function listConversations(userId = null) {
  ensureConversationData();
  const conversations = readTable("conversations");
  return userId ? conversations.filter((item) => item.user_id === userId) : conversations;
}

function listChatMessages(conversationId) {
  ensureConversationData();
  return readTable("chat_messages").filter((item) => item.conversation_id === conversationId);
}

// ── Ownership guard ───────────────────────────────────────────────────────────

function getConversationById(conversationId) {
  ensureConversationData();
  return readTable("conversations").find((c) => c.id === conversationId) || null;
}

function assertOwnership(conversationId, userId) {
  const conversation = getConversationById(conversationId);
  if (!conversation) {
    const err = new Error("Conversation not found.");
    err.statusCode = 404;
    throw err;
  }
  if (conversation.user_id !== userId) {
    const err = new Error("Forbidden.");
    err.statusCode = 403;
    throw err;
  }
  return conversation;
}

// ── Create ────────────────────────────────────────────────────────────────────

function createConversation({ userId, title, source = "Dashboard" }) {
  ensureConversationData();
  if (!userId) throw new Error("userId is required.");
  if (!title || !String(title).trim()) throw new Error("title is required.");
  const now = new Date().toISOString();
  const conversation = {
    id: nextId("conv"),
    user_id: userId,
    title: String(title).trim(),
    source,
    created_at: now,
    updated_at: now,
  };
  const rows = readTable("conversations");
  rows.push(conversation);
  writeTable("conversations", rows);
  return conversation;
}

// ── Update title ──────────────────────────────────────────────────────────────

function updateConversationTitle(conversationId, userId, title) {
  assertOwnership(conversationId, userId);
  if (!title || !String(title).trim()) throw new Error("title is required.");
  const rows = readTable("conversations");
  const idx = rows.findIndex((c) => c.id === conversationId);
  rows[idx].title = String(title).trim();
  rows[idx].updated_at = new Date().toISOString();
  writeTable("conversations", rows);
  return rows[idx];
}

// ── Add message ───────────────────────────────────────────────────────────────

function addChatMessage({ conversationId, userId, role, content }) {
  assertOwnership(conversationId, userId);
  if (!["user", "assistant"].includes(role)) throw new Error("Invalid role.");
  if (!content || !String(content).trim()) throw new Error("content is required.");
  const now = new Date().toISOString();
  const message = {
    id: nextId("msg"),
    conversation_id: conversationId,
    role,
    content: String(content).trim(),
    created_at: now,
  };
  const rows = readTable("chat_messages");
  rows.push(message);
  writeTable("chat_messages", rows);

  // Track usage stats permanently (survives chat deletion)
  // Each assistant message = 1 query consumed; tokens = combined user+assistant content
  if (role === "assistant") {
    // Token usage and queries are now logged centrally in queryController
    // to prevent double-counting and to use the exact LLM token metrics.
  }

  // bump conversation updated_at
  const convRows = readTable("conversations");
  const ci = convRows.findIndex((c) => c.id === conversationId);
  if (ci >= 0) {
    convRows[ci].updated_at = now;
    writeTable("conversations", convRows);
  }

  return message;
}

// ── Delete conversation (cascade messages) ────────────────────────────────────

function deleteConversation(conversationId, userId) {
  assertOwnership(conversationId, userId);
  const convRows = readTable("conversations").filter((c) => c.id !== conversationId);
  writeTable("conversations", convRows);
  const msgRows = readTable("chat_messages").filter((m) => m.conversation_id !== conversationId);
  writeTable("chat_messages", msgRows);
}

// ── Seed (dashboard stats compat) ─────────────────────────────────────────────

function seedConversationStats() {
  const conversations = readTable("conversations");
  if (conversations.length) return conversations;
  const now = new Date().toISOString();
  const seeded = [
    { id: nextId("conv"), user_id: "user_seed", title: "Widget integration", source: "Website widget", created_at: now, updated_at: now },
    { id: nextId("conv"), user_id: "user_seed", title: "Search relevance", source: "Dashboard", created_at: now, updated_at: now },
  ];
  writeTable("conversations", seeded);
  return seeded;
}

module.exports = {
  addChatMessage,
  assertOwnership,
  createConversation,
  deleteConversation,
  getAllUserStats,
  getConversationById,
  getUserStats,
  incrementUserStats,
  listChatMessages,
  listConversations,
  seedConversationStats,
  updateConversationTitle,
};