// Updates an existing database to the latest schema WITHOUT deleting data.
// Run with:  npm run db:migrate
// Each step is safe to run more than once.

require("dotenv").config({ quiet: true });
const { Client } = require("pg");

const steps = [
  {
    name: "users.active (admin can disable accounts)",
    sql: "ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE",
  },
  {
    name: "users privacy settings",
    sql: `ALTER TABLE users
            ADD COLUMN IF NOT EXISTS share_order_history BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS order_notifications BOOLEAN NOT NULL DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS recommendations BOOLEAN NOT NULL DEFAULT FALSE`,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env");
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  for (const step of steps) {
    await client.query(step.sql);
    console.log(`✓ ${step.name}`);
  }
  await client.end();
  console.log("Database is up to date. Your data was kept.");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  if (err.code === "42P01") console.error("-> Tables don't exist yet. Run `npm run db:setup` first.");
  process.exit(1);
});
