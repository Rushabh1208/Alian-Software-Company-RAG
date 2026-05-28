const { runPythonBridge } = require("../utils/runPython");

function askQuestion({ question, topK = 5, collection = "alian_software" }) {
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
