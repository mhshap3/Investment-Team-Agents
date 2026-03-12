const express = require("express");
const crypto  = require("crypto");
const router  = express.Router();

const { callAnthropic } = require("../middleware/anthropic"); // Gmail MCP only — stays Claude
const { getDb }         = require("../db/schema");
const { runPipeline }   = require("../lib/pipeline");
const { mergeFactSheets } = require("../lib/merge");
const log               = require("../lib/logger");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * POST /api/sync
 * Fetches pitch emails from Gmail and runs the three-stage screening pipeline.
 * Called manually from the UI (Basic Auth) or by cron (X-Cron-Secret header).
 *
 * Gmail fetch uses Claude/MCP — that is the only remaining Anthropic call.
 * Stage 1 + Stage 3 LLM calls use Gemini via lib/pipeline.js.
 *
 * DUPLICATE HANDLING:
 * - New company → create deal row + submission row + screening history
 * - Duplicate company → attach new submission to existing canonical deal row.
 *   Merge fact sheet fields where incoming has better info. Re-score only if
 *   the fact sheet changed materially.
 */
router.post("/", async (req, res) => {
  const triggeredBy = req.isCronCall ? "cron" : "manual";
  const db          = getDb();
  const startTime   = Date.now();

  log.syncStart(triggeredBy);

  try {
    // ── 1. Fetch emails from Gmail via Claude + MCP ──────────────────────────
    const afterDate   = formatDateForGmail(new Date(Date.now() - SEVEN_DAYS_MS));
    const gmailPrompt = buildGmailPrompt(afterDate);

    const gmailResponse = await callAnthropic({
      model:       "claude-sonnet-4-20250514",
      max_tokens:  4000,
      messages:    [{ role: "user", content: gmailPrompt }],
      mcp_servers: [{ type: "url", url: "https://gmail.mcp.claude.com/mcp", name: "gmail" }],
    });

    const emails = parseEmailsFromResponse(gmailResponse);
    log.info("sync.emails_fetched", { count: emails.length, trigger: triggeredBy });

    if (!emails.length) {
      logSync(db, triggeredBy, 0, 0, null);
      return res.json({ message: "No new pitch emails found.", newDeals: 0, durationMs: Date.now() - startTime });
    }

    // ── 2. Hard dedup: skip emails already recorded in submissions ───────────
    // We check submissions.gmail_id (not deals.gmail_id) because duplicate
    // submissions no longer create a new deal row — they attach to the canonical one.
    const seenGmailIds = new Set(
      db.prepare("SELECT gmail_id FROM submissions").all().map(r => r.gmail_id)
    );
    const newEmails = emails.filter(e => !seenGmailIds.has(e.gmail_id));

    if (!newEmails.length) {
      logSync(db, triggeredBy, emails.length, 0, null);
      return res.json({ message: "All emails already screened.", newDeals: 0, durationMs: Date.now() - startTime });
    }

    // ── 3. Load existing deals for Stage 2 soft-dedup ────────────────────────
    const existingDeals = db.prepare("SELECT id, fact_sheet, analysis FROM deals").all().map(r => ({
      id:         r.id,
      fact_sheet: r.fact_sheet
        ? JSON.parse(r.fact_sheet)
        : compatFactSheet(JSON.parse(r.analysis)),
    }));

    // ── 4. Prepare DB statements ──────────────────────────────────────────────
    const insertDeal = db.prepare(`
      INSERT INTO deals
        (id, gmail_id, subject, from_name, from_email, received_at, email_body,
         fact_sheet, analysis, status)
      VALUES
        (@id, @gmail_id, @subject, @from_name, @from_email, @received_at, @email_body,
         @fact_sheet, @analysis, 'queue')
    `);
    const insertHistory = db.prepare(`
      INSERT INTO screening_history (deal_id, version, analysis, trigger)
      VALUES (@deal_id, @version, @analysis, @trigger)
    `);
    const insertSubmission = db.prepare(`
      INSERT INTO submissions
        (deal_id, gmail_id, from_name, from_email, subject, received_at, source_type, introducer)
      VALUES
        (@deal_id, @gmail_id, @from_name, @from_email, @subject, @received_at, @source_type, @introducer)
    `);

    const results = { newDeals: 0, duplicates: 0, errors: [] };

    // ── 5. Run three-stage pipeline for each new email ────────────────────────
    for (const email of newEmails) {
      try {
        const { factSheet, isDuplicate, matchType, matchedDealId, analysis } =
          await runPipeline(email, existingDeals);

        const introducer = factSheet.source_type === "Intro"
          ? [factSheet.introducer_name, factSheet.introducer_title, factSheet.introducer_company]
              .filter(v => v && v !== "unknown").join(", ") || null
          : null;

        if (isDuplicate && matchedDealId) {
          // ── DUPLICATE: attach to canonical deal, merge fact sheet ─────────
          handleDuplicateSubmission({
            db, matchedDealId, email, factSheet, analysis,
            introducer, insertHistory, insertSubmission,
          });
          existingDeals.push({ id: matchedDealId, fact_sheet: factSheet }); // keep dedup sharp
          results.duplicates++;

        } else {
          // ── NEW COMPANY: create canonical deal row ────────────────────────
          const id = crypto.randomUUID();
          db.transaction(() => {
            insertDeal.run({
              id,
              gmail_id:    email.gmail_id,
              subject:     email.subject,
              from_name:   email.from_name,
              from_email:  email.from_email,
              received_at: email.date,
              email_body:  email.full_body,
              fact_sheet:  JSON.stringify(factSheet),
              analysis:    JSON.stringify(analysis),
            });
            insertHistory.run({ deal_id: id, version: 1, analysis: JSON.stringify(analysis), trigger: "email" });
            insertSubmission.run({
              deal_id:     id,
              gmail_id:    email.gmail_id,
              from_name:   email.from_name,
              from_email:  email.from_email,
              subject:     email.subject,
              received_at: email.date,
              source_type: factSheet.source_type || "unknown",
              introducer,
            });
          })();

          existingDeals.push({ id, fact_sheet: factSheet });
          log.screenOk(factSheet.company_name, 1);
          results.newDeals++;
        }

      } catch (err) {
        log.screenFail(email.subject, err.message);
        results.errors.push({ subject: email.subject, error: err.message });
      }
    }

    logSync(db, triggeredBy, emails.length, results.newDeals,
      results.errors.length ? JSON.stringify(results.errors) : null);

    log.syncFinish(triggeredBy, {
      emailsFound: emails.length,
      newDeals:    results.newDeals,
      duplicates:  results.duplicates,
      errors:      results.errors.length,
    });

    res.json({
      message:     `Sync complete. ${results.newDeals} new deal(s), ${results.duplicates} duplicate(s).`,
      emailsFound: emails.length,
      newDeals:    results.newDeals,
      duplicates:  results.duplicates,
      errors:      results.errors,
      durationMs:  Date.now() - startTime,
    });

  } catch (err) {
    log.syncError(triggeredBy, err.message);
    logSync(db, triggeredBy, 0, 0, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Duplicate submission handler ────────────────────────────────────────────

function handleDuplicateSubmission({ db, matchedDealId, email, factSheet, analysis, introducer, insertHistory, insertSubmission }) {
  const existing = db.prepare("SELECT fact_sheet, analysis FROM deals WHERE id = ?").get(matchedDealId);
  if (!existing) return; // shouldn't happen, safety guard

  const existingFactSheet = JSON.parse(existing.fact_sheet || "{}");
  const { merged, changed, contradictions } = mergeFactSheets(
    existingFactSheet, factSheet, factSheet.company_name
  );

  if (contradictions.length > 0) {
    log.info("merge.contradictions", { company: factSheet.company_name, contradictions });
  }

  const lastVersion = db.prepare(
    "SELECT MAX(version) as v FROM screening_history WHERE deal_id = ?"
  ).get(matchedDealId);
  const nextVersion = (lastVersion?.v || 1) + 1;

  db.transaction(() => {
    if (changed) {
      // Fact sheet improved — re-score only if material fields changed
      log.info("merge.fact_sheet_changed", { company: factSheet.company_name, dealId: matchedDealId });
      db.prepare(`
        UPDATE deals SET fact_sheet = ?, analysis = ?, updated_at = datetime('now') WHERE id = ?
      `).run(JSON.stringify(merged), JSON.stringify(analysis), matchedDealId);

      insertHistory.run({
        deal_id: matchedDealId,
        version: nextVersion,
        analysis: JSON.stringify(analysis),
        trigger:  "duplicate_rescore",
      });
    } else {
      log.info("merge.fact_sheet_unchanged", { company: factSheet.company_name, dealId: matchedDealId });
      // Still log the submission event in history
      insertHistory.run({
        deal_id: matchedDealId,
        version: nextVersion,
        analysis: existing.analysis,
        trigger:  "duplicate_submission",
      });
    }

    insertSubmission.run({
      deal_id:     matchedDealId,
      gmail_id:    email.gmail_id,
      from_name:   email.from_name,
      from_email:  email.from_email,
      subject:     email.subject,
      received_at: email.date,
      source_type: factSheet.source_type || "unknown",
      introducer,
    });
  })();

  log.info("dedup.submission_attached", {
    company:  factSheet.company_name,
    dealId:   matchedDealId,
    changed,
  });
}

// ─── Gmail helpers ────────────────────────────────────────────────────────────

function formatDateForGmail(date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function buildGmailPrompt(afterDate) {
  return `Search Gmail for investment pitch emails sent to investmentleads@york.ie in the last 7 days.

Run TWO search queries and combine results (deduplicate by gmail_id):
1. to:investmentleads@york.ie after:${afterDate}
2. bcc:investmentleads@york.ie after:${afterDate}

The second query catches deals where a York IE team member BCC'd the group inbox on an intro reply thread.

CRITICAL FILTERING — skip any email that matches these rules:
1. from_email is investmentleads@york.ie (automated group digests)
2. subject contains "Abridged summary", "topic summary", or "digest"
3. body starts with "Today's topic summary" or contains "You received this digest"
4. Only process genuine individual pitch emails or intro threads

For forwarded emails (look for "---------- Forwarded message ---------"):
- Use the ORIGINAL sender as the founder (name + email), not the york.ie forwarder

Return ONLY a JSON array (no markdown):
[{
  "gmail_id": "string",
  "subject": "string",
  "from_name": "string",
  "from_email": "string",
  "date": "ISO date string",
  "snippet": "string (first 300 chars)",
  "full_body": "string (full body, max 3000 chars)"
}]

If no emails found, return [].`;
}

function parseEmailsFromResponse(response) {
  const textBlock = response.content?.find(b => b.type === "text");
  if (!textBlock) return [];
  const raw   = textBlock.text.replace(/```json|```/g, "").trim();
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let emails;
  try { emails = JSON.parse(match[0]); }
  catch { log.warn("sync.parse_error", { raw: raw.slice(0, 200) }); return []; }
  if (!Array.isArray(emails)) return [];
  return emails.filter(e =>
    e.gmail_id &&
    e.from_email !== "investmentleads@york.ie" &&
    !e.from_email?.includes("googlegroups.com") &&
    !e.subject?.toLowerCase().includes("abridged summary") &&
    !e.subject?.toLowerCase().includes("topic summary") &&
    !e.subject?.toLowerCase().includes("digest")
  );
}

function compatFactSheet(analysis) {
  return {
    company_name:  analysis.company_name  || "unknown",
    website:       "unknown",
    founder_name:  analysis.founder_name  || "unknown",
    founder_email: analysis.founder_email || "unknown",
  };
}

function logSync(db, triggeredBy, emailsFound, newDeals, errors) {
  try {
    db.prepare(`INSERT INTO sync_log (triggered_by, emails_found, new_deals, errors) VALUES (?, ?, ?, ?)`)
      .run(triggeredBy, emailsFound, newDeals, errors);
  } catch (e) {
    log.warn("sync.log_failed", { error: e.message });
  }
}

module.exports = router;
