// Notification bell (customers) and notification sidebar (staff).
// Customers see their own; all staff share one staff feed.
const express = require("express");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatNotification } = require("../utils/format");
const { parseId } = require("../utils/validate");

const router = express.Router();

// SQL condition + params selecting the current user's notifications.
function audienceFilter(user) {
  return user.account_type === "staff"
    ? { sql: "audience = 'staff'", params: [] }
    : { sql: "audience = 'customer' AND user_id = $1", params: [user.id] };
}

// GET /api/notifications  - newest 50 plus the unread count
router.get("/", requireAuth, async (req, res) => {
  const f = audienceFilter(req.user);
  const { rows } = await query(
    `SELECT * FROM notifications WHERE ${f.sql} ORDER BY created_at DESC, id DESC LIMIT 50`,
    f.params
  );
  const unread = await query(`SELECT COUNT(*)::int AS n FROM notifications WHERE ${f.sql} AND NOT read`, f.params);
  res.json({ unreadCount: unread.rows[0].n, notifications: rows.map(formatNotification) });
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const f = audienceFilter(req.user);
  const { rows } = await query(
    `UPDATE notifications SET read = TRUE WHERE id = $${f.params.length + 1} AND ${f.sql} RETURNING *`,
    [...f.params, id]
  );
  if (!rows[0]) throw new HttpError(404, "Notification not found");
  res.json({ notification: formatNotification(rows[0]) });
});

// POST /api/notifications/read-all
router.post("/read-all", requireAuth, async (req, res) => {
  const f = audienceFilter(req.user);
  await query(`UPDATE notifications SET read = TRUE WHERE ${f.sql} AND NOT read`, f.params);
  res.json({ message: "All notifications marked as read" });
});

module.exports = router;
