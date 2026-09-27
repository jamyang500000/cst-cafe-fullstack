// Admin controls - Managers only.
// See every account, change staff roles, and disable / re-enable accounts.
// Disabling (instead of deleting) keeps the person's orders, so reports stay correct.
const express = require("express");
const { query } = require("../db");
const config = require("../config");
const { requireManager } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatUser } = require("../utils/format");
const { parseId } = require("../utils/validate");
const events = require("../utils/events");

const router = express.Router();

async function findUser(id) {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [id]);
  if (!rows[0]) throw new HttpError(404, "Account not found");
  return rows[0];
}

// A change must never leave the cafe without an active Manager.
async function ensureAnotherManager(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS n FROM users
     WHERE account_type = 'staff' AND staff_role = 'Manager' AND active AND id <> $1`,
    [userId]
  );
  if (rows[0].n === 0) {
    throw new HttpError(400, "There must always be at least one active Manager.");
  }
}

// GET /api/admin/users?type=staff|customer&search=karma
router.get("/users", requireManager, async (req, res) => {
  const { type, search } = req.query;
  const conditions = [];
  const params = [];
  if (type === "staff" || type === "customer") {
    params.push(type);
    conditions.push(`u.account_type = $${params.length}`);
  }
  if (search && String(search).trim()) {
    params.push(`%${String(search).trim().toLowerCase()}%`);
    conditions.push(`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
  }
  const { rows } = await query(
    `SELECT u.*, (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count
     FROM users u ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
     ORDER BY u.account_type DESC, u.active DESC, u.name
     LIMIT 500`,
    params
  );
  res.json({
    users: rows.map((r) => ({ ...formatUser(r), orderCount: r.order_count })),
    roles: config.staffRoles,
  });
});

// PATCH /api/admin/users/:id/role  { role }  (staff accounts only)
router.patch("/users/:id/role", requireManager, async (req, res) => {
  const id = parseId(req.params.id);
  const { role } = req.body;
  if (!config.staffRoles.includes(role)) {
    throw new HttpError(400, `Role must be one of: ${config.staffRoles.join(", ")}`);
  }
  const user = await findUser(id);
  if (user.account_type !== "staff") throw new HttpError(400, "Only staff accounts have a role");
  if (user.id === req.user.id) throw new HttpError(400, "You can't change your own role. Ask another manager.");
  if (user.staff_role === "Manager" && role !== "Manager") await ensureAnotherManager(user.id);

  const { rows } = await query("UPDATE users SET staff_role = $1 WHERE id = $2 RETURNING *", [role, id]);
  res.json({ user: formatUser(rows[0]) });
});

// PATCH /api/admin/users/:id/active  { active: true|false }
router.patch("/users/:id/active", requireManager, async (req, res) => {
  const id = parseId(req.params.id);
  const { active } = req.body;
  if (typeof active !== "boolean") throw new HttpError(400, "active must be true or false");
  const user = await findUser(id);
  if (user.id === req.user.id) throw new HttpError(400, "You can't disable your own account.");
  if (!active && user.staff_role === "Manager") await ensureAnotherManager(user.id);

  const { rows } = await query("UPDATE users SET active = $1 WHERE id = $2 RETURNING *", [active, id]);
  if (!active) events.logoutUser(id);
  res.json({ user: formatUser(rows[0]) });
});

module.exports = router;
