const fs = require("fs");
const path = require("path");

function loadJsonRecords(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function saveJsonRecords(filePath, records) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const payload = JSON.stringify(Array.isArray(records) ? records : [], null, 2);
  fs.writeFileSync(filePath, payload, "utf8");
}

module.exports = {
  loadJsonRecords,
  saveJsonRecords,
};
