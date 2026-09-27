// Anonymous feedback: anyone can send it, only staff can read it.
const express = require("express");
const { query } = require("../db");
const { requireStaff } = require("../middleware/auth");
const { Validator } = require("../utils/validate");
const { notifyStaff } = require("../utils/notify");

const router = express.Router();

// POST /api/feedback  { rating: 1-5, comment? }
router.post("/", async (req, res) => {
  const { rating, comment = "" } = req.body;
  const v = new Validator();
  v.check(Number.isInteger(rating) && rating >= 1 && rating <= 5, "rating", "Choose a rating from 1 to 5 stars");
  v.check(typeof comment === "string" && comment.length <= 1000, "comment", "Comment must be under 1000 characters");
  v.throwIfErrors();

  await query("INSERT INTO feedback (rating, comment) VALUES ($1, $2)", [rating, comment.trim()]);
  if (rating <= 2) {
    await notifyStaff("Low rating received", `A customer left a ${rating}-star review${comment.trim() ? `: "${comment.trim().slice(0, 80)}"` : "."}`);
  }
  res.status(201).json({ message: "Thanks for your feedback!" });
});

// GET /api/feedback  (staff) - newest first, with the average rating
router.get("/", requireStaff, async (req, res) => {
  const { rows } = await query("SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200");
  const stats = await query("SELECT COUNT(*)::int AS count, ROUND(AVG(rating), 1)::float AS average FROM feedback");
  res.json({
    averageRating: stats.rows[0].average,
    count: stats.rows[0].count,
    entries: rows.map((r) => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.created_at })),
  });
});

module.exports = router;
