// Safe to run on every start (used on Render, which has no terminal on the
// free plan):
//   - empty database   -> create all tables + starting data
//   - existing database -> only apply new updates (keeps all data)
// Run with:  npm run db:init

require("dotenv").config({ quiet: true });
const { Client } = require("pg");
const { createSchemaAndSeed, sslOption } = require("./setup");
const { runMigrations } = require("./migrate");

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL");
    process.exit(1);
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: sslOption() });
  await client.connect();
  const { rows } = await client.query("SELECT to_regclass('public.users') AS users");
  if (rows[0].users === null) {
    console.log("Empty database - setting it up for the first time");
    await createSchemaAndSeed(client);
  } else {
    console.log("Database already set up - applying any updates");
    await runMigrations(client);
  }
  await client.end();
}

main().catch((err) => {
  console.error("Database init failed:", err.message);
  process.exit(1);
});
