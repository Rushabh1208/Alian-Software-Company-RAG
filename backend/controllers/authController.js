const { login, logout, refresh, register } = require("../services/authService");

function getAuthCookieOptions() {
  return { httpOnly: true, sameSite: "lax", secure: false };
}

function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie?.("access_token", accessToken, { ...getAuthCookieOptions(), maxAge: 1000 * 60 * 60 });
  res.cookie?.("refresh_token", refreshToken, { ...getAuthCookieOptions(), maxAge: 1000 * 60 * 60 * 24 * 30 });
}

async function registerController(req, res) {
  try {
    const payload = register(req.body || {});
    setAuthCookies(res, payload);
    return res.status(201).json(payload);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function loginController(req, res) {
  try {
    const payload = login(req.body || {});
    setAuthCookies(res, payload);
    return res.json(payload);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function logoutController(req, res) {
  try {
    const payload = logout(req.body?.refreshToken || req.cookies?.refresh_token);
    res.clearCookie?.("access_token");
    res.clearCookie?.("refresh_token");
    return res.json(payload);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

async function refreshController(req, res) {
  try {
    const payload = refresh(req.body?.refreshToken || req.cookies?.refresh_token);
    setAuthCookies(res, payload);
    return res.json(payload);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
}

module.exports = {
  loginController,
  logoutController,
  refreshController,
  registerController,
};
