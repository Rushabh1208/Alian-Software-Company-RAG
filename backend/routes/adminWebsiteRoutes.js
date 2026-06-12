const express = require("express");
const { requireRole } = require("../middleware/authMiddleware");
const {
  deleteAdminWebsiteController,
  listAdminWebsitesController,
  reindexWebsiteController,
} = require("../controllers/adminWebsiteController");

const router = express.Router();

router.get("/admin/websites", requireRole("Admin"), listAdminWebsitesController);
router.post("/admin/websites/:id/reindex", requireRole("Admin"), reindexWebsiteController);
router.delete("/admin/websites/:id", requireRole("Admin"), deleteAdminWebsiteController);

module.exports = router;
