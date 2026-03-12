/**
 * Centralized LLM client.
 *
 * Stage 1 — Fact extraction   → Gemini Flash  (fast, cheap, structured extraction)
 * Stage 3 — Investment scoring → Gemini Pro    (higher reasoning for nuanced scoring)
 *
 * Gmail MCP fetch (sync.js) still uses the Anthropic/Claude MCP infrastructure
 * directly — that is the only remaining Claude call and lives in sync.js, not here.
 *
 * To swap models later: change EXTRACTION_MODEL or SCORING_MODEL below.
 * The rest of the app does not need to change.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

const EXTRACTION_MODEL = "gemini-2.0-flash";
const SCORING_MODEL    = "gemini-2.0-pro";

let _client = null;

function getClient() {
  if (!_client) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables.");
    }
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _client;
}

/**
 * Stage 1: Call Gemini Flash for fact extraction.
 *
 * @param {string} systemPrompt  - EXTRACTION_PROMPT
 * @param {string} userText      - Formatted email text
 * @param {object|null} pdf      - Optional { base64: string, mimeType: "application/pdf" }
 * @returns {string}             - Raw text response from the model
 */
async function extractFactsWithGeminiFlash(systemPrompt, userText, pdf = null) {
  const model = getClient().getGenerativeModel({
    model:             EXTRACTION_MODEL,
    systemInstruction: systemPrompt,
    generationConfig:  { temperature: 0.1 }, // Low temp — we want deterministic extraction
  });

  const parts = buildParts(userText, pdf, "Extract facts from this deal email");
  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  return result.response.text();
}

/**
 * Stage 3: Call Gemini Pro for investment scoring.
 *
 * @param {string} systemPrompt  - SCORING_PROMPT
 * @param {string} factSheetText - JSON stringified fact sheet
 * @param {object|null} pdf      - Optional { base64: string, mimeType: "application/pdf" }
 * @returns {string}             - Raw text response from the model
 */
async function scoreDealWithGeminiPro(systemPrompt, factSheetText, pdf = null) {
  const model = getClient().getGenerativeModel({
    model:             SCORING_MODEL,
    systemInstruction: systemPrompt,
    generationConfig:  { temperature: 0.2 }, // Slightly higher — allows nuanced reasoning
  });

  const parts = buildParts(factSheetText, pdf, "Score this deal using the extracted fact sheet");
  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  return result.response.text();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function buildParts(text, pdf, label) {
  if (!pdf) {
    return [{ text: `${label}:\n\n${text}` }];
  }
  // PDF first, then instructions — Gemini treats earlier parts as context
  return [
    {
      inlineData: {
        mimeType: pdf.mimeType || "application/pdf",
        data:     pdf.base64,
      },
    },
    {
      text: `${label}. The pitch deck is attached above — use it as the primary source. See below for context:\n\n${text}`,
    },
  ];
}

module.exports = { extractFactsWithGeminiFlash, scoreDealWithGeminiPro, EXTRACTION_MODEL, SCORING_MODEL };
