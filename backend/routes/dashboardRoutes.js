const express = require("express");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");
const {
  analyticsController,
  conversationsController,
  dashboardMetricsController,
  saveWidgetSettingsController,
  widgetSettingsController,
  adminHealthController,
  adminJobsController,
  adminOverviewController,
  adminSubscriptionsController,
  userMetricsController,
} = require("../controllers/dashboardController");

const router = express.Router();

router.get("/dashboard/metrics", requireAuth, dashboardMetricsController);
router.get("/conversations", requireAuth, conversationsController);
router.get("/dashboard/analytics", requireAuth, analyticsController);
router.get("/widget-settings", requireAuth, widgetSettingsController);
router.put("/widget-settings", requireAuth, saveWidgetSettingsController);

router.get("/admin/overview", requireRole("Admin"), adminOverviewController);
router.get("/admin/jobs", requireRole("Admin"), adminJobsController);
router.get("/admin/system-health", requireRole("Admin"), adminHealthController);
router.get("/admin/subscriptions", requireRole("Admin"), adminSubscriptionsController);
router.get("/admin/users/:id/metrics", requireRole("Admin"), userMetricsController);

module.exports = router;