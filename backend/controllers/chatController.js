const {
  addChatMessage,
  assertOwnership,
  createConversation,
  deleteConversation,
  listChatMessages,
  listConversations,
  updateConversationTitle,
} = require("../services/conversationService");

function getUserId(req) {
  const id = req.auth?.sub || req.auth?.userId || null;
  if (!id) {
    const err = new Error("Unauthorized.");
    err.statusCode = 401;
    throw err;
  }
  return id;
}

// GET /api/chats  → list all conversations for the current user
async function listChatsController(req, res) {
  try {
    const userId = getUserId(req);
    const conversations = listConversations(userId).map((conv) => ({
      ...conv,
      messages: listChatMessages(conv.id),
    }));
    return res.json({ conversations });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to list chats." });
  }
}

// POST /api/chats  → create a new conversation
async function createChatController(req, res) {
  try {
    const userId = getUserId(req);
    const { title, source } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "title is required." });
    }
    const conversation = createConversation({ userId, title, source });
    return res.status(201).json({ conversation: { ...conversation, messages: [] } });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to create chat." });
  }
}

// GET /api/chats/:id  → get single conversation (messages included)
async function getChatController(req, res) {
  try {
    const userId = getUserId(req);
    const conversation = assertOwnership(req.params.id, userId);
    return res.json({ conversation: { ...conversation, messages: listChatMessages(conversation.id) } });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to get chat." });
  }
}

// PATCH /api/chats/:id  → update conversation title
async function updateChatController(req, res) {
  try {
    const userId = getUserId(req);
    const { title } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: "title is required." });
    }
    const conversation = updateConversationTitle(req.params.id, userId, title);
    return res.json({ conversation: { ...conversation, messages: listChatMessages(conversation.id) } });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to update chat." });
  }
}

// DELETE /api/chats/:id  → delete conversation + all its messages
async function deleteChatController(req, res) {
  try {
    const userId = getUserId(req);
    deleteConversation(req.params.id, userId);
    return res.status(204).end();
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to delete chat." });
  }
}

// POST /api/chats/:id/messages  → append a user/assistant message
async function addMessageController(req, res) {
  try {
    const userId = getUserId(req);
    const { role, content } = req.body || {};
    if (!role || !content) {
      return res.status(400).json({ error: "role and content are required." });
    }
    const message = addChatMessage({ conversationId: req.params.id, userId, role, content });
    return res.status(201).json({ message });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to add message." });
  }
}

module.exports = {
  addMessageController,
  createChatController,
  deleteChatController,
  getChatController,
  listChatsController,
  updateChatController,
};