import { useState, useEffect, useCallback } from "react";
import DealRow from "../components/DealRow";
import DealDetail from "../components/DealDetail";
import { YIE, topScore } from "../constants/brand";
import { getDeals, syncGmail, getSyncStatus } from "../api";

export default function DealScreener() {
  const [deals, setDeals] = useState([]);
  const [reviewed, setReviewed] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState("queue");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [screeningStatus, setScreeningStatus] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const selectedDeal = [...deals, ...reviewed].find(d => d.id === selectedId) || null;

  // ─── Load deals from server ───────────────────────────────────────────────
  const loadDeals = useCallback(async () => {
    try {
      const [queueData, reviewedData] = await Promise.all([
        getDeals("queue"),
        getDeals("reviewed"),
      ]);
      const sorted = (queueData.deals || []).sort((a, b) => topScore(b.analysis) - topScore(a.analysis));
      setDeals(sorted);
      setReviewed(reviewedData.deals || []);
    } catch (e) {
      console.error("Failed to load deals:", e.message);
    }
  }, []);

  // Load last sync time from server
  const loadSyncStatus = useCallback(async () => {
    try {
      const { lastSync } = await getSyncStatus();
      if (lastSync?.ran_at) setLastSyncedAt(new Date(lastSync.ran_at));
    } catch (e) {
      console.warn("Could not load sync status");
    }
  }, []);

  useEffect(() => {
    loadDeals();
    loadSyncStatus();
  }, [loadDeals, loadSyncStatus]);

  // ─── Manual sync ─────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    setScreeningStatus("Fetching and screening emails...");
    try {
      const result = await syncGmail();
      setScreeningStatus(result.message);
      setLastSyncedAt(new Date());
      await loadDeals(); // refresh list from server
    } catch (e) {
      setSyncError("Sync failed: " + e.message);
      setScreeningStatus("");
    }
    setSyncing(false);
  };

  // ─── Deal actions ─────────────────────────────────────────────────────────
  const handleMarkReviewed = async () => {
    await loadDeals();
    setSelectedId(null);
  };

  const handleBackFromDetail = async (updatedAnalysis) => {
    if (updatedAnalysis) await loadDeals();
    setSelectedId(null);
  };

  const queueDeals = deals.sort((a, b) => topScore(b.analysis) - topScore(a.analysis));
  const highCount = queueDeals.filter(d => topScore(d.analysis) >= 70).length;
  const medCount  = queueDeals.filter(d => topScore(d.analysis) >= 45 && topScore(d.analysis) < 70).length;

  return (
    <div style={{ minHeight: "100vh", background: YIE.navy0, fontFamily: "'DM Sans', sans-serif", color: YIE.text1 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${YIE.navy1}} ::-webkit-scrollbar-thumb{background:${YIE.navy3};border-radius:2px}
        .bt{cursor:pointer;transition:all 0.15s} .bt:hover{background:${YIE.navy3} !important}
        .sync-btn{cursor:pointer;transition:all 0.2s;font-family:'DM Mono',monospace}
        .sync-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 4px 20px rgba(0,200,150,0.25)}
        .sync-btn:disabled{opacity:.5;cursor:not-allowed}
        .fi{animation:fi 0.35s ease forwards} @keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .pulse{animation:pulse 1.5s ease-in-out infinite} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        .spin{animation:spin 1s linear infinite} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .stat-card{transition:border-color 0.2s} .stat-card:hover{border-color:${YIE.teal3} !important}
        .geo-bg{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0;overflow:hidden;opacity:0.035;
          background-image:repeating-linear-gradient(60deg,${YIE.teal} 0,${YIE.teal} 1px,transparent 0,transparent 50%),
            repeating-linear-gradient(120deg,${YIE.teal} 0,${YIE.teal} 1px,transparent 0,transparent 50%);
          background-size:48px 27.7px;}
      `}</style>

      <div className="geo-bg" />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, borderBottom: `1px solid ${YIE.navy3}`, background: `${YIE.navy1}ee`, backdropFilter: "blur(8px)", padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "60px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill={YIE.navy3} stroke={YIE.teal} strokeWidth="1.5"/>
            <polygon points="16,8 22,11.5 22,18.5 16,22 10,18.5 10,11.5" fill="none" stroke={YIE.teal} strokeWidth="1" opacity="0.5"/>
            <circle cx="16" cy="15" r="2.5" fill={YIE.teal}/>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "15px", fontWeight: 600, letterSpacing: "0.12em", color: YIE.white, lineHeight: 1 }}>YORK <span style={{ color: YIE.teal }}>·</span> IE</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "8px", color: YIE.text3, letterSpacing: "0.18em", marginTop: "3px" }}>INVESTMENT DEAL SCREENER</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
            {screeningStatus && !syncing && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3 }}>{screeningStatus}</span>
            )}
            {lastSyncedAt && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.08em" }}>
                LAST SYNC · {lastSyncedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {lastSyncedAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
              </span>
            )}
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.navy4, letterSpacing: "0.08em" }}>
              AUTO SYNC · 7:00 AM ET DAILY
            </span>
          </div>
          <button className="sync-btn" onClick={handleSync} disabled={syncing} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 18px", background: YIE.teal, border: "none", borderRadius: "6px", color: YIE.navy0, fontSize: "11px", fontWeight: 600, letterSpacing: "0.1em", fontFamily: "'DM Mono', monospace" }}>
            <span className={syncing ? "spin" : ""} style={{ display: "inline-block", fontSize: "14px" }}>⟳</span>
            {syncing ? "SYNCING..." : "SYNC GMAIL"}
          </button>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: "980px", margin: "0 auto", padding: "28px 24px" }}>
        {selectedId && selectedDeal ? (
          <DealDetail
            item={selectedDeal}
            onBack={handleBackFromDetail}
            onMarkReviewed={handleMarkReviewed}
          />
        ) : (
          <div className="fi">
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "28px" }}>
              {[
                { label: "IN QUEUE",      value: queueDeals.length, color: YIE.white,  accent: YIE.navy3   },
                { label: "HIGH PRIORITY", value: highCount,          color: YIE.teal,  accent: YIE.teal3   },
                { label: "MED PRIORITY",  value: medCount,           color: YIE.amber, accent: "#7a4800"   },
                { label: "REVIEWED",      value: reviewed.length,    color: YIE.blue,  accent: "#1a3d5c"   },
              ].map(({ label, value, color, accent }) => (
                <div key={label} className="stat-card" style={{ background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderRadius: "8px", padding: "16px 20px", borderTop: `3px solid ${accent}` }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em", marginBottom: "10px" }}>{label}</div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "32px", fontWeight: 600, color, lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", marginBottom: "18px", background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderRadius: "7px", padding: "3px", width: "fit-content" }}>
              {[["queue", "PIPELINE"], ["reviewed", "REVIEWED"]].map(([id, lbl]) => (
                <button key={id} className="bt" onClick={() => setActiveTab(id)} style={{ padding: "7px 20px", borderRadius: "5px", border: "none", fontFamily: "'DM Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", fontWeight: 500, background: activeTab === id ? YIE.navy3 : "transparent", color: activeTab === id ? YIE.white : YIE.text3, borderBottom: activeTab === id ? `2px solid ${YIE.teal}` : "2px solid transparent" }}>
                  {lbl} <span style={{ opacity: 0.6 }}>{id === "queue" ? `(${queueDeals.length})` : `(${reviewed.length})`}</span>
                </button>
              ))}
            </div>

            {syncError && <div style={{ marginBottom: "14px", padding: "12px 16px", background: "#1a0808", border: `1px solid #7a1a1a`, borderRadius: "7px", fontFamily: "'DM Mono', monospace", fontSize: "11px", color: YIE.red }}>{syncError}</div>}

            {syncing && (
              <div style={{ marginBottom: "14px", padding: "12px 16px", background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderRadius: "7px", display: "flex", alignItems: "center", gap: "10px" }}>
                <div className="pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: YIE.teal, flexShrink: 0 }} />
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: YIE.text2 }}>Screening new deals — this may take a minute...</span>
              </div>
            )}

            {activeTab === "queue" && (
              queueDeals.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: "0 auto 16px", display: "block", opacity: 0.3 }}>
                    <polygon points="24,4 40,14 40,34 24,44 8,34 8,14" fill="none" stroke={YIE.teal} strokeWidth="2"/>
                  </svg>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "12px", letterSpacing: "0.1em", color: YIE.text3, marginBottom: "8px" }}>NO DEALS IN PIPELINE</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: YIE.navy4 }}>SYNC GMAIL to pull in new pitches</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em", marginBottom: "12px" }}>SORTED BY FIT SCORE · HIGHEST FIRST</div>
                  {queueDeals.map(item => (
                    <DealRow key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
                  ))}
                </div>
              )
            )}

            {activeTab === "reviewed" && (
              reviewed.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 0", fontFamily: "'DM Mono', monospace", fontSize: "11px", color: YIE.text3, letterSpacing: "0.1em" }}>NO REVIEWED DEALS YET</div>
              ) : (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em", marginBottom: "12px" }}>REVIEWED DEALS</div>
                  {reviewed.map(item => (
                    <DealRow key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
