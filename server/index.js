require("dotenv").config();

const { validateEnv } = require("./lib/validateEnv");
validateEnv(); // Fail fast before anything else boots

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const basicAuth  = require("express-basic-auth");
const rateLimit  = require("express-rate-limit");
const cron       = require("node-cron");
const path       = require("path");

const log               = require("./lib/logger");
const { initDb, getDb } = require("./db/schema");
const { cronAuthMiddleware } = require("./middleware/cronAuth");

const syncRoute    = require("./routes/sync");
const screenRoute  = require("./routes/screen");
const hubspotRoute = require("./routes/hubspot");
const dealsRoute   = require("./routes/deals");
const authRoute    = require("./routes/auth");

const app  = express();
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3001;

// ─── Security headers ────────────────────────────────────────────────────────
app.use(helmet());
app.use(express.json({ limit: "10mb" }));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_ORIGIN
  ? [process.env.CLIENT_ORIGIN]
  : ["http://localhost:3000"];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// ─── Rate limiting — AI routes only ─────────────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many requests, slow down." },
});

// ─── Auth ────────────────────────────────────────────────────────────────────
function buildBasicAuth() {
  if (!process.env.PLATFORM_USER || !process.env.PLATFORM_PASS) {
    log.warn("auth.disabled", { reason: "PLATFORM_USER/PLATFORM_PASS not set — dev mode" });
    return null;
  }
  return basicAuth({
    users: { [process.env.PLATFORM_USER]: process.env.PLATFORM_PASS },
    challenge: true,
    realm: "York IE Platform",
    unauthorizedResponse: (req) => {
      log.authFail(req.ip, req.path);
      return "Unauthorized";
    },
  });
}

const basicAuthMiddleware = buildBasicAuth();

function conditionalAuth(req, res, next) {
  if (req.isCronCall) return next();
  if (!basicAuthMiddleware) return next();
  return basicAuthMiddleware(req, res, next);
}

// ─── Health check — unauthenticated ──────────────────────────────────────────
app.get("/health", (req, res) => {
  const db = getDb();
  let dbStatus = "ok";
  let lastSync = null;
  try {
    db.prepare("SELECT 1").get();
    lastSync = db.prepare(
      "SELECT ran_at, new_deals, triggered_by, errors FROM sync_log ORDER BY id DESC LIMIT 1"
    ).get() || null;
  } catch (e) {
    dbStatus = "error: " + e.message;
  }

  const configured = {
    anthropic:  !!process.env.ANTHROPIC_API_KEY,
    gemini:     !!process.env.GEMINI_API_KEY,
    auth:       !!(process.env.PLATFORM_USER && process.env.PLATFORM_PASS),
    cronSecret: !!process.env.CRON_SECRET,
  };
  const healthy = Object.values(configured).every(Boolean) && dbStatus === "ok";

  res.status(healthy ? 200 : 503).json({
    status:     healthy ? "ok" : "degraded",
    ts:         new Date().toISOString(),
    db:         dbStatus,
    configured,
    lastSync:   lastSync || null,
  });
});

// ─── Gmail OAuth routes — unauthenticated (needed for initial setup) ──────────
app.use("/auth", authRoute);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/sync",    cronAuthMiddleware, conditionalAuth, aiLimiter, syncRoute);
app.use("/api/screen",  conditionalAuth, aiLimiter, screenRoute);
app.use("/api/hubspot", conditionalAuth, aiLimiter, hubspotRoute);
app.use("/api/deals",   conditionalAuth, dealsRoute);

// ─── Serve built React client in production ───────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const clientBuild = path.join(__dirname, "../client/build");
  app.use(express.static(clientBuild));
  app.get("*", (req, res) => res.sendFile(path.join(clientBuild, "index.html")));
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initDb();
app.listen(PORT, () => {
  log.info("server.start", {
    port: PORT,
    env:  process.env.NODE_ENV || "development",
    auth: !!basicAuthMiddleware,
  });
});

// ─── Daily cron — 7:00 AM ET ─────────────────────────────────────────────────
cron.schedule("0 7 * * *", async () => {
  log.cronTrigger(true);
  try {
    const fetch = require("node-fetch");
    const secret = process.env.CRON_SECRET || "";
    const res = await fetch(`http://localhost:${PORT}/api/sync`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "X-Cron-Secret": secret,
      },
    });
    const data = await res.json();
    log.syncFinish("cron", data);
  } catch (err) {
    log.syncError("cron", err.message);
  }
}, { timezone: "America/New_York" });

log.info("cron.scheduled", { expression: "0 7 * * *", tz: "America/New_York" });
