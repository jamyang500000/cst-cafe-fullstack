// Live updates using Server-Sent Events (SSE).
//
// Each logged-in browser keeps one connection open to GET /api/events.
// When something changes, the backend sends a short message such as
//   event: order        data: {"id": 12}
//   event: notifications
// and the page reloads just that piece of data. Messages are only "something
// changed" signals - the real data still comes from the normal API, so nobody
// can see anything through this that they couldn't see anyway.

const clients = new Set(); // { res, userId, isStaff }

const HEARTBEAT_MS = 25000; // keeps the connection from timing out

function write(client, event, data = {}) {
  try {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    clients.delete(client);
  }
}

// Called by the /api/events route for each browser that connects.
function addClient(req, res, user) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("retry: 3000\n\n"); // browser reconnects after 3s if cut off

  const client = { res, userId: user.id, isStaff: user.account_type === "staff" };
  clients.add(client);
  write(client, "connected", { at: new Date().toISOString() });

  const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

// Send to every open connection of one user (they may have several tabs).
function toUser(userId, event, data) {
  for (const c of clients) if (c.userId === userId) write(c, event, data);
}

// Send to every logged-in staff member.
function toStaff(event, data) {
  for (const c of clients) if (c.isStaff) write(c, event, data);
}

// Tell a user's browsers to log out, then close their connections
// (used when a manager disables the account).
function logoutUser(userId) {
  for (const c of clients) {
    if (c.userId === userId) {
      write(c, "logout", {});
      c.res.end();
      clients.delete(c);
    }
  }
}

function connectionCount() {
  return clients.size;
}

module.exports = { addClient, toUser, toStaff, logoutUser, connectionCount };
