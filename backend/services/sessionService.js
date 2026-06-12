const { verifyAccessToken } = require("../utils/auth");
const { getUserById, toPublicUser } = require("./authService");

function getCurrentUserFromRequest(req) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return null;
  const payload = verifyAccessToken(token);
  const user = getUserById(payload.sub);
  return user ? { user: toPublicUser(user), role: payload.role } : null;
}

module.exports = { getCurrentUserFromRequest };
