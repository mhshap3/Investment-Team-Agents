/**
 * fetchWebContent.js
 *
 * Fetches and cleans text content from a company website for use
 * in Stage 2 (web enrichment) of the deal screening pipeline.
 *
 * Tries the root URL first, then falls back to /about and /product
 * to maximise the chance of getting meaningful content.
 */

const https = require("https");
const http  = require("http");

const TIMEOUT_MS     = 8000;
const MAX_CHARS      = 15000; // ~3-4k tokens — enough context without blowing budget
const FALLBACK_PATHS = ["/about", "/product", "/platform", "/solutions"];

/**
 * Fetch cleaned text content from a company website.
 *
 * @param {string} website  - Domain or full URL, e.g. "acmecorp.com" or "https://acmecorp.com"
 * @returns {Promise<{ success: boolean, content: string, pagesScraped: string[] }>}
 */
async function fetchWebContent(website) {
  if (!website || website === "unknown") {
    return { success: false, content: "", pagesScraped: [] };
  }

  const baseUrl = normaliseUrl(website);
  const pagesScraped = [];
  let combinedContent = "";

  // Always try root first
  const rootResult = await fetchPage(baseUrl);
  if (rootResult.success) {
    combinedContent += rootResult.text;
    pagesScraped.push(baseUrl);
  }

  // If root was thin (<500 chars), try fallback paths
  if (combinedContent.length < 500) {
    for (const path of FALLBACK_PATHS) {
      if (combinedContent.length >= MAX_CHARS) break;
      const result = await fetchPage(baseUrl + path);
      if (result.success && result.text.length > 200) {
        combinedContent += "\n\n" + result.text;
        pagesScraped.push(baseUrl + path);
      }
    }
  }

  if (!combinedContent.trim()) {
    return { success: false, content: "", pagesScraped: [] };
  }

  return {
    success:      true,
    content:      combinedContent.slice(0, MAX_CHARS),
    pagesScraped,
  };
}

/**
 * Fetch a single page and return cleaned plain text.
 */
async function fetchPage(url) {
  try {
    const raw = await getRaw(url);
    const text = htmlToText(raw);
    return { success: text.length > 100, text };
  } catch {
    return { success: false, text: "" };
  }
}

/**
 * Raw HTTP GET with timeout.
 */
function getRaw(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: TIMEOUT_MS, headers: { "User-Agent": "Mozilla/5.0 (compatible; YorkIE-DealScreener/1.0)" } }, (res) => {
      // Follow one redirect
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        getRaw(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

/**
 * Strip HTML tags and collapse whitespace into readable plain text.
 * Removes scripts, styles, nav, footer, and cookie banners.
 */
function htmlToText(html) {
  return html
    // Remove scripts, styles, nav, footer, header, cookie banners
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    // Strip all remaining tags
    .replace(/<[^>]+>/g, " ")
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalise a website string to a full https:// URL.
 */
function normaliseUrl(website) {
  let url = website.trim().toLowerCase();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  // Remove trailing slash
  return url.replace(/\/$/, "");
}

module.exports = { fetchWebContent };
