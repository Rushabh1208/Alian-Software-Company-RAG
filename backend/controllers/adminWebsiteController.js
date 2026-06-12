const { listWebsites, deleteWebsite } = require("../services/web_ingestion/websiteService");
const { runPythonBridge } = require("../utils/runPython");

async function listAdminWebsitesController(_req, res) {
  try {
    return res.json(await listWebsites());
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list websites." });
  }
}

async function reindexWebsiteController(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Website id is required." });
    const result = await runPythonBridge(["sync-collections"]);
    return res.json({ websiteId: id, reindexed: true, result });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to reindex website." });
  }
}

async function deleteAdminWebsiteController(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Website id is required." });
    const payload = await deleteWebsite(id);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
}

module.exports = {
  deleteAdminWebsiteController,
  listAdminWebsitesController,
  reindexWebsiteController,
};
