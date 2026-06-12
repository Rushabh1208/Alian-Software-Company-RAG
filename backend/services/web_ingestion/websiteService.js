const { runPythonBridge, requestPythonBridge } = require("../../utils/runPython");

async function indexWebsite({ url, force = false, userId = null }) {
  return requestPythonBridge({
    method: "POST",
    path: "/index-website",
    body: {
      url: String(url).trim(),
      force: Boolean(force),
    },
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

async function listWebsites({ userId = null } = {}) {
  return requestPythonBridge({
    method: "GET",
    path: "/websites",
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

async function deleteWebsite(id, { userId = null } = {}) {
  return requestPythonBridge({
    method: "DELETE",
    path: `/websites/${encodeURIComponent(id)}`,
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

module.exports = {
  deleteWebsite,
  indexWebsite,
  listWebsites,
};