const express      = require("express");
const crypto       = require("crypto");
const router       = express.Router();
const { google }   = require("googleapis");

const { getDb }           = require("../db/schema");
const { runPipeline }     = require("../lib/pipeline");
const { mergeFactSheets } = require("../lib/merge");
const log                 = require("../lib/logger");

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getGmailClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "https://investment-team-agents-production.up.railway.app/auth/callback"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * POST /api/sync
 * Fetches pitch emails from Gmail and runs the three-stage screening pipeline.
 */
router.post("/", async (req, res) => {
  const triggeredBy = req.isCronCall ? "cron" : "manual";
  const db          = getDb();
  const startTime   = Date.now();

  log.syncStart(triggeredBy);

  try {
    // ── 1. Fetch emails from Gmail API ───────────────────────────────────────
    const emails = await fetchGmailEmails();
    log.info("sync.emails_fetched", { count: emails.length, trigger: triggeredBy });

    if (!emails.length) {
      logSync(db, triggeredBy, 0, 0, null);
      return res.json({ message: "No new pitch emails found.", newDeals: 0, durationMs: Date.now() - startTime });
    }

    // ── 2. Hard dedup: skip emails already recorded in submissions ───────────
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
          handleDuplicateSubmission({
            db, matchedDealId, email, factSheet, analysis,
            introducer, insertHistory, insertSubmission,
          });
          existingDeals.push({ id: matchedDealId, fact_sheet: factSheet });
          results.duplicates++;
        } else {
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

// ─── Gmail API fetch ──────────────────────────────────────────────────────────

async function fetchGmailEmails() {
  const gmail   = getGmailClient();
  const after   = Math.floor((Date.now() - SEVEN_DAYS_MS) / 1000);
  const queries = [
    `to:investmentleads@york.ie after:${after}`,
    `bcc:investmentleads@york.ie after:${after}`,
    `cc:investmentleads@york.ie after:${after}`,
  ];

  const gmailIds = new Set();
  for (const q of queries) {
    const res = await gmail.users.messages.list({ userId: "me", q, maxResults: 50 });
    (res.data.messages || []).forEach(m => gmailIds.add(m.id));
  }

  const emails = [];
  for (const id of gmailIds) {
    try {
      const msg  = await gmail.users.messages.get({ userId: "me", id, format: "full" });
      const email = parseGmailMessage(msg.data);
      if (email) emails.push(email);
    } catch (err) {
      log.warn("sync.gmail_fetch_error", { id, error: err.message });
    }
  }

  return emails.filter(e =>
    e.from_email !== "investmentleads@york.ie" &&
    !e.from_email?.includes("googlegroups.com") &&
    !e.subject?.toLowerCase().includes("abridged summary") &&
    !e.subject?.toLowerCase().includes("topic summary") &&
    !e.subject?.toLowerCase().includes("digest")
  );
}

function parseGmailMessage(msg) {
  const headers  = msg.payload?.headers || [];
  const get      = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  const from     = get("From");
  const subject  = get("Subject");
  const date     = get("Date");
  const fromMatch = from.match(/^(.*?)\s*<(.+?)>$/) || [];
  const from_name  = fromMatch[1]?.trim() || from;
  const from_email = fromMatch[2]?.trim() || from;

  const body = extractBody(msg.payload);

  return {
    gmail_id:  msg.id,
    subject,
    from_name,
    from_email,
    date:      new Date(date).toISOString(),
    snippet:   msg.snippet?.slice(0, 300) || "",
    full_body: body.slice(0, 3000),
  };
}

function extractBody(payload) {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return "";
}

// ─── Duplicate submission handler ─────────────────────────────────────────────

function handleDuplicateSubmission({ db, matchedDealId, email, factSheet, analysis, introducer, insertHistory, insertSubmission }) {
  const existing = db.prepare("SELECT fact_sheet, analysis FROM deals WHERE id = ?").get(matchedDealId);
  if (!existing) return;

  const existingFactSheet = JSON.parse(existing.fact_sheet || "{}");
  const { merged, changed, contradictions } = mergeFactSheets(existingFactSheet, factSheet, factSheet.company_name);

  if (contradictions.length > 0) {
    log.info("merge.contradictions", { company: factSheet.company_name, contradictions });
  }

  const lastVersion = db.prepare("SELECT MAX(version) as v FROM screening_history WHERE deal_id = ?").get(matchedDealId);
  const nextVersion = (lastVersion?.v || 1) + 1;

  db.transaction(() => {
    if (changed) {
      db.prepare(`UPDATE deals SET fact_sheet = ?, analysis = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(merged), JSON.stringify(analysis), matchedDealId);
      insertHistory.run({ deal_id: matchedDealId, version: nextVersion, analysis: JSON.stringify(analysis), trigger: "duplicate_rescore" });
    } else {
      insertHistory.run({ deal_id: matchedDealId, version: nextVersion, analysis: existing.analysis, trigger: "duplicate_submission" });
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

  log.info("dedup.submission_attached", { company: factSheet.company_name, dealId: matchedDealId, changed });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
