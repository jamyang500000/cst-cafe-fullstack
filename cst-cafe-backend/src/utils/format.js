// Turn database rows (snake_case) into the shapes the frontend uses (camelCase).

function formatUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    accountType: row.account_type,
    role: row.staff_role, // staff only: Barista | Cashier | Kitchen | Manager
    active: row.active !== false,
    memberSince: row.created_at,
  };
}

function formatMenuItem(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    prepMinutes: row.prep_minutes,
    prepTime: `${row.prep_minutes} min`,
    available: row.available,
    description: row.description,
    image: row.image_url,
  };
}

function formatTable(row) {
  return {
    id: row.id,
    label: row.label,
    seats: row.seats,
    nearWindow: row.near_window,
  };
}

function formatBooking(row) {
  return {
    id: row.id,
    tableId: row.table_id,
    table: row.table_label,
    nearWindow: row.near_window,
    date: row.booking_date,
    time: row.time_slot,
    partySize: row.party_size,
    status: row.status,
    customer: row.customer_name, // only present in staff queries
    createdAt: row.created_at,
  };
}

function orderCode(id) {
  return `ORD-${String(id).padStart(4, "0")}`;
}

function formatOrder(row, items = []) {
  return {
    id: row.id,
    code: orderCode(row.id), // e.g. "ORD-0142" - what customers and staff see
    queueNumber: row.queue_number,
    status: row.status, // waiting | preparing | ready | delayed | picked_up | cancelled
    orderType: row.order_type, // dine-in | takeaway
    tableId: row.table_id,
    table: row.table_label || "—",
    bookingId: row.booking_id,
    time: row.pickup_time,
    items: items.map((i) => ({ id: i.menu_item_id, name: i.name, price: i.price, qty: i.qty })),
    itemCount: items.reduce((sum, i) => sum + i.qty, 0),
    subtotal: row.subtotal,
    takeawayFee: row.takeaway_fee,
    total: row.total,
    customer: row.customer_name, // only present in staff queries
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function formatNotification(row) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.created_at,
  };
}

module.exports = {
  formatUser,
  formatMenuItem,
  formatTable,
  formatBooking,
  formatOrder,
  formatNotification,
  orderCode,
};
