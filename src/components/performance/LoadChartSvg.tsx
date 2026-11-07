import { ZONES, type WeekLoad } from "@/lib/performanceMetrics";

// Am I building safely? A bar per week of logged running km, with the safe
// range (85% to 110% of the planned km) shaded behind it. A bar above the
// range is amber, never red, and carries the words as well as the colour.

const BAR = "#2a78d6";
const ABOVE = "#c98500";
const RANGE = "#008300";
const W = 600;
const H = 220;
const PAD = { top: 16, right: 14, bottom: 36, left: 46 };

function short(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function LoadChartSvg({ weeks }: { weeks: WeekLoad[] }) {
  const peak = Math.max(5, ...weeks.map((w) => Math.max(w.loggedKm, (w.plannedKm ?? 0) * ZONES.weeklyHigh))) * 1.08;
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((st) => peak / st <= 4) ?? 100;
  const top = Math.ceil(peak / step) * step;
  const slot = (W - PAD.left - PAD.right) / Math.max(1, weeks.length);
  const barW = Math.min(34, slot * 0.6);
  const y = (km: number) => PAD.top + (1 - km / top) * (H - PAD.top - PAD.bottom);
  const yTicks: number[] = [];
  for (let v = 0; v <= top; v += step) yTicks.push(v);
  const labelEvery = weeks.length > 8 ? 2 : 1;

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weekly running kilometres against the planned range" style={{ display: "block", color: "inherit", fontFamily: "inherit" }}>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={13} fill="currentColor" fillOpacity={0.65}>
              {Math.round(v)}
            </text>
          </g>
        ))}
        <text x={PAD.left - 6} y={H - 4} textAnchor="end" fontSize={11.5} fill="currentColor" fillOpacity={0.55}>
          km
        </text>
        {weeks.map((w, i) => {
          const cx = PAD.left + slot * i + slot / 2;
          return (
            <g key={w.weekStart}>
              {w.plannedKm != null && w.plannedKm > 0 && (
                <rect
                  x={cx - slot / 2 + 2}
                  width={slot - 4}
                  y={y(w.plannedKm * ZONES.weeklyHigh)}
                  height={y(w.plannedKm * ZONES.weeklyLow) - y(w.plannedKm * ZONES.weeklyHigh)}
                  fill={RANGE}
                  fillOpacity={0.13}
                />
              )}
              <rect x={cx - barW / 2} width={barW} y={y(w.loggedKm)} height={Math.max(0, y(0) - y(w.loggedKm))} rx={3} fill={w.above ? ABOVE : BAR}>
                <title>{`Week of ${short(w.weekStart)}: ${w.loggedKm.toFixed(1)} km logged${w.plannedKm ? `, ${w.plannedKm.toFixed(1)} km planned` : ""}${w.above ? ", above the planned range" : ""}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={cx} y={H - PAD.bottom + 20} textAnchor="middle" fontSize={12.5} fill="currentColor" fillOpacity={0.65}>
                  {short(w.weekStart)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, marginTop: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, background: BAR, display: "inline-block", borderRadius: 2 }} />
          Running km logged
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 10, background: RANGE, opacity: 0.25, display: "inline-block" }} />
          Planned range
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, background: ABOVE, display: "inline-block", borderRadius: 2 }} />
          Above the range
        </span>
      </figcaption>
    </figure>
  );
}
