const { deleteUser, listUsers, updateUserStatus } = require("../services/authService");
const { getAllUserStats } = require("../services/conversationService");

async function listUsersController(req, res) {
  try {
    const currentUserId = req.auth?.sub || req.auth?.userId || null;
    const users = listUsers().filter((user) => user.id !== currentUserId);
    const allStats = getAllUserStats();
    const statsMap = Object.fromEntries(allStats.map((s) => [s.user_id, s]));
    const usersWithStats = users.map((user) => ({
      ...user,
      totalQueries: statsMap[user.id]?.total_queries ?? 0,
      totalTokens: statsMap[user.id]?.total_tokens ?? 0,
    }));
    return res.json({ users: usersWithStats });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list users." });
  }
}

async function updateUserStatusController(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    return res.json({ user: updateUserStatus(id, status) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function deleteUserController(req, res) {
  try {
    const { id } = req.params;
    return res.json(deleteUser(id));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

module.exports = { deleteUserController, listUsersController, updateUserStatusController };