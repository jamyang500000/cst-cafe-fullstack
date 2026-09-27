// Profile page: update your own details and password.
const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatUser } = require("../utils/format");
const { Validator, EMAIL_RE, isNonEmptyString, normalizeEmail } = require("../utils/validate");

const router = express.Router();

// PATCH /api/users/me  { name?, email?, phone? }
router.patch("/me", requireAuth, async (req, res) => {
  const { name, email, phone } = req.body;
  const v = new Validator();
  if (name !== undefined) v.check(isNonEmptyString(name, 100), "name", "Name is required");
  if (email !== undefined) v.check(EMAIL_RE.test(normalizeEmail(email)), "email", "Enter a valid email address");
  if (phone !== undefined && phone !== null && phone !== "") {
    v.check(/^[0-9+\- ]{6,20}$/.test(phone), "phone", "Enter a valid phone number");
  }
  v.throwIfErrors();

  if (email !== undefined) {
    const taken = await query("SELECT 1 FROM users WHERE email = $1 AND id <> $2", [normalizeEmail(email), req.user.id]);
    if (taken.rowCount > 0) throw new HttpError(409, "That email is already used by another account", { email: "Email already in use" });
  }

  const { rows } = await query(
    `UPDATE users SET
       name  = COALESCE($1, name),
       email = COALESCE($2, email),
       phone = CASE WHEN $3::boolean THEN $4 ELSE phone END
     WHERE id = $5
     RETURNING id, name, email, phone, account_type, staff_role, active, created_at`,
    [
      name !== undefined ? name.trim() : null,
      email !== undefined ? normalizeEmail(email) : null,
      phone !== undefined,
      phone ? String(phone).trim() : null,
      req.user.id,
    ]
  );
  res.json({ user: formatUser(rows[0]) });
});

// PATCH /api/users/me/password  { currentPassword, newPassword }
router.patch("/me/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const v = new Validator();
  v.check(typeof currentPassword === "string" && currentPassword.length > 0, "currentPassword", "Current password is required");
  v.check(typeof newPassword === "string" && newPassword.length >= 8 && newPassword.length <= 72, "newPassword", "New password must be 8-72 characters");
  v.throwIfErrors();

  const { rows } = await query("SELECT password_hash FROM users WHERE id = $1", [req.user.id]);
  if (!(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
    throw new HttpError(400, "Current password is incorrect", { currentPassword: "Incorrect password" });
  }
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(newPassword, 10), req.user.id]);
  res.json({ message: "Password updated" });
});

// ---------- Privacy settings ----------

const PRIVACY_SETTINGS = {
  shareOrderHistory: "share_order_history",
  orderNotifications: "order_notifications",
  recommendations: "recommendations",
};

function formatPrivacy(row) {
  return {
    shareOrderHistory: row.share_order_history,
    orderNotifications: row.order_notifications,
    recommendations: row.recommendations,
  };
}

// GET /api/users/me/privacy
router.get("/me/privacy", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT * FROM users WHERE id = $1", [req.user.id]);
  res.json({ privacy: formatPrivacy(rows[0]) });
});

// PATCH /api/users/me/privacy  { shareOrderHistory?, orderNotifications?, recommendations? }
router.patch("/me/privacy", requireAuth, async (req, res) => {
  const updates = Object.entries(req.body).filter(([key]) => PRIVACY_SETTINGS[key]);
  if (updates.length === 0) throw new HttpError(400, "Nothing to update");
  for (const [key, value] of updates) {
    if (typeof value !== "boolean") throw new HttpError(400, `${key} must be true or false`);
  }
  // Column names come from PRIVACY_SETTINGS above, never from the request.
  const sets = updates.map(([key], i) => `${PRIVACY_SETTINGS[key]} = $${i + 1}`);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(", ")} WHERE id = $${updates.length + 1} RETURNING *`,
    [...updates.map(([, value]) => value), req.user.id]
  );
  res.json({ privacy: formatPrivacy(rows[0]) });
});

module.exports = router;
