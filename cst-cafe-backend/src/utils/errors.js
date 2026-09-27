// Throw one of these anywhere in a route and the error handler turns it
// into a JSON response:  throw new HttpError(404, "Order not found")
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
  }
  // Body wasn't valid JSON
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON" });
  }
  // PostgreSQL: unique constraint broken (e.g. email already used)
  if (err.code === "23505") {
    return res.status(409).json({ error: "That already exists" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
}

module.exports = { HttpError, notFoundHandler, errorHandler };
