const { HttpError } = require("./errors");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Matches the frontend's time format, e.g. "9:05 AM" or "12:15 PM"
const TIME_RE = /^(1[0-2]|[1-9]):[0-5]\d (AM|PM)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Collects field errors, then throws them all at once as a 400 response:
//   const v = new Validator(); v.check(...); v.throwIfErrors();
class Validator {
  constructor() {
    this.errors = {};
  }
  check(condition, field, message) {
    if (!condition && !this.errors[field]) this.errors[field] = message;
    return condition;
  }
  throwIfErrors() {
    if (Object.keys(this.errors).length > 0) {
      throw new HttpError(400, "Please fix the highlighted fields", this.errors);
    }
  }
}

function isNonEmptyString(value, maxLength = 200) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isPositiveInt(value, max = Number.MAX_SAFE_INTEGER) {
  return Number.isInteger(value) && value > 0 && value <= max;
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Route params like /orders/:id must be whole numbers.
function parseId(value, label = "id") {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `Invalid ${label}`);
  return id;
}

// "12 min", "12", or 12  ->  12
function parsePrepMinutes(value) {
  if (Number.isInteger(value)) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,3})(\s*min(ute)?s?)?$/i);
    if (match) return Number(match[1]);
  }
  return NaN;
}

// "YYYY-MM-DD" in the server's local time zone
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

module.exports = {
  EMAIL_RE,
  TIME_RE,
  Validator,
  isNonEmptyString,
  isPositiveInt,
  normalizeEmail,
  parseId,
  parsePrepMinutes,
  todayString,
  isValidDate,
};
