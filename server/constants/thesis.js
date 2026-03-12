/**
 * Backwards-compat shim.
 * THESIS is now split into EXTRACTION_PROMPT (Stage 1) and SCORING_PROMPT (Stage 3).
 * See server/constants/prompts.js for the source of truth.
 *
 * This file re-exports SCORING_PROMPT as THESIS so any code that still
 * imports { THESIS } continues to work without changes.
 */
const { SCORING_PROMPT } = require("./prompts");
const THESIS = SCORING_PROMPT;
module.exports = { THESIS };
