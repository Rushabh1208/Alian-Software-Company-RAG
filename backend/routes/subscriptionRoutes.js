const express = require("express");
const { getMySubscriptionController, listPlansController } = require("../controllers/subscriptionController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/subscriptions/plans", listPlansController);
router.get("/subscriptions/me", requireAuth, getMySubscriptionController);

module.exports = router;
