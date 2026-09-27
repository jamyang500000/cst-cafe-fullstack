// Menu: anyone can browse; staff can add, edit, remove and mark sold out.
const express = require("express");
const { query } = require("../db");
const config = require("../config");
const { requireStaff, requireCustomer } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatMenuItem } = require("../utils/format");
const { notifyStaff } = require("../utils/notify");
const { Validator, isNonEmptyString, parseId, parsePrepMinutes } = require("../utils/validate");

const router = express.Router();

async function findItem(id) {
  const { rows } = await query("SELECT * FROM menu_items WHERE id = $1 AND NOT is_deleted", [id]);
  if (!rows[0]) throw new HttpError(404, "Menu item not found");
  return rows[0];
}

// Checks the fields for create (all required) or update (only the ones sent).
function validateItem(body, { partial }) {
  const v = new Validator();
  const has = (field) => !partial || body[field] !== undefined;

  if (has("name")) v.check(isNonEmptyString(body.name, 100), "name", "Name is required");
  if (has("category")) v.check(config.categories.includes(body.category), "category", `Category must be one of: ${config.categories.join(", ")}`);
  if (has("price")) v.check(["number", "string"].includes(typeof body.price) && /^\d{1,6}$/.test(String(body.price).trim()), "price", "Price must be a whole number (Nu.)");
  if (body.prepTime !== undefined) {
    const mins = parsePrepMinutes(body.prepTime);
    v.check(Number.isInteger(mins) && mins > 0 && mins <= 240, "prepTime", 'Prep time must be like "10 min"');
  }
  if (body.description !== undefined) v.check(typeof body.description === "string" && body.description.length <= 500, "description", "Description is too long");
  if (body.image !== undefined && body.image !== null && body.image !== "") v.check(typeof body.image === "string" && /^https?:\/\//.test(body.image), "image", "Image must be a web address (http/https)");
  if (body.available !== undefined) v.check(typeof body.available === "boolean", "available", "available must be true or false");
  v.throwIfErrors();
}

// GET /api/menu?category=Meals&available=true
router.get("/", async (req, res) => {
  const { category, available } = req.query;
  const conditions = ["NOT is_deleted"];
  const params = [];
  if (category && category !== "All") {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (available === "true") conditions.push("available");
  const { rows } = await query(
    `SELECT * FROM menu_items WHERE ${conditions.join(" AND ")} ORDER BY
       array_position(ARRAY['Meals','Snacks','Beverages'], category), id`,
    params
  );
  res.json({ categories: ["All", ...config.categories], items: rows.map(formatMenuItem) });
});

// GET /api/menu/recommendations  (customer)
// "Your favourites": the available items this customer orders most.
// Empty unless they turned on recommendations in Privacy settings.
router.get("/recommendations", requireCustomer, async (req, res) => {
  const setting = await query("SELECT recommendations FROM users WHERE id = $1", [req.user.id]);
  if (!setting.rows[0].recommendations) return res.json({ enabled: false, items: [] });
  const { rows } = await query(
    `SELECT m.*, SUM(oi.qty)::int AS times_ordered
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     JOIN menu_items m ON m.id = oi.menu_item_id
     WHERE o.user_id = $1 AND o.status <> 'cancelled' AND m.available AND NOT m.is_deleted
     GROUP BY m.id ORDER BY times_ordered DESC, m.name LIMIT 3`,
    [req.user.id]
  );
  res.json({
    enabled: true,
    items: rows.map((r) => ({ ...formatMenuItem(r), timesOrdered: r.times_ordered })),
  });
});

// GET /api/menu/:id
router.get("/:id", async (req, res) => {
  res.json({ item: formatMenuItem(await findItem(parseId(req.params.id))) });
});

// POST /api/menu  (staff)  { name, category, price, prepTime?, description?, image?, available? }
router.post("/", requireStaff, async (req, res) => {
  validateItem(req.body, { partial: false });
  const b = req.body;
  const { rows } = await query(
    `INSERT INTO menu_items (name, category, price, prep_minutes, description, image_url, available)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      b.name.trim(),
      b.category,
      Number(b.price),
      b.prepTime !== undefined ? parsePrepMinutes(b.prepTime) : 5,
      (b.description || "").trim(),
      b.image || null,
      b.available !== undefined ? b.available : true,
    ]
  );
  res.status(201).json({ item: formatMenuItem(rows[0]) });
});

// PATCH /api/menu/:id  (staff)  any of the fields above
router.patch("/:id", requireStaff, async (req, res) => {
  const id = parseId(req.params.id);
  await findItem(id);
  validateItem(req.body, { partial: true });
  const b = req.body;
  const { rows } = await query(
    `UPDATE menu_items SET
       name         = COALESCE($1, name),
       category     = COALESCE($2, category),
       price        = COALESCE($3, price),
       prep_minutes = COALESCE($4, prep_minutes),
       description  = COALESCE($5, description),
       image_url    = CASE WHEN $6::boolean THEN $7 ELSE image_url END,
       available    = COALESCE($8, available)
     WHERE id = $9 RETURNING *`,
    [
      b.name !== undefined ? b.name.trim() : null,
      b.category ?? null,
      b.price !== undefined ? Number(b.price) : null,
      b.prepTime !== undefined ? parsePrepMinutes(b.prepTime) : null,
      b.description !== undefined ? b.description.trim() : null,
      b.image !== undefined,
      b.image || null,
      b.available ?? null,
      id,
    ]
  );
  res.json({ item: formatMenuItem(rows[0]) });
});

// PATCH /api/menu/:id/availability  (staff)  { available? }  - toggles if not given
router.patch("/:id/availability", requireStaff, async (req, res) => {
  const id = parseId(req.params.id);
  const item = await findItem(id);
  if (req.body.available !== undefined && typeof req.body.available !== "boolean") {
    throw new HttpError(400, "available must be true or false");
  }
  const available = req.body.available ?? !item.available;
  const { rows } = await query("UPDATE menu_items SET available = $1 WHERE id = $2 RETURNING *", [available, id]);
  if (item.available && !available) {
    await notifyStaff("Item sold out", `${item.name} was marked sold out by ${req.user.name}.`);
  }
  res.json({ item: formatMenuItem(rows[0]) });
});

// DELETE /api/menu/:id  (staff) - hidden from the menu, old orders keep working
router.delete("/:id", requireStaff, async (req, res) => {
  const id = parseId(req.params.id);
  await findItem(id);
  await query("UPDATE menu_items SET is_deleted = TRUE, available = FALSE WHERE id = $1", [id]);
  res.json({ message: "Menu item removed" });
});

module.exports = router;
