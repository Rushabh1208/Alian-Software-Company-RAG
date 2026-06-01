const createApp = require("./app");

const PORT = Number(process.env.PORT || 5000);
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Disable the default Node server timeout so long-running index requests can complete.
server.timeout = 0;
