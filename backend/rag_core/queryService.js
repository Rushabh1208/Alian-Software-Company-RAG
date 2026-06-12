// REPLACE entire file content:
const { requestPythonBridge } = require("../utils/runPython");

async function askQuestion({ question, topK = 10, collection = "alian_software", userId = null }) {
  return requestPythonBridge({
    method: "POST",
    path: "/query",
    body: { question, collection, top_k: Number(topK) },
    headers: userId ? { "x-user-id": String(userId) } : {},
  });
}

module.exports = { askQuestion };