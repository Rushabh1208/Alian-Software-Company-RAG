function normalizeCollectionName(name) {
  return String(name || "").trim().toLowerCase();
}

module.exports = {
  normalizeCollectionName,
};
