const { runPythonBridge } = require("../utils/runPython");

async function askQuestion({ question, topK = 5, collection = "alian_software" }) {
  return runPythonBridge([
    "query",
    "--question",
    question,
    "--collection",
    collection,
    "--top-k",
    String(topK),
  ]);
}

module.exports = {
  askQuestion,
};
