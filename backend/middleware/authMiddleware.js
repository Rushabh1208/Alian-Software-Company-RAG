const { getBearerToken, verifyAccessToken } = require("../utils/auth");
const { readTable } = require("../utils/dbStore");

function getRoleName(roleId) {
  const roles = readTable("roles");
  return roles.find((role) => role.id === roleId)?.name || null;
}

function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Authentication required." });
    const payload = verifyAccessToken(token);
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: error.message || "Invalid token." });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    try {
      const token = getBearerToken(req);
      if (!token) return res.status(401).json({ error: "Authentication required." });
      const payload = verifyAccessToken(token);
      const roleName = getRoleName(payload.roleId);
      if (!allowedRoles.includes(roleName)) {
        return res.status(403).json({ error: "Forbidden." });
      }
      req.auth = payload;
      req.authRole = roleName;
      next();
    } catch (error) {
      return res.status(401).json({ error: error.message || "Invalid token." });
    }
  };
}

module.exports = { requireAuth, requireRole };
