const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const queryRoutes = require("./routes/queryRoutes");
const promptSettingsRoutes = require("./routes/promptSettingsRoutes");
const websiteRoutes = require("./routes/websiteRoutes");
const widgetRoutes = require("./routes/widgetRoutes");
const guardrailsRoutes = require('./routes/guardrailsRoutes');
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminWebsiteRoutes = require("./routes/adminWebsiteRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const meRoutes = require("./routes/meRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const chatRoutes = require("./routes/chatRoutes");
const { ensureSeeded } = require("./utils/dbStore");


function createApp() {
  const app = express();

  const allowedOrigins = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const isLocalDevOrigin = (origin) => {
    try {
      const parsed = new URL(origin);
      return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    } catch {
      return false;
    }
  };

  // Public widget endpoints must be reachable from any external website that
  // embeds the widget script, so only those endpoints use wildcard CORS.
  // All management/auth endpoints keep the normal credentialed CORS behavior.
  const isPublicWidgetPath = (method, path) =>
    (method === "GET" && /^\/api\/widgets\/[^/]+$/.test(path)) ||
    (method === "POST" && path === "/api/widget/chat") ||
    (method === "OPTIONS" && path === "/api/widget/chat");

  app.use((req, res, next) => {
    if (isPublicWidgetPath(req.method, req.path)) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
    }

    return next();
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }
        if (!allowedOrigins.length || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));
  ensureSeeded();

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", queryRoutes);
  app.use("/api", promptSettingsRoutes);
  app.use("/api", websiteRoutes);
  app.use("/api", widgetRoutes);
  app.use('/api/guardrails', guardrailsRoutes);
  app.use("/api", authRoutes);
  app.use("/api", sessionRoutes);
  app.use("/api", meRoutes);
  app.use("/api", userRoutes);
  app.use("/api", subscriptionRoutes);
  app.use("/api", adminRoutes);
  app.use("/api", adminWebsiteRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/api", chatRoutes);
  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || "Internal server error" });
  });

  return app;
}

module.exports = createApp;