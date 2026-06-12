const express = require("express");
const { requireRole } = require("../middleware/authMiddleware");
const { listUsersController, updateUserStatusController, deleteUserController } = require("../controllers/userController");
const { listPlansController } = require("../controllers/subscriptionController");

const router = express.Router();

router.get("/admin/users", requireRole("Admin"), listUsersController);
router.patch("/admin/users/:id/status", requireRole("Admin"), updateUserStatusController);
router.delete("/admin/users/:id", requireRole("Admin"), deleteUserController);
router.get("/admin/subscriptions/plans", requireRole("Admin"), listPlansController);

module.exports = router;
