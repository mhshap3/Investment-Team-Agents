```jsx
import { useRef, useState } from "react";
import ScoreRing from "./ScoreRing";
import { YIE, labelStyle, actionStyle, getPipelineName, formatDate } from "../constants/brand";
import { rescreenWithDeck } from "../api";

function getDealSource(item) {
  const { analysis: deal } = item;

  if (item.fact_sheet) {
    const fs = typeof item.fact_sheet === "string" ? JSON.parse(item.fact_sheet) : item.fact_sheet;
    if (fs.source_type === "Intro" || (fs.introducer_name && fs.introducer_name !== "unknown")) {
      const company = (fs.introducer_company || "").toLowerCase();
      const email = (fs.introducer_email || "").toLowerCase();
      if (company.includes("york") || email.includes("york.ie")) {
        return { type: "Cold Inbound", detail: null };
      }
      const parts = [fs.introducer_name, fs.introducer_title, fs.introducer_company].filter(v => v && v !== "unknown");
      return { type: "Intro", detail: parts.join(", ") || null };
    }
  }

  if (deal.referral_type === "Intro" || deal.referral_detail) {
    const detail = deal.referral_detail || "";
    if (detail.toLowerCase().includes("york")) {
      return { type: "Cold Inbound", detail: null };
    }
    return { type: "Intro", detail: detail || null };
  }

  if ((item.from_email || "").endsWith("@york.ie")) {
    return { type: "Cold Inbound", detail: null };
  }

  return { type: "Cold Inbound", detail: null };
}

export default function DealDetail({ item, onBack, onMarkReviewed, onRefresh }) {
  const { analysis: deal } = item;
  const pipeline = getPipelineName(deal);
  const isSeed = pipeline === "Seed Fund Deals";
  const ab = actionStyle(deal.recommended_action);
  const source = getDealSource(item);

  const fileInputRef = useRef(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null);
  const [rescreening, setRescreening] = useState(false);
  const [rescreenError, setRescreenError] = useState(null);

  const handlePdf = (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    setPdfFile(file);
    const reader = new FileReader();
    reader.onload = () => setPdfBase64(reader.result.split(",")[1]);
    reader.readAsDataURL(file);
  };

  const handleRescreen = async () => {
    if (!pdfBase64) return;
    setRescreening(true);
    setRescreenError(null);
    try {
      const { analysis } = await rescreenWithDeck(item.id, pdfBase64);
      onBack(analysis);
    } catch (e) {
      setRescreenError("Re-screen failed: " + e.message);
    }
    setRescreening(false);
  };

  const website = item.fact_sheet?.website && item.fact_sheet.website !== "unknown"
    ? item.fact_sheet.website
    : null;

  return (
    <div className="fi">
      <button
        onClick={() => onBack(null)}
        style={{ background: "none", border: "none", color: YIE.text3, fontFamily: "'DM Mono', monospace", fontSize: "11px", cursor: "pointer", marginBottom: "22px", padding: 0, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: "6px" }}
      >
        <span style={{ color: YIE.teal }}>←</span> BACK TO PIPELINE
      </button>

      {deal.deck_enriched && deal.deck_insights?.length > 0 && (
        <div style={{ background: "#081528", border: `1px solid #1a3d5c`, borderLeft: `3px solid ${YIE.blue}`, borderRadius: "8px", padding: "14px 18px", marginBottom: "14px" }}>
          <div style={{ fontSize: "10px", color: "#60a5fa", letterSpacing: "0.1em", marginBottom: "10px" }}>📄 DECK INSIGHTS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {deal.deck_insights.map((ins, i) => (
              <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: "#93c5fd", background: "#0c1a2e", border: "1px solid #1e3a5f", borderRadius: "4px", padding: "4px 10px" }}>· {ins}</div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderTop: `3px solid ${isSeed ? YIE.teal : YIE.blue}`, borderRadius: "8px", padding: "20px 24px", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "22px", fontWeight: 600, color: YIE.white }}>{deal.company_name}</span>
          {deal.hard_pass && (
            <span style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "20px", background: "#1a0505", color: "#f87171", border: "1px solid #991b1b", letterSpacing: "0.06em", fontWeight: 600 }}>HARD PASS</span>
          )}
          {deal.primary_fund !== "None" && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "3px 10px", borderRadius: "3px", background: isSeed ? "#052518" : "#081528", color: isSeed ? YIE.teal : YIE.blue, border: "1px solid " + (isSeed ? YIE.teal3 : "#1a3d5c"), letterSpacing: "0.08em" }}>
              {isSeed ? "SEED FUND" : "EARLY GROWTH FUND"}
            </span>
          )}
          {deal.deck_enriched && (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "3px 10px", borderRadius: "3px", background: "#081528", color: YIE.blue, border: "1px solid #1a3d5c" }}>DECK ANALYSED</span>
          )}
        </div>

        <div style={{ fontSize: "12px", color: YIE.text3, marginBottom: "16px" }}>{deal.one_liner}</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
          {[
            ["FOUNDER", deal.founder_name],
            ["EMAIL", deal.founder_email],
            ["SECTOR", deal.sector],
            ["STAGE", deal.stage],
            ["MOST RECENT ARR / ANNUALIZED REVENUE", deal.arr],
            ["ROUND", deal.round_size],
            ["RAISED", deal.total_raised],
            ["GEO", deal.geography],
            ["RECEIVED", formatDate(item.received_at || item.receivedAt)],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em", marginBottom: "3px" }}>{k}</div>
              <div style={{ fontSize: "12px", color: YIE.text1, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v || "—"}</div>
            </div>
          ))}
          {website && (
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em", marginBottom: "3px" }}>WEBSITE</div>
              
                href={website.startsWith("http") ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "12px", color: YIE.teal, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none", display: "block" }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
              >
                {website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: `1px solid ${YIE.navy3}`, display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em" }}>DEAL SOURCE</span>
          {source.type === "Intro" ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "10px", background: "#1a0a2e", color: "#c084fc", border: "1px solid #6b21a8", letterSpacing: "0.05em" }}>INTRO</span>
              {source.detail && <span style={{ fontSize: "11px", color: "#a78bfa" }}>via {source.detail}</span>}
            </div>
          ) : (
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "2px 8px", borderRadius: "10px", background: YIE.navy2, color: YIE.text3, border: `1px solid ${YIE.navy3}`, letterSpacing: "0.06em" }}>COLD INBOUND</span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
        {[
          { fund: "Seed Fund", score: deal.seed_score, label: deal.seed_label, reasoning: deal.seed_reasoning, color: YIE.teal, activeBorder: YIE.teal3, subtext: "Pre-rev → $1.5M ARR", activeBg: "#052518", tag: "SEED FUND" },
          { fund: "Early Growth Fund", score: deal.growth_score, label: deal.growth_label, reasoning: deal.growth_reasoning, color: YIE.blue, activeBorder: "#1a3d5c", subtext: "$2M–$8M ARR · PMF", activeBg: "#081528", tag: "EARLY GROWTH FUND" },
        ].map(({ fund, score, label, reasoning, color, activeBorder, subtext, activeBg, tag }) => (
          <div key={fund} style={{ background: YIE.navy1, border: "1px solid " + (deal.primary_fund === fund ? activeBorder : YIE.navy3), borderRadius: "8px", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "10px", color, letterSpacing: "0.1em", marginBottom: "2px" }}>{tag}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3 }}>{subtext}</div>
              </div>
              {deal.primary_fund === fund && (
                <span style={{ fontSize: "9px", color, background: activeBg, border: "1px solid " + activeBorder, padding: "2px 8px", borderRadius: "10px" }}>PRIMARY</span>
              )}
            </div>
            <ScoreRing score={score} />
            <div style={{ marginTop: "4px", display: "inline-block" }}>
              {(() => { const ls = labelStyle(label); return <span style={{ fontSize: "9px", padding: "2px 8px", borderRadius: "10px", background: ls.bg, color: ls.text, border: "1px solid " + ls.border }}>{label}</span>; })()}
            </div>
            <div style={{ marginTop: "10px", fontSize: "11px", color: YIE.text3, lineHeight: "1.7" }}>{reasoning}</div>
          </div>
        ))}
      </div>

      <div style={{ background: ab.bg, borderRadius: "8px", padding: "12px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em" }}>RECOMMENDED ACTION</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600, color: ab.text }}>{deal.recommended_action}</span>
      </div>

      {deal.hard_pass && deal.hard_pass_reason && (
        <div style={{ padding: "12px 16px", background: "#1a0505", border: "1px solid #7f1d1d", borderRadius: "8px", marginBottom: "16px", fontSize: "12px", color: "#fca5a5" }}>⚠ {deal.hard_pass_reason}</div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
        {[
          { label: "✓ GREEN FLAGS", color: YIE.teal, border: YIE.teal3, items: deal.green_flags, textColor: "#86efac" },
          { label: "✗ RED FLAGS",   color: "#f87171", border: YIE.teal3, items: deal.red_flags,   textColor: "#fca5a5" },
        ].map(({ label, color, border, items, textColor }) => (
          <div key={label} style={{ background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderTop: `3px solid ${border}`, borderRadius: "8px", padding: "16px 18px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color, letterSpacing: "0.12em", marginBottom: "10px" }}>{label}</div>
            {items?.length
              ? items.map((f, i) => <div key={i} style={{ fontSize: "11px", color: textColor, padding: "6px 0", borderBottom: `1px solid ${YIE.navy2}`, lineHeight: "1.5" }}>· {f}</div>)
              : <div style={{ fontSize: "11px", color: YIE.text3 }}>None</div>
            }
          </div>
        ))}
      </div>

      {!deal.deck_enriched && (
        <div style={{ background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderRadius: "8px", padding: "16px 20px", marginBottom: "14px" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em", marginBottom: "10px" }}>ENRICH WITH DECK</div>
          <div style={{ fontSize: "11px", color: YIE.text3, marginBottom: "12px" }}>Attach a PDF pitch deck to re-screen with richer data.</div>
          {!pdfFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `1px dashed ${YIE.navy3}`, borderRadius: "6px", padding: "14px", cursor: "pointer", textAlign: "center", transition: "all 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = YIE.teal3}
              onMouseLeave={e => e.currentTarget.style.borderColor = YIE.navy3}
            >
              <input ref={fileInputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handlePdf} />
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "11px", color: YIE.text3 }}>⬆ Click to upload PDF</div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ fontSize: "11px", color: "#cbd5e1" }}>📄 {pdfFile.name}</div>
              <button onClick={handleRescreen} disabled={rescreening} style={{ padding: "6px 14px", background: YIE.teal, border: "none", borderRadius: "5px", color: YIE.navy0, fontFamily: "'DM Mono', monospace", fontSize: "10px", fontWeight: 600, cursor: "pointer", opacity: rescreening ? 0.5 : 1 }}>
                {rescreening ? "⟳ RE-SCREENING..." : "→ RE-SCREEN WITH DECK"}
              </button>
            </div>
          )}
          {rescreenError && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: YIE.red, marginTop: "8px" }}>{rescreenError}</div>}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        <button disabled title="Coming soon" style={{ padding: "13px 20px", background: "#1a0505", border: "1px solid #991b1b", borderRadius: "7px", color: "#f87171", fontFamily: "'DM Mono', monospace", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", cursor: "not-allowed", opacity: 0.5 }}>
          ✉ SEND PASS EMAIL
        </button>
        <button disabled title="Coming soon" style={{ padding: "13px 20px", background: "#052518", border: `1px solid ${YIE.teal3}`, borderRadius: "7px", color: YIE.teal, fontFamily: "'DM Mono', monospace", fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", cursor: "not-allowed", opacity: 0.5 }}>
          📅 SCHEDULE FIRST CALL
        </button>
      </div>
    </div>
  );
}
```
