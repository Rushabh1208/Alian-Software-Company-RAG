const path = require("path");

function getProjectRoot() {
  return path.resolve(__dirname, "..", "..");
}

module.exports = {
  getProjectRoot,
};
