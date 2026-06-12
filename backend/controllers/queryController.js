const { askQuestion } = require("../rag_core/queryService");
const { assertWebsiteAccess, DEFAULT_BASE_COLLECTION_NAME } = require("../services/websiteOwnershipService");
const { recordDailyQuery } = require("../services/analyticsService");

async function queryController(req, res) {
  try {
    const { question, topK, websiteId, collection } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    const targetCollection = String(collection || websiteId || DEFAULT_BASE_COLLECTION_NAME);
    const userId = req.auth?.sub || req.auth?.userId || null;
    const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";

    try {
      assertWebsiteAccess(targetCollection, { userId, isAdmin });
    } catch (accessError) {
      return res.status(accessError.statusCode || 403).json({ error: accessError.message });
    }

    // Record daily analytics for this user
    if (userId) recordDailyQuery(userId);

    const payload = await askQuestion({
      question: String(question),
      topK: Number(topK || 10),
      collection: targetCollection,
      userId,
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Query failed." });
  }
}

module.exports = { queryController };