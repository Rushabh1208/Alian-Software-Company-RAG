// backend/routes/promptSettingsRoutes.js

const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const {
  getPromptSettingsController,
  updatePromptSettingsController,
  resetPromptSettingsController,
} = require("../controllers/promptSettingsController");

const router = express.Router();

// Load prompt settings for the authenticated user's selected collection.
router.get("/prompt-settings", requireAuth, getPromptSettingsController);

// Save updated prompt settings for the authenticated user + collection.
router.put("/prompt-settings", requireAuth, updatePromptSettingsController);

// Delete the user-specific override and fall back to global/defaults.
router.delete("/prompt-settings", requireAuth, resetPromptSettingsController);

module.exports = router;