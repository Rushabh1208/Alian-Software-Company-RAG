const express = require("express");
const {
  getPromptSettingsController,
  updatePromptSettingsController,
} = require("../controllers/promptSettingsController");

const router = express.Router();

router.get("/prompt-settings", getPromptSettingsController);
router.put("/prompt-settings", updatePromptSettingsController);

module.exports = router;
