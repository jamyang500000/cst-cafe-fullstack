const { Pool, types } = require("pg");
const { databaseUrl } = require("./config");

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Dates,
// so dates don't shift by a day because of time zones.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: databaseUrl,
  // Cloud databases reached from outside their network need SSL (DATABASE_SSL=true).
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

// Run a single query: const { rows } = await query("SELECT ...", [values])
function query(text, params) {
  return pool.query(text, params);
}

// Run several queries as one transaction: if anything throws, everything
// is rolled back.
async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
