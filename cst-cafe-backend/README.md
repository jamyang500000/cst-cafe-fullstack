# CST Cafe — Backend API

Node.js + Express REST API with a PostgreSQL database for the CST Cafe app
(menu, pre-orders, table booking, live queue, notifications, feedback, staff
dashboard and reports).

```
grp-10/
├── cst-cafe-frontend/   Next.js app  → http://localhost:3000
└── cst-cafe-backend/    this API     → http://localhost:5000/api
```

---

## First-time setup (Windows)

### 1. Install PostgreSQL (once)
1. Download the Windows installer from https://www.postgresql.org/download/windows/
2. Run it and keep the default options (port **5432**).
3. When it asks for a password for the `postgres` user, choose one and **write it down**.

### 2. Create your `.env` file
In PowerShell, inside `cst-cafe-backend`:
```powershell
Copy-Item .env.example .env
```
Open `.env` in VS Code and replace `YOUR_PASSWORD` in `DATABASE_URL` with the
password from step 1. Also change `JWT_SECRET` to any long random text.

### 3. Install and set up the database
```powershell
npm install
npm run db:setup
```
`db:setup` creates the `cst_cafe` database, all tables and some starting data
(the menu, 5 tables, and two demo accounts).

### 4. Start the API
```powershell
npm run dev
```
You should see `CST Cafe API running at http://localhost:5000/api`.
Open http://localhost:5000/api/health in your browser — it should say `{"status":"ok"}`.

`npm run dev` restarts automatically when you save a file. Stop it with `Ctrl + C`.

### Demo accounts
| Account | Email | Password |
|---|---|---|
| Staff (Manager) | pema.choden@cstcafe.bt | cstcafe123 |
| Customer | karma.wangdi@rub.edu.bt | cstcafe123 |

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the API (restarts on save) |
| `npm start` | Start the API |
| `npm run db:setup` | **Reset** the database: rebuild tables + starting data (deletes everything else!) |
| `npm run db:migrate` | **Update** an existing database to the latest version, keeping all data |
| `npm test` | Run the automated tests for every endpoint (adds test data to the database) |

---

## Common problems

| Message | Fix |
|---|---|
| `Missing DATABASE_URL in .env` | You haven't created `.env` yet — see step 2. |
| `password authentication failed` | Wrong password in `DATABASE_URL` in `.env`. |
| `ECONNREFUSED` / `Can't connect to PostgreSQL` | PostgreSQL isn't running. Open **Services** in Windows and start `postgresql-x64-…`. |
| `relation "users" does not exist` | Run `npm run db:setup`. |
| `column "…" does not exist` | Your database is from an older version. Run `npm run db:migrate`. |
| `EADDRINUSE: address already in use :::5000` | The API is already running in another terminal, or change `PORT` in `.env`. |

---

## How it works

- **Login**: sign up / log in returns a `token`. Send it on later requests as the
  header `Authorization: Bearer <token>`. Passwords are stored hashed (bcrypt).
- **Customers and staff are separate**: customers log in at `/api/auth/login`,
  staff at `/api/staff/login`. Staff-only routes return `403` for customers.
- **Prices come from the database**, never from the request, so nobody can
  change what they pay.
- **Queue numbers** start from 1 again every day.
- **Order status flow**: `waiting → preparing → ready → picked_up`, with
  `delayed` possible while waiting/preparing. Customers can cancel only while
  `waiting` and within 3 minutes. Customers are notified on every change.
- **Takeaway** adds Nu. 10 (change `takeawayFee` in `src/config.js`).
- **Feedback** is anonymous: no user is stored with it.
- **Live updates**: each logged-in browser keeps one connection open to
  `/api/events`. When an order is placed or changes, or a notification is
  created, the backend instantly sends a short signal (`order`,
  `notifications`, or `logout` when a manager disables the account) and the
  page reloads that data from the normal API. Pages also re-check every
  30–60 seconds as a backup in case the connection drops.
- **Privacy settings** (customers): *share order history* off → not counted in
  the "popular items" report; *order notifications* off → no bell
  notifications about order status; *recommendations* on → "Your favourites"
  row on the menu.
- **Managers** (staff role "Manager") can manage accounts in the staff
  dashboard's **Accounts** tab. Disabled accounts are logged out straight away.
- Errors always come back as `{ "error": "message" }`; form errors also include
  `details`, e.g. `{ "details": { "email": "Email already in use" } }`.

### Folder layout
```
db/schema.sql          all tables
db/setup.js            creates the database + starting data
src/index.js           starts the server
src/app.js             connects all the routes
src/config.js          settings (.env) and cafe rules
src/middleware/auth.js login checks (requireAuth / requireStaff / requireCustomer)
src/routes/*.js        one file per feature
src/utils/*.js         errors, validation, notifications, live events, response formatting
tests/api.test.js      automated tests
```

---

## API reference

Base URL: `http://localhost:5000/api` — 🔓 anyone · 👤 customer · 🧑‍🍳 staff · 🔑 any logged-in user

### Accounts
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/auth/signup` | 🔓 | `{ name, email, phone?, password }` → `{ token, user }` |
| POST | `/auth/login` | 🔓 | `{ email, password }` → `{ token, user }` |
| POST | `/staff/signup` | 🔓 | `{ name, email, role, password }` — role: Barista, Cashier, Kitchen, Manager |
| POST | `/staff/login` | 🔓 | `{ email, password }` → `{ token, user }` |
| GET | `/auth/me` | 🔑 | the logged-in user |
| PATCH | `/users/me` | 🔑 | `{ name?, email?, phone? }` |
| PATCH | `/users/me/password` | 🔑 | `{ currentPassword, newPassword }` |
| GET | `/users/me/privacy` | 🔑 | `{ shareOrderHistory, orderNotifications, recommendations }` |
| PATCH | `/users/me/privacy` | 🔑 | any of those three, `true`/`false` |

### Menu
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/menu` | 🔓 | `?category=Meals` `?available=true` → `{ categories, items }` |
| GET | `/menu/recommendations` | 👤 | "Your favourites" — only if recommendations are on in privacy settings |
| GET | `/menu/:id` | 🔓 | one item |
| POST | `/menu` | 🧑‍🍳 | `{ name, category, price, prepTime?, description?, image?, available? }` |
| PATCH | `/menu/:id` | 🧑‍🍳 | any of the fields above |
| PATCH | `/menu/:id/availability` | 🧑‍🍳 | `{ available? }` — toggles if empty |
| DELETE | `/menu/:id` | 🧑‍🍳 | removes from the menu (old orders keep it) |

### Tables & bookings
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/time-slots` | 🔓 | preset pickup/arrival times |
| GET | `/tables` | 🔓 | `?partySize=4&date=YYYY-MM-DD&time=12:15 PM` → each table has `available` |
| POST | `/bookings` | 👤 | `{ tableId, time, partySize, date? }` — date defaults to today; `409` if taken |
| GET | `/bookings/mine` | 👤 | your bookings |
| DELETE | `/bookings/:id` | 👤/🧑‍🍳 | cancel a booking |
| GET | `/bookings` | 🧑‍🍳 | `?date=` all bookings for a day (default today) |
| PATCH | `/bookings/:id/complete` | 🧑‍🍳 | guests have arrived |

### Orders
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/orders` | 👤 | `{ items: [{ id, qty }], orderType?, time?, tableId?, bookingId? }` |
| GET | `/orders/mine` | 👤 | `?active=true` for only unfinished orders |
| GET | `/orders/:id` | 👤/🧑‍🍳 | includes `aheadInQueue` and `cancelSecondsLeft` |
| PATCH | `/orders/:id` | 👤 | `{ orderType?, items? }` — only while `waiting` |
| POST | `/orders/:id/cancel` | 👤 | within 3 minutes, while `waiting` |
| POST | `/orders/:id/pickup` | 👤 | once `ready` |
| GET | `/orders/queue` | 🧑‍🍳 | today's active orders (`?all=true` for all of today) |
| PATCH | `/orders/:id/status` | 🧑‍🍳 | `{ status }` — preparing, ready, delayed, picked_up, cancelled |

### Feedback, notifications, reports
| Method | Path | Who | Body / notes |
|---|---|---|---|
| POST | `/feedback` | 🔓 | `{ rating: 1-5, comment? }` |
| GET | `/feedback` | 🧑‍🍳 | `{ averageRating, count, entries }` |
| GET | `/notifications` | 🔑 | yours (customer) or the staff feed → `{ unreadCount, notifications }` |
| PATCH | `/notifications/:id/read` | 🔑 | mark one as read |
| POST | `/notifications/read-all` | 🔑 | mark all as read |
| GET | `/reports/summary` | 🧑‍🍳 | `?date=&days=30` orders, revenue, busiest hours, popular items |
| GET | `/health` | 🔓 | API + database check |
| GET | `/events?token=` | 🔑 | live updates stream (Server-Sent Events) — see below |

### Admin (Managers only 👑)
| Method | Path | Who | Body / notes |
|---|---|---|---|
| GET | `/admin/users` | 👑 | `?type=staff\|customer&search=` all accounts with order counts |
| PATCH | `/admin/users/:id/role` | 👑 | `{ role }` — staff only; can't change your own |
| PATCH | `/admin/users/:id/active` | 👑 | `{ active: true\|false }` — disabled accounts can't log in; orders are kept |

There must always be at least one active Manager, so the last Manager can't be
demoted or disabled.

---

## Before real use
- Set `STAFF_SIGNUP_CODE` in `.env` so that only people who know the code can
  create staff accounts (the signup request must then include `signupCode`).
- Use a long random `JWT_SECRET` and never share your `.env` file.
