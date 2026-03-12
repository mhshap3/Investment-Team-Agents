import { YIE } from "../constants/brand";

const AGENTS = [
  {
    id: "deal-screener",
    label: "Deal Screener",
    tagline: "Inbound deal triage & fund scoring",
    description: "Screens pitch emails against Seed and Early Growth fund theses. Scores both funds independently, detects intros vs cold inbound, enriches with deck analysis, and routes to HubSpot.",
    status: "live",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <polygon points="16,2 28,8.5 28,23.5 16,30 4,23.5 4,8.5" fill="none" stroke="#00c896" strokeWidth="1.5"/>
        <polygon points="16,9 21,12 21,20 16,23 11,20 11,12" fill="none" stroke="#00c896" strokeWidth="1" opacity="0.45"/>
        <circle cx="16" cy="16" r="3" fill="#00c896"/>
      </svg>
    ),
    stats: [{ label: "FUNDS", value: "Seed + Growth" }, { label: "ROUTES TO", value: "HubSpot" }, { label: "STATUS", value: "Live" }],
    accentColor: "#00c896",
  },
  {
    id: "portfolio-updates",
    label: "Portfolio Updates",
    tagline: "Company news, milestones & signals",
    description: "Monitors all 91 portfolio companies for fundraising announcements, press coverage, executive changes, and key milestones. Surfaces what needs your attention each week.",
    status: "coming-soon",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="7" width="24" height="18" rx="2" stroke="#3d607d" strokeWidth="1.5" fill="none"/>
        <polyline points="8,19 12,14 16,17 21,11 24,14" stroke="#3d607d" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="24" cy="14" r="2" fill="#3d607d"/>
      </svg>
    ),
    stats: [{ label: "COMPANIES", value: "91" }, { label: "COHORTS", value: "13" }, { label: "STATUS", value: "Coming Soon" }],
    accentColor: "#4e9de8",
  },
  {
    id: "lp-reporting",
    label: "LP Report Builder",
    tagline: "Quarterly investor reporting & memos",
    description: "Generates draft LP updates, cohort performance summaries, and investment memos from portfolio data. Cuts reporting cycle from days to hours.",
    status: "coming-soon",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="7" y="3" width="18" height="26" rx="2" stroke="#3d607d" strokeWidth="1.5" fill="none"/>
        <line x1="11" y1="10" x2="21" y2="10" stroke="#3d607d" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="11" y1="14" x2="21" y2="14" stroke="#3d607d" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="11" y1="18" x2="17" y2="18" stroke="#3d607d" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="11" y1="22" x2="19" y2="22" stroke="#3d607d" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    stats: [{ label: "OUTPUT", value: "PDF + Deck" }, { label: "CADENCE", value: "Quarterly" }, { label: "STATUS", value: "Coming Soon" }],
    accentColor: "#a78bfa",
  },
  {
    id: "due-diligence",
    label: "Due Diligence",
    tagline: "Automated DD research & checklist",
    description: "Runs background research on founders and companies, generates structured DD checklists, surfaces competitive landscape, and flags risks before your first partner meeting.",
    status: "coming-soon",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="14" cy="14" r="9" stroke="#3d607d" strokeWidth="1.5" fill="none"/>
        <line x1="21" y1="21" x2="28" y2="28" stroke="#3d607d" strokeWidth="2" strokeLinecap="round"/>
        <line x1="10" y1="14" x2="18" y2="14" stroke="#3d607d" strokeWidth="1.2" strokeLinecap="round"/>
        <line x1="14" y1="10" x2="14" y2="18" stroke="#3d607d" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    stats: [{ label: "DEPTH", value: "Configurable" }, { label: "SOURCES", value: "Web + Docs" }, { label: "STATUS", value: "Coming Soon" }],
    accentColor: "#f5a623",
  },
  {
    id: "founder-outreach",
    label: "Founder Outreach",
    tagline: "Pass emails, follow-ups & meeting notes",
    description: "Drafts personalized pass emails, follow-up messages, and post-meeting notes for founders — written in your voice, grounded in deal context from the Deal Screener.",
    status: "coming-soon",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M4 9h24v16a2 2 0 01-2 2H6a2 2 0 01-2-2V9z" stroke="#3d607d" strokeWidth="1.5" fill="none"/>
        <polyline points="4,9 16,19 28,9" stroke="#3d607d" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    ),
    stats: [{ label: "TONE", value: "Your Voice" }, { label: "CONNECTED TO", value: "Deal Screener" }, { label: "STATUS", value: "Coming Soon" }],
    accentColor: "#e05252",
  },
  {
    id: "market-intel",
    label: "Market Intelligence",
    tagline: "Sector trends & competitive signals",
    description: "Monitors vertical software and AI sectors aligned with your thesis. Tracks funding rounds, exits, and narrative shifts. Delivered as a weekly briefing to your inbox.",
    status: "coming-soon",
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="11" stroke="#3d607d" strokeWidth="1.5" fill="none"/>
        <ellipse cx="16" cy="16" rx="5" ry="11" stroke="#3d607d" strokeWidth="1" fill="none"/>
        <line x1="5" y1="16" x2="27" y2="16" stroke="#3d607d" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
    stats: [{ label: "SECTORS", value: "Thesis-Aligned" }, { label: "FREQUENCY", value: "Weekly" }, { label: "STATUS", value: "Coming Soon" }],
    accentColor: "#00c896",
  },
];

export default function Platform({ onLaunchAgent }) {
  return (
    <div style={{ minHeight: "100vh", background: YIE.navy0, fontFamily: "'DM Sans', sans-serif", color: YIE.text1, overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:${YIE.navy1}} ::-webkit-scrollbar-thumb{background:${YIE.navy3};border-radius:2px}
        .agent-card{background:${YIE.navy1};border:1px solid ${YIE.navy3};border-radius:10px;padding:28px;transition:all 0.2s ease;position:relative;overflow:hidden;}
        .agent-card.live{cursor:pointer;}
        .agent-card.live:hover{border-color:#00c896;transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,200,150,0.12);}
        .agent-card.coming-soon{opacity:0.55;cursor:default;}
        .agent-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--accent);opacity:0;transition:opacity 0.2s;}
        .agent-card.live:hover::before{opacity:1;}
        .launch-btn{display:inline-flex;align-items:center;gap:8px;padding:9px 18px;background:${YIE.teal};border:none;border-radius:6px;color:${YIE.navy0};font-family:'DM Mono',monospace;font-size:11px;font-weight:600;letter-spacing:0.1em;cursor:pointer;transition:all 0.15s;}
        .launch-btn:hover{background:#00a87e;transform:translateY(-1px);}
        .geo-bg{position:fixed;top:0;left:0;right:0;bottom:0;pointer-events:none;z-index:0;overflow:hidden;opacity:0.025;background-image:repeating-linear-gradient(60deg,${YIE.teal} 0,${YIE.teal} 1px,transparent 0,transparent 50%),repeating-linear-gradient(120deg,${YIE.teal} 0,${YIE.teal} 1px,transparent 0,transparent 50%);background-size:48px 27.7px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fadeUp 0.5s ease forwards;}
        .fade-up-1{animation-delay:0.05s;opacity:0;} .fade-up-2{animation-delay:0.1s;opacity:0;} .fade-up-3{animation-delay:0.15s;opacity:0;} .fade-up-4{animation-delay:0.2s;opacity:0;} .fade-up-5{animation-delay:0.25s;opacity:0;} .fade-up-6{animation-delay:0.3s;opacity:0;}
      `}</style>

      <div className="geo-bg" />

      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, borderBottom: `1px solid ${YIE.navy3}`, background: `${YIE.navy1}ee`, backdropFilter: "blur(8px)", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill={YIE.navy3} stroke={YIE.teal} strokeWidth="1.5"/>
            <polygon points="18,9 25,13 25,21 18,25 11,21 11,13" fill="none" stroke={YIE.teal} strokeWidth="1" opacity="0.5"/>
            <circle cx="18" cy="17" r="3" fill={YIE.teal}/>
          </svg>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "17px", fontWeight: 600, letterSpacing: "0.1em", color: YIE.white, lineHeight: 1 }}>YORK <span style={{ color: YIE.teal }}>·</span> IE</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "8px", color: YIE.text3, letterSpacing: "0.2em", marginTop: "3px" }}>INVESTMENT INTELLIGENCE PLATFORM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: YIE.teal, boxShadow: `0 0 8px ${YIE.teal}` }} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em" }}>INTERNAL · YORK IE TEAM</span>
        </div>
      </div>

      {/* Hero */}
      <div style={{ position: "relative", zIndex: 1, padding: "56px 40px 40px", maxWidth: "1100px", margin: "0 auto" }}>
        <div className="fade-up fade-up-1">
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: YIE.teal, letterSpacing: "0.2em", marginBottom: "14px" }}>AGENT LIBRARY</div>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "36px", fontWeight: 600, color: YIE.white, lineHeight: 1.15, marginBottom: "12px" }}>
            Investment Team<br /><span style={{ color: YIE.teal }}>AI Agents</span>
          </h1>
          <p style={{ fontSize: "14px", color: YIE.text2, maxWidth: "460px", lineHeight: 1.7 }}>
            Purpose-built agents for the York IE investment workflow. From deal screening to LP reporting — each agent handles one job exceptionally well.
          </p>
        </div>

        <div className="fade-up fade-up-2" style={{ display: "flex", gap: "32px", marginTop: "36px", paddingTop: "32px", borderTop: `1px solid ${YIE.navy3}` }}>
          {[{ label: "LIVE AGENTS", value: "1" }, { label: "IN DEVELOPMENT", value: "5" }, { label: "FUNDS COVERED", value: "2" }, { label: "CRM", value: "HubSpot" }].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "8px", color: YIE.text3, letterSpacing: "0.14em", marginBottom: "4px" }}>{label}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "20px", fontWeight: 600, color: YIE.white }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent grid */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1100px", margin: "0 auto", padding: "0 40px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          {AGENTS.map((agent, i) => (
            <div
              key={agent.id}
              className={`agent-card ${agent.status} fade-up fade-up-${Math.min(i + 3, 6)}`}
              style={{ "--accent": agent.accentColor }}
              onClick={() => agent.status === "live" && onLaunchAgent(agent.id)}
            >
              {agent.status === "coming-soon" && (
                <div style={{ position: "absolute", top: "16px", right: "16px", fontFamily: "'DM Mono', monospace", fontSize: "8px", color: YIE.text3, background: YIE.navy3, padding: "3px 8px", borderRadius: "3px", letterSpacing: "0.12em" }}>COMING SOON</div>
              )}
              {agent.status === "live" && (
                <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: YIE.teal, boxShadow: `0 0 6px ${YIE.teal}` }} />
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "8px", color: YIE.teal, letterSpacing: "0.12em" }}>LIVE</span>
                </div>
              )}
              <div style={{ marginBottom: "18px" }}>{agent.icon}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "16px", fontWeight: 600, color: YIE.white, marginBottom: "4px" }}>{agent.label}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: agent.status === "live" ? agent.accentColor : YIE.text3, letterSpacing: "0.1em", marginBottom: "12px" }}>{agent.tagline}</div>
              <div style={{ fontSize: "12px", color: YIE.text2, lineHeight: 1.65, marginBottom: "20px", minHeight: "56px" }}>{agent.description}</div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                {agent.stats.map(s => (
                  <div key={s.label} style={{ background: YIE.navy2, border: `1px solid ${YIE.navy3}`, borderRadius: "4px", padding: "4px 10px" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "8px", color: YIE.text3, letterSpacing: "0.1em" }}>{s.label}</div>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "11px", fontWeight: 600, color: YIE.text1, marginTop: "1px" }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {agent.status === "live" ? (
                <button className="launch-btn" onClick={() => onLaunchAgent(agent.id)}>LAUNCH AGENT →</button>
              ) : (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: YIE.navy4, letterSpacing: "0.1em" }}>── IN DEVELOPMENT ──</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, borderTop: `1px solid ${YIE.navy3}`, padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.text3, letterSpacing: "0.12em" }}>YORK IE INVESTMENTS · INTERNAL PLATFORM · CONFIDENTIAL</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "9px", color: YIE.navy4, letterSpacing: "0.1em" }}>v2.0</span>
      </div>
    </div>
  );
}
