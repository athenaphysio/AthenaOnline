import { STATUS_STYLE, TREND_WORDS, formatValue, timepointLabel } from "@/lib/passport";
import { Sparkline } from "@/components/passport/PassportCharts";
import type { DomainSummary } from "@/lib/passportServer";
import styles from "../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

// Passport results for the areas a clinician may see, read only, each with
// its readings over time and a note on which are still drafts.
export default function DomainCards({ domains }: { domains: DomainSummary[] }) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {domains.map((d) => (
        <div key={d.key} className={styles.card} style={{ padding: 18, borderLeft: `4px solid ${d.colour}` }}>
          <h3 style={{ margin: "0 0 6px" }}>{d.name}</h3>
          {d.series.length === 0 && <p className={styles.muted} style={{ margin: 0, fontSize: 14 }}>No results yet.</p>}
          {d.series.map((s) => {
            const st = STATUS_STYLE[s.status];
            return (
              <div key={s.marker.marker_key} style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.marker.name}
                      {s.marker.panel && <span className={styles.muted} style={{ fontWeight: 400 }}>, {s.marker.panel}</span>}
                    </div>
                    <div className={styles.muted} style={{ fontSize: 12.5 }}>{TREND_WORDS[s.trend]}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Sparkline values={s.results.map((r) => Number(r.value))} colour={d.colour} />
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20, color: st.colour, background: st.soft }}>{st.label}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, marginTop: 6 }}>
                  {s.results.map((r) => (
                    <span key={r.id} style={{ fontVariantNumeric: "tabular-nums" }}>
                      <span className={styles.muted}>{timepointLabel(r.timepoint)}:</span> <strong>{formatValue(Number(r.value))}</strong> {s.marker.unit}
                      {r.status === "draft" && <span style={{ color: "var(--tone-warn)" }}> (draft, not yet shown to the client)</span>}
                    </span>
                  ))}
                </div>
                {s.latest.clinician_note && (
                  <div className={styles.muted} style={{ fontSize: 13, marginTop: 6 }}>
                    Note to client: {s.latest.clinician_note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
