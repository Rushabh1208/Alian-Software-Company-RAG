const { requestPythonBridge } = require("../utils/runPython");

async function getPromptSettings() {
  return requestPythonBridge({
    method: "GET",
    path: "/prompt-settings",
  });
}

async function updatePromptSettings({ role = "", constraints = [] }) {
  return requestPythonBridge({
    method: "PUT",
    path: "/prompt-settings",
    body: {
      role,
      constraints,
    },
  });
}

module.exports = {
  getPromptSettings,
  updatePromptSettings,
};
