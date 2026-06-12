// Multi-tenant website ownership service.
//
// In the multi-tenant model, each user gets their OWN isolated collection for
// every website they index. The collection name is user-scoped:
//   website_<slug>_u_<userId>
//
// This means:
//  - Duplicate checks only apply per-user (same user, same URL = duplicate).
//  - Different users indexing the same URL get completely separate collections.
//  - All ownership records track (website_id, owner_id) pairs.
//
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

// Returns the owner user id for a given website/collection id, or null if unowned.
function getWebsiteOwnerId(websiteId) {
  if (!websiteId) return null;
  const record = listOwnershipRecords().find(
    (row) => String(row.website_id) === String(websiteId)
  );
  return record ? record.owner_id : null;
}

// Returns true if the website id is the shared/default base collection.
function isSharedCollection(websiteId) {
  return String(websiteId || "") === DEFAULT_BASE_COLLECTION_NAME;
}

// Records ownership of a website/collection by a user.
// In multi-tenant mode: each (website_id, user_id) pair is unique.
// website_id is already user-scoped (contains user suffix), so this is
// effectively a 1:1 mapping — but we keep the ownership table for fast
// lookup and admin operations.
function claimWebsiteOwnership(websiteId, ownerId, { isAdmin = false } = {}) {
  if (!websiteId) throw new Error("Website id is required.");
  if (isSharedCollection(websiteId)) return; // shared collection — not owned by anyone

  ensureOwnersTable();
  const rows = listOwnershipRecords();
  const existing = rows.find((row) => String(row.website_id) === String(websiteId));

  if (existing) {
    // In multi-tenant mode website_id is already user-scoped, so if there's an
    // existing record with the same website_id but a different owner_id, that
    // would be a data integrity issue — not a normal ownership conflict.
    if (String(existing.owner_id) !== String(ownerId) && !isAdmin) {
      // This should rarely/never happen with user-scoped collection names, but
      // guard it just in case.
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

// Returns the set of website ids owned by the given user.
function listWebsiteIdsForOwner(ownerId) {
  return listOwnershipRecords()
    .filter((row) => String(row.owner_id) === String(ownerId))
    .map((row) => row.website_id);
}

// Removes the ownership record for a website (used on delete).
function removeWebsiteOwnership(websiteId) {
  ensureOwnersTable();
  const rows = listOwnershipRecords();
  const next = rows.filter((row) => String(row.website_id) !== String(websiteId));
  if (next.length !== rows.length) writeTable("website_owners", next);
}

// Core authorization check used by every website-scoped controller.
// With user-scoped collection names, each user can only see/access their own
// collections (name contains their user suffix).
function assertWebsiteAccess(websiteId, { userId, isAdmin = false }) {
  if (isAdmin) return; // admins can access everything
  if (isSharedCollection(websiteId)) return; // shared base collection is readable by all

  const ownerId = getWebsiteOwnerId(websiteId);
  if (!ownerId) {
    // Unowned website — deny for non-admins to prevent cross-tenant access.
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