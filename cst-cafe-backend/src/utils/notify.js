const { query } = require("../db");
const events = require("./events");

// Inside a transaction the data isn't visible until COMMIT, so the route
// sends the live update itself afterwards. Otherwise send it straight away.
function isPool(db) {
  return db.query === query;
}

// `db` can be a transaction client or omitted to use the pool.
async function notifyCustomer(userId, title, message, db = { query }) {
  await db.query(
    "INSERT INTO notifications (audience, user_id, title, message) VALUES ('customer', $1, $2, $3)",
    [userId, title, message]
  );
  if (isPool(db)) events.toUser(userId, "notifications");
}

// Order status updates - skipped if the customer turned them off in
// Privacy settings ("Notify me about my order status").
async function notifyOrderUpdate(userId, title, message, db = { query }) {
  const { rowCount } = await db.query(
    `INSERT INTO notifications (audience, user_id, title, message)
     SELECT 'customer', id, $2::text, $3::text FROM users WHERE id = $1 AND order_notifications`,
    [userId, title, message]
  );
  if (rowCount > 0 && isPool(db)) events.toUser(userId, "notifications");
}

async function notifyStaff(title, message, db = { query }) {
  await db.query(
    "INSERT INTO notifications (audience, user_id, title, message) VALUES ('staff', NULL, $1, $2)",
    [title, message]
  );
  if (isPool(db)) events.toStaff("notifications");
}

module.exports = { notifyCustomer, notifyOrderUpdate, notifyStaff };
