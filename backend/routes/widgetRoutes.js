const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");

const {
  createWidgetController,
  deleteWidgetController,
  getWidgetController,
  getWidgetSettingsController,
  listWidgetsController,
  saveWidgetSettingsController,
  updateWidgetController,
  widgetChatController,
} = require("../controllers/widgetController");

const router = express.Router();

// ── Public routes — no auth required (used by embedded widget on client sites) ─
router.get("/widgets/:id", getWidgetController);
router.post("/widget/chat", widgetChatController);

// ── Chatbot appearance settings (authenticated) ────────────────────────────────
// Changes here are picked up by embedded widgets automatically within ~20s.
router.get("/widget-settings", requireAuth, getWidgetSettingsController);
router.put("/widget-settings", requireAuth, saveWidgetSettingsController);

// ── Authenticated routes — only the owning user can manage their widgets ───────
router.post("/widgets", requireAuth, createWidgetController);
router.get("/widgets", requireAuth, listWidgetsController);
router.put("/widgets/:id", requireAuth, updateWidgetController);
router.delete("/widgets/:id", requireAuth, deleteWidgetController);

module.exports = router;