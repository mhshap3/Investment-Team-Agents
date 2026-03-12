/**
 * Lightweight structured logger for Railway log drain.
 * Outputs JSON lines — easy to grep, filter, and tail in Railway.
 * Never logs secrets, API keys, or raw email bodies.
 */

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function write(level, event, data = {}) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...data,
  });
  if (level === "error" || level === "warn") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

const log = {
  debug: (event, data) => write("debug", event, data),
  info:  (event, data) => write("info",  event, data),
  warn:  (event, data) => write("warn",  event, data),
  error: (event, data) => write("error", event, data),

  // ─── Typed event helpers ─────────────────────────────────────────────────
  syncStart:    (trigger)               => write("info",  "sync.start",           { trigger }),
  syncFinish:   (trigger, stats)        => write("info",  "sync.finish",          { trigger, ...stats }),
  syncError:    (trigger, err)          => write("error", "sync.error",           { trigger, error: err }),

  screenOk:     (company, version)      => write("info",  "screen.ok",            { company, version }),
  screenFail:   (subject, err)          => write("error", "screen.fail",          { subject, error: err }),
  screenValidationFail: (company, issues) => write("warn", "screen.validation_fail", { company, issues }),

  dupDetected:  (company, matchType)    => write("warn",  "dedup.soft_match",     { company, matchType }),

  deckStart:    (dealId)                => write("info",  "deck.start",           { dealId }),
  deckOk:       (dealId, version)       => write("info",  "deck.ok",              { dealId, version }),
  deckFail:     (dealId, err)           => write("error", "deck.fail",            { dealId, error: err }),

  hubspotOk:    (dealId, pipeline)      => write("info",  "hubspot.ok",           { dealId, pipeline }),
  hubspotFail:  (dealId, err)           => write("error", "hubspot.fail",         { dealId, error: err }),

  authFail:     (ip, path)              => write("warn",  "auth.fail",            { ip, path }),
  cronTrigger:  (secret_present)        => write("info",  "cron.trigger",         { secret_present }),

  // ─── Stage 1: Fact extraction ────────────────────────────────────────────
  extractOk:        (company)           => write("info",  "extract.ok",             { company }),
  extractFail:      (subject, err)      => write("error", "extract.fail",           { subject, error: err }),
  factSheetMissing: (company, fields)   => write("warn",  "extract.fields_missing", { company, fields }),
  factSheetUnclear: (company, fields)   => write("warn",  "extract.fields_unclear", { company, fields }),

  // ─── Stage 2: Duplicate detection / merge ────────────────────────────────
  dupDetected:      (company, matchType)              => write("warn",  "dedup.soft_match",        { company, matchType }),
  dupContradiction: (company, field, existing, incoming) => write("warn", "merge.contradiction",   { company, field, existing, incoming }),

  // ─── Stage 3: Investment scoring ────────────────────────────────────────
  scoreOk:      (company, seed, growth) => write("info",  "score.ok",               { company, seed_score: seed, growth_score: growth }),
  scoreFail:    (company, err)          => write("error", "score.fail",              { company, error: err }),
};

module.exports = log;
