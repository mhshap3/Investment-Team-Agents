import { YIE, scoreColor } from "../constants/brand";

export default function ScoreRing({ score, size = 80 }) {
  const r = size * 0.42;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={YIE.navy3} strokeWidth="6" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={scoreColor(score)} strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - score / 100)}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text x={size / 2} y={size / 2 - 3} textAnchor="middle"
        fill={scoreColor(score)} fontSize={size * 0.22} fontWeight="700"
        fontFamily="'DM Sans', sans-serif">{score}</text>
      <text x={size / 2} y={size / 2 + 10} textAnchor="middle"
        fill={YIE.text3} fontSize={size * 0.1}
        fontFamily="'DM Mono', monospace">/100</text>
    </svg>
  );
}
