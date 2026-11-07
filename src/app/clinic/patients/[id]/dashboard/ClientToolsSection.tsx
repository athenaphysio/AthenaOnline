import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPatientMembership } from "@/lib/membership";
import { getMembershipTier } from "@/lib/membershipTiers";
import { formatPriceGBP } from "@/lib/currency";
import { elapsedWeeks } from "@/lib/programmeWeek";
import { getGoalImageSignedUrl } from "@/lib/programmeGoalImage";
import { getClinicSettings } from "@/lib/clinicSettings";
import { programmeHasWeekSessions } from "@/lib/programmeCards";
import styles from "./ClientDashboard.module.css";
import VoiceNotesPanel from "../VoiceNotesPanel";
import UploadedWorkoutsPanel from "../UploadedWorkoutsPanel";
import TrainingDataPanel from "../TrainingDataPanel";
import RowingPanel from "../RowingPanel";
import WearableToggle from "../WearableToggle";
import AutoStrengthToggle from "../AutoStrengthToggle";
import IntakeFormToggle from "../IntakeFormToggle";
import IntakeUploader from "../IntakeUploader";
import GoalImageUploader from "../GoalImageUploader";
import CompletionAudioRecorder from "../CompletionAudioRecorder";
import ProgrammeAccessToggle from "../ProgrammeAccessToggle";
import MembershipPauseToggle from "../MembershipPauseToggle";
import CopyLogButton from "../CopyLogButton";

type ProgrammeSource = "subscription_gated" | "owned" | "clinician_assigned";

type ProgrammeRow = {
  id: string;
  title: string;
  delivery_mode: "scheduled" | "open";
  block_length_weeks: number;
  start_date: string;
  created_at: string;
  access_paused_at: string | null;
  source: ProgrammeSource;
  completion_audio_url: string | null;
  goal_image_path: string | null;
};

type EventRow = { kind: string; week_number: number; created_at: string };

type PurchaseRow = {
  id: string;
  programme_title: string;
  amount_gbp: number;
  status: "paid" | "refunded";
  created_at: string;
};

type CommunicationRow = {
  id: string;
  channel: "email" | "in_app";
  title: string;
  body: string | null;
  sent_at: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return formatDate(iso);
}

const ROW: React.CSSProperties = { padding: "10px 0", borderTop: "1px solid var(--border)", fontSize: 13.5 };

// Everything that used to live only on the older client page, brought onto
// the Overview so there is one client page. The panels below were built for
// the light clinic cards; .toolsScope (ClientDashboard.module.css) re-points
// their colours at this page's own palette so they sit in naturally.
export default async function ClientToolsSection({ patientId, firstName }: { patientId: string; firstName: string }) {
  const [{ data: patient }, { data: programmes }, { data: completions }, membership, { data: purchases }, { data: communications }, settings] =
    await Promise.all([
      supabaseAdmin
        .from("patients")
        .select("wearable_tracking_enabled, auto_strength, intake_form_enabled")
        .eq("id", patientId)
        .maybeSingle<{ wearable_tracking_enabled: boolean; auto_strength: boolean | null; intake_form_enabled: boolean }>(),
      supabaseAdmin
        .from("programmes")
        .select("id, title, delivery_mode, block_length_weeks, start_date, created_at, access_paused_at, source, completion_audio_url, goal_image_path")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .returns<ProgrammeRow[]>(),
      supabaseAdmin
        .from("session_completions")
        .select("programme_id, occurred_at")
        .eq("patient_id", patientId)
        .eq("status", "completed")
        .order("occurred_at", { ascending: false })
        .returns<{ programme_id: string; occurred_at: string }[]>(),
      getPatientMembership(patientId),
      supabaseAdmin
        .from("purchases")
        .select("id, programme_title, amount_gbp, status, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .returns<PurchaseRow[]>(),
      supabaseAdmin
        .from("communications")
        .select("id, channel, title, body, sent_at")
        .eq("patient_id", patientId)
        .order("sent_at", { ascending: false })
        .limit(20)
        .returns<CommunicationRow[]>(),
      getClinicSettings(),
    ]);

  const allProgrammes = programmes ?? [];
  const allCompletions = completions ?? [];
  const scheduled = allProgrammes.find((p) => p.delivery_mode === "scheduled") ?? null;
  const goalImageUrl = scheduled?.goal_image_path ? await getGoalImageSignedUrl(scheduled.goal_image_path) : null;
  const scheduledHasWeeks = scheduled ? await programmeHasWeekSessions(scheduled.id) : false;

  let programmeEvents: EventRow[] = [];
  if (scheduled && scheduledHasWeeks) {
    const { data } = await supabaseAdmin
      .from("programme_events")
      .select("kind, week_number, created_at")
      .eq("programme_id", scheduled.id)
      .order("created_at", { ascending: false })
      .returns<EventRow[]>();
    programmeEvents = data ?? [];
  }

  // The older imported plan calendar, only while that feature is switched on.
  let assignedPlan: { id: string; block_title: string } | null = null;
  let planEvents: EventRow[] = [];
  if (settings.legacyPlanCalendarEnabled) {
    const { data } = await supabaseAdmin
      .from("imported_plans")
      .select("id, block_title")
      .eq("patient_id", patientId)
      .eq("status", "assigned")
      .maybeSingle<{ id: string; block_title: string }>();
    assignedPlan = data ?? null;
    if (assignedPlan) {
      const { data: ev } = await supabaseAdmin
        .from("plan_events")
        .select("kind, week_number, created_at")
        .eq("imported_plan_id", assignedPlan.id)
        .order("created_at", { ascending: false })
        .returns<EventRow[]>();
      planEvents = ev ?? [];
    }
  }

  function completionsFor(programmeId: string) {
    const rows = allCompletions.filter((c) => c.programme_id === programmeId);
    return { count: rows.length, lastAt: rows[0]?.occurred_at ?? null };
  }

  const tier = membership.tier !== "none" ? getMembershipTier(membership.tier) : null;
  const linkBtn = `${styles.btn} ${styles.btnGhost}`;

  return (
    <div className={styles.toolsScope}>
      <div className={styles.sectionTitle}>
        <h2>Programme tools</h2>
      </div>
      <div className={styles.toolsGrid}>
        <div className={styles.toolsColumn}>
          <IntakeFormToggle patientId={patientId} firstName={firstName} initialEnabled={patient?.intake_form_enabled === true} />
          <AutoStrengthToggle patientId={patientId} firstName={firstName} initialEnabled={patient?.auto_strength !== false} />

          <VoiceNotesPanel patientId={patientId} firstName={firstName} />
          <UploadedWorkoutsPanel patientId={patientId} firstName={firstName} />
          <TrainingDataPanel patientId={patientId} firstName={firstName} />

          {scheduled && scheduledHasWeeks && (
            <div className={styles.card}>
              <span className={styles.label}>Programme log</span>
              <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13.5 }}>
                Cardio and strength together, as {firstName} has logged them.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <CopyLogButton url={`/api/clinic/programmes/${scheduled.id}/log`} className={linkBtn} />
                <a href={`/api/clinic/programmes/${scheduled.id}/plan-pdf`} className={linkBtn}>
                  Download plan (PDF)
                </a>
              </div>
              {programmeEvents.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  {programmeEvents.map((e, i) => (
                    <div key={i} className={styles.muted} style={ROW}>
                      {e.kind === "flare_up" ? "Flare-up" : "Repeated"} in week {e.week_number}, {relativeTime(e.created_at)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {assignedPlan && (
            <div className={styles.card}>
              <span className={styles.label}>Imported plan, currently assigned</span>
              <h3 style={{ marginBottom: 14 }}>{assignedPlan.block_title}</h3>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <CopyLogButton planId={assignedPlan.id} className={linkBtn} />
                <a href={`/api/clinic/imported-plans/${assignedPlan.id}/pdf`} className={linkBtn}>
                  Download plan (PDF)
                </a>
              </div>
              {planEvents.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  {planEvents.map((e, i) => (
                    <div key={i} className={styles.muted} style={ROW}>
                      {e.kind === "flare_up" ? "Flare-up" : "Repeated"} in week {e.week_number}, {relativeTime(e.created_at)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.card}>
            <span className={styles.label}>Every programme built for {firstName}</span>
            {allProgrammes.length === 0 ? (
              <p className={styles.muted} style={{ margin: 0, fontSize: 13.5 }}>
                Nothing yet.
              </p>
            ) : (
              allProgrammes.map((p) => {
                const stats = completionsFor(p.id);
                return (
                  <div key={p.id} style={{ ...ROW, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <a href={`/clinic/programmes/${p.id}`} style={{ color: "inherit", fontWeight: 600 }}>
                        {p.title}
                      </a>
                      <div className={styles.muted} style={{ fontSize: 12.5, marginTop: 2 }}>
                        {p.delivery_mode === "open" ? "Open routine" : `Scheduled, ${p.block_length_weeks} weeks`}, given {formatDate(p.created_at)}
                        {p.delivery_mode === "scheduled" &&
                          `, ${stats.count} session${stats.count === 1 ? "" : "s"} completed${stats.lastAt ? `, last ${relativeTime(stats.lastAt)}` : ""}`}
                      </div>
                    </div>
                    <ProgrammeAccessToggle programmeId={p.id} initialPaused={p.access_paused_at != null} initialSource={p.source} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={styles.toolsColumn}>
          {scheduled && elapsedWeeks(scheduled.start_date) >= scheduled.block_length_weeks && (
            <CompletionAudioRecorder programmeId={scheduled.id} programmeTitle={scheduled.title} existingUrl={scheduled.completion_audio_url} />
          )}

          {scheduled && <GoalImageUploader patientId={patientId} programmeId={scheduled.id} existingUrl={goalImageUrl} />}

          {scheduled && <RowingPanel programmeId={scheduled.id} firstName={firstName} />}

          <WearableToggle patientId={patientId} initialEnabled={Boolean(patient?.wearable_tracking_enabled)} />

          <div className={styles.card}>
            <span className={styles.label}>Intake form</span>
            <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13.5 }}>
              Drag in an intake form exported from Cliniko or Setmore to fill in the referral details above.
            </p>
            <IntakeUploader patientId={patientId} />
          </div>
        </div>
      </div>

      <div className={styles.sectionTitle}>
        <h2>Account</h2>
      </div>
      <div className={styles.toolsGrid}>
        <div className={styles.toolsColumn}>
          <div className={styles.card}>
            <span className={styles.label}>Membership</span>
            {!tier ? (
              <p className={styles.muted} style={{ margin: 0, fontSize: 13.5 }}>
                No membership yet.
              </p>
            ) : (
              <>
                <h3>{tier.name}</h3>
                <div className={styles.muted} style={{ fontSize: 13, marginTop: 4 }}>
                  {membership.status === "active"
                    ? "Active"
                    : membership.status === "paused"
                      ? "Paused"
                      : membership.status === "cancelled"
                        ? "Cancelled"
                        : "Lapsed"}
                  , {membership.billingType === "recurring" ? "monthly and recurring" : "paid upfront"}
                  {membership.billingType === "prepay" && membership.expiresAt ? `, runs until ${formatDate(membership.expiresAt)}` : ""}
                  {membership.pausedAt ? `, paused ${relativeTime(membership.pausedAt)}` : ""}
                </div>
                {membership.status !== "lapsed" && membership.status !== "cancelled" && (
                  <div style={{ marginTop: 14 }}>
                    <MembershipPauseToggle patientId={patientId} initialPaused={membership.status === "paused"} />
                  </div>
                )}
              </>
            )}
          </div>

          <div className={styles.card}>
            <span className={styles.label}>Bought by {firstName}</span>
            {(purchases ?? []).length === 0 ? (
              <p className={styles.muted} style={{ margin: 0, fontSize: 13.5 }}>
                Nothing bought yet.
              </p>
            ) : (
              (purchases ?? []).map((p) => (
                <div key={p.id} style={{ ...ROW, display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.programme_title}</div>
                    <div className={styles.muted} style={{ fontSize: 12.5 }}>
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600 }}>{formatPriceGBP(p.amount_gbp)}</div>
                    <div className={styles.muted} style={{ fontSize: 12.5 }}>
                      {p.status === "paid" ? "Paid" : "Refunded"}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.toolsColumn}>
          <div className={styles.card}>
            <span className={styles.label}>Emails and notifications sent to {firstName}</span>
            {(communications ?? []).length === 0 ? (
              <p className={styles.muted} style={{ margin: 0, fontSize: 13.5 }}>
                Nothing sent yet.
              </p>
            ) : (
              (communications ?? []).map((c) => (
                <div key={c.id} style={ROW}>
                  <div style={{ fontWeight: 600 }}>{c.title}</div>
                  {c.body && (
                    <div className={styles.muted} style={{ fontSize: 13, marginTop: 2 }}>
                      {c.body}
                    </div>
                  )}
                  <div className={styles.muted} style={{ fontSize: 12, marginTop: 4 }}>
                    {c.channel === "email" ? "Email" : "In-app notification"}, {formatDate(c.sent_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
