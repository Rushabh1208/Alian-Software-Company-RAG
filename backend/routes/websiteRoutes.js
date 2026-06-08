const express = require("express");
const {
  deleteWebsiteController,
  indexWebsiteController,
  listWebsitesController,
  getIndexingStatusController,
  syncCollectionsController,
} = require("../controllers/websiteController");

const router = express.Router();

router.post("/index-website", indexWebsiteController);
router.get("/websites", listWebsitesController);
router.post("/websites/sync", syncCollectionsController);      // ← move this UP
router.delete("/websites/:id", deleteWebsiteController);
router.get("/websites/:id/status", getIndexingStatusController);

module.exports = router;