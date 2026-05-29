const { askQuestion } = require("../rag_core/queryService");

async function queryController(req, res) {
  try {
    const { question, topK, websiteId, collection } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    const payload = await askQuestion({
      question: String(question),
      topK: Number(topK || 5),
      collection: String(collection || websiteId || "alian_software"),
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Query failed." });
  }
}

module.exports = {
  queryController,
};
