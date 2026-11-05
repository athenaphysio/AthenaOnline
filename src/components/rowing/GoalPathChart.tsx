import { formatMeasure, type GoalPath } from "@/lib/rowing/goalPath";

// The client's path to their goal: a straight line from their entry test
// to their goal, a light band either side of it, and a dot for every test
// since. Quicker is higher, so progress always reads as going up. Plain SVG
// with no hooks, so it renders on the server and inside client components
// alike, and every dot carries a hover tooltip.
//
// Colours are the two validated chart hues (path blue, tests orange); text
// stays in the surrounding ink colour.

const PATH = "#2a78d6";
const TESTS = "#eb6834";
const W = 600;
const H = 250;
const PAD = { top: 16, right: 18, bottom: 40, left: 76 };

export default function GoalPathChart({ path, surface = "#ffffff" }: { path: GoalPath; surface?: string }) {
  const { points, goal, totalWeeks } = path;
  const values = [...points.map((p) => p.value), ...(goal ? [goal.value] : [])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, hi * 0.02);
  const yMin = lo - span * 0.15; // fastest, drawn at the top
  const yMax = hi + span * 0.15;
  const x = (week: number) => PAD.left + (week / Math.max(1, totalWeeks)) * (W - PAD.left - PAD.right);
  // Lower time is better, so it sits higher on the chart.
  const y = (v: number) => PAD.top + ((v - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  const yTicks = [0, 1, 2, 3].map((i) => yMin + ((yMax - yMin) * i) / 3);
  const step = totalWeeks > 16 ? 4 : 2;
  const xTicks: number[] = [];
  for (let w = 0; w <= totalWeeks; w += step) xTicks.push(w);
  if (xTicks[xTicks.length - 1] !== totalWeeks) xTicks.push(totalWeeks);

  const base = points[0];
  const bandHalf = (v: number) => v * 0.01;
  const band = goal
    ? `M ${x(0)} ${y(base.value - bandHalf(base.value))} L ${x(totalWeeks)} ${y(goal.value - bandHalf(goal.value))} L ${x(totalWeeks)} ${y(goal.value + bandHalf(goal.value))} L ${x(0)} ${y(base.value + bandHalf(base.value))} Z`
    : null;
  const testLine = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.week)} ${y(p.value)}`).join(" ");
  const latest = points[points.length - 1];

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Path to ${goal ? goal.label : "the event"}: ${points.length} test${points.length === 1 ? "" : "s"} so far, latest ${formatMeasure(path, latest.value)}.`} style={{ display: "block", color: "inherit", fontFamily: "inherit" }}>
        {yTicks.map((v, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={14} fill="currentColor" fillOpacity={0.65}>
              {formatMeasure(path, v)}
            </text>
          </g>
        ))}
        {xTicks.map((w) => (
          <text key={`x${w}`} x={x(w)} y={H - PAD.bottom + 20} textAnchor="middle" fontSize={14} fill="currentColor" fillOpacity={0.65}>
            {w === 0 ? "Start" : `Wk ${w}`}
          </text>
        ))}
        <text x={PAD.left - 8} y={H - 6} textAnchor="end" fontSize={12} fill="currentColor" fillOpacity={0.55}>
          Quicker ↑
        </text>

        {path.currentWeek > 0 && path.currentWeek < totalWeeks && (
          <g>
            <line x1={x(path.currentWeek)} x2={x(path.currentWeek)} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1} />
            <text x={x(path.currentWeek) + 4} y={PAD.top + 10} fontSize={12} fill="currentColor" fillOpacity={0.6}>
              Now
            </text>
          </g>
        )}

        {band && <path d={band} fill={PATH} fillOpacity={0.12} />}
        {goal && (
          <g>
            <line x1={x(0)} y1={y(base.value)} x2={x(totalWeeks)} y2={y(goal.value)} stroke={PATH} strokeWidth={2} strokeLinecap="round" />
            <circle cx={x(totalWeeks)} cy={y(goal.value)} r={5} fill={PATH} stroke={surface} strokeWidth={2}>
              <title>{`${goal.label}, ${path.eventName}`}</title>
            </circle>
          </g>
        )}

        {points.length > 1 && <path d={testLine} fill="none" stroke={TESTS} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeOpacity={0.6} />}
        {points.map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={x(p.week)} cy={y(p.value)} r={12} fill="transparent">
              <title>{`${p.label}, ${p.date}: predicts ${formatMeasure(path, p.value)}`}</title>
            </circle>
            <circle cx={x(p.week)} cy={y(p.value)} r={5} fill={TESTS} stroke={surface} strokeWidth={2} pointerEvents="none" />
          </g>
        ))}
      </svg>
      <figcaption style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, marginTop: 4 }}>
        {goal && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 2, background: PATH, display: "inline-block" }} />
            Path to {goal.label.replace(/^Goal /, "")}
          </span>
        )}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: TESTS, display: "inline-block" }} />
          Your tests, as predicted {path.measure === "time" ? "event time" : "event pace"}
        </span>
      </figcaption>
    </figure>
  );
}
