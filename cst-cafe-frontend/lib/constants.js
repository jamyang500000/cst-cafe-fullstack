// Shared UI constants (the data itself now comes from the backend).

// Must match takeawayFee in cst-cafe-backend/src/config.js
export const TAKEAWAY_FEE = 10;

export const statusStyles = {
  waiting: { label: "Waiting", className: "bg-waiting/15 text-waiting" },
  preparing: { label: "Preparing", className: "bg-preparing/15 text-preparing" },
  ready: { label: "Ready", className: "bg-ready/15 text-ready" },
  delayed: { label: "Delayed", className: "bg-delayed/15 text-delayed" },
  picked_up: { label: "Picked up", className: "bg-ready/15 text-ready" },
  cancelled: { label: "Cancelled", className: "bg-border text-muted" },
};

export const staffRoles = ["Barista", "Cashier", "Kitchen", "Manager"];
