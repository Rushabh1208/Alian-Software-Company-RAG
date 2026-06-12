// Multi-tenant website ownership service.
//
// In the multi-tenant model, each user gets their own isolated collection for
// every website they index. The collection name is user-scoped:
//   website_<slug>_u_<userId>
//
// This means:
//  - Duplicate checks only apply per-user (same user, same URL = duplicate).
//  - Different users indexing the same URL get completely separate collections.
//  - All ownership records track (website_id, owner_id) pairs.
const { ensureSeeded, nextId, readTable, writeTable } = require("../utils/dbStore");

const DEFAULT_BASE_COLLECTION_NAME = "alian_software";

function ensureOwnersTable() {
  ensureSeeded();
  const { tablePath } = require("../utils/dbStore");
  const fs = require("fs");
  if (!fs.existsSync(tablePath("website_owners"))) {
    writeTable("website_owners", []);
  }
}

function listOwnershipRecords() {
  ensureOwnersTable();
  return readTable("website_owners");
}

function getWebsiteOwnerId(websiteId) {
  if (!websiteId) return null;
  const record = listOwnershipRecords().find(
    (row) => String(row.website_id) === String(websiteId)
  );
  return record ? record.owner_id : null;
}

function isSharedCollection(_websiteId) {
  return false;
}

function claimWebsiteOwnership(websiteId, ownerId, { isAdmin = false } = {}) {
  if (!websiteId) throw new Error("Website id is required.");

  ensureOwnersTable();
  const rows = listOwnershipRecords();
  const existing = rows.find((row) => String(row.website_id) === String(websiteId));

  if (existing) {
    if (String(existing.owner_id) !== String(ownerId) && !isAdmin) {
      throw new Error("This website is already owned by another user.");
    }
    return existing;
  }

  const record = {
    id: nextId("wowner"),
    website_id: String(websiteId),
    owner_id: String(ownerId),
    created_at: new Date().toISOString(),
  };
  rows.push(record);
  writeTable("website_owners", rows);
  return record;
}

function listWebsiteIdsForOwner(ownerId) {
  return listOwnershipRecords()
    .filter((row) => String(row.owner_id) === String(ownerId))
    .map((row) => row.website_id);
}

function removeWebsiteOwnership(websiteId) {
  ensureOwnersTable();
  const rows = listOwnershipRecords();
  const next = rows.filter((row) => String(row.website_id) !== String(websiteId));
  if (next.length !== rows.length) writeTable("website_owners", next);
}

function assertWebsiteAccess(websiteId, { userId, isAdmin = false }) {
  if (isAdmin) return;

  const ownerId = getWebsiteOwnerId(websiteId);
  if (!ownerId) {
    const error = new Error("Website not found.");
    error.statusCode = 404;
    throw error;
  }
  if (String(ownerId) !== String(userId)) {
    const error = new Error("Website not found.");
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  DEFAULT_BASE_COLLECTION_NAME,
  assertWebsiteAccess,
  claimWebsiteOwnership,
  getWebsiteOwnerId,
  isSharedCollection,
  listOwnershipRecords,
  listWebsiteIdsForOwner,
  removeWebsiteOwnership,
};
