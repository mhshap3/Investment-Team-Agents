import { YIE, scoreColor, actionStyle, priorityStyle, topScore, formatDate } from "../constants/brand";

function getDealSource(item) {
  if (item.fact_sheet) {
    const fs = typeof item.fact_sheet === "string" ? JSON.parse(item.fact_sheet) : item.fact_sheet;
    if (fs.source_type === "Intro" || fs.introducer_name) {
      const company = (fs.introducer_company || "").toLowerCase();
      const email = (fs.introducer_email || "").toLowerCase();
      if (company.includes("york") || email.includes("york.ie")) {
        return { type: "Cold Inbound", detail: null };
      }
      const parts = [fs.introducer_name, fs.introducer_title, fs.introducer_company].filter(v => v && v !== "unknown");
      return { type: "Intro", detail: parts.join(", ") || null };
    }
  }
  if (item.analysis?.referral_type === "Intro" || item.analysis?.referral_detail) {
    const detail = item.analysis?.referral_detail || "";
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

export default function DealRow({ item, onClick }) {
  const score = topScore(item.analysis);
  const ps = priorityStyle(score);
  const ab = actionStyle(item.analysis.recommended_action);
  const isSeed = item.analysis.primary_fund !== "Early Growth Fund";
  const source = getDealSource(item);

  return (
    <div
      onClick={onClick}
      style={{
        background: YIE.navy1, border: `1px solid ${YIE.navy3}`, borderRadius: "8px",
        padding: "14px 18px", cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
        marginBottom: "8px",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = YIE.teal3; e.currentTarget.style.background = YIE.navy2; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = YIE.navy3; e.currentTarget.style.background = YIE.navy1; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        {/* Priority badge */}
        <div style={{ width: "44px", textAlign: "center", flexShrink: 0 }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: "9px", fontWeight: 700,
            padding: "3px 6px", borderRadius: "4px", background: ps.bg,
            color: ps.text, border: "1px solid " + ps.border, letterSpacing: "0.06em",
          }}>{ps.label}</div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: scoreColor(score), marginTop: "5px", fontFamily: "'DM Sans', sans-serif" }}>{score}</div>
        </div>

        {/* Company info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600, color: YIE.white }}>
              {item.analysis.company_name}
            </span>
            <span style={{
              fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "2px 8px", borderRadius: "3px",
              background: isSeed ? "#052518" : "#081528",
              color: isSeed ? YIE.teal : YIE.blue,
              border: "1px solid " + (isSeed ? YIE.teal3 : "#1a3d5c"),
            }}>{isSeed ? "SEED" : "GROWTH"}</span>
            {item.analysis.hard_pass && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "2px 8px", borderRadius: "3px", background: "#200808", color: YIE.red, border: "1px solid #7a1a1a" }}>HARD PASS</span>
            )}
            {item.analysis.deck_enriched && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "2px 8px", borderRadius: "3px", background: "#081528", color: YIE.blue, border: "1px solid #1a3d5c" }}>DECK ✓</span>
            )}
            {source.type === "Intro" && (
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", padding: "2px 8px", borderRadius: "3px", background: "#160a28", color: "#c084fc", border: "1px solid #5b21b6" }}>INTRO</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ fontSize: "11px", color: YIE.text3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
              {item.analysis.one_liner}
            </div>
            {source.type === "Intro" && source.detail && (
              <div style={{ fontSize: "10px", color: "#a78bfa", flexShrink: 0, whiteSpace: "nowrap" }}>via {source.detail}</div>
            )}
          </div>
        </div>

        {/* Meta columns */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center", flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.1em" }}>ANNUAL REV.</div>
            <div style={{ fontSize: "11px", color: YIE.text1, fontWeight: 500 }}>{item.analysis.arr || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.1em" }}>ROUND</div>
            <div style={{ fontSize: "11px", color: YIE.text1, fontWeight: 500 }}>{item.analysis.round_size || "—"}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.1em" }}>ACTION</div>
            <div style={{ fontSize: "10px", fontWeight: 600, color: ab.text }}>{item.analysis.recommended_action}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.1em" }}>RECEIVED</div>
            <div style={{ fontSize: "10px", color: YIE.text2 }}>{formatDate(item.received_at || item.receivedAt)}</div>
          </div>
        </div>

        <div style={{ color: YIE.teal, fontSize: "16px", flexShrink: 0, opacity: 0.6 }}>›</div>
      </div>
    </div>
  );
}
