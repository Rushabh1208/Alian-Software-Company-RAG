const express = require("express");
const { queryController } = require("../controllers/queryController");

const router = express.Router();

router.post("/query", queryController);

module.exports = router;
