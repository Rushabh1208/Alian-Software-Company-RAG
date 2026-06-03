const express = require("express");

const {
  createWidgetController,
  getWidgetController,
  listWidgetsController,
  updateWidgetController,
  widgetChatController,
} = require("../controllers/widgetController");

const router = express.Router();

router.post("/widgets", createWidgetController);
router.get("/widgets", listWidgetsController);
router.get("/widgets/:id", getWidgetController);
router.put("/widgets/:id", updateWidgetController);
router.post("/widget/chat", widgetChatController);

module.exports = router;
