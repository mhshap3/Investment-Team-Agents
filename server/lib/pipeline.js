/**
 * Four-stage deal screening pipeline.
 *
 * Stage 1 — Fact Extraction      (Gemini Flash)
 *   Extract structured facts from raw email / deck text.
 *   Returns a clean fact sheet. Does NOT score.
 *
 * Stage 2 — Web Enrichment       (fetch + Gemini Flash)
 *   Scrape the company website and enrich the fact sheet.
 *   Adds product detail, customer signals, pricing, team depth.
 *
 * Stage 3 — Duplicate Detection  (local logic)
 *   Check whether this company already exists in the system.
 *   Returns isDuplicate flag and matched canonical deal ID if found.
 *
 * Stage 4 — Investment Scoring   (Gemini Pro)
 *   Score the deal against York IE's Seed and Early Growth fund theses.
 *   Uses the merged fact sheet (Stage 1 + Stage 2) — never raw email text.
 *
 * Routes call runPipeline() and runDeckRescore() and stay thin.
 * All LLM calls, validation, and dedup logic live here.
 */

const { extractFactsWithGeminiFlash, scoreDealWithGeminiPro } = require("./llm");
const { EXTRACTION_PROMPT, ENRICHMENT_PROMPT, SCORING_PROMPT } = require("../constants/prompts");
const { validateFactSheet }   = require("./validateFactSheet");
const { validateAnalysis }    = require("./validateAnalysis");
const { checkSoftDuplicate }  = require("./dedup");
const { fetchWebContent }     = require("./fetchWebContent");
const log                     = require("./logger");

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the full four-stage pipeline for a new email submission.
 *
 * @param {object} email          - { gmail_id, subject, from_name, from_email, date, full_body }
 * @param {Array}  existingDeals  - Array of { id, fact_sheet } from DB (for dedup)
 * @param {object} [pdfContent]   - Optional: { base64: string } if a deck PDF is available
 *
 * @returns {{
 *   factSheet: object,
 *   enrichment: object|null,
 *   isDuplicate: boolean,
 *   matchType: string|null,
 *   matchedDealId: string|null,
 *   analysis: object,
 * }}
 */
async function runPipeline(email, existingDeals, pdfContent = null) {
  // Stage 1: Fact Extraction
  const factSheet = await extractFacts(email, pdfContent);

  // Stage 2: Web Enrichment
  const enrichment = await enrichFromWeb(factSheet);

  // Stage 3: Duplicate Detection
  const dupResult = checkSoftDuplicate(factSheet, existingDeals);
  if (dupResult.isDuplicate) {
    log.dupDetected(factSheet.company_name, dupResult.matchType);
  }

  // Stage 4: Investment Scoring
  const analysis = await scoreDeal(factSheet, enrichment, pdfContent);

  return {
    factSheet,
    enrichment,
    isDuplicate:   dupResult.isDuplicate,
    matchType:     dupResult.matchType,
    matchedDealId: dupResult.matchedDealId,
    analysis,
  };
}

/**
 * Re-run the pipeline (Stage 1 + Stage 2 + Stage 4) for a deal that now has a deck.
 * Used by POST /api/screen.
 *
 * @param {object} existingDeal  - Full deal row from DB
 * @param {string} pdfBase64     - Base64-encoded PDF
 * @returns {{ factSheet: object, enrichment: object|null, analysis: object }}
 */
async function runDeckRescore(existingDeal, pdfBase64) {
  const email = {
    gmail_id:   existingDeal.gmail_id,
    subject:    existingDeal.subject,
    from_name:  existingDeal.from_name,
    from_email: existingDeal.from_email,
    full_body:  existingDeal.email_body,
    date:       existingDeal.received_at,
  };
  const pdf = { base64: pdfBase64 };

  const factSheet  = await extractFacts(email, pdf);
  const enrichment = await enrichFromWeb(factSheet);
  const analysis   = await scoreDeal(factSheet, enrichment, pdf);

  return { factSheet, enrichment, analysis };
}

// ─── Stage 1: Fact Extraction ─────────────────────────────────────────────────

async function extractFacts(email, pdfContent = null) {
  const emailText = formatEmail(email);
  const pdf = pdfContent ? { base64: pdfContent.base64 } : null;

  log.info("extract.start", { subject: email.subject });

  let rawText;
  try {
    rawText = await extractFactsWithGeminiFlash(EXTRACTION_PROMPT, emailText, pdf);
  } catch (err) {
    log.extractFail(email.subject, err.message);
    throw err;
  }

  const rawFacts = parseJson(rawText, "fact extraction");
  const { valid, issues, data: factSheet } = validateFactSheet(rawFacts, { subject: email.subject });

  if (!valid) {
    log.warn("extract.validation_issues", { subject: email.subject, issues });
  }

  log.extractOk(factSheet.company_name);
  return factSheet;
}

// ─── Stage 2: Web Enrichment ──────────────────────────────────────────────────

async function enrichFromWeb(factSheet) {
  const { website, company_name } = factSheet;

  if (!website || website === "unknown") {
    log.info("enrich.skip", { company: company_name, reason: "no website" });
    return null;
  }

  log.info("enrich.start", { company: company_name, website });

  // Fetch website content
  const { success, content, pagesScraped } = await fetchWebContent(website);

  if (!success || !content) {
    log.info("enrich.skip", { company: company_name, reason: "fetch failed or empty" });
    return null;
  }

  log.info("enrich.fetched", { company: company_name, pages: pagesScraped, chars: content.length });

  // Build the enrichment prompt input
  const enrichmentInput = `=== FACT SHEET (from pitch) ===
${JSON.stringify(factSheet, null, 2)}

=== WEBSITE CONTENT (scraped from ${pagesScraped.join(", ")}) ===
${content}`;

  let rawText;
  try {
    rawText = await extractFactsWithGeminiFlash(ENRICHMENT_PROMPT, enrichmentInput, null);
  } catch (err) {
    log.warn("enrich.llm_fail", { company: company_name, error: err.message });
    return null;
  }

  let enrichment;
  try {
    enrichment = parseJson(rawText, "web enrichment");
  } catch (err) {
    log.warn("enrich.parse_fail", { company: company_name, error: err.message });
    return null;
  }

  log.info("enrich.ok", { company: company_name, web_enriched: enrichment.web_enriched });
  return enrichment;
}

// ─── Stage 4: Investment Scoring ──────────────────────────────────────────────

async function scoreDeal(factSheet, enrichment = null, pdfContent = null) {
  // Merge fact sheet and enrichment into a single scoring input
  const scoringInput = buildScoringInput(factSheet, enrichment);
  const pdf = pdfContent ? { base64: pdfContent.base64 } : null;

  log.info("score.start", { company: factSheet.company_name });

  let rawText;
  try {
    rawText = await scoreDealWithGeminiPro(SCORING_PROMPT, scoringInput, pdf);
  } catch (err) {
    log.scoreFail(factSheet.company_name, err.message);
    throw err;
  }

  const rawAnalysis = parseJson(rawText, "investment scoring");
  if (pdfContent)  rawAnalysis.deck_enriched = true;
  if (enrichment?.web_enriched) rawAnalysis.web_enriched = true;

  const { valid, issues, data: analysis } = validateAnalysis(rawAnalysis);
  if (!valid) {
    log.screenValidationFail(factSheet.company_name, issues);
  }

  log.scoreOk(factSheet.company_name, analysis.seed_score, analysis.growth_score);
  return analysis;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Merge the fact sheet and web enrichment into a single JSON string for scoring.
 */
function buildScoringInput(factSheet, enrichment) {
  const merged = {
    ...factSheet,
    web_enrichment: enrichment || { web_enriched: false },
  };
  return JSON.stringify(merged, null, 2);
}

function formatEmail(email) {
  return `From: ${email.from_name} <${email.from_email}>
Date: ${email.date}
Subject: ${email.subject}

${email.full_body}`;
}

function parseJson(text, stage) {
  const clean = text.replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object found in ${stage} response`);
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    throw new Error(`Failed to parse JSON from ${stage}: ${err.message}`);
  }
}

module.exports = { runPipeline, runDeckRescore };
