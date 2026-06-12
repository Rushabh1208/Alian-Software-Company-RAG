// backend/controllers/promptSettingsController.js
//
// Extracts the authenticated user id from the JWT and passes it through
// to the service layer so each user gets isolated prompt settings.

const {
  getPromptSettings,
  updatePromptSettings,
  resetPromptSettings,
} = require("../rag_core/promptSettingsService");
const { assertWebsiteAccess } = require("../services/websiteOwnershipService");

function authContext(req) {
  const userId = req.auth?.sub || req.auth?.userId || null;
  const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";
  return { userId, isAdmin };
}

function resolveCollection(req) {
  return String(req.query?.collection || req.body?.collection || "").trim();
}

// GET /api/prompt-settings?collection=<id>
async function getPromptSettingsController(req, res) {
  try {
    const collection = resolveCollection(req);
    if (!collection) {
      return res.status(400).json({ error: "Collection is required." });
    }
    const { userId, isAdmin } = authContext(req);
    assertWebsiteAccess(collection, { userId, isAdmin });

    return res.json(await getPromptSettings(collection, userId));
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Failed to load prompt settings." });
  }
}

// PUT /api/prompt-settings?collection=<id>
async function updatePromptSettingsController(req, res) {
  try {
    const collection = resolveCollection(req);
    if (!collection) {
      return res.status(400).json({ error: "Collection is required." });
    }
    const { userId, isAdmin } = authContext(req);
    assertWebsiteAccess(collection, { userId, isAdmin });

    const { role, constraints } = req.body || {};
    const payload = await updatePromptSettings({
      collection,
      role: typeof role === "string" ? role : "",
      constraints: Array.isArray(constraints) ? constraints : [],
      userId,
    });
    return res.json(payload);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Failed to save prompt settings." });
  }
}

// DELETE /api/prompt-settings?collection=<id>
// Removes the user-specific override; the effective (fallback) settings are returned.
async function resetPromptSettingsController(req, res) {
  try {
    const collection = resolveCollection(req);
    if (!collection) {
      return res.status(400).json({ error: "Collection is required." });
    }
    const { userId, isAdmin } = authContext(req);
    assertWebsiteAccess(collection, { userId, isAdmin });

    const payload = await resetPromptSettings(collection, userId);
    return res.json(payload);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Failed to reset prompt settings." });
  }
}

module.exports = {
  getPromptSettingsController,
  updatePromptSettingsController,
  resetPromptSettingsController,
};
