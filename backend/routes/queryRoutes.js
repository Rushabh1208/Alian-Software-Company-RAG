const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const { queryController } = require("../controllers/queryController");

const router = express.Router();

router.post("/query", requireAuth, queryController);

module.exports = router;