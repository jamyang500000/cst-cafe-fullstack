-- CST Cafe database schema (PostgreSQL)
-- Running this file DROPS and recreates every table, so all data is reset.
-- Use `npm run db:setup` to run it together with the seed data.

DROP TABLE IF EXISTS notifications, feedback, order_items, orders, bookings,
  cafe_tables, menu_items, users CASCADE;

-- Everyone who logs in: customers (students / college staff) and cafe staff.
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  account_type  TEXT NOT NULL CHECK (account_type IN ('customer', 'staff')),
  -- Only for staff: Barista | Cashier | Kitchen | Manager
  staff_role    TEXT CHECK (staff_role IN ('Barista', 'Cashier', 'Kitchen', 'Manager')),
  -- A Manager can disable an account; it keeps its orders but can't log in.
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  -- Privacy settings (customers set these on the Privacy settings page)
  share_order_history BOOLEAN NOT NULL DEFAULT TRUE,  -- counted in "popular items" report
  order_notifications BOOLEAN NOT NULL DEFAULT TRUE,  -- notified when order status changes
  recommendations     BOOLEAN NOT NULL DEFAULT FALSE, -- "Your favourites" row on the menu
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (account_type = 'staff' OR staff_role IS NULL)
);

CREATE TABLE menu_items (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('Meals', 'Snacks', 'Beverages')),
  price        INTEGER NOT NULL CHECK (price >= 0),          -- in Ngultrum
  prep_minutes INTEGER NOT NULL DEFAULT 5 CHECK (prep_minutes > 0),
  description  TEXT NOT NULL DEFAULT '',
  image_url    TEXT,
  available    BOOLEAN NOT NULL DEFAULT TRUE,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,  -- keeps old orders readable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE cafe_tables (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL UNIQUE,
  seats       INTEGER NOT NULL CHECK (seats > 0),
  near_window BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE bookings (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_id     INTEGER NOT NULL REFERENCES cafe_tables(id),
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_slot    TEXT NOT NULL,                 -- e.g. '12:15 PM'
  party_size   INTEGER NOT NULL CHECK (party_size BETWEEN 1 AND 20),
  status       TEXT NOT NULL DEFAULT 'confirmed'
               CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A table can only have one active booking per date + time slot.
CREATE UNIQUE INDEX bookings_one_active_per_slot
  ON bookings (table_id, booking_date, time_slot)
  WHERE status = 'confirmed';

CREATE TABLE orders (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queue_number INTEGER NOT NULL,              -- restarts from 1 every day
  order_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  order_type   TEXT NOT NULL DEFAULT 'dine-in'
               CHECK (order_type IN ('dine-in', 'takeaway')),
  table_id     INTEGER REFERENCES cafe_tables(id),
  booking_id   INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
  pickup_time  TEXT,                          -- e.g. '12:15 PM'
  status       TEXT NOT NULL DEFAULT 'waiting'
               CHECK (status IN ('waiting', 'preparing', 'ready', 'delayed',
                                 'picked_up', 'cancelled')),
  subtotal     INTEGER NOT NULL DEFAULT 0,
  takeaway_fee INTEGER NOT NULL DEFAULT 0,
  total        INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_date, queue_number)
);

-- Name and price are copied in, so an order keeps its original price
-- even if the menu item is edited or removed later.
CREATE TABLE order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES menu_items(id),
  name         TEXT NOT NULL,
  price        INTEGER NOT NULL,
  qty          INTEGER NOT NULL CHECK (qty > 0)
);

-- Anonymous on purpose: no user or order is attached (see the feedback page).
CREATE TABLE feedback (
  id         SERIAL PRIMARY KEY,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- audience = 'customer' -> for one user (user_id set)
-- audience = 'staff'    -> shared by all staff (user_id NULL)
CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  audience   TEXT NOT NULL CHECK (audience IN ('customer', 'staff')),
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((audience = 'customer') = (user_id IS NOT NULL))
);

CREATE INDEX orders_by_date_status ON orders (order_date, status);
CREATE INDEX orders_by_user ON orders (user_id);
CREATE INDEX bookings_by_user ON bookings (user_id);
CREATE INDEX notifications_by_user ON notifications (audience, user_id, created_at DESC);
