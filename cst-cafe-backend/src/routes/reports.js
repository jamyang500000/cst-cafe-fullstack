// Basic reports for the staff dashboard (proposal: "Reports - basic demand
// & activity insights").
const express = require("express");
const { query } = require("../db");
const { requireStaff } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { isValidDate, todayString } = require("../utils/validate");

const router = express.Router();

// GET /api/reports/summary?date=2026-09-25&days=30  (staff)
//  - that day's orders, revenue, bookings and busiest hours
//  - most popular items over the last `days` days (default 30)
router.get("/summary", requireStaff, async (req, res) => {
  const date = req.query.date || todayString();
  if (!isValidDate(date)) throw new HttpError(400, "Date must look like YYYY-MM-DD");
  const days = req.query.days ? Number(req.query.days) : 30;
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new HttpError(400, "days must be 1-365");

  const [orders, hours, popular, bookings, rating] = await Promise.all([
    query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'picked_up')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
         COUNT(*) FILTER (WHERE status IN ('waiting','preparing','ready','delayed'))::int AS active,
         COUNT(*) FILTER (WHERE order_type = 'takeaway')::int AS takeaway,
         COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::int AS revenue
       FROM orders WHERE order_date = $1`,
      [date]
    ),
    query(
      `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS orders
       FROM orders WHERE order_date = $1 AND status <> 'cancelled'
       GROUP BY 1 ORDER BY 1`,
      [date]
    ),
    query(
      `SELECT oi.name, SUM(oi.qty)::int AS quantity, SUM(oi.qty * oi.price)::int AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN users u ON u.id = o.user_id
       WHERE o.status <> 'cancelled' AND o.order_date > $1::date - $2::int
         AND u.share_order_history  -- respect customers' privacy setting
       GROUP BY oi.name ORDER BY quantity DESC, oi.name LIMIT 5`,
      [date, days]
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE status <> 'cancelled')::int AS total,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM bookings WHERE booking_date = $1`,
      [date]
    ),
    query("SELECT ROUND(AVG(rating), 1)::float AS average, COUNT(*)::int AS count FROM feedback"),
  ]);

  res.json({
    date,
    orders: orders.rows[0],
    ordersByHour: hours.rows,
    popularItems: { days, items: popular.rows },
    bookings: bookings.rows[0],
    feedback: rating.rows[0],
  });
});

module.exports = router;
