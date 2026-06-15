const express = require("express");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const {
  analyticsController,
  dashboardMetricsController,
  saveWidgetSettingsController,
  widgetSettingsController,

  adminOverviewController,
  userMetricsController,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/dashboard/metrics", requireAuth, dashboardMetricsController);

router.get("/dashboard/analytics", requireAuth, analyticsController);
router.get("/widget-settings", requireAuth, widgetSettingsController);
router.put("/widget-settings", requireAuth, saveWidgetSettingsController);

router.get("/admin/overview", requireRole("Admin"), adminOverviewController);

router.get("/admin/users/:id/metrics", requireRole("Admin"), userMetricsController);

module.exports = router;