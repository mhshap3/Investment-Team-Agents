/**
 * SQLite schema and connection management.
 *
 * CONCURRENCY NOTE: SQLite with WAL mode handles concurrent reads fine.
 * Writes are serialised — acceptable for a single-instance internal tool.
 * If this moves to multi-instance or Postgres, replace getDb() with a
 * connection pool (pg + Pool) and remove the singleton pattern.
 *
 * MIGRATION NOTE: All DB access goes through getDb(). Routes never import
 * better-sqlite3 directly. This isolation makes a future Postgres migration
 * straightforward — swap getDb() and rewrite schema.js, routes stay the same.
 */

const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

// Persistent volume on Railway → /data. Local dev → ./data/
const DB_PATH  = process.env.DB_PATH || path.join(__dirname, "../../data/platform.db");

let db;

function getDb() {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL"); // Better concurrent read performance
    db.pragma("foreign_keys = ON");
    db.pragma("busy_timeout = 5000"); // Wait up to 5s on write contention
  }
  return db;
}

function initDb() {
  const db = getDb();

  // Deals — one canonical row per company/deal
  // gmail_id is kept for reference but NOT unique — duplicate submissions from the
  // same company attach a submissions row to this canonical deal, not a new deal row.
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id                TEXT PRIMARY KEY,             -- crypto.randomUUID()
      gmail_id          TEXT,                         -- gmail_id of first submission (reference only)
      subject           TEXT,
      from_name         TEXT,
      from_email        TEXT,
      received_at       TEXT,
      email_body        TEXT,
      fact_sheet        TEXT,                         -- Stage 1: extracted facts JSON blob
      analysis          TEXT NOT NULL,                -- Stage 3: investment analysis JSON blob
      status            TEXT NOT NULL DEFAULT 'queue', -- 'queue' | 'reviewed'
      deck_attached     INTEGER DEFAULT 0,
      pushed_to_hubspot INTEGER DEFAULT 0,
      hubspot_pushed_at TEXT,
      hubspot_result    TEXT,
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    )
  `);

  // Idempotent migrations for older schemas
  const alterations = [
    "ALTER TABLE deals ADD COLUMN fact_sheet TEXT",
  ];
  for (const sql of alterations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
  // Remove possible_duplicate_of if present — no longer used in active logic
  try { db.exec("ALTER TABLE deals ADD COLUMN _drop_me TEXT"); } catch {}
  // (SQLite cannot DROP COLUMN in older versions — leave possible_duplicate_of in place if it exists,
  //  it is harmless. New DBs won't have it.)

  // Submissions — tracks every email source for a deal (same company, multiple senders)
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id     TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      gmail_id    TEXT NOT NULL,                      -- message ID of this submission
      from_name   TEXT,
      from_email  TEXT,
      subject     TEXT,
      received_at TEXT,
      source_type TEXT,                               -- 'Cold Inbound' | 'Intro'
      introducer  TEXT,                               -- free text: name + title + company
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // Screening history — versioned re-screens (email v1, deck v2, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS screening_history (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id     TEXT NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
      version     INTEGER NOT NULL DEFAULT 1,
      analysis    TEXT NOT NULL,                      -- validated JSON blob
      trigger     TEXT,                               -- 'email' | 'deck' | 'manual'
      screened_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Sync audit log
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      triggered_by TEXT,                              -- 'cron' | 'manual'
      emails_found INTEGER DEFAULT 0,
      new_deals    INTEGER DEFAULT 0,
      errors       TEXT,
      ran_at       TEXT DEFAULT (datetime('now'))
    )
  `);

  console.log("✓ Database initialised at", DB_PATH);
}

module.exports = { getDb, initDb };
