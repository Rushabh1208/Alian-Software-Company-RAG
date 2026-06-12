const { getCurrentUserFromRequest } = require("../services/sessionService");

async function sessionController(req, res) {
  try {
    const current = getCurrentUserFromRequest(req);
    if (!current) return res.status(401).json({ error: "Unauthorized." });
    return res.json(current);
  } catch (error) {
    return res.status(401).json({ error: error.message || "Unauthorized." });
  }
}

module.exports = { sessionController };
