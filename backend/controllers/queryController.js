const { askQuestion } = require("../rag_core/queryService");
const { assertWebsiteAccess } = require("../services/websiteOwnershipService");
const { recordDailyQuery } = require("../services/analyticsService");
const { incrementUserStats } = require("../services/conversationService");

async function queryController(req, res) {
  try {
    const { question, topK, websiteId, collection } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    const targetCollection = String(collection || websiteId || "").trim();
    if (!targetCollection) {
      return res.status(400).json({ error: "Collection is required." });
    }

    const userId  = req.auth?.sub || req.auth?.userId || null;
    const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";

    try {
      assertWebsiteAccess(targetCollection, { userId, isAdmin });
    } catch (accessError) {
      return res.status(accessError.statusCode || 403).json({ error: accessError.message });
    }

    // Run the query first so we have the real token count from the LLM response
    const payload = await askQuestion({
      question: String(question),
      topK: Number(topK || 10),
      collection: targetCollection,
      userId,
    });

    // Record daily analytics AFTER the response so we can pass the actual
    // token count (input + output) returned by the Python RAG layer.
    // Falls back to 0 gracefully if the metrics field is absent.
    if (userId) {
      const tokensUsed = Number(payload?.result?.metrics?.total_tokens || 0);
      recordDailyQuery(userId, tokensUsed);
      incrementUserStats(userId, { queries: 1, tokens: tokensUsed });
    }

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Query failed." });
  }
}

module.exports = { queryController };