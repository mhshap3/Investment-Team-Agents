const express = require("express");
const router  = express.Router();

const { callAnthropic } = require("../middleware/anthropic");
const { getDb }         = require("../db/schema");
const log               = require("../lib/logger");

const HUBSPOT_MCP_URL = "https://mcp.hubspot.com/anthropic";

/**
 * POST /api/hubspot
 * Creates Company + Contact + Deal records in HubSpot for a screened deal.
 * Body: { dealId: string }
 */
router.post("/", async (req, res) => {
  const { dealId } = req.body;

  if (!dealId) {
    return res.status(400).json({ error: "dealId is required" });
  }

  const db  = getDb();
  const row = db.prepare("SELECT * FROM deals WHERE id = ?").get(dealId);

  if (!row) {
    return res.status(404).json({ error: "Deal not found" });
  }

  const deal     = JSON.parse(row.analysis);
  const pipeline = getPipelineName(deal);
  const primaryScore = deal.primary_fund === "Early Growth Fund"
    ? deal.growth_score
    : deal.seed_score;

  const nameParts  = (deal.founder_name || "Unknown").split(" ");
  const firstName  = nameParts[0];
  const lastName   = nameParts.slice(1).join(" ") || "Unknown";

  const prompt = `Using HubSpot CRM, create these three records:
1. COMPANY: Name="${deal.company_name}", Industry="${deal.sector}", Description="${deal.one_liner}", Region="${deal.geography}"
2. CONTACT: FirstName="${firstName}", LastName="${lastName}", Email="${deal.founder_email}", Title="Founder/CEO"
3. DEAL: Name="${deal.company_name} - ${deal.round_size} (${deal.stage})", Pipeline="${pipeline}", Stage="Inbound Review", Amount="${deal.round_size}", Notes="Seed: ${deal.seed_score}/100 — ${deal.seed_reasoning} | Growth: ${deal.growth_score}/100 — ${deal.growth_reasoning} | Primary Fund: ${deal.primary_fund} (${primaryScore}/100)${row.deck_attached ? " [Deck analysed]" : ""} | Deal Source: ${deal.referral_type}${deal.referral_detail ? " via " + deal.referral_detail : ""}"
CRITICAL: pipeline must be "${pipeline}". Confirm all three records created and pipeline used.`;

  try {
    const response = await callAnthropic({
      model:      "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages:   [{ role: "user", content: prompt }],
      mcp_servers: [{ type: "url", url: HUBSPOT_MCP_URL, name: "hubspot" }],
    });

    const resultText = response.content?.find(b => b.type === "text")?.text || "Records created.";

    db.prepare(`
      UPDATE deals
      SET pushed_to_hubspot = 1,
          hubspot_pushed_at = datetime('now'),
          hubspot_result    = ?,
          updated_at        = datetime('now')
      WHERE id = ?
    `).run(resultText.slice(0, 1000), dealId);

    log.hubspotOk(dealId, pipeline);
    res.json({ result: resultText, pipeline });

  } catch (err) {
    log.hubspotFail(dealId, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function getPipelineName(deal) {
  if (deal.primary_fund === "Early Growth Fund") return "Early Growth Fund Deals";
  if (deal.primary_fund === "Seed Fund")         return "Seed Fund Deals";
  const arr = deal.arr || "";
  if (/pre.?revenue/i.test(arr))                 return "Seed Fund Deals";
  const m = arr.match(/([\d.]+)\s*([MmKk])?/);
  if (m) {
    let n = parseFloat(m[1]);
    if (/[Mm]/.test(m[2] || "")) n *= 1e6;
    else if (/[Kk]/.test(m[2] || "")) n *= 1e3;
    return n > 1_500_000 ? "Early Growth Fund Deals" : "Seed Fund Deals";
  }
  return "Seed Fund Deals";
}

module.exports = router;
