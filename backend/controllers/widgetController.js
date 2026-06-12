const {
  buildWidgetScript,
  createWidget,
  deleteWidget,
  findWidgetByOwner,
  findWidgetRecord,
  listWidgetsByOwner,
  queryWidget,
  toPublicWidgetConfig,
  updateWidget,
} = require("../services/widgetService");
const { getWidgetSettings, saveWidgetSettings } = require("../services/widgetSettingsService");
const { readTable } = require("../utils/dbStore");
const {
  assertWebsiteAccess,
  DEFAULT_BASE_COLLECTION_NAME,
} = require("../services/websiteOwnershipService");

// Extract authenticated user id from request (set by requireAuth middleware).
function userIdFromAuth(req) {
  return req.auth?.sub || req.auth?.userId || null;
}

// Default settings used when no record exists yet.
const SETTINGS_DEFAULTS = {
  theme: "dark",
  accent_color: "#00d992",
  welcome_message: "Hi, how can I help?",
  suggested_questions: [],
  widget_title: "Voltagent Assistant",
};

// Return the widget settings for a given owner user id.
function settingsForOwner(ownerId) {
  try {
    const record = ownerId ? getWidgetSettings(ownerId) : null;
    return record || SETTINGS_DEFAULTS;
  } catch {
    return SETTINGS_DEFAULTS;
  }
}

// Shape settings into the camelCase format the widget script expects.
function formatSettingsForWidget(settings) {
  return {
    theme: settings.theme || SETTINGS_DEFAULTS.theme,
    accentColor: settings.accent_color || SETTINGS_DEFAULTS.accent_color,
    welcomeMessage: settings.welcome_message || "",
    suggestedQuestions: Array.isArray(settings.suggested_questions)
      ? settings.suggested_questions
      : [],
    widgetTitle: settings.widget_title || SETTINGS_DEFAULTS.widget_title,
  };
}

// ── Authenticated owner-scoped endpoints ─────────────────────────────────────

async function createWidgetController(req, res) {
  try {
    const ownerId = userIdFromAuth(req);
    if (!ownerId) return res.status(401).json({ error: "Unauthorised." });

    const { collection, displayName, status } = req.body || {};
    const targetCollection = String(collection || "").trim() || DEFAULT_BASE_COLLECTION_NAME;

    // A widget exposes a collection's RAG content publicly (via /widget/chat),
    // so users may only point widgets at collections they own (or the shared
    // base collection).
    const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";
    try {
      assertWebsiteAccess(targetCollection, { userId: ownerId, isAdmin });
    } catch (accessError) {
      return res.status(accessError.statusCode || 403).json({ error: "You do not have access to this website/collection." });
    }

    const widget = createWidget({
      ownerId,
      collection: targetCollection,
      displayName: String(displayName || "").trim(),
      status: String(status || "active").trim(),
    });

    return res.status(201).json({
      widgetId: widget.widgetId,
      script: buildWidgetScript(widget.widgetId),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to create widget." });
  }
}

// List only the requesting user's widgets.
async function listWidgetsController(req, res) {
  try {
    const ownerId = userIdFromAuth(req);
    if (!ownerId) return res.status(401).json({ error: "Unauthorised." });

    const widgets = listWidgetsByOwner(ownerId);
    return res.json({
      widgets: widgets.map((widget) => ({
        ...toPublicWidgetConfig(widget),
        collection: String(widget.collection || ""),
        displayName: String(widget.displayName || ""),
        script: buildWidgetScript(widget.widgetId),
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list widgets." });
  }
}

async function updateWidgetController(req, res) {
  try {
    const ownerId = userIdFromAuth(req);
    if (!ownerId) return res.status(401).json({ error: "Unauthorised." });

    const { id } = req.params;
    const updates = req.body || {};

    if (updates.collection) {
      const isAdmin = String(req.auth?.role || "").toLowerCase() === "admin";
      const targetCollection = String(updates.collection).trim() || DEFAULT_BASE_COLLECTION_NAME;
      try {
        assertWebsiteAccess(targetCollection, { userId: ownerId, isAdmin });
      } catch (accessError) {
        return res.status(accessError.statusCode || 403).json({ error: "You do not have access to this website/collection." });
      }
      updates.collection = targetCollection;
    }

    // Pass ownerId so the service can reject widgets that belong to someone else.
    const widget = updateWidget(id, updates, ownerId);
    return res.json({
      widgetId: widget.widgetId,
      script: buildWidgetScript(widget.widgetId),
      widget: toPublicWidgetConfig(widget),
    });
  } catch (error) {
    if (String(error.message || "").includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Failed to update widget." });
  }
}

async function deleteWidgetController(req, res) {
  try {
    const ownerId = userIdFromAuth(req);
    if (!ownerId) return res.status(401).json({ error: "Unauthorised." });

    const { id } = req.params;
    const removed = deleteWidget(id, ownerId);
    return res.json({ deleted: true, widgetId: removed.widgetId });
  } catch (error) {
    if (String(error.message || "").includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Failed to delete widget." });
  }
}

// ── Public endpoint (no auth) — called by the embedded widget script ──────────

// GET /api/widgets/:id  — public, returns widget config + owner's settings.
async function getWidgetController(req, res) {
  try {
    const { id } = req.params;
    const widget = findWidgetRecord(id);
    if (!widget) return res.status(404).json({ error: "Widget not found." });

    const settings = settingsForOwner(widget.ownerId);
    return res.json({
      ...toPublicWidgetConfig(widget),
      widgetSettings: formatSettingsForWidget(settings),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load widget." });
  }
}

// POST /api/widget/chat — public, chat with a widget.
async function widgetChatController(req, res) {
  try {
    const { widgetId, message } = req.body || {};
    if (!widgetId || !String(widgetId).trim()) {
      return res.status(400).json({ error: "Widget id is required." });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const payload = await queryWidget(String(widgetId).trim(), String(message).trim());
    return res.json({ answer: payload.answer });
  } catch (error) {
    if (String(error.message || "").includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    if (String(error.message || "").includes("inactive")) {
      return res.status(403).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || "Widget chat failed." });
  }
}

// ── Authenticated: chatbot appearance settings ────────────────────────────────
// GET  /api/widget-settings  — load current user's appearance settings
// PUT  /api/widget-settings  — save them; embedded widgets pick up changes within ~20s

async function getWidgetSettingsController(req, res) {
  try {
    const ownerId = userIdFromAuth(req);
    if (!ownerId) return res.status(401).json({ error: "Unauthorised." });

    const record = getWidgetSettings(ownerId);
    if (!record) return res.json({ ...SETTINGS_DEFAULTS, settings: SETTINGS_DEFAULTS });

    const out = formatSettingsForWidget(record);
    return res.json({ ...out, settings: out });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load widget settings." });
  }
}

async function saveWidgetSettingsController(req, res) {
  try {
    const ownerId = userIdFromAuth(req);
    if (!ownerId) return res.status(401).json({ error: "Unauthorised." });

    const body = req.body || {};
    // Accept camelCase (frontend-voltagent) or snake_case (older clients)
    const record = saveWidgetSettings(ownerId, {
      theme: typeof body.theme === "string" ? body.theme : SETTINGS_DEFAULTS.theme,
      accentColor:
        (typeof body.accentColor === "string" ? body.accentColor : null) ||
        (typeof body.accent_color === "string" ? body.accent_color : null) ||
        SETTINGS_DEFAULTS.accent_color,
      welcomeMessage:
        typeof body.welcomeMessage === "string"
          ? body.welcomeMessage
          : typeof body.welcome_message === "string"
          ? body.welcome_message
          : SETTINGS_DEFAULTS.welcome_message,
      suggestedQuestions: Array.isArray(body.suggestedQuestions)
        ? body.suggestedQuestions
        : Array.isArray(body.suggested_questions)
        ? body.suggested_questions
        : SETTINGS_DEFAULTS.suggested_questions,
      widgetTitle:
        (typeof body.widgetTitle === "string" ? body.widgetTitle : null) ||
        (typeof body.widget_title === "string" ? body.widget_title : null) ||
        SETTINGS_DEFAULTS.widget_title,
    });

    const out = formatSettingsForWidget(record);
    return res.json({ ...out, settings: out });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save widget settings." });
  }
}

module.exports = {
  createWidgetController,
  deleteWidgetController,
  getWidgetController,
  getWidgetSettingsController,
  listWidgetsController,
  saveWidgetSettingsController,
  updateWidgetController,
  widgetChatController,
};