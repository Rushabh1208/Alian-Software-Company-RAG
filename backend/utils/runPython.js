const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { getProjectRoot } = require("./paths");

function resolvePythonExecutable() {
  if (process.env.PYTHON && process.env.PYTHON.trim()) {
    return process.env.PYTHON.trim();
  }

  const projectRoot = getProjectRoot();
  const venvPython = path.join(projectRoot, ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) {
    return venvPython;
  }

  return "python";
}

function runPythonBridge(args) {
  const python = resolvePythonExecutable();
  const result = spawnSync(python, ["-m", "rag.api.bridge", ...args], {
    cwd: getProjectRoot(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  });

  if (result.error) {
    throw result.error;
  }

  const stdout = (result.stdout || "").trim();
  const stderr = (result.stderr || "").trim();

  if (result.status !== 0) {
    const missingYaml = /No module named ['"]yaml['"]/.test(stderr) || /No module named ['"]yaml['"]/.test(stdout);
    if (missingYaml) {
      throw new Error(
        "Python dependency missing: PyYAML. Activate the project virtualenv and run `pip install -r requirements.txt`."
      );
    }

    throw new Error(stderr || stdout || `Python bridge exited with an error using ${python}`);
  }

  if (!stdout) {
    return {};
  }

  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse Python bridge output: ${error.message}\n${stdout}`);
  }
}

module.exports = {
  runPythonBridge,
};
