const { runPythonBridge } = require("../../utils/runPython");

async function indexWebsite({ url, force = false }) {
  return runPythonBridge([
    "index-website",
    "--url",
    url,
    ...(force ? ["--force"] : []),
  ]);
}

async function listWebsites() {
  return runPythonBridge(["list-websites"]);
}

async function deleteWebsite(id) {
  return runPythonBridge(["delete-website", "--id", id]);
}

module.exports = {
  deleteWebsite,
  indexWebsite,
  listWebsites,
};
