const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn } = require("../config");
const { query } = require("../db");
const { HttpError } = require("../utils/errors");

function createToken(user) {
  return jwt.sign({ sub: user.id, type: user.account_type }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
}

// Reads "Authorization: Bearer <token>" and loads the user.
async function loadUser(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return userFromToken(token);
}

// Checks a login token and returns the (active) user it belongs to.
async function userFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch {
    throw new HttpError(401, "Your session has expired. Please log in again.");
  }

  const { rows } = await query(
    "SELECT id, name, email, phone, account_type, staff_role, active, created_at FROM users WHERE id = $1",
    [payload.sub]
  );
  if (!rows[0]) throw new HttpError(401, "Account no longer exists. Please log in again.");
  if (!rows[0].active) throw new HttpError(401, "This account has been disabled. Please contact the cafe manager.");
  return rows[0];
}

// Route needs a logged-in user (customer or staff)
async function requireAuth(req, res, next) {
  const user = await loadUser(req);
  if (!user) throw new HttpError(401, "Please log in first");
  req.user = user;
  next();
}

// Logged in is optional (e.g. browsing the menu)
async function optionalAuth(req, res, next) {
  req.user = await loadUser(req).catch(() => null);
  next();
}

async function requireStaff(req, res, next) {
  await requireAuth(req, res, () => {});
  if (req.user.account_type !== "staff") throw new HttpError(403, "Staff only");
  next();
}

async function requireCustomer(req, res, next) {
  await requireAuth(req, res, () => {});
  if (req.user.account_type !== "customer") {
    throw new HttpError(403, "Only customer accounts can do this");
  }
  next();
}

// Staff with the Manager role only (admin controls)
async function requireManager(req, res, next) {
  await requireStaff(req, res, () => {});
  if (req.user.staff_role !== "Manager") throw new HttpError(403, "Only managers can do this");
  next();
}

module.exports = {
  createToken,
  userFromToken,
  requireAuth,
  optionalAuth,
  requireStaff,
  requireCustomer,
  requireManager,
};
