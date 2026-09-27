const express = require("express");
const cors = require("cors");
const { clientOrigin } = require("./config");
const { query } = require("./db");
const { userFromToken } = require("./middleware/auth");
const events = require("./utils/events");
const { HttpError, notFoundHandler, errorHandler } = require("./utils/errors");

const app = express();

app.use(cors({ origin: clientOrigin }));
app.use(express.json({ limit: "100kb" }));
// Express 5 leaves req.body undefined when nothing was sent; use {} instead
// so routes can always destructure it.
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null || typeof req.body !== "object") req.body = {};
  next();
});

// GET /api/health - quick check that the API and database are up
app.get("/api/health", async (req, res) => {
  await query("SELECT 1");
  res.json({ status: "ok" });
});

// GET /api/events?token=...  - live updates (Server-Sent Events).
// Browsers can't send headers with EventSource, so the login token is in the URL.
app.get("/api/events", async (req, res) => {
  if (!req.query.token) throw new HttpError(401, "Please log in first");
  const user = await userFromToken(String(req.query.token));
  events.addClient(req, res, user);
});

app.use("/api", require("./routes/auth")); // /api/auth/*, /api/staff/*
app.use("/api/users", require("./routes/users"));
app.use("/api/menu", require("./routes/menu"));
app.use("/api", require("./routes/bookings")); // /api/tables, /api/time-slots, /api/bookings
app.use("/api/orders", require("./routes/orders"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/admin", require("./routes/admin"));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
