const express = require("express");
const router  = express.Router();

const { getDb }          = require("../db/schema");
const { runDeckRescore } = require("../lib/pipeline");
const log                = require("../lib/logger");

/**
 * POST /api/screen
 * Re-screens an existing deal with a PDF deck attached.
 * Runs the full pipeline (Stage 1 extraction + Stage 3 scoring) using the deck.
 * Body: { dealId: string, pdfBase64: string }
 */
router.post("/", async (req, res) => {
  const { dealId, pdfBase64 } = req.body;

  if (!dealId || !pdfBase64) {
    return res.status(400).json({ error: "dealId and pdfBase64 are required" });
  }
  if (typeof pdfBase64 !== "string" || pdfBase64.length < 100) {
    return res.status(400).json({ error: "pdfBase64 appears invalid" });
  }

  const db   = getDb();
  const deal = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId);

  if (!deal) {
    return res.status(404).json({ error: "Deal not found" });
  }

  log.deckStart(dealId);

  try {
    const lastVersion = db.prepare(
      "SELECT MAX(version) as v FROM screening_history WHERE deal_id = ?"
    ).get(dealId);
    const nextVersion = (lastVersion?.v || 1) + 1;

    const { factSheet, analysis } = await runDeckRescore(deal, pdfBase64);

    const factSheetJson = JSON.stringify(factSheet);
    const analysisJson  = JSON.stringify(analysis);

    db.transaction(() => {
      db.prepare(`
        UPDATE deals
        SET fact_sheet = ?, analysis = ?, deck_attached = 1, updated_at = datetime('now')
        WHERE id = ?
      `).run(factSheetJson, analysisJson, dealId);

      db.prepare(`
        INSERT INTO screening_history (deal_id, version, analysis, trigger)
        VALUES (?, ?, ?, 'deck')
      `).run(dealId, nextVersion, analysisJson);
    })();

    log.deckOk(dealId, nextVersion);
    res.json({ factSheet, analysis, version: nextVersion });

  } catch (err) {
    log.deckFail(dealId, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
