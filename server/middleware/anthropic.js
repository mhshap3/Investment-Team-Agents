const fetch = require("node-fetch");

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

/**
 * Proxy a request to the Anthropic API.
 * The API key NEVER leaves the server.
 */
async function callAnthropic(body) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set in environment variables.");
  }

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "mcp-client-2025-04-04", // required for MCP server calls
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  return response.json();
}

module.exports = { callAnthropic };
