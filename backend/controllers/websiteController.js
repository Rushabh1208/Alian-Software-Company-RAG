const {
  deleteWebsite,
  indexWebsite,
  listWebsites,
} = require("../services/web_ingestion/websiteService");
const { runPythonBridge } = require("../utils/runPython");
const { pruneWidgetsForCollections } = require("../services/widgetService");
const {
  assertWebsiteAccess,
  claimWebsiteOwnership,
  isSharedCollection,
  listWebsiteIdsForOwner,
  removeWebsiteOwnership,
} = require("../services/websiteOwnershipService");

function authContext(req) {
  const userId = req.auth?.sub || req.auth?.userId || null;
  const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";
  return { userId, isAdmin };
}

async function indexWebsiteController(req, res) {
  try {
    const { url, force } = req.body || {};
    if (!url || !String(url).trim()) {
      return res.status(400).json({ error: "Website URL is required." });
    }

    const { userId, isAdmin } = authContext(req);

    // Pass userId to Python so it generates a user-scoped collection name.
    // This ensures each user gets their own isolated collection even for the
    // same URL — no cross-tenant conflicts are possible.
    const payload = await indexWebsite({
      url: String(url).trim(),
      force: Boolean(force),
      userId,
    });

    // Record ownership for the newly indexed website so that all subsequent
    // reads/queries/deletes are scoped to this user.
    const collectionName = payload?.collection_name || payload?.website?.id;
    if (collectionName && userId) {
      claimWebsiteOwnership(collectionName, userId, { isAdmin });
    }

    return res.json(payload);
  } catch (error) {
    if (String(error.message || "").includes("already owned by another user")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Indexing failed." });
  }
}

// List only the websites owned by the requesting user (plus the shared base
// collection). Admins see everything.
async function listWebsitesController(req, res) {
  try {
    const { userId, isAdmin } = authContext(req);

    // Pass userId so Python can filter to user-owned collections when needed.
    const payload = await listWebsites({ userId: isAdmin ? null : userId });
    const allWebsites = Array.isArray(payload?.websites) ? payload.websites : [];

    if (isAdmin) {
      return res.json(payload);
    }

    const ownedIds = new Set(listWebsiteIdsForOwner(userId));
    const filtered = allWebsites.filter((site) => {
      const id = String(site.id || site.collection_name || "");
      return isSharedCollection(id) || ownedIds.has(id);
    });

    return res.json({ ...payload, websites: filtered });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list websites." });
  }
}

async function deleteWebsiteController(req, res) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: "Website id is required." });
    }

    const { userId, isAdmin } = authContext(req);
    assertWebsiteAccess(id, { userId, isAdmin });

    const payload = await deleteWebsite(id, { userId });
    removeWebsiteOwnership(id);

    // Prune any saved widgets whose collection no longer exists
    try {
      const remaining = await listWebsites({ userId: isAdmin ? null : userId });
      const validCollections = (remaining.websites || []).map((w) => w.collection_name).filter(Boolean);
      pruneWidgetsForCollections(validCollections);
    } catch (_pruneErr) {
      // Non-fatal — widget pruning failure should not block the delete response
    }

    return res.json(payload);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    if (error instanceof Error && error.message.includes("cannot be deleted")) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Delete failed." });
  }
}

const getIndexingStatusController = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, isAdmin } = authContext(req);
    assertWebsiteAccess(id, { userId, isAdmin });

    const result = await runPythonBridge(["get-indexing-status", "--collection", id]);
    res.json(result);
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

const syncCollectionsController = async (req, res) => {
  try {
    const { isAdmin } = authContext(req);
    if (!isAdmin) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const result = await runPythonBridge(["sync-collections"]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


module.exports = {
  deleteWebsiteController,
  indexWebsiteController,
  getIndexingStatusController,
  syncCollectionsController,
  listWebsitesController,
};