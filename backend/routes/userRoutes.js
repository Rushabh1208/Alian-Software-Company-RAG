const express = require("express");
const { deleteUserController, listUsersController, updateUserStatusController } = require("../controllers/userController");
const { requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/users", requireRole("Admin"), listUsersController);
router.patch("/users/:id/status", requireRole("Admin"), updateUserStatusController);
router.delete("/users/:id", requireRole("Admin"), deleteUserController);

module.exports = router;
