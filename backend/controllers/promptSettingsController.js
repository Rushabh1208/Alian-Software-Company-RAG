const {
  getPromptSettings,
  updatePromptSettings,
} = require("../rag_core/promptSettingsService");

async function getPromptSettingsController(_req, res) {
  try {
    return res.json(await getPromptSettings());
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load prompt settings." });
  }
}

async function updatePromptSettingsController(req, res) {
  try {
    const { role, constraints } = req.body || {};
    const payload = await updatePromptSettings({
      role: typeof role === "string" ? role : "",
      constraints: Array.isArray(constraints) ? constraints : [],
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save prompt settings." });
  }
}

module.exports = {
  getPromptSettingsController,
  updatePromptSettingsController,
};
