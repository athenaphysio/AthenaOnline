import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../ClinicBrandbar";
import clinicStyles from "../clinic.module.css";
import ProgressionEventRow from "./ProgressionEventRow";

type EventRow = {
  id: string;
  patient_id: string;
  kind: "ready_to_progress" | "progressed_automatic" | "dropped_back";
  status: "pending" | "approved" | "held";
  from_rung_number: number;
  to_rung_number: number;
  created_at: string;
  resolved_at: string | null;
};

type PatientRow = { id: string; first_name: string };

type FlareRow = {
  id: string;
  patient_id: string;
  pre_flare_rung_number: number;
  started_at: string;
  ends_at: string;
  status: "active" | "resolved";
};

function relativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

const KIND_LABEL: Record<EventRow["kind"], string> = {
  ready_to_progress: "Ready to move up",
  progressed_automatic: "Moved up automatically",
  dropped_back: "Dropped back",
};

// The clinician-facing half of Step 4 -- every "ready to move up" moment
// waiting on David's Approve/Hold, plus a recent-history feed of what's
// already been decided (automatically or by him). Reached from the clinic
// home page nav, same footing as Messages.
export default async function RunningProgressionPage() {
  const { data: events, error } = await supabaseAdmin
    .from("running_progression_events")
    .select("id, patient_id, kind, status, from_rung_number, to_rung_number, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<EventRow[]>();
  if (error) throw new Error(`Running progression query failed: ${error.message}`);

  const { data: flares, error: flaresError } = await supabaseAdmin
    .from("running_flare_events")
    .select("id, patient_id, pre_flare_rung_number, started_at, ends_at, status")
    .order("started_at", { ascending: false })
    .limit(20)
    .returns<FlareRow[]>();
  if (flaresError) throw new Error(`Flare events query failed: ${flaresError.message}`);

  const { data: deloadSettings } = await supabaseAdmin
    .from("running_deload_settings")
    .select("deload_workout_id")
    .eq("id", true)
    .maybeSingle<{ deload_workout_id: string }>();

  const patientIds = Array.from(new Set([...(events ?? []).map((e) => e.patient_id), ...(flares ?? []).map((f) => f.patient_id)]));
  const { data: patients } = patientIds.length
    ? await supabaseAdmin.from("patients").select("id, first_name").in("id", patientIds).returns<PatientRow[]>()
    : { data: [] as PatientRow[] };
  const nameById = new Map((patients ?? []).map((p) => [p.id, p.first_name]));

  const activeFlares = (flares ?? []).filter((f) => f.status === "active");
  const pastFlares = (flares ?? []).filter((f) => f.status !== "active").slice(0, 10);

  const pending = (events ?? []).filter((e) => e.status === "pending");
  const resolved = (events ?? []).filter((e) => e.status !== "pending").slice(0, 30);

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />
        <p className={clinicStyles.subheading} style={{ marginBottom: -4 }}>
          <Link href="/clinic" className={clinicStyles.canvasLink}>
            ← Patients
          </Link>
        </p>
        <h1 className={clinicStyles.heading}>Running progression</h1>
        <p className={clinicStyles.subheading}>Clients whose running is ready to step up, or who've had to ease back.</p>

        {activeFlares.length > 0 && (
          <div className={clinicStyles.warningCard}>
            <div className={clinicStyles.warningTitle}>
              Flare-up{activeFlares.length === 1 ? "" : "s"} right now ({activeFlares.length})
            </div>
            {activeFlares.map((f) => (
              <div key={f.id} className={clinicStyles.warningItem}>
                <Link href={`/clinic/patients/${f.patient_id}`} style={{ color: "inherit", fontWeight: 500 }}>
                  {nameById.get(f.patient_id) ?? "A client"}
                </Link>
                {" -- "}on the deload plan since {relativeTime(f.started_at)}, back on rung {Math.max(1, f.pre_flare_rung_number - 1)} on{" "}
                {new Date(f.ends_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.
              </div>
            ))}
          </div>
        )}

        {deloadSettings && (
          <p className={clinicStyles.subheading} style={{ marginTop: -6 }}>
            <Link href={`/clinic/workouts/${deloadSettings.deload_workout_id}`} className={clinicStyles.canvasLink}>
              Edit the deload template
            </Link>
          </p>
        )}

        {pastFlares.length > 0 && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>Past flare-ups</div>
            {pastFlares.map((f) => (
              <div key={f.id} style={{ padding: "10px 0", borderTop: "1px solid var(--cream)" }}>
                <Link href={`/clinic/patients/${f.patient_id}`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                  {nameById.get(f.patient_id) ?? "A client"}
                </Link>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                  Deload from {relativeTime(f.started_at)}, back on rung {Math.max(1, f.pre_flare_rung_number - 1)}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Waiting on you ({pending.length})</div>
          {pending.length === 0 && (
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
              Nothing waiting.
            </p>
          )}
          {pending.map((e) => (
            <ProgressionEventRow
              key={e.id}
              id={e.id}
              patientId={e.patient_id}
              patientName={nameById.get(e.patient_id) ?? "A client"}
              fromRung={e.from_rung_number}
              toRung={e.to_rung_number}
              createdRelative={relativeTime(e.created_at)}
            />
          ))}
        </div>

        <div className={clinicStyles.card}>
          <div className={clinicStyles.cardTitle}>Recent decisions</div>
          {resolved.length === 0 && (
            <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
              Nothing yet.
            </p>
          )}
          {resolved.map((e) => (
            <div key={e.id} style={{ padding: "10px 0", borderTop: "1px solid var(--cream)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <Link href={`/clinic/patients/${e.patient_id}`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                    {nameById.get(e.patient_id) ?? "A client"}
                  </Link>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                    {e.kind === "dropped_back"
                      ? `Rung ${e.from_rung_number} to rung ${e.to_rung_number}`
                      : e.status === "held"
                        ? `Held at rung ${e.from_rung_number} (would have moved to ${e.to_rung_number})`
                        : `Rung ${e.from_rung_number} to rung ${e.to_rung_number}`}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={clinicStyles.statusPill}>
                    {e.status === "held" ? "Held" : KIND_LABEL[e.kind]}
                  </span>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    {relativeTime(e.resolved_at ?? e.created_at)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
