const { randomUUID } = require("crypto");
const { createAccessToken, createRefreshToken, hashPassword, verifyPassword, verifyRefreshToken } = require("../utils/auth");
const { ensureSeeded, nextId, readTable, writeTable } = require("../utils/dbStore");

function getRoleByName(name) {
  ensureSeeded();
  return readTable("roles").find((role) => role.name.toLowerCase() === String(name || "").toLowerCase()) || null;
}

function getUserByEmail(email) {
  ensureSeeded();
  return readTable("users").find((user) => user.email.toLowerCase() === String(email || "").toLowerCase()) || null;
}

function getUserById(id) {
  ensureSeeded();
  return readTable("users").find((user) => user.id === id) || null;
}

function toPublicUser(user) {
  const role = readTable("roles").find((item) => item.id === user.role_id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: role?.name || "User",
    status: user.status,
    lastLoginAt: user.last_login_at || null,
    createdAt: user.created_at,
  };
}

function issueTokenPair(user) {
  const role = readTable("roles").find((item) => item.id === user.role_id);
  const payload = { sub: user.id, roleId: user.role_id, role: role?.name || "User", email: user.email };
  return {
    accessToken: createAccessToken(payload),
    refreshToken: createRefreshToken(payload),
  };
}

function persistRefreshToken(userId, refreshToken) {
  const rows = readTable("refresh_tokens");
  rows.push({ id: nextId("token"), userId, token: refreshToken, createdAt: new Date().toISOString(), revokedAt: null });
  writeTable("refresh_tokens", rows);
}

function register({ name, email, password, role = "User" }) {
  ensureSeeded();
  if (!name || !String(name).trim()) throw new Error("Name is required.");
  if (!email || !String(email).trim()) throw new Error("Email is required.");
  if (!password || String(password).length < 8) throw new Error("Password must be at least 8 characters.");
  if (getUserByEmail(email)) throw new Error("Email already exists.");
  const roleRecord = getRoleByName(role) || getRoleByName("User");
  const now = new Date().toISOString();
  const users = readTable("users");
  const user = {
    id: nextId("user"),
    role_id: roleRecord.id,
    name: String(name).trim(),
    email: String(email).trim().toLowerCase(),
    password_hash: hashPassword(password),
    status: "active",
    created_at: now,
    updated_at: now,
    last_login_at: null,
  };
  users.push(user);
  writeTable("users", users);
  return { user: toPublicUser(user), ...issueTokenPair(user) };
}

function login({ email, password }) {
  ensureSeeded();
  const user = getUserByEmail(email);
  if (!user) throw new Error("Invalid email or password.");
  if (String(user.status) !== "active") throw new Error("User is disabled.");
  if (!verifyPassword(password, user.password_hash)) throw new Error("Invalid email or password.");
  const now = new Date().toISOString();
  const users = readTable("users").map((item) => item.id === user.id ? { ...item, last_login_at: now, updated_at: now } : item);
  writeTable("users", users);
  const refreshedUser = users.find((item) => item.id === user.id);
  const tokens = issueTokenPair(refreshedUser);
  persistRefreshToken(refreshedUser.id, tokens.refreshToken);
  return { user: toPublicUser(refreshedUser), ...tokens };
}

function refresh(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const user = getUserById(payload.sub);
  if (!user || String(user.status) !== "active") throw new Error("Invalid refresh token.");
  return { user: toPublicUser(user), ...issueTokenPair(user) };
}

function logout(refreshToken) {
  const tokens = readTable("refresh_tokens").map((item) => item.token === refreshToken ? { ...item, revokedAt: new Date().toISOString() } : item);
  writeTable("refresh_tokens", tokens);
  return { loggedOut: true };
}

function listUsers() {
  ensureSeeded();
  return readTable("users").map(toPublicUser);
}

function updateUserStatus(userId, status) {
  ensureSeeded();
  const users = readTable("users");
  const index = users.findIndex((user) => user.id === userId);
  if (index < 0) throw new Error("User not found.");
  users[index] = { ...users[index], status: String(status || "active"), updated_at: new Date().toISOString() };
  writeTable("users", users);
  return toPublicUser(users[index]);
}

function deleteUser(userId) {
  ensureSeeded();
  const users = readTable("users");
  const next = users.filter((user) => user.id !== userId);
  if (next.length === users.length) throw new Error("User not found.");
  writeTable("users", next);
  return { deleted: true };
}

module.exports = {
  deleteUser,
  getUserById,
  listUsers,
  login,
  logout,
  refresh,
  register,
  toPublicUser,
  updateUserStatus,
};
