(() => {
  const currentScript =
    document.currentScript ||
    Array.from(document.scripts)
      .slice()
      .reverse()
      .find((script) => script.dataset && script.dataset.widgetId);

  if (!currentScript) {
    return;
  }

  const widgetId = String(currentScript.dataset.widgetId || "").trim();
  const apiBaseUrl = (() => {
    const explicitBaseUrl = String(currentScript.dataset.apiBaseUrl || "").trim().replace(/\/+$/, "");
    if (explicitBaseUrl) {
      return explicitBaseUrl;
    }

    try {
      const scriptUrl = new URL(currentScript.src, window.location.href);
      const scriptOrigin = `${scriptUrl.protocol}//${scriptUrl.host}`;
      if (scriptOrigin === window.location.origin) {
        return scriptOrigin;
      }
    } catch (_error) {
      // Ignore URL parsing issues and fall through to the guard below.
    }

    return "";
  })();

  if (!widgetId) {
    return;
  }

  if (!apiBaseUrl) {
    console.error("RAG widget: missing api base url. Provide data-api-base-url on the script tag.");
    return;
  }

  const storageKey = `rag-widget:${apiBaseUrl}:${widgetId}`;
  const rootSelector = `[data-rag-widget-root="${widgetId}"]`;
  const existingRoot = document.querySelector(rootSelector);
  if (existingRoot) {
    existingRoot.remove();
  }

  const root = document.createElement("div");
  root.setAttribute("data-rag-widget-root", widgetId);

  // Always mount on <body> so the fixed-position widget is visible regardless
  // of where in the HTML the <script> tag is placed (head, body, deferred, etc.)
  function mountRoot() {
    if (document.body) {
      document.body.appendChild(root);
    } else {
      // Script ran before body exists — wait for it.
      document.addEventListener("DOMContentLoaded", () => {
        document.body.appendChild(root);
        bootstrap();
      }, { once: true });
      return false; // signal: bootstrap will be called by the listener
    }
    return true;
  }
  if (!mountRoot()) return; // early return; bootstrap deferred to DOMContentLoaded

  const state = {
    config: {
      widgetId,
      collection: "",
      displayName: "Chatbot",
      status: "active",
      mappingVersion: "",
    },
    widgetSettings: {
      theme: "dark",
      accentColor: "#00d992",
      welcomeMessage: "",
      suggestedQuestions: [],
      widgetTitle: "Voltagent Assistant",
    },
    sessions: [],
    currentSessionId: null,
    view: "chat",
    input: "",
    loading: false,
    open: false,
    ready: false,
    error: "",
  };

  let refreshTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatTimeStamp(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }

  function formatDateGroup(value) {
    const now = new Date();
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Older";
    }

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessionDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today.getTime() - sessionDay.getTime()) / 86400000);

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return "Older";
  }

  function summarizeTitle(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) {
      return "New Chat";
    }

    if (normalized.length <= 42) {
      return normalized;
    }

    return `${normalized.slice(0, 39).trim()}...`;
  }

  function createSession(overrides = {}) {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      title: overrides.title || overrides.name || "New Chat",
      collection: overrides.collection || state.config.collection,
      collectionLabel: overrides.collectionLabel || state.config.displayName,
      createdAt: overrides.createdAt || now,
      updatedAt: overrides.updatedAt || now,
      messages: Array.isArray(overrides.messages) ? overrides.messages : [],
    };
  }

  function ensureActiveSession(nextSessions = state.sessions) {
    if (!Array.isArray(nextSessions) || !nextSessions.length) {
      const session = createSession();
      state.sessions = [session];
      state.currentSessionId = session.id;
      return session;
    }

    const current = nextSessions.find((session) => session.id === state.currentSessionId);
    if (current) {
      return current;
    }

    state.currentSessionId = nextSessions[0].id;
    return nextSessions[0];
  }

  function getCurrentSession() {
    return ensureActiveSession();
  }

  function persistState() {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          sessions: state.sessions,
          currentSessionId: state.currentSessionId,
          view: state.view,
          widgetSettings: state.widgetSettings,
        })
      );
    } catch (_error) {
      // Ignore persistence failures.
    }
  }

    

  function loadState() {
     try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.sessions) && parsed.sessions.length) {
        state.sessions = parsed.sessions.map((session) => ({
          ...createSession(session),
          ...session,
          messages: Array.isArray(session.messages) ? session.messages : [],
        }));
      }

      if (typeof parsed.currentSessionId === "string") {
        state.currentSessionId = parsed.currentSessionId;
      }

      if (parsed.view === "history" || parsed.view === "chat") {
        state.view = parsed.view;
      }

      // Restore saved theme/accent so applyTheme() in bootstrap uses the
      // correct values immediately — before refreshConfig() returns.
      if (parsed.widgetSettings && typeof parsed.widgetSettings === "object") {
        const ws = parsed.widgetSettings;
        state.widgetSettings = {
          theme: ws.theme === "dark" || ws.theme === "light" ? ws.theme : state.widgetSettings.theme,
          accentColor: typeof ws.accentColor === "string" && ws.accentColor ? ws.accentColor : state.widgetSettings.accentColor,
          welcomeMessage: typeof ws.welcomeMessage === "string" ? ws.welcomeMessage : state.widgetSettings.welcomeMessage,
          suggestedQuestions: Array.isArray(ws.suggestedQuestions) ? ws.suggestedQuestions : state.widgetSettings.suggestedQuestions,
          widgetTitle: typeof ws.widgetTitle === "string" && ws.widgetTitle ? ws.widgetTitle : state.widgetSettings.widgetTitle,
        };
      }
    } catch (_error) {
      // Ignore bad persistence payloads.
    }
  }

    

  function setState(nextState, options = {}) {
    Object.assign(state, nextState);
    if (options.persist !== false) {
      persistState();
    }
    render();
  }

  function updateSession(sessionId, updater) {
    const nextSessions = state.sessions.map((session) => {
      if (session.id !== sessionId) {
        return session;
      }
      return typeof updater === "function" ? updater(session) : { ...session, ...updater };
    });
    state.sessions = nextSessions;
    ensureActiveSession(nextSessions);
    persistState();
    render();
  }

  function addMessage(sessionId, message) {
    updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: new Date().toISOString(),
      messages: [...session.messages, message],
    }));
  }

  function replaceMessage(sessionId, messageId, nextMessage) {
    updateSession(sessionId, (session) => ({
      ...session,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message) => (message.id === messageId ? nextMessage : message)),
    }));
  }

  function syncCurrentSessionCollection() {
    const currentSession = getCurrentSession();
    updateSession(currentSession.id, (session) => ({
      ...session,
      collection: state.config.collection,
      collectionLabel: state.config.displayName,
    }));
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
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

  async function refreshConfig() {
    try {
      const payload = await requestJson(`/api/widgets/${encodeURIComponent(widgetId)}`);
      state.config = {
        widgetId: String(payload.widgetId || widgetId),
        collection: String(payload.collection || state.config.collection || ""),
        displayName: String(payload.displayName || state.config.displayName || "Chatbot"),
        status: String(payload.status || state.config.status || "active"),
        mappingVersion: String(payload.mappingVersion || state.config.mappingVersion || ""),
      };

      // Apply widget appearance settings when included in the config response.
      if (payload.widgetSettings) {
        const ws = payload.widgetSettings;
        state.widgetSettings = {
          theme: String(ws.theme || state.widgetSettings.theme || "dark"),
          accentColor: String(ws.accentColor || state.widgetSettings.accentColor || "#00d992"),
          welcomeMessage: String(ws.welcomeMessage ?? state.widgetSettings.welcomeMessage ?? ""),
          suggestedQuestions: Array.isArray(ws.suggestedQuestions)
            ? ws.suggestedQuestions
            : state.widgetSettings.suggestedQuestions,
          widgetTitle: String(ws.widgetTitle || state.widgetSettings.widgetTitle || "Voltagent Assistant"),
        };
        applyTheme();
      }

      syncCurrentSessionCollection();
      state.ready = true;
      state.error = "";
      persistState();
      render();
    } catch (_error) {
      if (!state.ready) {
        state.ready = true;
        render();
      }
    }
  }

  // Inject / update CSS custom properties on the widget root so theme and accent
  // color changes take effect without a full re-render.
  function applyTheme() {
    const ws = state.widgetSettings;
    const accent = ws.accentColor || "#00d992";
    const isDark = ws.theme === "dark";

    const styleId = `rag-widget-theme-vars-${widgetId}`;
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      [data-rag-widget-root="${widgetId}"] {
        --rag-accent: ${accent};
        --rag-accent-shadow: ${accent}42;
        --rag-panel-bg: ${isDark ? "#0f1720" : "#ffffff"};
        --rag-panel-border: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(18,24,32,0.08)"};
        --rag-title-color: ${isDark ? "#ffffff" : "#0f1720"};
        --rag-subtitle-color: ${isDark ? "#94a3b8" : "#667085"};
        --rag-body-color: ${isDark ? "#cbd5e1" : "#374151"};
        --rag-msg-bg: ${isDark ? "rgba(255,255,255,0.06)" : "rgba(15,23,32,0.05)"};
        --rag-input-bg: ${isDark ? "rgba(255,255,255,0.06)" : "#f9fafb"};
        --rag-input-border: ${isDark ? "rgba(255,255,255,0.10)" : "rgba(18,24,32,0.10)"};
        --rag-chip-border: ${isDark ? "rgba(255,255,255,0.14)" : "rgba(18,24,32,0.14)"};
        --rag-chip-bg: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,32,0.06)"};
        --rag-chip-color: ${isDark ? "#ffffff" : "#0f1720"};
        --rag-surface-bg: ${isDark ? "rgba(255,255,255,0.04)" : "rgba(15,23,32,0.03)"};
        --rag-surface-border: ${isDark ? "rgba(255,255,255,0.08)" : "rgba(15,23,32,0.08)"};
        --rag-heading-color: ${isDark ? "#94a3b8" : "#667085"};
        --rag-user-bubble-bg: ${isDark ? "rgba(255,255,255,0.10)" : "linear-gradient(135deg, rgba(0,0,0,0.04), rgba(0,0,0,0.02))"};
        --rag-user-bubble-border: ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)"};
        --rag-composer-bg: ${isDark ? "rgba(15,23,32,0.4)" : "rgba(255,255,255,0.92)"};
        --rag-text-color: ${isDark ? "#e5e7eb" : "#101418"};
        --rag-destructive-bg: ${isDark ? "rgba(248,113,113,0.14)" : "rgba(208,46,61,0.08)"};
        --rag-destructive-color: ${isDark ? "#fca5a5" : "#b42318"};
        --rag-header-bg: ${accent}22;
        --rag-header-border: ${accent}44;
        --rag-chip-accent-border: ${accent}66;
        --rag-chip-accent-bg: ${accent}11;
      }
    `;
  }

  function setCurrentSession(sessionId) {
    state.currentSessionId = sessionId;
    state.view = "chat";
    state.input = "";
    ensureActiveSession();
    persistState();
    render();
  }

  function newChat() {
    const session = createSession();
    state.sessions = [session, ...state.sessions];
    state.currentSessionId = session.id;
    state.view = "chat";
    state.input = "";
    persistState();
    render();
  }

  function deleteCurrentChat() {
    const currentSession = getCurrentSession();
    if (!currentSession) {
      return;
    }

    if (!window.confirm("Delete this chat session?")) {
      return;
    }

    const nextSessions = state.sessions.filter((session) => session.id !== currentSession.id);
    state.sessions = nextSessions;
    if (!nextSessions.length) {
      const session = createSession();
      state.sessions = [session];
      state.currentSessionId = session.id;
    } else if (!nextSessions.some((session) => session.id === state.currentSessionId)) {
      state.currentSessionId = nextSessions[0].id;
    }

    state.view = "chat";
    state.input = "";
    persistState();
    render();
  }

  function toggleHistory() {
    state.view = state.view === "history" ? "chat" : "history";
    persistState();
    render();
  }

  function openWidget() {
    state.open = true;
    render();
  }

  function closeWidget() {
    state.open = false;
    render();
  }

  async function submitMessage(event) {
    event.preventDefault();
    const message = String(state.input || "").trim();
    if (!message || state.loading) {
      return;
    }

    const currentSession = getCurrentSession();
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    const placeholderId = crypto.randomUUID();
    const pendingMessage = {
      id: placeholderId,
      role: "assistant",
      content: "",
      pending: true,
      createdAt: new Date().toISOString(),
    };

    if (currentSession.messages.length === 0 || currentSession.title === "New Chat") {
      updateSession(currentSession.id, (session) => ({
        ...session,
        title: summarizeTitle(message),
        updatedAt: new Date().toISOString(),
        messages: [...session.messages, userMessage, pendingMessage],
      }));
    } else {
      addMessage(currentSession.id, userMessage);
      addMessage(currentSession.id, pendingMessage);
    }

    state.input = "";
    state.loading = true;
    state.error = "";
    render();

    try {
      await refreshConfig();
      const payload = await requestJson("/api/widget/chat", {
        method: "POST",
        body: JSON.stringify({
          widgetId,
          message,
        }),
      });

      const answer = String(payload.answer || "I couldn't find an answer in the indexed knowledge source.");
      replaceMessage(currentSession.id, placeholderId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      replaceMessage(currentSession.id, placeholderId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `I couldn't answer that right now. ${error.message || "Please try again."}`,
        createdAt: new Date().toISOString(),
      });
    } finally {
      state.loading = false;
      render();
    }
  }

  function groupSessions(sessions) {
    const buckets = {
      Today: [],
      Yesterday: [],
      Older: [],
    };

    [...sessions]
      .sort((left, right) => new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime())
      .forEach((session) => {
        buckets[formatDateGroup(session.updatedAt || session.createdAt)].push(session);
      });

    return buckets;
  }

  function renderHistory() {
    const sessions = state.sessions.length ? state.sessions : [getCurrentSession()];
    const grouped = groupSessions(sessions);

    return `
      <div class="rag-widget-history">
        <div class="rag-widget-history-scroll">
          ${["Today", "Yesterday", "Older"]
            .map((groupName) => {
              const items = grouped[groupName];
              if (!items.length) {
                return "";
              }

              return `
                <section class="rag-widget-history-group">
                  <div class="rag-widget-history-heading">${groupName}</div>
                  <div class="rag-widget-history-list">
                    ${items
                      .map(
                        (session) => `
                          <article class="rag-widget-session ${session.id === state.currentSessionId ? "is-active" : ""}">
                            <button type="button" class="rag-widget-session-main" data-action="open-session" data-session-id="${session.id}">
                              <div class="rag-widget-session-title">${escapeHtml(session.title || "New Chat")}</div>
                              <div class="rag-widget-session-meta">
                                ${escapeHtml(session.collectionLabel || state.config.displayName)} · ${escapeHtml(session.collection || state.config.collection)}
                              </div>
                              <div class="rag-widget-session-meta">
                                ${session.messages.length} messages · ${escapeHtml(formatTimeStamp(session.updatedAt || session.createdAt))}
                              </div>
                            </button>
                            <button
                              type="button"
                              class="rag-widget-session-delete"
                              data-action="delete-session"
                              data-session-id="${session.id}"
                              aria-label="Delete chat session"
                            >
                              Delete
                            </button>
                          </article>
                        `
                      )
                      .join("")}
                  </div>
                </section>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderMessages(session) {
    const ws = state.widgetSettings;
    if (!session.messages.length) {
      const welcomeMsg = ws.welcomeMessage || "";
      const chips = Array.isArray(ws.suggestedQuestions) ? ws.suggestedQuestions.slice(0, 3) : [];
      const chipsHtml = chips.length
        ? `<div class="rag-widget-chips-row">${chips
            .map((q) => `<button type="button" class="rag-widget-suggestion-chip" data-action="suggestion-click" data-question="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
            .join("")}</div>`
        : "";
      return `
        <div class="rag-widget-empty">
          ${welcomeMsg
            ? `<div class="rag-widget-welcome-row">
                 <div class="rag-widget-avatar">🤖</div>
                 <div class="rag-widget-welcome-bubble">${escapeHtml(welcomeMsg)}</div>
               </div>`
            : `<div class="rag-widget-empty-title">Start a new conversation</div>
               <div class="rag-widget-empty-text">Ask a question and the widget will answer from the mapped knowledge source.</div>`
          }
          ${chipsHtml}
        </div>
      `;
    }

    return session.messages
      .map((message) => {
        const cls = message.role === "user" ? "rag-widget-message is-user" : "rag-widget-message is-assistant";
        const content = message.pending
          ? `<span class="rag-widget-typing"><i></i><i></i><i></i></span>`
          : escapeHtml(message.content).replace(/\n/g, "<br>");
        const avatar = message.role === "assistant" ? `<div class="rag-widget-avatar">🤖</div>` : "";
        return `
          <div class="${cls}">
            ${avatar}
            <div class="rag-widget-message-bubble">${content}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderChat(session) {
    return `
      <div class="rag-widget-chat">
        <div class="rag-widget-messages" data-role="messages">
          ${renderMessages(session)}
        </div>
        <form class="rag-widget-composer" data-role="composer">
          <textarea
            class="rag-widget-input"
            rows="1"
            placeholder="Ask a question about ${escapeHtml(state.config.displayName)}..."
            data-role="input"
          >${escapeHtml(state.input)}</textarea>
          <button class="rag-widget-send" type="submit" ${state.loading ? "disabled" : ""}>
            ${state.loading ? "Thinking..." : "Send"}
          </button>
        </form>
      </div>
    `;
  }

  function renderLauncher() {
    return `
      <button type="button" class="rag-widget-launcher" data-action="open-widget">
      Chat

      </button>
    `;
  }

  function renderPanel(session) {
    const ws = state.widgetSettings;
    const title = escapeHtml(ws.widgetTitle || state.config.displayName || "Chatbot");
    const currentChatTitle = escapeHtml(session.title || "New Chat");
    const actionButtons =
      state.view === "history"
        ? `
            <button type="button" class="rag-widget-chip" data-action="new-chat">New Chat</button>
            <button type="button" class="rag-widget-chip" data-action="back-chat">Back</button>
            <button type="button" class="rag-widget-close" data-action="close-widget" aria-label="Close widget">×</button>
          `
        : `
            <button type="button" class="rag-widget-chip" data-action="new-chat">New Chat</button>
            <button type="button" class="rag-widget-chip" data-action="delete-chat">Delete Chat</button>
            <button type="button" class="rag-widget-chip" data-action="toggle-history">History</button>
            <button type="button" class="rag-widget-close" data-action="close-widget" aria-label="Close widget">×</button>
          `;

    return `
      <section class="rag-widget-panel" role="dialog" aria-label="Widget chat">
        <header class="rag-widget-header">
          <div class="rag-widget-header-avatar">💬</div>
          <div class="rag-widget-header-copy">
            <h2 class="rag-widget-title">${title}</h2>
            <div class="rag-widget-subtitle">${currentChatTitle}</div>
          </div>
          <div class="rag-widget-header-actions">${actionButtons}</div>
        </header>
        <main class="rag-widget-content">
          ${state.view === "history" ? renderHistory() : renderChat(session)}
        </main>
      </section>
    `;
  }

  function renderStyles() {
    const isDark = state.widgetSettings.theme === "dark";
    return `
      <style data-rag-widget-styles="${widgetId}">
        [data-rag-widget-root="${widgetId}"] {
          color-scheme: ${isDark ? "dark" : "light"};
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 2147483000;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: var(--rag-text-color, #101418);
        }

        [data-rag-widget-root="${widgetId}"] *,
        [data-rag-widget-root="${widgetId}"] *::before,
        [data-rag-widget-root="${widgetId}"] *::after {
          box-sizing: border-box;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget {
          position: relative;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-launcher {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-width: 88px;
          height: 52px;
          border: 0;
          border-radius: 999px;
          padding: 0 18px;
          background: linear-gradient(135deg, var(--rag-accent, #0d8f69), color-mix(in srgb, var(--rag-accent, #0d8f69) 80%, #000));
          color: #ffffff;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 18px 44px var(--rag-accent-shadow, rgba(13,143,105,0.26));
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-panel {
          width: min(420px, calc(100vw - 36px));
          height: min(680px, calc(100vh - 36px));
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          border-radius: 24px;
          border: 1px solid var(--rag-panel-border, rgba(18, 24, 32, 0.08));
          background: var(--rag-panel-bg, #ffffff);
          box-shadow: 0 32px 90px rgba(11, 17, 28, 0.26);
          overflow: hidden;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          padding: 16px 16px 14px;
          border-bottom: 1px solid var(--rag-header-border, var(--rag-panel-border));
          background: var(--rag-header-bg, linear-gradient(180deg, rgba(16, 24, 32, 0.03), rgba(16, 24, 32, 0)));
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-header-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: var(--rag-accent, #0d8f69);
          font-size: 14px;
          flex-shrink: 0;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-avatar {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: var(--rag-accent, #0d8f69);
          font-size: 11px;
          flex-shrink: 0;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-welcome-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-header-copy {
          min-width: 0;
          flex: 1;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-title {
          margin: 0;
          font-size: 17px;
          line-height: 1.2;
          color: var(--rag-title-color, #0f1720);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-subtitle {
          margin-top: 4px;
          font-size: 12px;
          line-height: 1.4;
          color: var(--rag-subtitle-color, #667085);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-header-actions {
          display: flex;
          align-items: start;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
          margin-left: auto;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-chip,
        [data-rag-widget-root="${widgetId}"] .rag-widget-close,
        [data-rag-widget-root="${widgetId}"] .rag-widget-session-delete,
        [data-rag-widget-root="${widgetId}"] .rag-widget-send {
          border: 0;
          cursor: pointer;
          transition: transform 140ms ease, box-shadow 140ms ease, background-color 140ms ease, opacity 140ms ease;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-chip {
          border-radius: 999px;
          padding: 8px 12px;
          background: var(--rag-chip-bg);
          color: var(--rag-chip-color);
          font-size: 12px;
          font-weight: 700;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-close {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          background: var(--rag-chip-bg);
          color: var(--rag-chip-color);
          font-size: 22px;
          line-height: 1;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-chip:hover,
        [data-rag-widget-root="${widgetId}"] .rag-widget-close:hover,
        [data-rag-widget-root="${widgetId}"] .rag-widget-send:hover,
        [data-rag-widget-root="${widgetId}"] .rag-widget-session-delete:hover,
        [data-rag-widget-root="${widgetId}"] .rag-widget-session-main:hover {
          transform: translateY(-1px);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-content {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-chat,
        [data-rag-widget-root="${widgetId}"] .rag-widget-history {
          display: flex;
          flex: 1;
          min-height: 0;
          flex-direction: column;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-history {
          overflow: hidden;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-messages,
        [data-rag-widget-root="${widgetId}"] .rag-widget-history-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 18px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-history-scroll { overflow-x: hidden; }

        [data-rag-widget-root="${widgetId}"] .rag-widget-empty {
          margin: auto 18px;
          padding: 18px 14px 14px;
          text-align: left;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-empty-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--rag-title-color, #0f1720);
          text-align: center;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-empty-text {
          margin-top: 8px;
          font-size: 13px;
          line-height: 1.6;
          color: var(--rag-subtitle-color, #667085);
          text-align: center;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-welcome-bubble {
          display: inline-block;
          background: var(--rag-msg-bg, rgba(15,23,32,0.05));
          border-radius: 4px 14px 14px 14px;
          padding: 10px 14px;
          font-size: 13px;
          line-height: 1.55;
          color: var(--rag-title-color, #0f1720);
          max-width: 88%;
          margin-bottom: 12px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-chips-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 8px;
          padding-left: 32px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-suggestion-chip {
          border: 1px solid var(--rag-chip-accent-border, var(--rag-chip-border));
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          color: var(--rag-accent, #0d8f69);
          background: var(--rag-chip-accent-bg, transparent);
          cursor: pointer;
          transition: background-color 120ms ease, border-color 120ms ease;
          text-align: left;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-suggestion-chip:hover {
          background: var(--rag-accent-shadow, rgba(13,143,105,0.12));
          border-color: var(--rag-accent, #00d992);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-message {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-message.is-user {
          justify-content: flex-end;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-message-bubble {
          max-width: 86%;
          border-radius: 18px;
          padding: 12px 14px;
          font-size: 14px;
          line-height: 1.65;
          white-space: normal;
          word-break: break-word;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-message.is-user .rag-widget-message-bubble {
          background: var(--rag-user-bubble-bg);
          border: 1px solid var(--rag-user-bubble-border);
          color: var(--rag-text-color, #0f1720);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-message.is-assistant .rag-widget-message-bubble {
          background: var(--rag-msg-bg);
          border: 1px solid var(--rag-panel-border);
          color: var(--rag-body-color);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-typing {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          min-height: 20px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-typing i {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--rag-accent, #0d8f69);
          display: inline-block;
          animation: rag-widget-bounce 1.05s infinite ease-in-out;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-typing i:nth-child(2) {
          animation-delay: 0.12s;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-typing i:nth-child(3) {
          animation-delay: 0.24s;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-composer {
          display: flex;
          gap: 10px;
          padding: 14px 14px 16px;
          border-top: 1px solid var(--rag-panel-border);
          background: var(--rag-composer-bg);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-input {
          flex: 1;
          resize: none;
          min-height: 52px;
          max-height: 140px;
          border-radius: 16px;
          border: 1px solid var(--rag-input-border);
          padding: 14px 14px;
          font: inherit;
          font-size: 14px;
          line-height: 1.55;
          color: var(--rag-text-color, #101418);
          background: var(--rag-input-bg);
          outline: none;
          overflow-y: auto;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-input:focus {
          border-color: var(--rag-accent, #0d8f69);
          box-shadow: 0 0 0 3px var(--rag-accent-shadow, rgba(13,143,105,0.12));
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-send {
          align-self: end;
          height: 52px;
          border-radius: 16px;
          padding: 0 16px;
          background: linear-gradient(135deg, var(--rag-accent, #0d8f69), color-mix(in srgb, var(--rag-accent, #0d8f69) 75%, #000));
          color: #ffffff;
          font-weight: 700;
          box-shadow: 0 12px 28px var(--rag-accent-shadow, rgba(13,143,105,0.18));
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-send:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-history-group + .rag-widget-history-group {
          margin-top: 16px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-history-group {
          padding-bottom: 2px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-history-heading {
          margin-bottom: 10px;
          padding: 0 2px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--rag-heading-color, #667085);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-session {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 10px;
          align-items: start;
          margin-bottom: 10px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid var(--rag-surface-border);
          background: var(--rag-surface-bg);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-session.is-active {
          border-color: var(--rag-accent, #0d8f69);
          background: var(--rag-accent-shadow, rgba(13,143,105,0.06));
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-session-main {
          border: 0;
          background: transparent;
          text-align: left;
          padding: 0;
          cursor: pointer;
          min-width: 0;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-session-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--rag-title-color, #0f1720);
          margin-bottom: 6px;
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-session-meta {
          font-size: 12px;
          line-height: 1.5;
          color: var(--rag-subtitle-color, #667085);
        }

        [data-rag-widget-root="${widgetId}"] .rag-widget-session-delete {
          align-self: start;
          border-radius: 999px;
          padding: 7px 11px;
          background: var(--rag-destructive-bg);
          color: var(--rag-destructive-color);
          font-size: 12px;
          font-weight: 700;
        }

        @keyframes rag-widget-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.7; }
          40% { transform: translateY(-4px); opacity: 1; }
        }

        @media (max-width: 640px) {
          [data-rag-widget-root="${widgetId}"] {
            right: 0;
            left: 0;
            bottom: 0;
            padding: 0 12px 12px;
          }

          [data-rag-widget-root="${widgetId}"] .rag-widget-panel {
            width: 100%;
            height: min(80vh, 680px);
          }

          [data-rag-widget-root="${widgetId}"] .rag-widget-header {
            flex-direction: column;
            align-items: stretch;
          }

          [data-rag-widget-root="${widgetId}"] .rag-widget-header-actions {
            justify-content: flex-start;
            margin-left: 0;
          }
        }
      </style>
    `;
  }

  function render() {
    const session = getCurrentSession();
    const panel = state.open ? renderPanel(session) : "";

    root.innerHTML = `
      ${renderStyles()}
      <div class="rag-widget">
        ${state.open ? panel : renderLauncher()}
      </div>
    `;

    bindEvents();

    if (state.open && state.view === "chat") {
      const messages = root.querySelector('[data-role="messages"]');
      if (messages) {
        messages.scrollTop = messages.scrollHeight;
      }
      const input = root.querySelector('[data-role="input"]');
      if (input instanceof HTMLTextAreaElement) {
        input.focus({ preventScroll: true });
      }
    }
  }

  function bindEvents() {
    root.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", () => {
        const action = element.getAttribute("data-action");
        const sessionId = element.getAttribute("data-session-id");

        if (action === "open-widget") {
          openWidget();
          return;
        }
        if (action === "close-widget") {
          closeWidget();
          return;
        }
        if (action === "new-chat") {
          newChat();
          return;
        }
        if (action === "delete-chat") {
          deleteCurrentChat();
          return;
        }
        if (action === "toggle-history") {
          toggleHistory();
          return;
        }
        if (action === "back-chat") {
          state.view = "chat";
          persistState();
          render();
          return;
        }
        if (action === "open-session" && sessionId) {
          setCurrentSession(sessionId);
          return;
        }
        if (action === "delete-session" && sessionId) {
          const target = state.sessions.find((session) => session.id === sessionId);
          if (!target) {
            return;
          }
          if (!window.confirm("Delete this chat session?")) {
            return;
          }

          const nextSessions = state.sessions.filter((session) => session.id !== sessionId);
          state.sessions = nextSessions.length ? nextSessions : [createSession()];
          if (!nextSessions.length) {
            state.currentSessionId = state.sessions[0].id;
            state.view = "chat";
          } else if (state.currentSessionId === sessionId) {
            state.currentSessionId = nextSessions[0].id;
          }
          if (nextSessions.length) {
            state.view = "history";
          }
          persistState();
          render();
        }
        // Suggested question chip — fill the textarea and auto-submit
        if (action === "suggestion-click") {
          const question = element.getAttribute("data-question") || "";
          if (!question) return;
          state.input = question;
          render();
          // Submit after next paint so the textarea value is in state
          requestAnimationFrame(() => {
            const composer = root.querySelector("[data-role='composer']");
            if (composer) {
              composer.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            }
          });
        }
      });
    });

    const composer = root.querySelector('[data-role="composer"]');
    if (composer) {
      composer.addEventListener("submit", submitMessage);
    }

    const input = root.querySelector('[data-role="input"]');
    if (input instanceof HTMLTextAreaElement) {
      input.addEventListener("input", (event) => {
        state.input = event.target.value;
        persistState();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          composer?.requestSubmit();
        }
      });
    }
  }

  function startConfigPolling() {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
    refreshTimer = window.setInterval(() => {
      void refreshConfig();
    }, 20000);
  }

  function bootstrap() {
    loadState();
    ensureActiveSession();
    persistState();
    applyTheme();
    render();
    void refreshConfig();
    startConfigPolling();
  }

  bootstrap();
})();