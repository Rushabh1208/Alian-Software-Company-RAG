const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const { askQuestion } = require("../rag_core/queryService");
const { loadJsonRecords, saveJsonRecords } = require("../utils/jsonStore");

const WIDGET_STORE_PATH = path.join(__dirname, "..", "..", "data", "widgets", "widgets.json");
const DEFAULT_WIDGET_SCRIPT_URL =
  process.env.WIDGET_SCRIPT_URL || "http://localhost:3001/widget.js";
const DEFAULT_WIDGET_API_BASE_URL =
  process.env.WIDGET_API_BASE_URL || process.env.API_BASE_URL || "http://localhost:5000";
const DEFAULT_WIDGET_COLLECTION = "alian_software";

function ensureWidgetStoreSeeded() {
  const directory = path.dirname(WIDGET_STORE_PATH);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  if (!fs.existsSync(WIDGET_STORE_PATH)) {
    saveJsonRecords(WIDGET_STORE_PATH, []);
  }
}

function readWidgets() {
  ensureWidgetStoreSeeded();
  const records = loadJsonRecords(WIDGET_STORE_PATH);
  return Array.isArray(records) ? records : [];
}

function listWidgets() {
  return readWidgets()
    .map(toStoredWidget)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
}

// Returns only widgets belonging to the given user.
function listWidgetsByOwner(ownerId) {
  return listWidgets().filter((w) => String(w.ownerId || "") === String(ownerId || ""));
}

function writeWidgets(records) {
  ensureWidgetStoreSeeded();
  saveJsonRecords(WIDGET_STORE_PATH, records);
}

function generateWidgetId(existingWidgets) {
  const existingIds = new Set(existingWidgets.map((item) => String(item.widgetId || item.id || "")));
  let widgetId = "";
  do {
    widgetId = `widget_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  } while (existingIds.has(widgetId));
  return widgetId;
}

function humanizeLabel(value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) return "Default Collection";
  if (normalizedValue === DEFAULT_WIDGET_COLLECTION) return "Default Collection";
  return String(value || "")
    .replace(/^website_/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function resolveDisplayName({ collection, displayName }) {
  const normalizedDisplayName = String(displayName || "").trim();
  if (normalizedDisplayName) return normalizedDisplayName;
  const normalizedCollection = String(collection || "").trim();
  if (!normalizedCollection) return "Chatbot";
  return humanizeLabel(normalizedCollection);
}

function toStoredWidget(record) {
  return {
    widgetId: String(record.widgetId || record.id || ""),
    ownerId: String(record.ownerId || record.owner_id || ""),           // <-- multi-tenant owner field
    collection: String(record.collection || DEFAULT_WIDGET_COLLECTION),
    displayName: String(record.displayName || humanizeLabel(record.collection || DEFAULT_WIDGET_COLLECTION)),
    status: String(record.status || "active"),
    createdAt: String(record.createdAt || ""),
    updatedAt: String(record.updatedAt || ""),
    mappingVersion: String(record.mappingVersion || record.updatedAt || record.createdAt || ""),
  };
}

function toPublicWidgetConfig(record) {
  const widget = toStoredWidget(record);
  return {
    widgetId: widget.widgetId,
    ownerId: widget.ownerId,
    collection: widget.collection,
    displayName: widget.displayName,
    status: widget.status,
    mappingVersion: widget.mappingVersion,
  };
}

function buildWidgetScript(widgetId) {
  const attrs = [`data-widget-id="${widgetId}"`];
  if (DEFAULT_WIDGET_API_BASE_URL) {
    attrs.push(`data-api-base-url="${DEFAULT_WIDGET_API_BASE_URL}"`);
  }
  return `<script src="${DEFAULT_WIDGET_SCRIPT_URL}" ${attrs.join(" ")}></script>`;
}

function findWidgetRecord(widgetId) {
  const widgetList = listWidgets();
  return widgetList.find((item) => String(item.widgetId || item.id || "") === String(widgetId || "")) || null;
}

// Find a widget only if it belongs to the given owner — used for authenticated mutations.
function findWidgetByOwner(widgetId, ownerId) {
  const widget = findWidgetRecord(widgetId);
  if (!widget) return null;
  // Widgets without an ownerId are treated as unowned (legacy data); allow access.
  if (widget.ownerId && String(widget.ownerId) !== String(ownerId || "")) return null;
  return widget;
}

function createWidget({ collection, displayName, status, ownerId }) {
  const widgetList = readWidgets().map(toStoredWidget);
  const widgetId = generateWidgetId(widgetList);
  const now = new Date().toISOString();
  const record = {
    widgetId,
    ownerId: String(ownerId || ""),
    collection: String(collection || DEFAULT_WIDGET_COLLECTION).trim() || DEFAULT_WIDGET_COLLECTION,
    displayName: resolveDisplayName({ collection, displayName }),
    status: String(status || "active").trim() || "active",
    createdAt: now,
    updatedAt: now,
    mappingVersion: now,
  };

  widgetList.push(record);
  writeWidgets(widgetList);
  return record;
}

function updateWidget(widgetId, updates, ownerId) {
  const widgetList = readWidgets().map(toStoredWidget);
  const index = widgetList.findIndex((item) => String(item.widgetId) === String(widgetId || ""));
  if (index < 0) throw new Error(`Widget ${widgetId} not found.`);

  const current = widgetList[index];

  // Ownership check: if ownerId is provided, enforce it (skip for legacy unowned widgets).
  if (ownerId && current.ownerId && String(current.ownerId) !== String(ownerId)) {
    throw new Error(`Widget ${widgetId} not found.`);
  }

  const nextCollection = String(updates.collection || current.collection || DEFAULT_WIDGET_COLLECTION).trim() || DEFAULT_WIDGET_COLLECTION;
  const nextDisplayName = Object.prototype.hasOwnProperty.call(updates, "displayName")
    ? resolveDisplayName({ collection: nextCollection, displayName: updates.displayName })
    : resolveDisplayName({ collection: nextCollection });
  const nextStatus = String(updates.status || current.status || "active").trim() || "active";
  const now = new Date().toISOString();

  const updated = {
    ...current,
    collection: nextCollection,
    displayName: nextDisplayName,
    status: nextStatus,
    updatedAt: now,
    mappingVersion: now,
  };

  widgetList[index] = updated;
  writeWidgets(widgetList);
  return updated;
}

async function queryWidget(widgetId, message) {
  const widget = findWidgetRecord(widgetId);
  if (!widget) throw new Error(`Widget ${widgetId} not found.`);
  const resolvedCollection = String(widget.collection || "").trim();

  if (String(widget.status || "active") !== "active") {
    throw new Error("This widget is currently inactive.");
  }

  const payload = await askQuestion({
    question: message,
    collection: resolvedCollection,
    topK: 5,
  });

  return {
    answer: String(payload?.result?.answer || payload?.answer || "I don't know based on indexed content."),
  };
}

function deleteWidget(widgetId, ownerId) {
  const widgetList = readWidgets().map(toStoredWidget);
  const index = widgetList.findIndex((item) => String(item.widgetId) === String(widgetId || ""));
  if (index < 0) throw new Error(`Widget ${widgetId} not found.`);

  const target = widgetList[index];
  // Ownership check: enforce if ownerId provided and widget has an owner.
  if (ownerId && target.ownerId && String(target.ownerId) !== String(ownerId)) {
    throw new Error(`Widget ${widgetId} not found.`);
  }

  const removed = widgetList.splice(index, 1)[0];
  writeWidgets(widgetList);
  return removed;
}

/**
 * Remove all widget records whose collection is not in the provided set of
 * valid collection names.
 */
function pruneWidgetsForCollections(validCollectionNames) {
  const validSet = new Set(Array.isArray(validCollectionNames) ? validCollectionNames.map(String) : []);
  const widgetList = readWidgets().map(toStoredWidget);
  const kept = widgetList.filter((w) => validSet.has(String(w.collection || "")));
  if (kept.length !== widgetList.length) writeWidgets(kept);
  return kept;
}

module.exports = {
  buildWidgetScript,
  createWidget,
  deleteWidget,
  findWidgetByOwner,
  findWidgetRecord,
  listWidgets,
  listWidgetsByOwner,
  pruneWidgetsForCollections,
  queryWidget,
  toPublicWidgetConfig,
  updateWidget,
};
