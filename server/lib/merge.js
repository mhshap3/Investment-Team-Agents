/**
 * Merges an incoming fact sheet into an existing canonical fact sheet.
 *
 * Rules (deterministic, easy to explain):
 * 1. Keep the existing value if it is known (not "unknown" / "unclear" / null).
 * 2. Fill in a field if it is currently unknown and the new sheet has a real value.
 * 3. If both sheets have a value AND they differ materially, log the contradiction
 *    and keep the existing value (do not overwrite without human review).
 * 4. Never overwrite a known good value with "unknown" or "unclear".
 *
 * Returns: { merged: object, changed: boolean, contradictions: string[] }
 */

const log = require("./logger");

// Fields we attempt to merge — other fields (one_liner, source_type, etc.) are
// fixed at creation time and should not be overwritten by later submissions.
const MERGEABLE_FIELDS = [
  "company_name",
  "website",
  "founder_name",
  "founder_email",
  "geography",
  "sector",
  "business_model",
  "arr",
  "round_size",
  "total_raised",
  "stage",
  "founded_year",
  "customers",
  "traction_signals",
];

const UNKNOWN_VALUES = new Set(["unknown", "unclear", "", null, undefined]);

function isUnknown(val) {
  return UNKNOWN_VALUES.has(typeof val === "string" ? val.toLowerCase().trim() : val);
}

/**
 * @param {object} existing   - The canonical fact sheet stored on the deal row
 * @param {object} incoming   - The new fact sheet from the duplicate submission
 * @param {string} company    - Company name for logging context
 * @returns {{ merged: object, changed: boolean, contradictions: string[] }}
 */
function mergeFactSheets(existing, incoming, company = "unknown") {
  const merged = { ...existing };
  const contradictions = [];
  let changed = false;

  for (const field of MERGEABLE_FIELDS) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];

    // Nothing new to offer
    if (isUnknown(incomingVal)) continue;

    // Existing is unknown → fill it in
    if (isUnknown(existingVal)) {
      merged[field] = incomingVal;
      changed = true;
      log.info("merge.field_filled", { company, field, value: incomingVal });
      continue;
    }

    // Both have values — check for material contradiction
    const existingNorm = String(existingVal).toLowerCase().trim();
    const incomingNorm = String(incomingVal).toLowerCase().trim();

    if (existingNorm !== incomingNorm) {
      const contradiction = `${field}: existing="${existingVal}" vs incoming="${incomingVal}"`;
      contradictions.push(contradiction);
      log.dupContradiction(company, field, existingVal, incomingVal);
      // Keep existing — do not overwrite without human review
    }
    // Else: identical — no action needed
  }

  return { merged, changed, contradictions };
}

module.exports = { mergeFactSheets };
