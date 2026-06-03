const express = require("express");
const cors = require("cors");
const queryRoutes = require("./routes/queryRoutes");
const promptSettingsRoutes = require("./routes/promptSettingsRoutes");
const websiteRoutes = require("./routes/websiteRoutes");
const widgetRoutes = require("./routes/widgetRoutes");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", queryRoutes);
  app.use("/api", promptSettingsRoutes);
  app.use("/api", websiteRoutes);
  app.use("/api", widgetRoutes);

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || "Internal server error" });
  });

  return app;
}

module.exports = createApp;
