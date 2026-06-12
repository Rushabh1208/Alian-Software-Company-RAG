const express = require("express");
const { requireAuth } = require("../middleware/authMiddleware");
const {
  addMessageController,
  createChatController,
  deleteChatController,
  getChatController,
  listChatsController,
  updateChatController,
} = require("../controllers/chatController");

const router = express.Router();

// All routes require a valid JWT — userId is extracted from req.auth.sub
router.get("/chats", requireAuth, listChatsController);
router.post("/chats", requireAuth, createChatController);
router.get("/chats/:id", requireAuth, getChatController);
router.patch("/chats/:id", requireAuth, updateChatController);
router.delete("/chats/:id", requireAuth, deleteChatController);
router.post("/chats/:id/messages", requireAuth, addMessageController);

module.exports = router;