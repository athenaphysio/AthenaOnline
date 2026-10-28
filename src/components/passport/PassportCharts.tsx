// Human Passport charts. Plain SVG, no chart library, so they render on the
// server, cost nothing to load on a phone and look identical everywhere.
//
// The visual grammar, used the same way on every chart:
//   healthy range  = a soft blue band
//   optimal range  = a soft green band inside it
//   the client     = a solid dot in the domain colour, the latest one larger
//   earlier values = a hollow "ghost" dot with an arrow to the newest

import { formatValue, timepointLabel, type PassportMarker, type PassportResult } from "@/lib/passport";

const RANGE_FILL = "#e6edf5";
const OPTIMAL_FILL = "#d7ebe3";
const TRACK = "#ece6db";
const AXIS_TEXT = "#7a716a";
const INK = "#1c1c1c";

type Ranges = Pick<PassportMarker, "range_low" | "range_high" | "optimal_low" | "optimal_high">;

// The visible window: wide enough to hold every value and every range edge,
// with a little breathing room either side.
function extent(values: number[], m: Ranges): [number, number] {
  const all = [...values, m.range_low, m.range_high, m.optimal_low, m.optimal_high].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (lo === hi) {
    lo -= Math.abs(lo) * 0.2 || 1;
    hi += Math.abs(hi) * 0.2 || 1;
  }
  const pad = (hi - lo) * 0.12;
  return [lo - pad, hi + pad];
}

// ---------------------------------------------------------------------------
// Range bar: where the latest value sits, and where the previous one sat.
// ---------------------------------------------------------------------------
export function RangeBar({
  marker,
  results,
  colour,
}: {
  marker: PassportMarker;
  results: PassportResult[];
  colour: string;
}) {
  const values = results.map((r) => Number(r.value));
  const latest = values[values.length - 1];
  const previous = values.length > 1 ? values[values.length - 2] : null;
  const [lo, hi] = extent(values, marker);
  const W = 320;
  const left = 8;
  const right = W - 8;
  const X = (v: number) => left + ((v - lo) / (hi - lo)) * (right - left);
  const barY = 22;
  const barH = 10;
  const band = (a: number | null, b: number | null, fill: string, key: string) => {
    if (a == null && b == null) return null;
    const x1 = X(a ?? lo);
    const x2 = X(b ?? hi);
    return <rect key={key} x={x1} y={barY} width={Math.max(2, x2 - x1)} height={barH} rx={barH / 2} fill={fill} />;
  };
  const arrowId = `passport-arrow-${colour.replace(/[^a-zA-Z0-9]/g, "")}`;
  const edgeLabels = [marker.range_low, marker.range_high].filter((v): v is number => v != null);

  return (
    <svg viewBox={`0 0 ${W} 58`} width="100%" role="img" aria-label={`${marker.name}: ${formatValue(latest)}${marker.unit ? ` ${marker.unit}` : ""}`}>
      <rect x={left} y={barY} width={right - left} height={barH} rx={barH / 2} fill={TRACK} />
      {band(marker.range_low, marker.range_high, RANGE_FILL, "range")}
      {band(marker.optimal_low, marker.optimal_high, OPTIMAL_FILL, "optimal")}
      {previous != null && (
        <g>
          <circle cx={X(previous)} cy={barY + barH / 2} r={6} fill="#fff" stroke={colour} strokeWidth={1.5} strokeOpacity={0.5} />
          {Math.abs(X(latest) - X(previous)) > 18 && (
            <line
              x1={X(previous) + (X(latest) > X(previous) ? 8 : -8)}
              x2={X(latest) + (X(latest) > X(previous) ? -11 : 11)}
              y1={barY - 6}
              y2={barY - 6}
              stroke={colour}
              strokeWidth={1.25}
              markerEnd={`url(#${arrowId})`}
            />
          )}
        </g>
      )}
      <circle cx={X(latest)} cy={barY + barH / 2} r={8} fill={colour} stroke="#fff" strokeWidth={2} />
      {edgeLabels.map((v) => (
        <text key={v} x={X(v)} y={barY + barH + 16} textAnchor="middle" fontSize={10.5} fill={AXIS_TEXT}>
          {formatValue(v)}
        </text>
      ))}
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={colour} />
        </marker>
      </defs>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Trend chart: every reading over time, drawn over the range bands.
// ---------------------------------------------------------------------------
export function TrendChart({
  marker,
  results,
  colour,
}: {
  marker: PassportMarker;
  results: PassportResult[];
  colour: string;
}) {
  const values = results.map((r) => Number(r.value));
  const [lo, hi] = extent(values, marker);
  const W = 340;
  const H = 210;
  const padL = 40;
  const padR = 18;
  const padT = 28;
  const padB = 44;
  const times = results.map((r) => Date.parse(r.taken_on));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const X = (i: number) =>
    results.length === 1 ? (padL + W - padR) / 2 : t1 === t0 ? padL + (i / (results.length - 1)) * (W - padL - padR) : padL + ((times[i] - t0) / (t1 - t0)) * (W - padL - padR);
  const Y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const bandRect = (a: number | null, b: number | null, fill: string, key: string) => {
    if (a == null && b == null) return null;
    const yTop = Y(b ?? hi);
    const yBottom = Y(a ?? lo);
    return <rect key={key} x={padL} y={yTop} width={W - padL - padR} height={Math.max(1, yBottom - yTop)} fill={fill} />;
  };
  const ticks = niceTicks(lo, hi, 4);
  const many = results.length > 8;
  const path = results.map((_, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)} ${Y(values[i]).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${marker.name} over time`}>
      {bandRect(marker.range_low, marker.range_high, RANGE_FILL, "range")}
      {bandRect(marker.optimal_low, marker.optimal_high, OPTIMAL_FILL, "optimal")}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={Y(t)} y2={Y(t)} stroke="#e2dacb" strokeWidth={0.75} />
          <text x={padL - 6} y={Y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={AXIS_TEXT}>
            {formatValue(t)}
          </text>
        </g>
      ))}
      {results.length > 1 && <path d={path} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
      {results.map((r, i) => {
        const last = i === results.length - 1;
        return (
          <g key={r.id}>
            <circle cx={X(i)} cy={Y(values[i])} r={last ? 6.5 : many ? 2.5 : 4.5} fill={last ? colour : "#fff"} stroke={colour} strokeWidth={2} />
            {!many && (
              <text x={X(i)} y={Y(values[i]) - 11} textAnchor="middle" fontSize={11.5} fontWeight={last ? 600 : 400} fill={INK}>
                {formatValue(values[i])}
              </text>
            )}
            {(!many || i === 0 || last) && (
              <>
                <text x={X(i)} y={H - padB + 18} textAnchor="middle" fontSize={10.5} fontWeight={last ? 600 : 400} fill={last ? INK : AXIS_TEXT}>
                  {timepointLabel(r.timepoint)}
                </text>
                <text x={X(i)} y={H - padB + 32} textAnchor="middle" fontSize={10} fill={AXIS_TEXT}>
                  {shortDate(r.taken_on)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sparkline: a tiny trend for list rows and domain cards.
// ---------------------------------------------------------------------------
export function Sparkline({ values, colour, width = 72, height = 26 }: { values: number[]; colour: string; width?: number; height?: number }) {
  if (values.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
        <circle cx={width / 2} cy={height / 2} r={3.5} fill={colour} />
      </svg>
    );
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const X = (i: number) => 4 + (i / (values.length - 1)) * (width - 8);
  const Y = (v: number) => 4 + (1 - (v - lo) / span) * (height - 8);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      <path d={d} fill="none" stroke={colour} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(values.length - 1)} cy={Y(values[values.length - 1])} r={3} fill={colour} />
    </svg>
  );
}

function niceTicks(lo: number, hi: number, count: number): number[] {
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${String(y).slice(2)}`;
}
