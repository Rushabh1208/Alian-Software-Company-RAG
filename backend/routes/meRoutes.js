const express = require("express");
const { meController } = require("../controllers/meController");

const router = express.Router();

router.get("/me", meController);

module.exports = router;
