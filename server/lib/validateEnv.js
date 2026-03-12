/**
 * Validates required environment variables at startup.
 * Call validateEnv() before anything else in index.js.
 * Fails fast in production; warns in development.
 */

const REQUIRED = [
  { key: "ANTHROPIC_API_KEY",  desc: "Anthropic API key (sk-ant-...) — used for Gmail MCP fetch only" },
  { key: "GEMINI_API_KEY",     desc: "Google Gemini API key — used for Stage 1 extraction and Stage 3 scoring" },
  { key: "PLATFORM_USER",      desc: "HTTP Basic Auth username" },
  { key: "PLATFORM_PASS",      desc: "HTTP Basic Auth password" },
  { key: "CRON_SECRET",        desc: "Internal cron bypass secret (openssl rand -hex 32)" },
];

const OPTIONAL = [
  { key: "DB_PATH",            desc: "SQLite path — defaults to ./data/platform.db" },
  { key: "PORT",               desc: "Server port — defaults to 3001" },
  { key: "CLIENT_ORIGIN",      desc: "Allowed CORS origin — defaults to localhost:3000 in dev" },
  { key: "TZ",                 desc: "Timezone for cron — set to America/New_York on Railway" },
  { key: "NODE_ENV",           desc: "production | development" },
  { key: "LOG_LEVEL",          desc: "debug | info | warn | error — defaults to info" },
];

function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const missing = REQUIRED.filter(v => !process.env[v.key]);

  if (missing.length === 0) {
    console.log(`✓ Environment OK (${isProd ? "production" : "development"})`);
    return;
  }

  const lines = missing.map(v => `  - ${v.key}: ${v.desc}`).join("\n");

  if (isProd) {
    // Hard fail in production — don't start with broken config
    console.error(`\n✗ Missing required environment variables:\n${lines}\n`);
    console.error("Set these in Railway → Variables before deploying.\n");
    process.exit(1);
  } else {
    // Warn only in dev — allows running with partial config
    console.warn(`\n⚠  Missing env vars (dev mode — continuing anyway):\n${lines}\n`);
  }
}

module.exports = { validateEnv, REQUIRED, OPTIONAL };
