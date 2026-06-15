const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { loadJsonRecords, saveJsonRecords } = require("./jsonStore");

const DB_DIR = path.join(__dirname, "..", "data", "db");

function ensureDbDir() {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function tablePath(name) {
  return path.join(DB_DIR, `${name}.json`);
}

function readTable(name) {
  ensureDbDir();
  return loadJsonRecords(tablePath(name));
}

function writeTable(name, rows) {
  ensureDbDir();
  saveJsonRecords(tablePath(name), rows);
}

function ensureSeeded() {
  const seedPath = path.join(DB_DIR, "seed.json");
  const seed = fs.existsSync(seedPath) ? JSON.parse(fs.readFileSync(seedPath, "utf8")) : { roles: [], plans: [] };
  if (!fs.existsSync(tablePath("roles"))) writeTable("roles", seed.roles || []);
  if (!fs.existsSync(tablePath("users"))) writeTable("users", []);
  if (!fs.existsSync(tablePath("websites"))) writeTable("websites", []);
  if (!fs.existsSync(tablePath("website_indexes"))) writeTable("website_indexes", []);
  if (!fs.existsSync(tablePath("api_keys"))) writeTable("api_keys", []);
  if (!fs.existsSync(tablePath("notifications"))) writeTable("notifications", []);
  if (!fs.existsSync(tablePath("refresh_tokens"))) writeTable("refresh_tokens", []);
  if (!fs.existsSync(tablePath("conversations"))) writeTable("conversations", []);
  if (!fs.existsSync(tablePath("chat_messages"))) writeTable("chat_messages", []);
  if (!fs.existsSync(tablePath("widget_settings"))) writeTable("widget_settings", []);
  if (!fs.existsSync(tablePath("analytics"))) writeTable("analytics", []);
  if (!fs.existsSync(tablePath("analytics_daily"))) writeTable("analytics_daily", []);
  if (!fs.existsSync(tablePath("analytics_monthly"))) writeTable("analytics_monthly", []);
  if (!fs.existsSync(tablePath("indexing_jobs"))) writeTable("indexing_jobs", []);
  if (!fs.existsSync(tablePath("website_owners"))) writeTable("website_owners", []);
  if (!fs.existsSync(tablePath("user_stats"))) writeTable("user_stats", []);
}

function nextId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

module.exports = {
  ensureSeeded,
  nextId,
  readTable,
  writeTable,
  tablePath,
};