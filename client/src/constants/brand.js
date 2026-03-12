export const YIE = {
  navy0: "#080f18",
  navy1: "#0d1b2a",
  navy2: "#112236",
  navy3: "#1a3550",
  navy4: "#1e3d5c",
  teal:  "#00c896",
  teal2: "#00a87e",
  teal3: "#007d5e",
  white: "#ffffff",
  text1: "#c8d8e8",
  text2: "#7a9bb5",
  text3: "#3d607d",
  amber: "#f5a623",
  red:   "#e05252",
  blue:  "#4e9de8",
};

export const scoreColor = (s) => s >= 70 ? YIE.teal : s >= 45 ? YIE.amber : YIE.red;

export const labelStyle = (l) => {
  if (l === "Strong Fit")   return { bg: "#052518", text: YIE.teal,  border: YIE.teal3  };
  if (l === "Possible Fit") return { bg: "#1e1500", text: YIE.amber, border: "#7a4800"  };
  if (l === "Weak Fit")     return { bg: "#1e0a00", text: "#fb923c", border: "#7a2800"  };
  return                           { bg: "#200808", text: YIE.red,   border: "#7a1a1a"  };
};

export const actionStyle = (a) => {
  if (a === "Fast Track")    return { bg: "#052518", text: YIE.teal  };
  if (a === "Schedule Call") return { bg: "#081528", text: YIE.blue  };
  if (a === "Review Deck")   return { bg: "#1e1500", text: YIE.amber };
  return                            { bg: "#200808", text: YIE.red   };
};

export const priorityStyle = (score) => {
  if (score >= 70) return { label: "HIGH", bg: "#052518", text: YIE.teal,  border: YIE.teal3  };
  if (score >= 45) return { label: "MED",  bg: "#1e1500", text: YIE.amber, border: "#7a4800"  };
  return                  { label: "LOW",  bg: "#200808", text: YIE.red,   border: "#7a1a1a"  };
};

export const topScore = (analysis) =>
  Math.max(analysis?.seed_score || 0, analysis?.growth_score || 0);

export const getPipelineName = (deal) => {
  if (deal.primary_fund === "Early Growth Fund") return "Early Growth Fund Deals";
  if (deal.primary_fund === "Seed Fund")         return "Seed Fund Deals";
  const arr = deal.arr || "";
  if (/pre.?revenue/i.test(arr)) return "Seed Fund Deals";
  const m = arr.match(/([\d.]+)\s*([MmKk])?/);
  if (m) {
    let n = parseFloat(m[1]);
    if (/[Mm]/.test(m[2] || "")) n *= 1e6;
    else if (/[Kk]/.test(m[2] || "")) n *= 1e3;
    return n > 1_500_000 ? "Early Growth Fund Deals" : "Seed Fund Deals";
  }
  return "Seed Fund Deals";
};

export const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};
