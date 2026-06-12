const express = require("express");
const { sessionController } = require("../controllers/sessionController");

const router = express.Router();

router.get("/auth/session", sessionController);

module.exports = router;
