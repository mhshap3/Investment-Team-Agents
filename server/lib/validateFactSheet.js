/**
 * Validates the Stage 1 fact sheet returned by the extraction prompt.
 *
 * Returns { valid: bool, issues: string[], data: factSheet }
 * where data is always safe to use downstream (defaults applied).
 *
 * Also logs warnings for high-impact fields that are unknown or unclear,
 * so the system has full observability into data quality.
 */

const log = require("./logger");

// Fields that directly drive investment scoring — missing values need visibility
const HIGH_IMPACT_FIELDS = [
  "arr",
  "round_size",
  "total_raised",
  "business_model",
  "geography",
  "founder_name",
  "founder_email",
  "company_name",
];

const VALID_SOURCE_TYPES = ["Cold Inbound", "Intro", "unknown"];

function validateFactSheet(raw, context = {}) {
  const issues = [];
  const d = { ...raw };

  // ─── String fields — default to "unknown" if missing ───────────────────────
  const stringFields = [
    "company_name", "website", "founder_name", "founder_email",
    "geography", "sector", "business_model", "arr", "round_size",
    "total_raised", "stage", "founded_year", "customers",
    "traction_signals", "one_liner", "source_type",
    "introducer_name", "introducer_title", "introducer_company",
  ];

  for (const field of stringFields) {
    if (typeof d[field] !== "string" || !d[field].trim()) {
      issues.push(`${field} is missing or not a string`);
      d[field] = "unknown";
    }
  }

  // ─── Source type enum ───────────────────────────────────────────────────────
  if (!VALID_SOURCE_TYPES.includes(d.source_type)) {
    issues.push(`source_type must be one of ${VALID_SOURCE_TYPES.join(", ")}, got "${d.source_type}"`);
    d.source_type = "unknown";
  }

  // ─── Introducer fields only matter for Intro source type ───────────────────
  if (d.source_type !== "Intro") {
    d.introducer_name    = "unknown";
    d.introducer_title   = "unknown";
    d.introducer_company = "unknown";
  }

  // ─── Log high-impact missing or unclear fields ─────────────────────────────
  const missingFields   = [];
  const unclearFields   = [];

  for (const field of HIGH_IMPACT_FIELDS) {
    const val = (d[field] || "").toLowerCase();
    if (val === "unknown") missingFields.push(field);
    else if (val === "unclear") unclearFields.push(field);
  }

  const company = d.company_name !== "unknown" ? d.company_name : (context.subject || "unknown");

  if (missingFields.length > 0) {
    log.factSheetMissing(company, missingFields);
  }
  if (unclearFields.length > 0) {
    log.factSheetUnclear(company, unclearFields);
  }

  return {
    valid: issues.length === 0,
    issues,
    data: d,
  };
}

module.exports = { validateFactSheet };
