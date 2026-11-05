import GoalPathChart from "@/components/rowing/GoalPathChart";
import { formatMeasure } from "@/lib/rowing/goalPath";
import type { OnTarget, Strand, Tone } from "@/lib/rowing/onTarget";

// Never red: a strand that needs a look is a prompt for a conversation,
// not an alarm. Each tone carries a symbol and words, never colour alone.
const TONE: Record<Tone, { colour: string; mark: string }> = {
  good: { colour: "#008300", mark: "✓" },
  middle: { colour: "#c98500", mark: "~" },
  look: { colour: "#eb6834", mark: "!" },
  none: { colour: "#8a8a8a", mark: "·" },
};

function Mark({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        borderRadius: 9,
        background: TONE[tone].colour,
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {TONE[tone].mark}
    </span>
  );
}

function StrandRow({ s }: { s: Strand }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--cream)" }}>
      <Mark tone={s.tone} />
      <div>
        <div style={{ fontSize: 13.5 }}>
          <b>{s.label}:</b> {s.status}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>{s.detail}</div>
      </div>
    </div>
  );
}

export default function OnTargetCard({ data }: { data: OnTarget }) {
  const { path } = data;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Mark tone={data.overall.tone} />
        <span style={{ fontSize: 16, fontWeight: 600 }}>{data.overall.status}</span>
      </div>
      <GoalPathChart path={path} surface="var(--clinic-box, #fff)" />
      <details style={{ fontSize: 12.5, margin: "6px 0 8px" }}>
        <summary style={{ cursor: "pointer" }}>The numbers behind the chart</summary>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 4 }}>Date</th>
              <th style={{ textAlign: "left", padding: 4 }}>What</th>
              <th style={{ textAlign: "left", padding: 4 }}>Predicts</th>
            </tr>
          </thead>
          <tbody>
            {path.points.map((p, i) => (
              <tr key={i}>
                <td style={{ padding: 4 }}>{p.date}</td>
                <td style={{ padding: 4 }}>{p.label}</td>
                <td style={{ padding: 4 }}>{formatMeasure(path, p.value)}</td>
              </tr>
            ))}
            {path.goal && (
              <tr>
                <td style={{ padding: 4 }}>Event</td>
                <td style={{ padding: 4 }}>{path.goal.label}</td>
                <td style={{ padding: 4 }}>{formatMeasure(path, path.goal.value)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </details>
      <StrandRow s={data.fitness} />
      <StrandRow s={data.practice} />
      <StrandRow s={data.feel} />
    </div>
  );
}
