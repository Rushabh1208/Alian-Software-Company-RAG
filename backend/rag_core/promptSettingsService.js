// backend/rag_core/promptSettingsService.js
//
// Forwards user-specific prompt-settings requests to the Python bridge.
// The authenticated user id is sent as the X-User-Id header so the Python
// layer can scope reads/writes to that user's directory.

const { requestPythonBridge } = require("../utils/runPython");

/**
 * Load prompt settings for a specific user + collection.
 * Falls back to the global collection settings (then defaults) when no
 * user-specific file exists yet.
 *
 * @param {string} collection  - ChromaDB collection / website id
 * @param {string|null} userId - Authenticated user id (from JWT)
 */
async function getPromptSettings(collection = "", userId = null) {
  return requestPythonBridge({
    method: "GET",
    path: `/prompt-settings?collection=${encodeURIComponent(collection)}`,
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

/**
 * Save prompt settings scoped to a specific user + collection.
 *
 * @param {object} options
 * @param {string}   options.collection
 * @param {string}   options.role
 * @param {string[]} options.constraints
 * @param {string|null} options.userId
 */
async function updatePromptSettings({
  collection = "",
  role = "",
  constraints = [],
  userId = null,
}) {
  return requestPythonBridge({
    method: "PUT",
    path: `/prompt-settings?collection=${encodeURIComponent(collection)}`,
    body: { role, constraints },
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

/**
 * Delete the user-specific override and return the effective (fallback) settings.
 *
 * @param {string} collection
 * @param {string|null} userId
 */
async function resetPromptSettings(collection = "", userId = null) {
  return requestPythonBridge({
    method: "DELETE",
    path: `/prompt-settings?collection=${encodeURIComponent(collection)}`,
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

module.exports = {
  getPromptSettings,
  updatePromptSettings,
  resetPromptSettings,
};
