const {
  buildWidgetScript,
  createWidget,
  findWidgetRecord,
  listWidgets,
  queryWidget,
  toPublicWidgetConfig,
  updateWidget,
} = require("../services/widgetService");

async function createWidgetController(req, res) {
  try {
    const { collection, displayName, status } = req.body || {};
    const widget = createWidget({
      collection: String(collection || "").trim(),
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

async function getWidgetController(req, res) {
  try {
    const { id } = req.params;
    const widget = findWidgetRecord(id);
    if (!widget) {
      return res.status(404).json({ error: "Widget not found." });
    }

    return res.json(toPublicWidgetConfig(widget));
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to load widget." });
  }
}

async function listWidgetsController(_req, res) {
  try {
    return res.json({ widgets: listWidgets().map((widget) => ({
      ...toPublicWidgetConfig(widget),
      collection: String(widget.collection || ""),
      displayName: String(widget.displayName || ""),
      script: buildWidgetScript(widget.widgetId),
    })) });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to list widgets." });
  }
}

async function updateWidgetController(req, res) {
  try {
    const { id } = req.params;
    const widget = updateWidget(id, req.body || {});
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

module.exports = {
  createWidgetController,
  getWidgetController,
  listWidgetsController,
  updateWidgetController,
  widgetChatController,
};
