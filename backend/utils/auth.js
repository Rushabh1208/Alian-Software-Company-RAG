const crypto = require("crypto");

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || "voltagent-access-secret";
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || "voltagent-refresh-secret";
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.JWT_ACCESS_TTL_SECONDS || 60 * 60);
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.JWT_REFRESH_TTL_SECONDS || 60 * 60 * 24 * 30);

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function createToken(payload, secret, ttlSeconds) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const signature = signPayload(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

function verifyToken(token, secret) {
  const [header, body, signature] = String(token || "").split(".");
  if (!header || !body || !signature) throw new Error("Invalid token");
  const expected = signPayload(`${header}.${body}`, secret);
  if (expected !== signature) throw new Error("Invalid token");
  const payload = JSON.parse(Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Token expired");
  return payload;
}

function createAccessToken(payload) {
  return createToken(payload, ACCESS_TOKEN_SECRET, ACCESS_TOKEN_TTL_SECONDS);
}

function createRefreshToken(payload) {
  return createToken(payload, REFRESH_TOKEN_SECRET, REFRESH_TOKEN_TTL_SECONDS);
}

function verifyAccessToken(token) {
  return verifyToken(token, ACCESS_TOKEN_SECRET);
}

function verifyRefreshToken(token) {
  return verifyToken(token, REFRESH_TOKEN_SECRET);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  return token || req.cookies?.access_token || null;
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  getBearerToken,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
};
