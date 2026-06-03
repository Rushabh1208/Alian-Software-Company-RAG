const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

export function queryRag({ question, websiteId, topK = 5 }) {
  return request("/api/query", {
    method: "POST",
    body: JSON.stringify({ question, websiteId, topK }),
  });
}

export function indexWebsite(url) {
  return request("/api/index-website", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function getWebsites() {
  return request("/api/websites");
}

export function deleteWebsite(id) {
  return request(`/api/websites/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getWidgets() {
  return request("/api/widgets");
}

export function createWidget({ collection, displayName, status = "active" }) {
  return request("/api/widgets", {
    method: "POST",
    body: JSON.stringify({
      collection,
      displayName,
      status,
    }),
  });
}

export function updateWidget(widgetId, { collection, displayName, status = "active" }) {
  return request(`/api/widgets/${encodeURIComponent(widgetId)}`, {
    method: "PUT",
    body: JSON.stringify({
      collection,
      displayName,
      status,
    }),
  });
}

export function getPromptSettings() {
  return request("/api/prompt-settings");
}

export function updatePromptSettings({ role, constraints }) {
  return request("/api/prompt-settings", {
    method: "PUT",
    body: JSON.stringify({
      role,
      constraints,
    }),
  });
}

export function resetPromptSettings() {
  return updatePromptSettings({
    role: "",
    constraints: [],
  });
}

export { API_BASE_URL };
