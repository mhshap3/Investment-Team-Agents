/**
 * Middleware that allows the internal cron job to call /api/sync
 * without going through HTTP Basic Auth, using a shared secret header.
 * Only used on the /api/sync route.
 */
function cronAuthMiddleware(req, res, next) {
  const cronSecret = process.env.CRON_SECRET;
  // If no CRON_SECRET is set, this middleware is a no-op
  if (!cronSecret) return next();

  const provided = req.headers["x-cron-secret"];
  if (provided === cronSecret) {
    // Valid internal cron call — skip Basic Auth check
    req.isCronCall = true;
    return next();
  }

  // Not a cron call, let normal auth handle it
  next();
}

module.exports = { cronAuthMiddleware };
