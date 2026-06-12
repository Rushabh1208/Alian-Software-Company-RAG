const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const {
  deleteWebsiteController,
  indexWebsiteController,
  listWebsitesController,
  getIndexingStatusController,
  syncCollectionsController,
} = require("../controllers/websiteController");

const router = express.Router();

router.post("/index-website", requireAuth, indexWebsiteController);
router.get("/websites", requireAuth, listWebsitesController);
router.post("/websites/sync", requireAuth, syncCollectionsController);      // ← move this UP
router.delete("/websites/:id", requireAuth, deleteWebsiteController);
router.get("/websites/:id/status", requireAuth, getIndexingStatusController);

module.exports = router;