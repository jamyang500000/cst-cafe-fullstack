const app = require("./app");
const { port } = require("./config");
const { query } = require("./db");

async function start() {
  try {
    await query("SELECT 1");
  } catch (err) {
    console.error("Can't connect to PostgreSQL:", err.message);
    console.error("Check DATABASE_URL in .env, and that you ran `npm run db:setup`.");
    process.exit(1);
  }
  app.listen(port, () => {
    console.log(`CST Cafe API running at http://localhost:${port}/api`);
  });
}

start();
