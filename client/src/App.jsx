import { useState } from "react";
import Platform from "./pages/Platform";
import DealScreener from "./pages/DealScreener";
import { YIE } from "./constants/brand";

export default function App() {
  const [activeAgent, setActiveAgent] = useState(null);

  if (activeAgent === "deal-screener") {
    return (
      <div>
        {/* Back to platform nav */}
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
          background: `${YIE.navy0}f0`, backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${YIE.navy3}`,
          display: "flex", alignItems: "center", gap: "16px",
          padding: "0 24px", height: "44px",
        }}>
          <button
            onClick={() => setActiveAgent(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Mono', monospace", fontSize: "10px", color: YIE.text3, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "6px", padding: 0 }}
          >
            <span style={{ color: YIE.teal }}>←</span> PLATFORM
          </button>
          <span style={{ color: YIE.navy3, fontSize: "12px" }}>|</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "10px", color: YIE.text3, letterSpacing: "0.1em" }}>DEAL SCREENER</span>
        </div>
        <div style={{ paddingTop: "44px" }}>
          <DealScreener />
        </div>
      </div>
    );
  }

  return <Platform onLaunchAgent={setActiveAgent} />;
}
