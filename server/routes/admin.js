const express = require("express");
const router = express.Router();
const { getDb } = require("../db/schema");

// GET /admin/schema — dump all table schemas
router.get("/schema", (req, res) => {
  try {
    const db = getDb();
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'"
    ).all();
    const schema = {};
    for (const { name } of tables) {
      schema[name] = db.prepare(`PRAGMA table_info(${name})`).all();
    }
    res.json(schema);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/deal/:name — dump raw DB record for debugging
router.get("/deal/:name", (req, res) => {
  try {
    const db = getDb();
    const name = `%${req.params.name}%`;

    // First get column names from deals table
    const cols = db.prepare("PRAGMA table_info(deals)").all().map(c => c.name);
    const row = db.prepare(`SELECT * FROM deals LIMIT 1`).get();
    if (!row) return res.status(404).json({ error: "No deals found", cols });

    // Find the name-like column
    const nameCol = cols.find(c => c.includes("name") || c.includes("company"));
    if (!nameCol) return res.status(500).json({ error: "Could not find name column", cols });

    const match = db.prepare(
      `SELECT * FROM deals WHERE ${nameCol} LIKE ? LIMIT 1`
    ).get(name);

    if (!match) return res.status(404).json({ error: "Not found", cols });

    try { match.fact_sheet = JSON.parse(match.fact_sheet); } catch {}
    try { match.analysis = JSON.parse(match.analysis); } catch {}

    res.json(match);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
