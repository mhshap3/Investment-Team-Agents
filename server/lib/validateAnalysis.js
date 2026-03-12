/**
 * Validates AI-generated deal screening JSON before it touches the database.
 * Uses plain JS — no Zod dependency needed, easy to extend.
 *
 * Returns { valid: true, data } or { valid: false, issues: string[], data }
 * where `data` is the coerced/defaulted object (safe to save when valid).
 */

const VALID_LABELS    = ["Strong Fit", "Possible Fit", "Weak Fit", "Hard Pass"];
const VALID_ACTIONS   = ["Pass", "Review Deck", "Schedule Call", "Fast Track"];
const VALID_FUNDS     = ["Seed Fund", "Early Growth Fund", "None"];
const VALID_REFERRALS = ["Cold Inbound", "Intro"];

function validateAnalysis(raw) {
  const issues = [];
  const d = { ...raw };

  // ─── Required strings ─────────────────────────────────────────────────────
  for (const field of ["company_name", "founder_name", "founder_email"]) {
    if (!d[field] || typeof d[field] !== "string" || !d[field].trim()) {
      issues.push(`${field} is required and must be a non-empty string`);
      d[field] = d[field] || "Unknown";
    }
  }

  // ─── Scores ───────────────────────────────────────────────────────────────
  for (const field of ["seed_score", "growth_score"]) {
    const val = Number(d[field]);
    if (isNaN(val) || val < 0 || val > 100) {
      issues.push(`${field} must be a number 0–100, got ${JSON.stringify(d[field])}`);
      d[field] = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
    } else {
      d[field] = Math.round(val); // ensure integer
    }
  }

  // ─── Enums ────────────────────────────────────────────────────────────────
  if (!VALID_LABELS.includes(d.seed_label)) {
    issues.push(`seed_label must be one of ${VALID_LABELS.join(", ")}, got "${d.seed_label}"`);
    d.seed_label = inferLabel(d.seed_score);
  }
  if (!VALID_LABELS.includes(d.growth_label)) {
    issues.push(`growth_label must be one of ${VALID_LABELS.join(", ")}, got "${d.growth_label}"`);
    d.growth_label = inferLabel(d.growth_score);
  }
  if (!VALID_FUNDS.includes(d.primary_fund)) {
    issues.push(`primary_fund must be one of ${VALID_FUNDS.join(", ")}, got "${d.primary_fund}"`);
    d.primary_fund = d.seed_score >= d.growth_score && d.seed_score >= 30
      ? "Seed Fund"
      : d.growth_score >= 30 ? "Early Growth Fund" : "None";
  }
  if (!VALID_ACTIONS.includes(d.recommended_action)) {
    issues.push(`recommended_action must be one of ${VALID_ACTIONS.join(", ")}, got "${d.recommended_action}"`);
    d.recommended_action = inferAction(Math.max(d.seed_score, d.growth_score));
  }
  if (!VALID_REFERRALS.includes(d.referral_type)) {
    issues.push(`referral_type must be one of ${VALID_REFERRALS.join(", ")}, got "${d.referral_type}"`);
    d.referral_type = "Cold Inbound";
  }

  // ─── Booleans ─────────────────────────────────────────────────────────────
  d.hard_pass    = !!d.hard_pass;
  d.deck_enriched = !!d.deck_enriched;

  // ─── Arrays ───────────────────────────────────────────────────────────────
  for (const field of ["green_flags", "red_flags", "deck_insights"]) {
    if (!Array.isArray(d[field])) {
      issues.push(`${field} must be an array`);
      d[field] = [];
    }
  }

  // ─── Optional strings with sensible defaults ──────────────────────────────
  d.sector       = typeof d.sector === "string"       ? d.sector       : null;
  d.stage        = typeof d.stage === "string"        ? d.stage        : null;
  d.arr          = typeof d.arr === "string"          ? d.arr          : null;
  d.round_size   = typeof d.round_size === "string"   ? d.round_size   : null;
  d.total_raised = typeof d.total_raised === "string" ? d.total_raised : null;
  d.geography    = typeof d.geography === "string"    ? d.geography    : null;
  d.founded_year = typeof d.founded_year === "string" ? d.founded_year : null;
  d.one_liner    = typeof d.one_liner === "string"    ? d.one_liner    : "";
  d.referral_detail = d.referral_type === "Intro"
    ? (typeof d.referral_detail === "string" ? d.referral_detail : null)
    : null;
  d.hard_pass_reason = d.hard_pass
    ? (typeof d.hard_pass_reason === "string" ? d.hard_pass_reason : null)
    : null;

  // ─── Reasoning fields ─────────────────────────────────────────────────────
  for (const field of ["seed_reasoning", "growth_reasoning"]) {
    if (typeof d[field] !== "string" || !d[field].trim()) {
      issues.push(`${field} is required`);
      d[field] = "";
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    data: d,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function inferLabel(score) {
  if (score >= 70) return "Strong Fit";
  if (score >= 45) return "Possible Fit";
  if (score >= 20) return "Weak Fit";
  return "Hard Pass";
}

function inferAction(topScore) {
  if (topScore >= 70) return "Schedule Call";
  if (topScore >= 45) return "Review Deck";
  return "Pass";
}

module.exports = { validateAnalysis };
