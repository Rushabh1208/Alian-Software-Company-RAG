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

    const payload = indexWebsite({
      url: String(url).trim(),
      force: Boolean(force),
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Indexing failed." });
  }
}

function listWebsitesController(_req, res) {
  try {
    return res.json(listWebsites());
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list websites." });
  }
}

function deleteWebsiteController(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Website id is required." });
    }

    const payload = deleteWebsite(id);
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
