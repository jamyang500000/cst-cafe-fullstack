require("dotenv").config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env - copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:3000",
  staffSignupCode: process.env.STAFF_SIGNUP_CODE || "",

  // Cafe rules (match the frontend)
  takeawayFee: 10, // Nu. added to takeaway orders
  cancelWindowSeconds: 180, // customers can cancel within 3 minutes
  timeSlots: [
    "11:30 AM", "11:45 AM", "12:00 PM", "12:15 PM",
    "12:30 PM", "12:45 PM", "1:00 PM", "1:15 PM",
  ],
  categories: ["Meals", "Snacks", "Beverages"],
  staffRoles: ["Barista", "Cashier", "Kitchen", "Manager"],
};
