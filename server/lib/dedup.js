/**
 * Soft duplicate detection for deals — Stage 2 of the three-stage pipeline.
 *
 * Gmail message ID is the hard dedup key (handled upstream in sync.js).
 * This module catches same-company pitches arriving via different threads:
 *   - same company + different intro vs cold inbound
 *   - multiple forwards from different team members
 *   - same founder, different subject line
 *   - intro referencing a company already screened cold
 *
 * Accepts FACT SHEETS (Stage 1 output) rather than analysis blobs,
 * which provides a richer, cleaner set of signals — including website domain.
 *
 * Deliberately conservative — flags, never auto-merges.
 *
 * Returns: { isDuplicate: bool, matchType: string|null, matchedDealId: string|null }
 */

/**
 * @param {object} incomingFacts  - Validated Stage 1 fact sheet for the new deal
 * @param {Array}  existingDeals  - Array of { id, fact_sheet } objects from DB
 * @returns {{ isDuplicate: boolean, matchType: string|null, matchedDealId: string|null }}
 */
function checkSoftDuplicate(incomingFacts, existingDeals) {
  const inEmail   = normalizeEmail(incomingFacts.founder_email);
  const inDomain  = websiteDomain(incomingFacts.website) || emailDomain(inEmail);
  const inName    = normalizeCompany(incomingFacts.company_name);
  const inFounder = normalizeName(incomingFacts.founder_name);

  for (const { id, fact_sheet: ex } of existingDeals) {
    const exEmail   = normalizeEmail(ex.founder_email);
    const exDomain  = websiteDomain(ex.website) || emailDomain(exEmail);
    const exName    = normalizeCompany(ex.company_name);
    const exFounder = normalizeName(ex.founder_name);

    // 1. Exact founder email — almost certainly same person
    if (inEmail && exEmail && inEmail === exEmail) {
      return { isDuplicate: true, matchType: "founder_email_exact", matchedDealId: id };
    }

    // 2. Same website domain — strong signal regardless of company name variation
    if (inDomain && exDomain && inDomain === exDomain) {
      return { isDuplicate: true, matchType: "website_domain_exact", matchedDealId: id };
    }

    // 3. Same normalised company name + same email domain
    if (inName && exName && inName === exName && inDomain && exDomain && inDomain === exDomain) {
      return { isDuplicate: true, matchType: "domain_and_company", matchedDealId: id };
    }

    // 4. Same normalised company name + same founder name
    if (inName && exName && inName === exName && inFounder && exFounder && inFounder === exFounder) {
      return { isDuplicate: true, matchType: "company_and_founder", matchedDealId: id };
    }

    // 5. Fuzzy company name similarity + same founder name (catches "Parq" vs "Parq Inc")
    if (
      inName && exName && similarity(inName, exName) >= 0.85 &&
      inFounder && exFounder && inFounder === exFounder
    ) {
      return { isDuplicate: true, matchType: "fuzzy_company_and_founder", matchedDealId: id };
    }
  }

  return { isDuplicate: false, matchType: null, matchedDealId: null };
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

function normalizeEmail(email) {
  if (!email || typeof email !== "string" || email === "unknown") return null;
  return email.trim().toLowerCase();
}

function emailDomain(email) {
  if (!email) return null;
  const parts = email.split("@");
  return parts.length === 2 ? parts[1] : null;
}

function websiteDomain(website) {
  if (!website || typeof website !== "string" || website === "unknown") return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function normalizeCompany(name) {
  if (!name || typeof name !== "string" || name === "unknown") return null;
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co|the|technologies|tech|ai|software|labs|group)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(name) {
  if (!name || typeof name !== "string" || name === "unknown") return null;
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Dice coefficient string similarity.
 * Returns 0.0 (totally different) to 1.0 (identical).
 */
function similarity(a, b) {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const bigrams = (s) => {
    const map = new Map();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      map.set(bg, (map.get(bg) || 0) + 1);
    }
    return map;
  };

  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  let intersection = 0;

  for (const [bg, count] of aBigrams) {
    intersection += Math.min(count, bBigrams.get(bg) || 0);
  }

  return (2.0 * intersection) / (a.length - 1 + b.length - 1);
}

module.exports = { checkSoftDuplicate };
