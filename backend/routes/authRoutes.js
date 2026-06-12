const express = require("express");
const { loginController, logoutController, refreshController, registerController } = require("../controllers/authController");

const router = express.Router();

router.post("/auth/register", registerController);
router.post("/auth/login", loginController);
router.post("/auth/logout", logoutController);
router.post("/auth/refresh", refreshController);

module.exports = router;
