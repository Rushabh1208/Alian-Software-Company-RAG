const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function getStoredToken() {
  try {
    return localStorage.getItem("webgenius_access_token") || "";
  } catch {
    return "";
  }
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const token = getStoredToken();
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function setStoredAuth({ accessToken, refreshToken, user }) {
  try {
    if (accessToken) localStorage.setItem("webgenius_access_token", accessToken);
    if (refreshToken) localStorage.setItem("webgenius_refresh_token", refreshToken);
    if (user) localStorage.setItem("webgenius_user", JSON.stringify(user));
  } catch {}
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem("webgenius_access_token");
    localStorage.removeItem("webgenius_refresh_token");
    localStorage.removeItem("webgenius_user");
  } catch {}
}

export function loadStoredAuth() {
  try {
    const user = JSON.parse(localStorage.getItem("webgenius_user") || "null");
    return {
      accessToken: localStorage.getItem("webgenius_access_token") || "",
      refreshToken: localStorage.getItem("webgenius_refresh_token") || "",
      user: user || null,
    };
  } catch {
    return { accessToken: "", refreshToken: "", user: null };
  }
}

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem("webgenius_refresh_token") || "";
  } catch {
    return "";
  }
}

export function decodeJwt(token) {
  try {
    const [, body] = String(token || "").split(".");
    if (!body) return null;
    return JSON.parse(atob(body.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

export function isTokenExpired(token) {
  const payload = decodeJwt(token);
  return !payload?.exp || Date.now() / 1000 >= payload.exp;
}

export function loginApi(payload) {
  return request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function registerApi(payload) {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) });
}

export function refreshSessionApi(refreshToken) {
  return request("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken }) });
}

export function logoutApi(refreshToken) {
  return request("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
}

export function getSessionApi() {
  return request("/api/auth/session");
}

export function getMeApi() {
  return request("/api/me");
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
  return request(`/api/websites/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function syncWebsites() {
  return request("/api/websites/sync", { method: "POST" });
}

export function getIndexingStatus(collectionId) {
  return request(`/api/websites/${encodeURIComponent(collectionId)}/status`);
}

export function deleteWidget(widgetId) {
  return request(`/api/widgets/${encodeURIComponent(widgetId)}`, { method: "DELETE" });
}

export function getWidgets() {
  return request("/api/widgets");
}

export function createWidget({ collection, displayName, status = "active" }) {
  return request("/api/widgets", {
    method: "POST",
    body: JSON.stringify({ collection, displayName, status }),
  });
}

export function updateWidget(widgetId, { collection, displayName, status = "active" }) {
  return request(`/api/widgets/${encodeURIComponent(widgetId)}`, {
    method: "PUT",
    body: JSON.stringify({ collection, displayName, status }),
  });
}

export function getPromptSettings(collection) {
  const qs = collection ? `?collection=${encodeURIComponent(collection)}` : "";
  return request(`/api/prompt-settings${qs}`);
}

export function updatePromptSettings({ role, constraints, collection }) {
  const qs = collection ? `?collection=${encodeURIComponent(collection)}` : "";
  return request(`/api/prompt-settings${qs}`, {
    method: "PUT",
    body: JSON.stringify({ role, constraints }),
  });
}

export function resetPromptSettings(collection) {
  return updatePromptSettings({ role: "", constraints: [], collection });
}

export function checkGuardrails({ role, constraints }) {
  return request("/api/guardrails/check", {
    method: "POST",
    body: JSON.stringify({ role, constraints }),
  });
}

export function listUsersApi() {
  return request("/api/users");
}

export function updateUserStatusApi(id, status) {
  return request(`/api/users/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteUserApi(id) {
  return request(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getUserMetricsApi(id) {
  return request(`/api/admin/users/${encodeURIComponent(id)}/metrics`);
}
export function adminWebsitesApi() {
  return request("/api/admin/websites");
}

export function adminReindexWebsiteApi(id) {
  return request(`/api/admin/websites/${encodeURIComponent(id)}/reindex`, { method: "POST" });
}

export function adminDeleteWebsiteApi(id) {
  return request(`/api/admin/websites/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getUserAnalyticsApi() {
  return request("/api/dashboard/analytics");
}


export function getWidgetSettingsApi() {
  return request("/api/widget-settings");
}

export function updateWidgetSettingsApi(body) {
  return request("/api/widget-settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function getDashboardMetricsApi() {
  return request("/api/dashboard/metrics");
}

export function getAdminOverviewApi() {
  return request("/api/admin/overview");
}

export function getAdminConfigApi() {
  return request("/api/admin/config");
}

export function updateAdminConfigApi(body) {
  return request("/api/admin/config", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}




export { API_BASE_URL };
// ── User-scoped chat storage API ──────────────────────────────────────────────

/** List all conversations (with messages) for the current authenticated user */
export function listChatsApi() {
  return request("/api/chats");
}

/** Create a new conversation for the current user */
export function createChatApi({ title, source = "Dashboard" }) {
  return request("/api/chats", {
    method: "POST",
    body: JSON.stringify({ title, source }),
  });
}

/** Rename a conversation */
export function updateChatApi(id, { title }) {
  return request(`/api/chats/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

/** Delete a conversation and all its messages */
export function deleteChatApi(id) {
  return request(`/api/chats/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** Append a message to a conversation */
export function addMessageApi(chatId, { role, content }) {
  return request(`/api/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ role, content }),
  });
}
