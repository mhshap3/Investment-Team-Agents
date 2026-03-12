const express = require("express");
const router  = express.Router();
const { getDb } = require("../db/schema");
const log       = require("../lib/logger");

/**
 * GET /api/deals
 * Returns all deals sorted by created_at desc.
 * Query params: ?status=queue|reviewed
 */
router.get("/", (req, res) => {
  const db          = getDb();
  const { status }  = req.query;

  let query    = "SELECT * FROM deals";
  const params = [];
  if (status === "queue" || status === "reviewed") {
    query += " WHERE status = ?";
    params.push(status);
  }
  query += " ORDER BY created_at DESC";

  try {
    const rows = db.prepare(query).all(...params);

    // Attach submission counts in one query rather than N+1
    const subCounts = db.prepare(`
      SELECT deal_id,
             COUNT(*) as count,
             SUM(CASE WHEN source_type = 'Intro' THEN 1 ELSE 0 END) as intro_count,
             SUM(CASE WHEN source_type = 'Cold Inbound' THEN 1 ELSE 0 END) as cold_count
      FROM submissions GROUP BY deal_id
    `).all();
    const subMap = {};
    for (const s of subCounts) subMap[s.deal_id] = s;

    res.json({ deals: rows.map(r => deserializeDeal(r, subMap[r.id])) });
  } catch (err) {
    log.error("deals.list_error", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/deals/sync-status
 * Returns last sync time + new deal count from sync_log.
 */
router.get("/sync-status", (req, res) => {
  const db = getDb();
  try {
    const lastSync = db.prepare(
      "SELECT ran_at, new_deals, triggered_by, errors FROM sync_log ORDER BY id DESC LIMIT 1"
    ).get();
    res.json({ lastSync: lastSync || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/deals/:id
 * Update deal status. Body: { status: 'queue' | 'reviewed' }
 */
router.patch("/:id", (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { status } = req.body;

  if (!["queue", "reviewed"].includes(status)) {
    return res.status(400).json({ error: "status must be 'queue' or 'reviewed'" });
  }

  try {
    const result = db.prepare(
      "UPDATE deals SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(status, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Deal not found" });
    }
    res.json({ success: true, id, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/deals/:id/history
 * Full screening history for a deal (v1 = initial email, v2+ = after deck, etc.)
 */
router.get("/:id/history", (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(
      "SELECT * FROM screening_history WHERE deal_id = ? ORDER BY version ASC"
    ).all(req.params.id);
    res.json({
      history: rows.map(r => ({ ...r, analysis: JSON.parse(r.analysis) })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/deals/:id/submissions
 * All email sources that have been linked to this deal.
 */
router.get("/:id/submissions", (req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare(
      "SELECT * FROM submissions WHERE deal_id = ? ORDER BY created_at ASC"
    ).all(req.params.id);
    res.json({ submissions: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function deserializeDeal(row, subStats = null) {
  return {
    ...row,
    fact_sheet:        row.fact_sheet ? JSON.parse(row.fact_sheet) : null,
    analysis:          JSON.parse(row.analysis),
    deck_attached:     !!row.deck_attached,
    pushed_to_hubspot: !!row.pushed_to_hubspot,
    // Submission source summary for UI badges
    submission_count:  subStats?.count       || 1,
    intro_count:       subStats?.intro_count || 0,
    cold_count:        subStats?.cold_count  || 0,
  };
}

module.exports = router;
