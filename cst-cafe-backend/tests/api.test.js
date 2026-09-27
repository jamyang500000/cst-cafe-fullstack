// End-to-end API test. Runs every main flow against the database in .env.
//   npm test
// It creates test customers, orders and bookings in that database. Run
// `npm run db:setup` afterwards if you want a clean database again.
// Each run uses its own users/dates, so it can be run as often as you like.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const { pool, query } = require("../src/db");

let server;
let base;
const unique = Date.now();

// A different far-future date and time for each run, so bookings made by
// earlier test runs never clash with this one.
function futureDate() {
  const d = new Date(Date.UTC(2100, 0, 1) + (unique % 36500) * 86400000);
  return d.toISOString().slice(0, 10);
}
function randomTime() {
  const minute = String(Math.floor(Math.random() * 60)).padStart(2, "0");
  return `${1 + Math.floor(Math.random() * 12)}:${minute} PM`;
}

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function newCustomer(name = "Test Customer") {
  const email = `cust${unique}${Math.random().toString(36).slice(2, 7)}@rub.edu.bt`;
  const r = await api("POST", "/auth/signup", { body: { name, email, phone: "17000000", password: "password123" } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  return { token: r.data.token, user: r.data.user };
}

async function staffLogin() {
  const r = await api("POST", "/staff/login", { body: { email: "pema.choden@cstcafe.bt", password: "cstcafe123" } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return r.data.token;
}

async function menuItem(name) {
  const r = await api("GET", "/menu");
  return r.data.items.find((i) => i.name === name);
}

test("health check", async () => {
  const r = await api("GET", "/health");
  assert.deepEqual(r.data, { status: "ok" });
});

test("customer signup, login, profile and password", async () => {
  const email = `karma${unique}@RUB.edu.bt `;
  let r = await api("POST", "/auth/signup", { body: { name: "Karma", email, password: "short" } });
  assert.equal(r.status, 400);
  assert.ok(r.data.details.password);

  r = await api("POST", "/auth/signup", { body: { name: "Karma", email, phone: "17123456", password: "password123" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.email, `karma${unique}@rub.edu.bt`, "email is trimmed + lowercased");
  assert.equal(r.data.user.accountType, "customer");
  assert.equal(r.data.user.password_hash, undefined, "never leak the hash");

  r = await api("POST", "/auth/signup", { body: { name: "Again", email, password: "password123" } });
  assert.equal(r.status, 409, "duplicate email rejected");

  r = await api("POST", "/auth/login", { body: { email, password: "wrong-password" } });
  assert.equal(r.status, 401);
  assert.equal(r.data.error, "Invalid email or password");

  r = await api("POST", "/auth/login", { body: { email, password: "password123" } });
  assert.equal(r.status, 200);
  const token = r.data.token;

  r = await api("GET", "/auth/me", { token });
  assert.equal(r.data.user.name, "Karma");

  r = await api("GET", "/auth/me");
  assert.equal(r.status, 401, "no token");
  r = await api("GET", "/auth/me", { token: "garbage" });
  assert.equal(r.status, 401, "bad token");

  r = await api("PATCH", "/users/me", { token, body: { name: "Karma Wangdi", phone: "17999999" } });
  assert.equal(r.data.user.name, "Karma Wangdi");
  assert.equal(r.data.user.phone, "17999999");

  r = await api("PATCH", "/users/me", { token, body: { email: "pema.choden@cstcafe.bt" } });
  assert.equal(r.status, 409, "can't take someone else's email");

  r = await api("PATCH", "/users/me/password", { token, body: { currentPassword: "nope", newPassword: "newpassword1" } });
  assert.equal(r.status, 400);
  r = await api("PATCH", "/users/me/password", { token, body: { currentPassword: "password123", newPassword: "newpassword1" } });
  assert.equal(r.status, 200);
  r = await api("POST", "/auth/login", { body: { email, password: "newpassword1" } });
  assert.equal(r.status, 200, "new password works");

  r = await api("GET", "/notifications", { token });
  assert.equal(r.data.notifications[0].title, "Welcome to CST Cafe");
});

test("staff signup/login and portal separation", async () => {
  const email = `staff${unique}@cstcafe.bt`;
  let r = await api("POST", "/staff/signup", { body: { name: "Tashi", email, role: "Chef", password: "password123" } });
  assert.equal(r.status, 400, "role must be a known role");
  r = await api("POST", "/staff/signup", { body: { name: "Tashi", email, role: "Kitchen", password: "password123" } });
  assert.equal(r.status, 201);
  assert.equal(r.data.user.role, "Kitchen");

  r = await api("POST", "/auth/login", { body: { email, password: "password123" } });
  assert.equal(r.status, 403, "staff can't use the customer login");
  r = await api("POST", "/staff/login", { body: { email: "karma.wangdi@rub.edu.bt", password: "cstcafe123" } });
  assert.equal(r.status, 403, "customers can't use the staff login");
});

test("menu browsing and staff menu management", async () => {
  let r = await api("GET", "/menu");
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.categories, ["All", "Meals", "Snacks", "Beverages"]);
  assert.equal(r.data.items.length, 7);
  assert.equal(r.data.items[0].prepTime, "12 min");

  r = await api("GET", "/menu?category=Beverages");
  assert.ok(r.data.items.every((i) => i.category === "Beverages"));

  const customer = await newCustomer();
  r = await api("POST", "/menu", { token: customer.token, body: { name: "Hack", category: "Meals", price: 1 } });
  assert.equal(r.status, 403, "customers can't edit the menu");

  const staff = await staffLogin();
  r = await api("POST", "/menu", { token: staff, body: { name: "Suja", category: "Soup", price: -5 } });
  assert.equal(r.status, 400);
  assert.ok(r.data.details.category && r.data.details.price);

  r = await api("POST", "/menu", { token: staff, body: { name: "Suja", category: "Beverages", price: "25", prepTime: "4 min", description: "Butter tea, the other name." } });
  assert.equal(r.status, 201);
  const id = r.data.item.id;
  assert.equal(r.data.item.prepMinutes, 4);

  r = await api("PATCH", `/menu/${id}`, { token: staff, body: { price: 30, description: "Updated" } });
  assert.equal(r.data.item.price, 30);
  assert.equal(r.data.item.name, "Suja", "unchanged fields stay");

  r = await api("PATCH", `/menu/${id}/availability`, { token: staff });
  assert.equal(r.data.item.available, false, "toggled to sold out");
  r = await api("GET", "/notifications", { token: staff });
  assert.ok(r.data.notifications.some((n) => n.title === "Item sold out" && n.message.includes("Suja")));

  r = await api("DELETE", `/menu/${id}`, { token: staff });
  assert.equal(r.status, 200);
  r = await api("GET", `/menu/${id}`);
  assert.equal(r.status, 404);
  r = await api("GET", "/menu/abc");
  assert.equal(r.status, 400);
});

test("table booking: availability, double booking, cancel", async () => {
  const a = await newCustomer("Sonam");
  const b = await newCustomer("Dechen");
  const date = futureDate();

  let r = await api("GET", `/tables?partySize=5`);
  assert.deepEqual(r.data.tables.map((t) => t.label), ["Table 4"], "only tables with enough seats");

  const table2 = (await api("GET", "/tables")).data.tables.find((t) => t.label === "Table 2");

  r = await api("POST", "/bookings", { token: a.token, body: { tableId: table2.id, time: "25:00", partySize: 2, date } });
  assert.equal(r.status, 400);
  r = await api("POST", "/bookings", { token: a.token, body: { tableId: table2.id, time: "12:15 PM", partySize: 9, date } });
  assert.equal(r.status, 400, "party too big for table");
  r = await api("POST", "/bookings", { token: a.token, body: { tableId: table2.id, time: "12:15 PM", partySize: 2, date: "2000-01-01" } });
  assert.equal(r.status, 400, "past date");

  r = await api("POST", "/bookings", { token: a.token, body: { tableId: table2.id, time: "12:15 PM", partySize: 3, date } });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const booking = r.data.booking;
  assert.equal(booking.table, "Table 2");
  assert.equal(booking.date, date);

  r = await api("POST", "/bookings", { token: b.token, body: { tableId: table2.id, time: "12:15 PM", partySize: 2, date } });
  assert.equal(r.status, 409, "same table + time can't be booked twice");

  r = await api("GET", `/tables?date=${date}&time=${encodeURIComponent("12:15 PM")}`);
  assert.equal(r.data.tables.find((t) => t.id === table2.id).available, false);

  r = await api("DELETE", `/bookings/${booking.id}`, { token: b.token });
  assert.equal(r.status, 404, "can't cancel someone else's booking");
  r = await api("DELETE", `/bookings/${booking.id}`, { token: a.token });
  assert.equal(r.data.booking.status, "cancelled");
  r = await api("DELETE", `/bookings/${booking.id}`, { token: a.token });
  assert.equal(r.status, 400, "already cancelled");

  r = await api("POST", "/bookings", { token: b.token, body: { tableId: table2.id, time: "12:15 PM", partySize: 2, date } });
  assert.equal(r.status, 201, "slot is free again after cancelling");

  const staff = await staffLogin();
  r = await api("GET", `/bookings?date=${date}`, { token: staff });
  assert.ok(r.data.bookings.some((x) => x.customer === "Dechen"));
  r = await api("GET", "/bookings/mine", { token: a.token });
  assert.equal(r.data.bookings.length, 1);

  r = await api("GET", "/time-slots");
  assert.equal(r.data.timeSlots.length, 8);
});

test("orders: place, queue, staff status flow, pickup", async () => {
  const customer = await newCustomer("Kencho");
  const staff = await staffLogin();
  const momo = await menuItem("Chicken Momo (10 pcs)");
  const tea = await menuItem("Milk Tea");
  const sandwich = await menuItem("Cheese Sandwich");

  let r = await api("POST", "/orders", { token: customer.token, body: { items: [] } });
  assert.equal(r.status, 400, "empty order");
  r = await api("POST", "/orders", { token: customer.token, body: { items: [{ id: sandwich.id, qty: 1 }] } });
  assert.equal(r.status, 409, "sold out item");
  r = await api("POST", "/orders", { token: staff, body: { items: [{ id: momo.id, qty: 1 }] } });
  assert.equal(r.status, 403, "staff can't place customer orders");

  // Price comes from the database, not the request
  r = await api("POST", "/orders", {
    token: customer.token,
    body: { items: [{ id: momo.id, qty: 1, price: 1 }, { id: tea.id, qty: 2 }, { id: tea.id, qty: 1 }], orderType: "takeaway", time: "12:15 PM" },
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const order = r.data.order;
  assert.equal(order.subtotal, 100 + 15 * 3);
  assert.equal(order.takeawayFee, 10);
  assert.equal(order.total, 155);
  assert.equal(order.items.find((i) => i.name === "Milk Tea").qty, 3, "duplicate lines merged");
  assert.match(order.code, /^ORD-\d{4,}$/);
  assert.equal(order.status, "waiting");
  assert.ok(order.cancelSecondsLeft > 170);

  // Second customer is behind in the queue
  const other = await newCustomer("Kuenzang");
  r = await api("POST", "/orders", { token: other.token, body: { items: [{ id: tea.id, qty: 1 }] } });
  const second = r.data.order;
  assert.equal(second.queueNumber, order.queueNumber + 1);
  assert.equal(second.aheadInQueue >= 1, true);

  r = await api("GET", `/orders/${order.id}`, { token: other.token });
  assert.equal(r.status, 404, "customers can't see other people's orders");

  // Staff sees it in the queue and moves it along
  r = await api("GET", "/orders/queue", { token: staff });
  const inQueue = r.data.orders.find((o) => o.id === order.id);
  assert.equal(inQueue.customer, "Kencho");
  assert.equal(inQueue.itemCount, 4);

  r = await api("PATCH", `/orders/${order.id}/status`, { token: staff, body: { status: "ready" } });
  assert.equal(r.status, 400, "can't skip from waiting to ready");
  r = await api("POST", `/orders/${order.id}/pickup`, { token: customer.token });
  assert.equal(r.status, 400, "can't pick up before ready");

  r = await api("PATCH", `/orders/${order.id}/status`, { token: staff, body: { status: "preparing" } });
  assert.equal(r.data.order.status, "preparing");
  r = await api("POST", `/orders/${order.id}/cancel`, { token: customer.token });
  assert.equal(r.status, 400, "can't cancel once preparing");
  r = await api("PATCH", `/orders/${order.id}`, { token: customer.token, body: { orderType: "dine-in" } });
  assert.equal(r.status, 400, "can't edit once preparing");

  r = await api("PATCH", `/orders/${order.id}/status`, { token: staff, body: { status: "delayed" } });
  r = await api("PATCH", `/orders/${order.id}/status`, { token: staff, body: { status: "ready" } });
  assert.equal(r.data.order.status, "ready");

  r = await api("GET", "/notifications", { token: customer.token });
  const titles = r.data.notifications.map((n) => n.title);
  for (const t of ["Order placed", "Order being prepared", "Order delayed", "Order ready"]) {
    assert.ok(titles.includes(t), `customer notified: ${t}`);
  }
  assert.ok(r.data.unreadCount >= 4);

  r = await api("POST", `/orders/${order.id}/pickup`, { token: customer.token });
  assert.equal(r.data.order.status, "picked_up");

  r = await api("GET", "/orders/mine?active=true", { token: customer.token });
  assert.equal(r.data.orders.length, 0, "picked-up order is no longer active");
  r = await api("GET", "/orders/mine", { token: customer.token });
  assert.equal(r.data.orders.length, 1);
});

test("orders: edit and cancel within 3 minutes, then window closes", async () => {
  const customer = await newCustomer("Ugyen");
  const staff = await staffLogin();
  const momo = await menuItem("Chicken Momo (10 pcs)");
  const tea = await menuItem("Milk Tea");

  let r = await api("POST", "/orders", { token: customer.token, body: { items: [{ id: momo.id, qty: 1 }, { id: tea.id, qty: 2 }] } });
  const order = r.data.order;
  assert.equal(order.total, 130);

  // Remove the tea and switch to takeaway
  r = await api("PATCH", `/orders/${order.id}`, { token: customer.token, body: { items: [{ id: momo.id, qty: 1 }], orderType: "takeaway" } });
  assert.equal(r.data.order.total, 110);
  assert.equal(r.data.order.items.length, 1);
  r = await api("PATCH", `/orders/${order.id}`, { token: customer.token, body: { items: [] } });
  assert.equal(r.status, 400, "can't remove every item");

  r = await api("POST", `/orders/${order.id}/cancel`, { token: customer.token });
  assert.equal(r.data.order.status, "cancelled");
  r = await api("GET", "/notifications", { token: staff });
  assert.ok(r.data.notifications.some((n) => n.title === "Order cancelled" && n.message.includes(order.code)));

  // An order older than 3 minutes can't be cancelled by the customer
  r = await api("POST", "/orders", { token: customer.token, body: { items: [{ id: tea.id, qty: 1 }] } });
  const old = r.data.order;
  await query("UPDATE orders SET created_at = now() - interval '4 minutes' WHERE id = $1", [old.id]);
  r = await api("POST", `/orders/${old.id}/cancel`, { token: customer.token });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /3-minute/);

  // Staff can still cancel a waiting order
  r = await api("PATCH", `/orders/${old.id}/status`, { token: staff, body: { status: "cancelled" } });
  assert.equal(r.data.order.status, "cancelled");
});

test("order linked to a booking uses the booked table", async () => {
  const customer = await newCustomer("Jamyang");
  const tables = (await api("GET", "/tables")).data.tables;
  const table5 = tables.find((t) => t.label === "Table 5");
  const today = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  // Try random times until one is free (earlier runs may have booked some)
  let r;
  let time;
  for (let attempt = 0; attempt < 10; attempt++) {
    time = randomTime();
    r = await api("POST", "/bookings", { token: customer.token, body: { tableId: table5.id, time, partySize: 2, date } });
    if (r.status !== 409) break;
  }
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const tea = await menuItem("Butter Tea");
  r = await api("POST", "/orders", { token: customer.token, body: { items: [{ id: tea.id, qty: 2 }], bookingId: r.data.booking.id } });
  assert.equal(r.status, 201);
  assert.equal(r.data.order.table, "Table 5");
  assert.equal(r.data.order.time, time);
});

test("parallel orders get unique queue numbers", async () => {
  const customers = await Promise.all([1, 2, 3, 4, 5, 6].map((n) => newCustomer(`Rush ${n}`)));
  const tea = await menuItem("Milk Tea");
  const results = await Promise.all(
    customers.map((c) => api("POST", "/orders", { token: c.token, body: { items: [{ id: tea.id, qty: 1 }] } }))
  );
  const numbers = results.map((r) => r.data.order.queueNumber);
  assert.equal(new Set(numbers).size, numbers.length, `no duplicate queue numbers: ${numbers}`);
});

test("feedback is anonymous and staff-only to read", async () => {
  let r = await api("POST", "/feedback", { body: { rating: 6 } });
  assert.equal(r.status, 400);
  r = await api("POST", "/feedback", { body: { rating: 2, comment: "Momo was cold" } });
  assert.equal(r.status, 201);

  const customer = await newCustomer();
  r = await api("GET", "/feedback", { token: customer.token });
  assert.equal(r.status, 403);

  const staff = await staffLogin();
  r = await api("GET", "/feedback", { token: staff });
  assert.equal(r.data.entries[0].comment, "Momo was cold");
  assert.equal(r.data.entries[0].userId, undefined, "no user attached");
  assert.ok(r.data.averageRating > 0);
  r = await api("GET", "/notifications", { token: staff });
  assert.ok(r.data.notifications.some((n) => n.title === "Low rating received"));
});

test("notifications: mark one / all as read, no peeking", async () => {
  const a = await newCustomer();
  const b = await newCustomer();
  let r = await api("GET", "/notifications", { token: a.token });
  const id = r.data.notifications[0].id;
  r = await api("PATCH", `/notifications/${id}/read`, { token: b.token });
  assert.equal(r.status, 404, "can't touch someone else's notification");
  r = await api("PATCH", `/notifications/${id}/read`, { token: a.token });
  assert.equal(r.data.notification.read, true);
  r = await api("POST", "/notifications/read-all", { token: a.token });
  r = await api("GET", "/notifications", { token: a.token });
  assert.equal(r.data.unreadCount, 0);
});

test("reports summary (staff)", async () => {
  const staff = await staffLogin();
  const r = await api("GET", "/reports/summary", { token: staff });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.orders.total >= 1);
  assert.ok(r.data.orders.revenue > 0);
  assert.ok(r.data.popularItems.items.length > 0);
  assert.ok(Array.isArray(r.data.ordersByHour));
  const bad = await api("GET", "/reports/summary?date=yesterday", { token: staff });
  assert.equal(bad.status, 400);
});

test("bad requests give clean errors", async () => {
  let r = await api("GET", "/nope");
  assert.equal(r.status, 404);
  const res = await fetch(base + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{not json" });
  assert.equal(res.status, 400);
  r = await api("POST", "/auth/login", {});
  assert.equal(r.status, 400, "missing body handled");
});

test("admin controls (managers only)", async () => {
  const manager = await staffLogin();
  const disabledName = `To Be Disabled ${unique}`;
  const customer = await newCustomer(disabledName);

  // A non-manager staff member
  const baristaEmail = `barista${unique}@cstcafe.bt`;
  let r = await api("POST", "/staff/signup", { body: { name: "Deki", email: baristaEmail, role: "Barista", password: "password123" } });
  const barista = r.data;

  r = await api("GET", "/admin/users", { token: barista.token });
  assert.equal(r.status, 403, "baristas can't see admin controls");
  r = await api("GET", "/admin/users", { token: customer.token });
  assert.equal(r.status, 403, "customers can't either");

  r = await api("GET", "/admin/users?type=staff", { token: manager });
  assert.equal(r.status, 200);
  assert.ok(r.data.users.every((u) => u.accountType === "staff"));
  assert.ok(r.data.users.some((u) => u.email === baristaEmail));
  r = await api("GET", `/admin/users?search=${encodeURIComponent(disabledName)}`, { token: manager });
  assert.equal(r.data.users[0].id, customer.user.id);
  assert.equal(typeof r.data.users[0].orderCount, "number");

  // Promote barista -> Manager -> back to Cashier
  r = await api("PATCH", `/admin/users/${barista.user.id}/role`, { token: manager, body: { role: "Chef" } });
  assert.equal(r.status, 400);
  r = await api("PATCH", `/admin/users/${barista.user.id}/role`, { token: manager, body: { role: "Manager" } });
  assert.equal(r.data.user.role, "Manager");
  r = await api("GET", "/admin/users", { token: barista.token });
  assert.equal(r.status, 200, "new manager gets access straight away");
  r = await api("PATCH", `/admin/users/${barista.user.id}/role`, { token: manager, body: { role: "Cashier" } });
  assert.equal(r.data.user.role, "Cashier");
  r = await api("PATCH", `/admin/users/${customer.user.id}/role`, { token: manager, body: { role: "Barista" } });
  assert.equal(r.status, 400, "customers have no role");

  // Can't lock yourself out
  const me = (await api("GET", "/auth/me", { token: manager })).data.user;
  r = await api("PATCH", `/admin/users/${me.id}/role`, { token: manager, body: { role: "Barista" } });
  assert.equal(r.status, 400);
  r = await api("PATCH", `/admin/users/${me.id}/active`, { token: manager, body: { active: false } });
  assert.equal(r.status, 400);

  // Disable the customer: their token stops working and they can't log in
  const tea = await menuItem("Milk Tea");
  await api("POST", "/orders", { token: customer.token, body: { items: [{ id: tea.id, qty: 1 }] } });
  r = await api("PATCH", `/admin/users/${customer.user.id}/active`, { token: manager, body: { active: false } });
  assert.equal(r.data.user.active, false);
  r = await api("GET", "/auth/me", { token: customer.token });
  assert.equal(r.status, 401);
  r = await api("POST", "/auth/login", { body: { email: customer.user.email, password: "password123" } });
  assert.equal(r.status, 403);
  assert.match(r.data.error, /disabled/);
  r = await api("POST", "/auth/login", { body: { email: customer.user.email, password: "wrong-password" } });
  assert.equal(r.status, 401, "wrong password doesn't reveal the account is disabled");
  r = await api("GET", `/admin/users?search=${encodeURIComponent(disabledName)}`, { token: manager });
  assert.equal(r.data.users[0].orderCount, 1, "their orders are kept");

  // Re-enable
  r = await api("PATCH", `/admin/users/${customer.user.id}/active`, { token: manager, body: { active: true } });
  r = await api("POST", "/auth/login", { body: { email: customer.user.email, password: "password123" } });
  assert.equal(r.status, 200);
});

test("privacy settings are saved and change behaviour", async () => {
  const staff = await staffLogin();
  const c = await newCustomer("Private Person");
  const momo = await menuItem("Chicken Momo (10 pcs)");
  const tea = await menuItem("Milk Tea");

  let r = await api("GET", "/users/me/privacy", { token: c.token });
  assert.deepEqual(r.data.privacy, { shareOrderHistory: true, orderNotifications: true, recommendations: false });

  r = await api("PATCH", "/users/me/privacy", { token: c.token, body: { recommendations: "yes" } });
  assert.equal(r.status, 400);
  r = await api("PATCH", "/users/me/privacy", { token: c.token, body: { password_hash: "x" } });
  assert.equal(r.status, 400, "unknown settings are ignored / rejected");

  // Recommendations: off -> nothing; on -> most-ordered items
  r = await api("GET", "/menu/recommendations", { token: c.token });
  assert.deepEqual(r.data, { enabled: false, items: [] });
  await api("POST", "/orders", { token: c.token, body: { items: [{ id: tea.id, qty: 3 }, { id: momo.id, qty: 1 }] } });
  r = await api("PATCH", "/users/me/privacy", { token: c.token, body: { recommendations: true } });
  assert.equal(r.data.privacy.recommendations, true);
  r = await api("GET", "/menu/recommendations", { token: c.token });
  assert.equal(r.data.enabled, true);
  assert.deepEqual(r.data.items.map((i) => i.name), ["Milk Tea", "Chicken Momo (10 pcs)"]);
  r = await api("GET", "/menu/recommendations", { token: staff });
  assert.equal(r.status, 403, "customers only");

  // Order notifications off -> status changes don't notify
  await api("PATCH", "/users/me/privacy", { token: c.token, body: { orderNotifications: false } });
  r = await api("POST", "/orders", { token: c.token, body: { items: [{ id: momo.id, qty: 1 }] } });
  const quiet = r.data.order;
  await api("PATCH", `/orders/${quiet.id}/status`, { token: staff, body: { status: "preparing" } });
  r = await api("GET", "/notifications", { token: c.token });
  assert.ok(!r.data.notifications.some((n) => n.message.includes(quiet.code)), "no notifications for this order");
  r = await api("GET", `/orders/${quiet.id}`, { token: c.token });
  assert.equal(r.data.order.status, "preparing", "order page still shows the status");

  // Share order history off -> not counted in popular items
  const before = await api("GET", "/reports/summary", { token: staff });
  const teaBefore = before.data.popularItems.items.find((i) => i.name === "Milk Tea")?.quantity || 0;
  await api("PATCH", "/users/me/privacy", { token: c.token, body: { shareOrderHistory: false } });
  const after = await api("GET", "/reports/summary", { token: staff });
  const teaAfter = after.data.popularItems.items.find((i) => i.name === "Milk Tea")?.quantity || 0;
  assert.equal(teaBefore - teaAfter, 3, "their 3 milk teas no longer counted");
  assert.equal(after.data.orders.total, before.data.orders.total, "but the cafe's order totals are unchanged");
});

// Opens the live-updates stream and records every event that arrives.
async function openStream(token) {
  const controller = new AbortController();
  const res = await fetch(`${base}/events?token=${encodeURIComponent(token)}`, { signal: controller.signal });
  const received = [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let cut;
        while ((cut = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, cut);
          buffer = buffer.slice(cut + 2);
          const event = chunk.match(/^event: (.+)$/m)?.[1];
          const data = chunk.match(/^data: (.+)$/m)?.[1];
          if (event) received.push({ event, data: data ? JSON.parse(data) : null, at: Date.now() });
        }
      }
    } catch {}
  })();
  return {
    status: res.status,
    received,
    close: () => controller.abort(),
    // Resolves when an event matching `test` arrives (or fails after `ms`).
    waitFor: async (test, ms = 3000) => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const hit = received.find(test);
        if (hit) return hit;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`no matching event within ${ms}ms; got: ${received.map((e) => e.event).join(", ")}`);
    },
  };
}

test("live updates (server-sent events)", async () => {
  const staffToken = await staffLogin();
  const customer = await newCustomer("Live Customer");
  const other = await newCustomer("Someone Else");
  const tea = await menuItem("Milk Tea");

  const bad = await fetch(`${base}/events?token=nonsense`);
  assert.equal(bad.status, 401, "needs a valid login");
  await bad.text();

  const staffStream = await openStream(staffToken);
  const custStream = await openStream(customer.token);
  const otherStream = await openStream(other.token);
  try {
    assert.equal(staffStream.status, 200);
    await staffStream.waitFor((e) => e.event === "connected");

    // Customer orders -> staff hear about it instantly
    const t0 = Date.now();
    const r = await api("POST", "/orders", { token: customer.token, body: { items: [{ id: tea.id, qty: 1 }] } });
    const order = r.data.order;
    const hit = await staffStream.waitFor((e) => e.event === "order" && e.data.id === order.id);
    assert.ok(hit.at - t0 < 1000, "arrives in under a second");
    await staffStream.waitFor((e) => e.event === "notifications");

    // Staff update status -> customer hears about it
    await api("PATCH", `/orders/${order.id}/status`, { token: staffToken, body: { status: "preparing" } });
    await custStream.waitFor((e) => e.event === "order" && e.data.id === order.id);
    await custStream.waitFor((e) => e.event === "notifications");

    // Other customers hear nothing about it
    await new Promise((r) => setTimeout(r, 200));
    assert.ok(!otherStream.received.some((e) => e.event === "order"), "no leaks to other customers");

    // Manager disables the customer -> their browser is told to log out
    const disabled = await newCustomer("Soon Disabled");
    const disabledStream = await openStream(disabled.token);
    await disabledStream.waitFor((e) => e.event === "connected");
    await api("PATCH", `/admin/users/${disabled.user.id}/active`, { token: staffToken, body: { active: false } });
    await disabledStream.waitFor((e) => e.event === "logout");
    disabledStream.close();
  } finally {
    staffStream.close();
    custStream.close();
    otherStream.close();
  }
});
