// Sign up, log in and "who am I" for customers and staff.
const express = require("express");
const bcrypt = require("bcryptjs");
const { query } = require("../db");
const config = require("../config");
const { createToken, requireAuth } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatUser } = require("../utils/format");
const { notifyCustomer } = require("../utils/notify");
const { Validator, EMAIL_RE, isNonEmptyString, normalizeEmail } = require("../utils/validate");

const router = express.Router();

const USER_COLUMNS = "id, name, email, phone, account_type, staff_role, active, created_at";

function validateSignup(body, extra) {
  const v = new Validator();
  v.check(isNonEmptyString(body.name, 100), "name", "Name is required");
  v.check(EMAIL_RE.test(normalizeEmail(body.email)), "email", "Enter a valid email address");
  v.check(typeof body.password === "string" && body.password.length >= 8, "password", "Password must be at least 8 characters");
  v.check(typeof body.password !== "string" || body.password.length <= 72, "password", "Password is too long");
  if (extra) extra(v);
  v.throwIfErrors();
}

async function createUser({ name, email, phone, password, accountType, staffRole }) {
  const existing = await query("SELECT 1 FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) {
    throw new HttpError(409, "An account with this email already exists", { email: "Email already in use" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, phone, password_hash, account_type, staff_role)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${USER_COLUMNS}`,
    [name, email, phone || null, passwordHash, accountType, staffRole || null]
  );
  return rows[0];
}

async function login(email, password, accountType) {
  const v = new Validator();
  v.check(EMAIL_RE.test(normalizeEmail(email)), "email", "Enter a valid email address");
  v.check(typeof password === "string" && password.length > 0, "password", "Password is required");
  v.throwIfErrors();

  const { rows } = await query(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`, [
    normalizeEmail(email),
  ]);
  const user = rows[0];
  // Same message for "no such email" and "wrong password", so nobody can
  // find out which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, "Invalid email or password");
  }
  if (!user.active) {
    throw new HttpError(403, "This account has been disabled. Please contact the cafe manager.");
  }
  if (user.account_type !== accountType) {
    throw new HttpError(
      403,
      accountType === "staff"
        ? "This is a customer account. Please use the customer login."
        : "This is a staff account. Please use the staff portal."
    );
  }
  return { token: createToken(user), user: formatUser(user) };
}

// ---------- Customers ----------

// POST /api/auth/signup  { name, email, phone?, password }
router.post("/auth/signup", async (req, res) => {
  const { name, email, phone, password } = req.body;
  validateSignup(req.body, (v) => {
    v.check(phone === undefined || phone === null || phone === "" || /^[0-9+\- ]{6,20}$/.test(phone), "phone", "Enter a valid phone number");
  });
  const user = await createUser({
    name: name.trim(),
    email: normalizeEmail(email),
    phone: phone ? String(phone).trim() : null,
    password,
    accountType: "customer",
  });
  await notifyCustomer(user.id, "Welcome to CST Cafe", "Thanks for signing up! Browse the menu to place your first order.");
  res.status(201).json({ token: createToken(user), user: formatUser(user) });
});

// POST /api/auth/login  { email, password }
router.post("/auth/login", async (req, res) => {
  res.json(await login(req.body.email, req.body.password, "customer"));
});

// ---------- Staff ----------

// POST /api/staff/signup  { name, email, role, password, signupCode? }
router.post("/staff/signup", async (req, res) => {
  const { name, email, role, password, signupCode } = req.body;
  validateSignup(req.body, (v) => {
    v.check(config.staffRoles.includes(role), "role", `Role must be one of: ${config.staffRoles.join(", ")}`);
    if (config.staffSignupCode) {
      v.check(signupCode === config.staffSignupCode, "signupCode", "Invalid staff signup code");
    }
  });
  const user = await createUser({
    name: name.trim(),
    email: normalizeEmail(email),
    password,
    accountType: "staff",
    staffRole: role,
  });
  res.status(201).json({ token: createToken(user), user: formatUser(user) });
});

// POST /api/staff/login  { email, password }
router.post("/staff/login", async (req, res) => {
  res.json(await login(req.body.email, req.body.password, "staff"));
});

// ---------- Both ----------

// GET /api/auth/me  -> the logged-in user
router.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: formatUser(req.user) });
});

module.exports = router;
