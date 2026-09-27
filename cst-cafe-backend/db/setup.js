// Creates the database (if needed), builds all tables from schema.sql and
// fills them with starting data.  Run with:  npm run db:setup
// WARNING: this wipes existing data in the cst_cafe database.

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const DEMO_PASSWORD = "cstcafe123";

const menuItems = [
  ["Ema Datshi Rice Bowl", "Meals", 85, 12, true, "Chili cheese stew served over steamed rice.", "https://commons.wikimedia.org/wiki/Special:FilePath/Shakam_Datshi.jpg"],
  ["Chicken Momo (10 pcs)", "Meals", 100, 15, true, "Steamed dumplings with house chili sauce.", "https://commons.wikimedia.org/wiki/Special:FilePath/Steamed_Chicken_Momo.jpg"],
  ["Vegetable Thukpa", "Meals", 75, 10, true, "Warm noodle soup with seasonal vegetables.", "https://commons.wikimedia.org/wiki/Special:FilePath/Thukpa,_Tibetan_noodle_in_Osaka,_Japan.jpg"],
  ["Samosa (2 pcs)", "Snacks", 30, 5, true, "Crisp pastry with spiced potato filling.", "https://commons.wikimedia.org/wiki/Special:FilePath/North_Indian_style_samosa.jpg"],
  ["Cheese Sandwich", "Snacks", 45, 6, false, "Grilled sandwich with local cheese.", "https://commons.wikimedia.org/wiki/Special:FilePath/Grilled_cheese_sandwich.jpg"],
  ["Butter Tea", "Beverages", 20, 3, true, "Traditional salted butter tea, served hot.", "https://commons.wikimedia.org/wiki/Special:FilePath/Butter_tea,_Bhutan.JPG"],
  ["Milk Tea", "Beverages", 15, 3, true, "Sweet milk tea, served hot or iced.", "https://commons.wikimedia.org/wiki/Special:FilePath/Hong_Kong-style_Milk_Tea.jpg"],
];

const tables = [
  ["Table 1", 2, true],
  ["Table 2", 4, false],
  ["Table 3", 4, false],
  ["Table 4", 6, false],
  ["Table 5", 2, true],
];

const feedback = [
  [5, "Loved the Ema Datshi, will come back!"],
  [4, "Great food but the wait was a bit long during lunch rush."],
  [3, ""],
  [5, "Best butter tea on campus."],
];

async function ensureDatabaseExists(url) {
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (rowCount === 0) {
    // Database names can't be passed as $1 parameters, so quote it safely.
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}"`);
  }
  await client.end();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Missing DATABASE_URL in .env - copy .env.example to .env first.");
    process.exit(1);
  }

  await ensureDatabaseExists(url);

  const client = new Client({ connectionString: url });
  await client.connect();

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await client.query(schema);
  console.log("Tables created");

  for (const [name, category, price, prep, available, description, image] of menuItems) {
    await client.query(
      `INSERT INTO menu_items (name, category, price, prep_minutes, available, description, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, category, price, prep, available, description, image]
    );
  }
  for (const [label, seats, nearWindow] of tables) {
    await client.query(
      "INSERT INTO cafe_tables (label, seats, near_window) VALUES ($1, $2, $3)",
      [label, seats, nearWindow]
    );
  }
  for (const [rating, comment] of feedback) {
    await client.query("INSERT INTO feedback (rating, comment) VALUES ($1, $2)", [rating, comment]);
  }

  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await client.query(
    `INSERT INTO users (name, email, phone, password_hash, account_type, staff_role) VALUES
       ('Pema Choden', 'pema.choden@cstcafe.bt', NULL, $1, 'staff', 'Manager'),
       ('Karma Wangdi', 'karma.wangdi@rub.edu.bt', '17123456', $1, 'customer', NULL)`,
    [hash]
  );

  await client.end();
  console.log("Seed data added");
  console.log("\nDemo accounts (password for both: " + DEMO_PASSWORD + ")");
  console.log("  Staff (Manager): pema.choden@cstcafe.bt");
  console.log("  Customer:        karma.wangdi@rub.edu.bt");
}

main().catch((err) => {
  console.error("\nDatabase setup failed:", err.message);
  if (err.code === "28P01") console.error("-> Wrong PostgreSQL password in DATABASE_URL (.env)");
  if (err.code === "ECONNREFUSED") console.error("-> PostgreSQL isn't running, or the port in DATABASE_URL is wrong");
  process.exit(1);
});
