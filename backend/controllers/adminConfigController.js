const { loadAdminConfig, saveAdminConfig } = require("../services/adminConfigService");

function getAdminConfigController(_req, res) {
  try {
    return res.json({ config: loadAdminConfig() });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load admin configuration." });
  }
}

function updateAdminConfigController(req, res) {
  try {
    const patch = req.body || {};
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
      return res.status(400).json({ error: "Configuration payload is required." });
    }
    const updated = saveAdminConfig(patch);
    return res.json({ config: updated });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update admin configuration." });
  }
}

module.exports = {
  getAdminConfigController,
  updateAdminConfigController,
};
