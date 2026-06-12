const fs = require("fs");
const path = require("path");

const ADMIN_CONFIG_PATH = path.join(__dirname, "..", "..", "data", "admin_config.json");

const DEFAULT_ADMIN_CONFIG = {
  prompt_seed: {
    role:
      "You are a friendly, helpful website assistant. You speak naturally like a real customer support representative. You are warm, professional, concise and easy to understand. You help users find information available on the website while maintaining a natural conversation.",
    constraints: [
      "Answer only using information supported by the website knowledge.",
      "Speak naturally like a real customer support representative.",
      "Be warm, friendly and professional.",
      "Address the user directly using 'you' and 'your'.",
      "Write short paragraphs or clean bullet points.",
      "Never create large walls of text.",
      "If information exists, answer confidently.",
      "If information is partial, share what is available.",
      "If related information exists, use it to provide guidance.",
      "Always try to be helpful before refusing.",
      "Never mention chunks, context, retrieval, sources or internal systems.",
      "Never expose technical implementation details.",
      "Never invent facts not supported by retrieved information.",
    ],
  },
  ingestion: {
    chunk_size: 500,
    chunk_overlap: 100,
    batch_size: 100,
    batch_pause_seconds: 5,
    embedding_batch_size: 32,
    max_retries: 3,
    backoff_multiplier: 2,
    timeout: 30,
    recursive_fallback_depth: 2,
    recursive_fallback_pages: 80,
    max_backoff_seconds: 120,
    rate_limit_retries: 5,
    rate_limit_base_seconds: 30,
  },
  retrieval: {
    vector_top_k: 20,
    final_top_k: 5,
    max_search_distance: 1.15,
  },
  reranking: {
    enabled: true,
    backend: "auto",
    model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
  },
  embedding: {
    provider: "huggingface",
    model: "BAAI/bge-small-en-v1.5",
    batch_size: 32,
    normalize_embeddings: true,
  },
  registration: {
    enabled: true,
    signup_default_model: "gemini-3.1-flash-lite",
    signup_default_token_limit: 50000,
    max_website_contexts_per_user: 2,
    max_chatbots_per_user: 2,
    cooldown_minutes: 120,
  },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureAdminConfigFile() {
  const directory = path.dirname(ADMIN_CONFIG_PATH);
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(ADMIN_CONFIG_PATH)) {
    fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(DEFAULT_ADMIN_CONFIG, null, 2), "utf8");
  }
}

function loadAdminConfig() {
  ensureAdminConfigFile();
  const rawText = fs.readFileSync(ADMIN_CONFIG_PATH, "utf8").trim();
  if (!rawText) {
    return deepClone(DEFAULT_ADMIN_CONFIG);
  }
  let raw;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return deepClone(DEFAULT_ADMIN_CONFIG);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return deepClone(DEFAULT_ADMIN_CONFIG);
  }
  return mergeAdminConfig(DEFAULT_ADMIN_CONFIG, raw);
}

function saveAdminConfig(patch) {
  const current = loadAdminConfig();
  const next = mergeAdminConfig(current, patch || {});
  fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function mergeAdminConfig(base, patch) {
  const result = deepClone(base);
  if (!patch || typeof patch !== "object") return result;

  for (const [section, values] of Object.entries(patch)) {
    if (!result[section] || !values || typeof values !== "object" || Array.isArray(values)) {
      continue;
    }
    const mergedSection = { ...result[section] };
    for (const [key, value] of Object.entries(values)) {
      if (!(key in mergedSection)) continue;
      mergedSection[key] = coerceValue(mergedSection[key], value);
    }
    result[section] = mergedSection;
  }

  return result;
}

function coerceValue(fallback, value) {
  if (typeof fallback === "boolean") {
    return Boolean(value);
  }
  if (typeof fallback === "number") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  if (Array.isArray(fallback)) {
    if (!Array.isArray(value)) return fallback;
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value ?? fallback);
}

module.exports = {
  ADMIN_CONFIG_PATH,
  DEFAULT_ADMIN_CONFIG,
  loadAdminConfig,
  saveAdminConfig,
};
