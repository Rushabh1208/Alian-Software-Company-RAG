const express = require("express");
const { requireRole } = require("../middleware/authMiddleware");
const { listUsersController, updateUserStatusController, deleteUserController } = require("../controllers/userController");
const { listPlansController } = require("../controllers/subscriptionController");
const { getAdminConfigController, updateAdminConfigController } = require("../controllers/adminConfigController");

const router = express.Router();

router.get("/admin/users", requireRole("Admin"), listUsersController);
router.patch("/admin/users/:id/status", requireRole("Admin"), updateUserStatusController);
router.delete("/admin/users/:id", requireRole("Admin"), deleteUserController);
router.get("/admin/subscriptions/plans", requireRole("Admin"), listPlansController);
router.get("/admin/config", requireRole("Admin"), getAdminConfigController);
router.put("/admin/config", requireRole("Admin"), updateAdminConfigController);

module.exports = router;
