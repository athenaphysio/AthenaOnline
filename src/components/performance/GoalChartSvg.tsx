import { formatValue, type GoalChart, type Status } from "@/lib/performanceMetrics";

// One goal's graph: a dot for every test by date, a dashed target line from
// the first test to the goal, and a green on track zone around it that
// narrows towards the goal date. Better always sits higher. Plain SVG with
// no hooks, so it renders on the server, and every dot has a tooltip.

const LINE = "#2a78d6";
const ZONE = "#008300";
// Status colours, each also named in the legend and the tooltip, so colour
// never carries the meaning alone. Behind is amber, never red.
const DOT: Record<Status, string> = { on_track: "#008300", ahead: "#7a4fd0", behind: "#c98500", reached: "#008300", none: "#eb6834" };
const DOT_WORDS: Record<Status, string> = { on_track: "on track", ahead: "ahead", behind: "below the path", reached: "goal reached", none: "" };

const W = 600;
const H = 240;
const PAD = { top: 16, right: 18, bottom: 36, left: 72 };
const DAY = 86400000;

function t(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function short(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function GoalChartSvg({ chart, surface = "#ffffff" }: { chart: GoalChart; surface?: string }) {
  const { points, line, zone, higherIsBetter, unit, goalValue } = chart;
  const dates = [...points.map((p) => t(p.date)), ...(line ? [t(line.to.date)] : [])];
  const x0 = dates.length ? Math.min(...dates) : 0;
  const x1 = Math.max(x0 + 28 * DAY, ...dates);

  const values = [...points.map((p) => p.value), goalValue];
  if (line && zone) values.push(line.from.value + zone.startHalf, line.from.value - zone.startHalf, goalValue + zone.endHalf, goalValue - zone.endHalf);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.02, 1);
  const vMin = lo - span * 0.12;
  const vMax = hi + span * 0.12;

  const x = (ms: number) => PAD.left + ((ms - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  // Better is higher: for times, smaller values go to the top.
  const y = (v: number) => {
    const share = (v - vMin) / (vMax - vMin);
    return higherIsBetter ? PAD.top + (1 - share) * (H - PAD.top - PAD.bottom) : PAD.top + share * (H - PAD.top - PAD.bottom);
  };

  // Round steps for the axis: whole minutes for times, whole watts.
  const steps = unit === "watts" ? [1, 2, 5, 10, 20, 25, 50, 100] : [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
  const step = steps.find((st) => (vMax - vMin) / st <= 4) ?? steps[steps.length - 1];
  const yTicks: number[] = [];
  for (let v = Math.ceil(vMin / step) * step; v <= vMax; v += step) yTicks.push(v);
  const xTicks = [0, 1, 2, 3].map((i) => x0 + ((x1 - x0) * i) / 3);

  let zonePath: string | null = null;
  if (line && zone) {
    const a = t(line.from.date);
    const b = t(line.to.date);
    zonePath = `M ${x(a)} ${y(line.from.value + zone.startHalf)} L ${x(b)} ${y(line.to.value + zone.endHalf)} L ${x(b)} ${y(line.to.value - zone.endHalf)} L ${x(a)} ${y(line.from.value - zone.startHalf)} Z`;
  }

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${chart.question} ${points.length} result${points.length === 1 ? "" : "s"}; ${chart.headline.text}.`}
        style={{ display: "block", color: "inherit", fontFamily: "inherit" }}
      >
        {yTicks.map((v, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={13} fill="currentColor" fillOpacity={0.65}>
              {formatValue(unit, v)}
            </text>
          </g>
        ))}
        {xTicks.map((ms, i) => (
          <text key={`x${i}`} x={x(ms)} y={H - PAD.bottom + 20} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"} fontSize={13} fill="currentColor" fillOpacity={0.65}>
            {short(ms)}
          </text>
        ))}
        <text x={PAD.left - 8} y={H - 4} textAnchor="end" fontSize={11.5} fill="currentColor" fillOpacity={0.55}>
          Better ↑
        </text>

        {zonePath && <path d={zonePath} fill={ZONE} fillOpacity={0.13} />}
        {line ? (
          <g>
            <line x1={x(t(line.from.date))} y1={y(line.from.value)} x2={x(t(line.to.date))} y2={y(line.to.value)} stroke={LINE} strokeWidth={2} strokeDasharray="6 5" />
            <circle cx={x(t(line.to.date))} cy={y(line.to.value)} r={5} fill={LINE} stroke={surface} strokeWidth={2}>
              <title>{`Goal ${formatValue(unit, line.to.value)}, ${short(t(line.to.date))}`}</title>
            </circle>
          </g>
        ) : (
          <line x1={PAD.left} x2={W - PAD.right} y1={y(goalValue)} y2={y(goalValue)} stroke={LINE} strokeWidth={2} strokeDasharray="6 5">
            <title>{`Goal ${formatValue(unit, goalValue)}`}</title>
          </line>
        )}

        {points.map((p, i) => (
          <g key={`p${i}`}>
            <circle cx={x(t(p.date))} cy={y(p.value)} r={12} fill="transparent">
              <title>{`${p.label}, ${short(t(p.date))}: ${chart.predicted ? "predicts " : ""}${formatValue(unit, p.value)}${DOT_WORDS[p.status] ? `, ${DOT_WORDS[p.status]}` : ""}`}</title>
            </circle>
            <circle cx={x(t(p.date))} cy={y(p.value)} r={5.5} fill={DOT[p.status]} stroke={surface} strokeWidth={2} pointerEvents="none" />
          </g>
        ))}
      </svg>
      <figcaption style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, marginTop: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 16, borderTop: `2px dashed ${LINE}`, display: "inline-block" }} />
          Path to the goal
        </span>
        {zonePath && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 10, background: ZONE, opacity: 0.25, display: "inline-block" }} />
            On track zone
          </span>
        )}
        {(["on_track", "ahead", "behind", "reached", "none"] as Status[])
          .filter((st) => points.some((p) => p.status === st))
          .map((st) => (
            <span key={st} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 5, background: DOT[st], display: "inline-block" }} />
              {st === "none" ? (chart.predicted ? "Tests and races, as a predicted time" : "Tests") : `${chart.predicted ? "Prediction" : "Test"} ${DOT_WORDS[st]}`}
            </span>
          ))}
        {chart.fewTests && <span style={{ fontStyle: "italic" }}>{points.length === 0 ? "No tests yet" : "First test, more to come"}</span>}
      </figcaption>
    </figure>
  );
}
