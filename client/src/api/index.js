/**
 * api/index.js
 * All client→server calls live here.
 * The server proxies to Anthropic — the API key never touches the browser.
 */

const BASE = process.env.REACT_APP_API_URL || "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
}

/** Trigger a Gmail sync. Returns { newDeals, emailsFound, message } */
export async function syncGmail() {
  return apiFetch("/api/sync", { method: "POST" });
}

/** Re-screen a deal with a PDF deck. Returns { analysis, version } */
export async function rescreenWithDeck(dealId, pdfBase64) {
  return apiFetch("/api/screen", {
    method: "POST",
    body: JSON.stringify({ dealId, pdfBase64 }),
  });
}

/** Push a deal to HubSpot. Returns { result, pipeline } */
export async function pushToHubSpot(dealId) {
  return apiFetch("/api/hubspot", {
    method: "POST",
    body: JSON.stringify({ dealId }),
  });
}

/** Get all deals. Optional status filter: 'queue' | 'reviewed' */
export async function getDeals(status) {
  const qs = status ? `?status=${status}` : "";
  return apiFetch(`/api/deals${qs}`);
}

/** Mark a deal as reviewed (or back to queue) */
export async function updateDealStatus(dealId, status) {
  return apiFetch(`/api/deals/${dealId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Get sync log / last sync time */
export async function getSyncStatus() {
  return apiFetch("/api/deals/sync-status");
}

/** Get full screening history for a deal */
export async function getDealHistory(dealId) {
  return apiFetch(`/api/deals/${dealId}/history`);
}
