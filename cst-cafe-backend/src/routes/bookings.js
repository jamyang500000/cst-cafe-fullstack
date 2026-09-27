// Tables, time slots and table bookings.
const express = require("express");
const { query } = require("../db");
const config = require("../config");
const { requireAuth, requireCustomer, requireStaff } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatBooking, formatTable } = require("../utils/format");
const { notifyCustomer, notifyStaff } = require("../utils/notify");
const { Validator, TIME_RE, isPositiveInt, isValidDate, parseId, todayString } = require("../utils/validate");

const router = express.Router();

const BOOKING_SELECT = `
  SELECT b.*, t.label AS table_label, t.near_window, u.name AS customer_name
  FROM bookings b
  JOIN cafe_tables t ON t.id = b.table_id
  JOIN users u ON u.id = b.user_id`;

function readDate(value) {
  if (value === undefined || value === "") return todayString();
  if (!isValidDate(value)) throw new HttpError(400, "Date must look like YYYY-MM-DD");
  return value;
}

// GET /api/time-slots
router.get("/time-slots", (req, res) => {
  res.json({ timeSlots: config.timeSlots });
});

// GET /api/tables?partySize=2&date=2026-09-25&time=12:15 PM
// If date + time are given, each table says whether it's free then.
router.get("/tables", async (req, res) => {
  const partySize = req.query.partySize ? Number(req.query.partySize) : 1;
  if (!isPositiveInt(partySize, 20)) throw new HttpError(400, "partySize must be a number from 1 to 20");
  const date = readDate(req.query.date);
  const time = req.query.time;
  if (time !== undefined && !TIME_RE.test(time)) throw new HttpError(400, 'time must look like "12:15 PM"');

  const { rows } = await query(
    `SELECT t.*,
       EXISTS (SELECT 1 FROM bookings b
               WHERE b.table_id = t.id AND b.status = 'confirmed'
                 AND b.booking_date = $2 AND b.time_slot = $3) AS booked
     FROM cafe_tables t WHERE t.seats >= $1 ORDER BY t.id`,
    [partySize, date, time || null]
  );
  res.json({
    tables: rows.map((r) => ({ ...formatTable(r), available: time ? !r.booked : true })),
  });
});

// POST /api/bookings  (customer)  { tableId, time, partySize, date? }
router.post("/bookings", requireCustomer, async (req, res) => {
  const { tableId, time, partySize } = req.body;
  const v = new Validator();
  v.check(isPositiveInt(tableId), "tableId", "Choose a table");
  v.check(typeof time === "string" && TIME_RE.test(time), "time", 'Choose a time like "12:15 PM"');
  v.check(isPositiveInt(partySize, 20), "partySize", "Party size must be 1-20");
  v.throwIfErrors();
  const date = readDate(req.body.date);
  if (date < todayString()) throw new HttpError(400, "You can't book a date in the past");

  const tableResult = await query("SELECT * FROM cafe_tables WHERE id = $1", [tableId]);
  const table = tableResult.rows[0];
  if (!table) throw new HttpError(404, "Table not found");
  if (partySize > table.seats) throw new HttpError(400, `${table.label} only seats ${table.seats}`);

  let booking;
  try {
    const { rows } = await query(
      `INSERT INTO bookings (user_id, table_id, booking_date, time_slot, party_size)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [req.user.id, tableId, date, time, partySize]
    );
    booking = rows[0];
  } catch (err) {
    if (err.code === "23505") throw new HttpError(409, `${table.label} is already booked at ${time}. Please pick another table or time.`);
    throw err;
  }

  const guests = `${partySize} ${partySize === 1 ? "guest" : "guests"}`;
  await notifyCustomer(req.user.id, "Booking confirmed", `${table.label} is reserved for ${guests} at ${time}.`);
  await notifyStaff("New booking", `${req.user.name} booked ${table.label} for ${guests} at ${time}.`);

  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [booking.id]);
  res.status(201).json({ booking: formatBooking(rows[0]) });
});

// GET /api/bookings/mine  (customer) - upcoming first
router.get("/bookings/mine", requireCustomer, async (req, res) => {
  const { rows } = await query(
    `${BOOKING_SELECT} WHERE b.user_id = $1 ORDER BY b.booking_date DESC, b.created_at DESC LIMIT 50`,
    [req.user.id]
  );
  res.json({ bookings: rows.map(formatBooking) });
});

// GET /api/bookings?date=2026-09-25  (staff) - all bookings for a day
router.get("/bookings", requireStaff, async (req, res) => {
  const date = readDate(req.query.date);
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.booking_date = $1 ORDER BY b.created_at`, [date]);
  res.json({ date, bookings: rows.map(formatBooking) });
});

// DELETE /api/bookings/:id  - customer cancels their own booking (staff can cancel any)
router.delete("/bookings/:id", requireAuth, async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
  const booking = rows[0];
  const isStaff = req.user.account_type === "staff";
  if (!booking || (!isStaff && booking.user_id !== req.user.id)) throw new HttpError(404, "Booking not found");
  if (booking.status !== "confirmed") throw new HttpError(400, `This booking is already ${booking.status}`);

  await query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);
  if (isStaff) {
    await notifyCustomer(booking.user_id, "Booking cancelled", `Your booking for ${booking.table_label} at ${booking.time_slot} was cancelled by the cafe.`);
  } else {
    await notifyStaff("Booking cancelled", `${booking.customer_name} cancelled ${booking.table_label} at ${booking.time_slot}.`);
  }
  res.json({ booking: formatBooking({ ...booking, status: "cancelled" }) });
});

// PATCH /api/bookings/:id/complete  (staff) - guests arrived
router.patch("/bookings/:id/complete", requireStaff, async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await query(
    "UPDATE bookings SET status = 'completed' WHERE id = $1 AND status = 'confirmed' RETURNING id",
    [id]
  );
  if (!rows[0]) throw new HttpError(400, "Only confirmed bookings can be completed");
  const result = await query(`${BOOKING_SELECT} WHERE b.id = $1`, [id]);
  res.json({ booking: formatBooking(result.rows[0]) });
});

module.exports = router;
