// Pre-orders, the live queue and order status.
//
// Status flow:
//   waiting -> preparing -> ready -> picked_up
//   waiting/preparing -> delayed -> preparing/ready
//   waiting -> cancelled   (customer within 3 minutes, or staff any time)
const express = require("express");
const { query, transaction } = require("../db");
const config = require("../config");
const { requireAuth, requireCustomer, requireStaff } = require("../middleware/auth");
const { HttpError } = require("../utils/errors");
const { formatOrder, orderCode } = require("../utils/format");
const { notifyOrderUpdate, notifyStaff } = require("../utils/notify");
const events = require("../utils/events");

// Live update: the order's owner and all staff reload this order / the queue.
function orderChanged(orderId, ownerId) {
  events.toUser(ownerId, "order", { id: orderId });
  events.toStaff("order", { id: orderId });
}
const { Validator, TIME_RE, isPositiveInt, parseId, todayString } = require("../utils/validate");

const router = express.Router();

const ACTIVE_STATUSES = ["waiting", "preparing", "ready", "delayed"];

// Which status staff may move an order to, from each status.
const STAFF_TRANSITIONS = {
  waiting: ["preparing", "delayed", "cancelled"],
  preparing: ["ready", "delayed"],
  delayed: ["preparing", "ready", "cancelled"],
  ready: ["picked_up"],
  picked_up: [],
  cancelled: [],
};

// What the customer is told when staff change the status.
const CUSTOMER_MESSAGES = {
  preparing: ["Order being prepared", (o) => `${orderCode(o.id)} is now being prepared.`],
  ready: ["Order ready", (o) => `${orderCode(o.id)} is ready for pickup at the counter (queue #${o.queue_number}).`],
  delayed: ["Order delayed", (o) => `${orderCode(o.id)} is running a little late. We'll notify you the moment it's ready.`],
  cancelled: ["Order cancelled", (o) => `${orderCode(o.id)} was cancelled by the cafe. Please ask at the counter if you have questions.`],
};

const ORDER_SELECT = `
  SELECT o.*, t.label AS table_label, u.name AS customer_name
  FROM orders o
  LEFT JOIN cafe_tables t ON t.id = o.table_id
  JOIN users u ON u.id = o.user_id`;

// Loads orders with their items and returns them in frontend shape.
async function loadOrders(whereSql, params, db = { query }) {
  const { rows } = await db.query(`${ORDER_SELECT} ${whereSql}`, params);
  if (rows.length === 0) return [];
  const items = await db.query(
    "SELECT * FROM order_items WHERE order_id = ANY($1) ORDER BY id",
    [rows.map((r) => r.id)]
  );
  return rows.map((row) => formatOrder(row, items.rows.filter((i) => i.order_id === row.id)));
}

async function loadOrder(id, db) {
  const [order] = await loadOrders("WHERE o.id = $1", [id], db);
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

// Adds queue position and cancel countdown for the customer's order page.
async function withLiveInfo(order) {
  let aheadInQueue = 0;
  if (["waiting", "preparing", "delayed"].includes(order.status)) {
    const { rows } = await query(
      `SELECT COUNT(*)::int AS n FROM orders
       WHERE order_date = (SELECT order_date FROM orders WHERE id = $1)
         AND status IN ('waiting', 'preparing', 'delayed') AND queue_number < $2`,
      [order.id, order.queueNumber]
    );
    aheadInQueue = rows[0].n;
  }
  const ageSeconds = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 1000);
  const cancelSecondsLeft =
    order.status === "waiting" ? Math.max(0, config.cancelWindowSeconds - ageSeconds) : 0;
  return { ...order, aheadInQueue, cancelSecondsLeft };
}

// Validates [{ id, qty }] against the menu and returns priced lines.
async function priceItems(items, db) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "Add at least one item to your order", { items: "Order is empty" });
  }
  const merged = new Map();
  for (const line of items) {
    const id = Number(line?.id);
    const qty = line?.qty;
    if (!isPositiveInt(id) || !isPositiveInt(qty, 20)) {
      throw new HttpError(400, "Each item needs an id and a quantity from 1 to 20", { items: "Invalid item" });
    }
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  const { rows } = await db.query(
    "SELECT * FROM menu_items WHERE id = ANY($1) AND NOT is_deleted",
    [[...merged.keys()]]
  );
  const lines = [];
  for (const [id, qty] of merged) {
    const item = rows.find((r) => r.id === id);
    if (!item) throw new HttpError(400, `Menu item ${id} doesn't exist`, { items: "Unknown item" });
    if (!item.available) throw new HttpError(409, `${item.name} is sold out`, { items: `${item.name} is sold out` });
    if (qty > 20) throw new HttpError(400, `Too many ${item.name}`, { items: "Max 20 of one item" });
    lines.push({ menuItemId: id, name: item.name, price: item.price, qty });
  }
  return lines;
}

function totals(lines, orderType) {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const takeawayFee = orderType === "takeaway" ? config.takeawayFee : 0;
  return { subtotal, takeawayFee, total: subtotal + takeawayFee };
}

async function insertItems(db, orderId, lines) {
  for (const l of lines) {
    await db.query(
      "INSERT INTO order_items (order_id, menu_item_id, name, price, qty) VALUES ($1, $2, $3, $4, $5)",
      [orderId, l.menuItemId, l.name, l.price, l.qty]
    );
  }
}

// Customers can only see their own orders; staff can see all.
async function findOrderFor(user, id) {
  const { rows } = await query("SELECT user_id FROM orders WHERE id = $1", [id]);
  // "Not found" (not "forbidden") so customers can't discover other orders.
  if (!rows[0] || (user.account_type !== "staff" && rows[0].user_id !== user.id)) {
    throw new HttpError(404, "Order not found");
  }
  return { order: await loadOrder(id), ownerId: rows[0].user_id };
}

// Changes status only if it's still `from` - protects against two people
// updating the same order at the same moment.
async function moveStatus(id, from, to) {
  const { rowCount } = await query(
    "UPDATE orders SET status = $1, updated_at = now() WHERE id = $2 AND status = $3",
    [to, id, from]
  );
  if (rowCount === 0) throw new HttpError(409, "This order was just updated by someone else. Please refresh.");
}

// ---------------- Customer ----------------

// POST /api/orders  (customer)
// { items: [{ id, qty }], orderType?: "dine-in"|"takeaway", tableId?, bookingId?, time? }
router.post("/", requireCustomer, async (req, res) => {
  const { items, orderType = "dine-in", time } = req.body;
  let { tableId = null, bookingId = null } = req.body;

  const v = new Validator();
  v.check(["dine-in", "takeaway"].includes(orderType), "orderType", 'orderType must be "dine-in" or "takeaway"');
  v.check(time === undefined || time === null || (typeof time === "string" && TIME_RE.test(time)), "time", 'Pickup time must look like "12:15 PM"');
  v.check(tableId === null || isPositiveInt(tableId), "tableId", "Invalid table");
  v.check(bookingId === null || isPositiveInt(bookingId), "bookingId", "Invalid booking");
  v.throwIfErrors();

  let pickupTime = time || null;
  if (bookingId) {
    const { rows } = await query(
      "SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND status = 'confirmed'",
      [bookingId, req.user.id]
    );
    if (!rows[0]) throw new HttpError(400, "That booking isn't active", { bookingId: "Booking not found" });
    tableId = rows[0].table_id; // eat at the booked table
    pickupTime = pickupTime || rows[0].time_slot;
  }
  if (orderType === "takeaway") tableId = null;
  if (tableId) {
    const t = await query("SELECT 1 FROM cafe_tables WHERE id = $1", [tableId]);
    if (t.rowCount === 0) throw new HttpError(400, "Table not found", { tableId: "Table not found" });
  }

  const orderId = await transaction(async (db) => {
    const lines = await priceItems(items, db);
    const { subtotal, takeawayFee, total } = totals(lines, orderType);
    const today = todayString();

    // Only one order at a time may pick the next queue number.
    await db.query("SELECT pg_advisory_xact_lock(42)");
    const q = await db.query(
      "SELECT COALESCE(MAX(queue_number), 0) + 1 AS next FROM orders WHERE order_date = $1",
      [today]
    );
    const { rows } = await db.query(
      `INSERT INTO orders (user_id, queue_number, order_date, order_type, table_id, booking_id,
                           pickup_time, subtotal, takeaway_fee, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, queue_number`,
      [req.user.id, q.rows[0].next, today, orderType, tableId, bookingId, pickupTime, subtotal, takeawayFee, total]
    );
    await insertItems(db, rows[0].id, lines);

    const count = lines.reduce((s, l) => s + l.qty, 0);
    await notifyStaff(
      "New order",
      `${orderCode(rows[0].id)} (queue #${rows[0].queue_number}) - ${orderType}, ${count} item${count === 1 ? "" : "s"}, Nu. ${total}.`,
      db
    );
    await notifyOrderUpdate(req.user.id, "Order placed", `${orderCode(rows[0].id)} is in the queue as #${rows[0].queue_number}.`, db);
    return rows[0].id;
  });

  // Sent after the transaction has committed, so the data is really there.
  orderChanged(orderId, req.user.id);
  events.toStaff("notifications");
  events.toUser(req.user.id, "notifications");
  res.status(201).json({ order: await withLiveInfo(await loadOrder(orderId)) });
});

// GET /api/orders/mine?active=true  (customer) - newest first
router.get("/mine", requireCustomer, async (req, res) => {
  const activeOnly = req.query.active === "true";
  const orders = await loadOrders(
    `WHERE o.user_id = $1 ${activeOnly ? "AND o.status = ANY($2)" : ""} ORDER BY o.created_at DESC LIMIT 50`,
    activeOnly ? [req.user.id, ACTIVE_STATUSES] : [req.user.id]
  );
  res.json({ orders: await Promise.all(orders.map(withLiveInfo)) });
});

// ---------------- Staff ----------------

// GET /api/orders/queue?all=true  (staff) - today's orders, oldest first
// Without ?all=true only active orders (waiting/preparing/ready/delayed) are returned.
router.get("/queue", requireStaff, async (req, res) => {
  const all = req.query.all === "true";
  const orders = await loadOrders(
    `WHERE o.order_date = $1 ${all ? "" : "AND o.status = ANY($2)"} ORDER BY o.queue_number`,
    all ? [todayString()] : [todayString(), ACTIVE_STATUSES]
  );
  res.json({ orders, nextStatus: STAFF_TRANSITIONS });
});

// PATCH /api/orders/:id/status  (staff)  { status }
router.patch("/:id/status", requireStaff, async (req, res) => {
  const id = parseId(req.params.id);
  const { status } = req.body;
  const { rows } = await query("SELECT * FROM orders WHERE id = $1", [id]);
  const order = rows[0];
  if (!order) throw new HttpError(404, "Order not found");
  const allowed = STAFF_TRANSITIONS[order.status];
  if (!allowed.includes(status)) {
    throw new HttpError(
      400,
      allowed.length
        ? `A ${order.status} order can only be changed to: ${allowed.join(", ")}`
        : `This order is already ${order.status.replace("_", " ")}`
    );
  }
  await moveStatus(id, order.status, status);
  orderChanged(id, order.user_id);
  if (CUSTOMER_MESSAGES[status]) {
    const [title, message] = CUSTOMER_MESSAGES[status];
    await notifyOrderUpdate(order.user_id, title, message(order));
  }
  res.json({ order: await loadOrder(id) });
});

// ---------------- Both ----------------

// GET /api/orders/:id  - owner or staff
router.get("/:id", requireAuth, async (req, res) => {
  const { order } = await findOrderFor(req.user, parseId(req.params.id));
  res.json({ order: await withLiveInfo(order) });
});

// PATCH /api/orders/:id  (customer, only while "waiting")
// { orderType?, items?: [{ id, qty }] }  - change dine-in/takeaway or remove items
router.patch("/:id", requireCustomer, async (req, res) => {
  const id = parseId(req.params.id);
  const { order } = await findOrderFor(req.user, id);
  if (order.status !== "waiting") {
    throw new HttpError(400, "This order is already being prepared and can't be changed");
  }
  const { orderType, items } = req.body;
  if (orderType !== undefined && !["dine-in", "takeaway"].includes(orderType)) {
    throw new HttpError(400, 'orderType must be "dine-in" or "takeaway"');
  }
  if (orderType === undefined && items === undefined) throw new HttpError(400, "Nothing to update");
  if (Array.isArray(items) && items.length === 0) {
    throw new HttpError(400, "An order needs at least one item. Cancel the order instead.");
  }

  await transaction(async (db) => {
    // Lock the order row so staff can't start preparing it mid-edit.
    const lock = await db.query("SELECT status FROM orders WHERE id = $1 FOR UPDATE", [id]);
    if (lock.rows[0].status !== "waiting") {
      throw new HttpError(409, "This order was just updated by someone else. Please refresh.");
    }
    const type = orderType || order.orderType;
    let lines;
    if (items !== undefined) {
      lines = await priceItems(items, db);
      await db.query("DELETE FROM order_items WHERE order_id = $1", [id]);
      await insertItems(db, id, lines);
    } else {
      lines = order.items.map((i) => ({ price: i.price, qty: i.qty }));
    }
    const t = totals(lines, type);
    await db.query(
      `UPDATE orders SET order_type = $1, table_id = CASE WHEN $1 = 'takeaway' THEN NULL ELSE table_id END,
         subtotal = $2, takeaway_fee = $3, total = $4, updated_at = now() WHERE id = $5`,
      [type, t.subtotal, t.takeawayFee, t.total, id]
    );
  });
  orderChanged(id, req.user.id);
  res.json({ order: await withLiveInfo(await loadOrder(id)) });
});

// POST /api/orders/:id/cancel  (customer, within 3 minutes while "waiting")
router.post("/:id/cancel", requireCustomer, async (req, res) => {
  const id = parseId(req.params.id);
  const { order } = await findOrderFor(req.user, id);
  const live = await withLiveInfo(order);
  if (order.status !== "waiting") throw new HttpError(400, "This order is already being prepared and can't be cancelled");
  if (live.cancelSecondsLeft <= 0) throw new HttpError(400, "The 3-minute cancellation window has passed. Please ask at the counter.");

  await moveStatus(id, "waiting", "cancelled");
  orderChanged(id, req.user.id);
  await notifyStaff("Order cancelled", `${order.code} was cancelled by the customer.`);
  res.json({ order: await withLiveInfo(await loadOrder(id)) });
});

// POST /api/orders/:id/pickup  (customer confirms they have it, once "ready")
router.post("/:id/pickup", requireCustomer, async (req, res) => {
  const id = parseId(req.params.id);
  const { order } = await findOrderFor(req.user, id);
  if (order.status !== "ready") throw new HttpError(400, "You can confirm pickup once your order is ready");
  await moveStatus(id, "ready", "picked_up");
  orderChanged(id, req.user.id);
  res.json({ order: await withLiveInfo(await loadOrder(id)) });
});

module.exports = router;
