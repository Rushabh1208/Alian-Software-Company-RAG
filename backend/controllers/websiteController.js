const {
  deleteWebsite,
  indexWebsite,
  listWebsites,
} = require("../services/web_ingestion/websiteService");

async function indexWebsiteController(req, res) {
  try {
    const { url, force } = req.body || {};
    if (!url || !String(url).trim()) {
      return res.status(400).json({ error: "Website URL is required." });
    }

    const payload = await indexWebsite({
      url: String(url).trim(),
      force: Boolean(force),
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Indexing failed." });
  }
}

async function listWebsitesController(_req, res) {
  try {
    return res.json(await listWebsites());
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list websites." });
  }
}

async function deleteWebsiteController(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Website id is required." });
    }

    const payload = await deleteWebsite(id);
    return res.json(payload);
  } catch (error) {
    if (error instanceof Error && error.message.includes("cannot be deleted")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
}

module.exports = {
  deleteWebsiteController,
  indexWebsiteController,
  listWebsitesController,
};
