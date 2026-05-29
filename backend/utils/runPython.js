const { URL } = require("url");

const defaultBaseUrl = process.env.RAG_PYTHON_API_URL || "http://127.0.0.1:8000";
const defaultTimeoutMs = Number(process.env.RAG_PYTHON_API_TIMEOUT_MS || 30000);
const fetchFn = typeof fetch !== "undefined" ? fetch : require("undici").fetch;

function parseArgs(args) {
  const data = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case "--question":
        data.question = String(args[index + 1] || "");
        index += 1;
        break;
      case "--collection":
        data.collection = String(args[index + 1] || "");
        index += 1;
        break;
      case "--top-k":
        data.top_k = Number(args[index + 1] || 5);
        index += 1;
        break;
      case "--url":
        data.url = String(args[index + 1] || "");
        index += 1;
        break;
      case "--id":
        data.id = String(args[index + 1] || "");
        index += 1;
        break;
      case "--force":
        data.force = true;
        break;
      default:
        break;
    }
  }
  return data;
}

function buildRequest(args) {
  const command = String(args[0] || "").trim();
  const parsed = parseArgs(args.slice(1));

  switch (command) {
    case "query":
      return {
        method: "POST",
        path: "/query",
        body: {
          question: parsed.question,
          collection: parsed.collection,
          top_k: parsed.top_k ?? 5,
        },
      };
    case "index-website":
      return {
        method: "POST",
        path: "/index-website",
        body: {
          url: parsed.url,
          force: Boolean(parsed.force),
        },
      };
    case "list-websites":
      return {
        method: "GET",
        path: "/websites",
      };
    case "delete-website": {
      if (!parsed.id) {
        throw new Error("Missing website id for delete-website command.");
      }
      return {
        method: "DELETE",
        path: `/websites/${encodeURIComponent(parsed.id)}`,
      };
    }
    default:
      throw new Error(`Unsupported bridge command: ${command}`);
  }
}

async function runPythonBridge(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error("runPythonBridge requires an args array.");
  }

  const request = buildRequest(args);
  const url = new URL(request.path, defaultBaseUrl).toString();
  const headers = { "Accept": "application/json" };
  const options = {
    method: request.method,
    headers,
  };

  if (request.body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(request.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), defaultTimeoutMs);
  options.signal = controller.signal;

  let response;
  try {
    response = await fetchFn(url, options);
  } catch (error) {
    throw new Error(`Failed to reach Python bridge at ${url}: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`Invalid JSON response from Python bridge: ${error.message}`);
  }

  if (!response.ok) {
    const message = payload.detail || payload.error || JSON.stringify(payload);
    throw new Error(`Python bridge error: ${message}`);
  }

  return payload;
}

module.exports = {
  runPythonBridge,
};
