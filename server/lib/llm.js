/**
 * Centralized LLM client.
 *
 * Stage 1 — Fact extraction    → Gemini Flash Lite  (fast, cheap, structured extraction)
 * Stage 3 — Investment scoring → Gemini 2.5 Pro     (highest reasoning for nuanced scoring)
 *
 * To swap models later: change EXTRACTION_MODEL or SCORING_MODEL below.
 * The rest of the app does not need to change.
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

const EXTRACTION_MODEL = "gemini-2.0-flash-lite";   // Fast + cheap — structured fact extraction
const SCORING_MODEL    = "gemini-2.5-pro-exp-03-25"; // Best reasoning — investment scoring

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
 * Stage 1: Call Gemini Flash Lite for fact extraction.
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
    generationConfig:  { temperature: 0.1 }, // Low temp — deterministic extraction
  });
  const parts = buildParts(userText, pdf, "Extract facts from this deal email");
  const result = await model.generateContent({ contents: [{ role: "user", parts }] });
  return result.response.text();
}

/**
 * Stage 3: Call Gemini 2.5 Pro for investment scoring.
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
    generationConfig:  { temperature: 0.2 }, // Slightly higher — nuanced reasoning
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
