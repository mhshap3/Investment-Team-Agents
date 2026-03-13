const express = require("express");
const router = express.Router();
const { getDb } = require("../db/schema");

// GET /admin/schema
router.get("/schema", (req, res) => {
  try {
    const db = getDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const schema = {};
    for (const { name } of tables) {
      schema[name] = db.prepare(`PRAGMA table_info(${name})`).all();
    }
    res.json(schema);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /admin/deal/:name — search by company name inside analysis JSON
router.get("/deal/:name", (req, res) => {
  try {
    const db = getDb();
    const search = req.params.name.toLowerCase();

    const rows = db.prepare("SELECT * FROM deals").all();
    const match = rows.find(row => {
      try {
        const analysis = JSON.parse(row.analysis);
        return (analysis.company_name || "").toLowerCase().includes(search);
      } catch { return false; }
    });

    if (!match) return res.status(404).json({ error: "Not found" });

    try { match.fact_sheet = JSON.parse(match.fact_sheet); } catch {}
    try { match.analysis = JSON.parse(match.analysis); } catch {}

    res.json(match);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
