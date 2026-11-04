import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRowingContext } from "@/lib/rowing/rowingServer";
import { concept2Configured } from "@/lib/rowing/concept2";
import { formatDuration, formatSplit } from "@/lib/rowing/zones";
import clinicStyles from "../../clinic.module.css";
import RowingActions, { type PendingSuggestion } from "./RowingActions";

const SOURCE_LABEL: Record<string, string> = {
  entry_test: "the entry 20 minute test",
  new_test: "a newer 20 minute test",
  paces_up: "an approved step up",
  paces_down: "an approved easing",
};

function shortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

// The rowing side of a client's record: where their paces come from, their
// Concept2 link, what their PM5 rows show against the plan, and any
// suggestion waiting for Dr David Silver PhD. Renders nothing for a
// programme that wasn't made by the Rowing Builder.
export default async function RowingPanel({ programmeId, firstName }: { programmeId: string; firstName: string }) {
  const ctx = await loadRowingContext(programmeId);
  if (!ctx) return null;

  const { data: conn } = await supabaseAdmin
    .from("concept2_connections")
    .select("connected_at, last_synced_at, last_error")
    .eq("patient_id", ctx.programme.patient_id)
    .maybeSingle<{ connected_at: string; last_synced_at: string | null; last_error: string | null }>();

  const { data: pending } = await supabaseAdmin
    .from("rowing_suggestions")
    .select("id, kind, reason, evidence, from_split_seconds, to_split_seconds, created_at")
    .eq("programme_id", programmeId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<PendingSuggestion[]>();

  const recent = ctx.rows.slice(0, 8);
  const configured = concept2Configured();

  return (
    <div className={clinicStyles.card}>
      <div className={clinicStyles.cardTitle}>Rowing</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
        Paces are set from <b>{formatSplit(ctx.plan.reference_split_seconds)} per 500m</b>, from {SOURCE_LABEL[ctx.plan.reference_source] ?? "the plan"}. Week{" "}
        {ctx.currentWeek} of {ctx.programme.block_length_weeks}, with {ctx.plan.slack_weeks} spare week{ctx.plan.slack_weeks === 1 ? "" : "s"} before the {ctx.plan.inputs.eventName}.
      </div>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
        {!configured
          ? "The Concept2 link is not switched on yet. Rows can still be added by hand below."
          : conn
            ? `Concept2 Logbook connected${conn.last_synced_at ? `, last checked ${shortDate(conn.last_synced_at)}` : ""}.${conn.last_error ? ` The last check said: ${conn.last_error}` : ""}`
            : `${firstName} hasn't connected Concept2 yet. They can do it from the Concept2 page in their app, at /session/concept2.`}
      </div>

      {recent.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {recent.map((r) => {
            let against = "";
            if (r.meta) {
              if (r.avgSplit < r.meta.fast) against = `quicker than the planned ${formatSplit(r.meta.fast)} to ${formatSplit(r.meta.slow)}`;
              else if (r.avgSplit > r.meta.slow) against = `slower than the planned ${formatSplit(r.meta.fast)} to ${formatSplit(r.meta.slow)}`;
              else against = "within the planned range";
            }
            return (
              <div key={r.id} style={{ fontSize: 12.5, padding: "6px 0", borderTop: "1px solid var(--cream)" }}>
                <b>{shortDate(r.rowedOn)}</b> {Math.round(r.distanceM).toLocaleString("en-GB")}m in {formatDuration(r.timeSeconds)}, {formatSplit(r.avgSplit)} /500m
                {r.strokeRate ? `, rate ${r.strokeRate}` : ""}
                {r.avgHr ? `, HR ${r.avgHr}` : ""}
                {against && <span style={{ color: "var(--muted)" }}>; {against}</span>}
              </div>
            );
          })}
        </div>
      )}

      <RowingActions programmeId={programmeId} pending={pending ?? []} />
    </div>
  );
}
