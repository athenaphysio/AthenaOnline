import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClinicBrandbar from "../../../ClinicBrandbar";
import MessageThreadPanel from "./MessageThreadPanel";
import EditDetailsButton from "./EditDetailsButton";
import styles from "./ClientDashboard.module.css";
import { computePatientStanding, type PatientStatus } from "@/lib/patientStatus";
import { currentWeekNumber, elapsedWeeks, todayIsoWeekday } from "@/lib/programmeWeek";
import { resolveWorkoutItems } from "@/lib/workoutResolution";
import { prescriptionSummary } from "@/lib/prescription";
import { cardioModalityLabel, cardioPlainSummary } from "@/lib/cardioBlock";
import { getPatientMembership } from "@/lib/membership";
import { getMembershipTier } from "@/lib/membershipTiers";
import TierBadgeIcon from "@/components/TierBadgeIcon";
import {
  computeAdherence,
  computeCurrentStreak,
  computeLongestStreak,
  distinctCompletionDates,
  daysAgo,
  mostRecentMonday,
  relativeDayLabel,
} from "@/lib/patientEngagement";

// Phase 2 of the individual client dashboard (see athena_client_dashboard_v1.html
// and the Phase 2 build brief) -- every section below is wired to real data
// where real data exists, checked against the actual schema first rather than
// guessed at. Anything the schema genuinely has no field for renders an honest
// "Not tracked yet" / "Not yet available" instead of fabricated content -- see
// the per-section comments for exactly what's real vs not, and the summary at
// the bottom of this file for the full Phase 3 list.

type PatientRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  presenting_complaint: string | null;
  date_of_onset: string | null;
  mechanism_of_injury: string | null;
  referred_via: string | null;
  referral_goals_history: string | null;
  occupation: string | null;
  sport: string | null;
  date_of_birth: string | null;
  assigned_clinician: string | null;
  clinic_location: string | null;
};

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
};

type ProgrammeWorkoutRow = { workout_id: string; day_of_week: number | null; workouts: { name: string } };

type CompletionRow = { exercise_id: string | null; cardio_block_id: string | null; occurred_at: string };
type PhaseRow = { name: string; start_week: number; end_week: number; sort_order: number };

type FormSendRow = { id: string; sent_at: string; forms: { title: string } | null };
type FormResponseRow = { form_send_id: string; submitted_at: string };

const STATUS_LABEL: Record<PatientStatus, string> = {
  brand_new: "Brand new",
  no_programme: "No programme",
  active: "Active",
  ending_soon: "Ending soon",
  lapsed: "Lapsed",
  block_ended: "Block ended",
};

const STATUS_BADGE_CLASS: Record<PatientStatus, string> = {
  brand_new: "badgeNeutral",
  no_programme: "badgeNeutral",
  active: "badgeActive",
  ending_soon: "badgeActive",
  lapsed: "badgeWarn",
  block_ended: "badgeWarn",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDobWithAge(dob: string): string {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return `${formatDate(dob)} (age ${age})`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ClientDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select(
      "id, first_name, last_name, email, created_at, last_seen_at, presenting_complaint, date_of_onset, mechanism_of_injury, referred_via, referral_goals_history, occupation, sport, date_of_birth, assigned_clinician, clinic_location"
    )
    .eq("id", id)
    .maybeSingle<PatientRow>();

  if (!patient) {
    notFound();
  }

  const [{ data: programmes }, { data: formSends }, membership] = await Promise.all([
    supabaseAdmin
      .from("programmes")
      .select("id, title, delivery_mode, block_length_weeks, start_date, created_at, access_paused_at, source")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<ProgrammeRow[]>(),
    supabaseAdmin
      .from("form_sends")
      .select("id, sent_at, forms(title)")
      .eq("patient_id", id)
      .order("sent_at", { ascending: false })
      .limit(3)
      .returns<FormSendRow[]>(),
    getPatientMembership(id),
  ]);

  const allProgrammes = programmes ?? [];
  const scheduled = allProgrammes.find((p) => p.delivery_mode === "scheduled" && !p.access_paused_at) ?? null;
  const open = allProgrammes.find((p) => p.delivery_mode === "open" && !p.access_paused_at) ?? null;

  // Forms & submissions -- real (form_sends/form_responses/forms), same
  // shape as the existing Submissions tab on /clinic/patients/[id].
  const sends = formSends ?? [];
  let responseBySend = new Map<string, FormResponseRow>();
  if (sends.length > 0) {
    const { data: responses } = await supabaseAdmin
      .from("form_responses")
      .select("form_send_id, submitted_at")
      .in(
        "form_send_id",
        sends.map((s) => s.id)
      )
      .returns<FormResponseRow[]>();
    responseBySend = new Map((responses ?? []).map((r) => [r.form_send_id, r]));
  }

  // Current programme's own schedule + completions -- everything below is
  // scoped to this one programme, not blended across past ones.
  let programmeWorkouts: ProgrammeWorkoutRow[] = [];
  let completions: CompletionRow[] = [];
  let phases: PhaseRow[] = [];
  if (scheduled) {
    const [{ data: pw }, { data: comp }, { data: ph }] = await Promise.all([
      supabaseAdmin
        .from("programme_workouts")
        .select("workout_id, day_of_week, workouts(name)")
        .eq("programme_id", scheduled.id)
        .returns<ProgrammeWorkoutRow[]>(),
      supabaseAdmin
        .from("session_completions")
        .select("exercise_id, cardio_block_id, occurred_at")
        .eq("programme_id", scheduled.id)
        .eq("status", "completed")
        .returns<CompletionRow[]>(),
      supabaseAdmin
        .from("programme_phases")
        .select("name, start_week, end_week, sort_order")
        .eq("programme_id", scheduled.id)
        .order("sort_order")
        .returns<PhaseRow[]>(),
    ]);
    programmeWorkouts = pw ?? [];
    completions = comp ?? [];
    phases = ph ?? [];
  }

  const completionDates = distinctCompletionDates(completions);
  const lastCompletionAt = completions.reduce<string | null>(
    (max, c) => (!max || c.occurred_at > max ? c.occurred_at : max),
    null
  );
  const lastActivityAt =
    patient.last_seen_at && lastCompletionAt
      ? patient.last_seen_at > lastCompletionAt
        ? patient.last_seen_at
        : lastCompletionAt
      : (patient.last_seen_at ?? lastCompletionAt ?? null);

  const standing = computePatientStanding({
    patientCreatedAt: patient.created_at,
    lastActivityAt,
    scheduled: scheduled
      ? { title: scheduled.title, blockLengthWeeks: scheduled.block_length_weeks, startDate: scheduled.start_date }
      : null,
    open: open ? { title: open.title, createdAt: open.created_at } : null,
  });

  const membershipTier = membership.tier !== "none" ? getMembershipTier(membership.tier) : null;

  // This week's exercises: today's scheduled workout if there is one,
  // otherwise the nearest day this week that has one (preferring the most
  // recently passed day, since that's what's actually relevant right now).
  const scheduledDaysOfWeek = Array.from(new Set(programmeWorkouts.map((w) => w.day_of_week).filter((d): d is number => d != null))).sort(
    (a, b) => a - b
  );
  let currentWeekWorkout: ProgrammeWorkoutRow | null = null;
  if (scheduled && programmeWorkouts.length > 0) {
    const today = todayIsoWeekday();
    currentWeekWorkout = programmeWorkouts.find((w) => w.day_of_week === today) ?? null;
    if (!currentWeekWorkout) {
      const pastDays = scheduledDaysOfWeek.filter((d) => d < today);
      const nearestDay = pastDays.length > 0 ? Math.max(...pastDays) : Math.min(...scheduledDaysOfWeek);
      currentWeekWorkout = programmeWorkouts.find((w) => w.day_of_week === nearestDay) ?? null;
    }
  }

  const week = scheduled ? currentWeekNumber(scheduled.start_date, scheduled.block_length_weeks) : 1;
  const resolvedItems = currentWeekWorkout ? await resolveWorkoutItems(currentWeekWorkout.workout_id, week) : [];

  function lastPerformed(itemId: string): string | null {
    const matches = completions.filter((c) => c.exercise_id === itemId || c.cardio_block_id === itemId);
    return matches.reduce<string | null>((max, c) => (!max || c.occurred_at > max ? c.occurred_at : max), null);
  }

  // Adherence / streak -- real, computed from session_completions against
  // the programme's own day-of-week schedule. null (from computeAdherence)
  // means there's genuinely nothing to measure (e.g. an Open routine has no
  // fixed schedule to be adherent to).
  const adherence7d = scheduled
    ? computeAdherence({
        scheduledDaysOfWeek,
        completionDates,
        programmeStartDate: scheduled.start_date,
        rangeStart: daysAgo(6),
      })
    : null;
  const adherence30d = scheduled
    ? computeAdherence({
        scheduledDaysOfWeek,
        completionDates,
        programmeStartDate: scheduled.start_date,
        rangeStart: daysAgo(29),
      })
    : null;
  const adherenceThisWeek = scheduled
    ? computeAdherence({
        scheduledDaysOfWeek,
        completionDates,
        programmeStartDate: scheduled.start_date,
        rangeStart: mostRecentMonday(),
      })
    : null;
  const currentStreak = computeCurrentStreak(completionDates);
  const longestStreak = computeLongestStreak(completionDates);

  // Next scheduled day still to come this week, for the "next session due"
  // line -- real, derived from the same day-of-week schedule.
  const today = todayIsoWeekday();
  const nextScheduledDay = scheduledDaysOfWeek.find((d) => d > today) ?? scheduledDaysOfWeek.find((d) => d <= today);
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const nextSessionLabel = nextScheduledDay
    ? nextScheduledDay === today
      ? "due today"
      : `next on ${DAY_NAMES[nextScheduledDay - 1]}`
    : null;

  const hasReferralData = Boolean(
    patient.presenting_complaint || patient.date_of_onset || patient.mechanism_of_injury || patient.referred_via || patient.referral_goals_history
  );

  const initials =
    (patient.first_name.trim().charAt(0) + (patient.last_name?.trim().charAt(0) ?? "")).toUpperCase() || "?";

  const membershipRenewalLabel =
    membership.tier === "none"
      ? null
      : membership.billingType === "prepay" && membership.expiresAt
        ? `Renews ${formatDate(membership.expiresAt)}`
        : membership.billingType === "recurring"
          ? "Recurring, managed via Stripe"
          : null;

  // Phase 4 -- every "adjust/view/swap" action below opens the one real
  // programme-editing surface that exists (/clinic/programmes/[id], the
  // same ProgrammeBuilder used everywhere else in the clinic app). There's
  // no separate read-only "full view", no dedicated "swap just one
  // exercise" flow, and no distinct "phases" view -- ProgrammeBuilder
  // already shows every week of the block and lets a workout's exercises
  // be edited/swapped from there, so pointing all of these at it is
  // honest, not a shortcut standing in for something that doesn't exist.
  // Disabled (not linked anywhere) when there's no current programme at
  // all, rather than linking to a broken/empty path.
  const currentProgrammeId = scheduled?.id ?? open?.id ?? null;

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <ClinicBrandbar />

        {/* HEADER -- name/email real (patients); first + last name and
            avatar initials both real now (patients.last_name); status real
            (patientStatus.ts); membership tier and renewal real
            (patient_memberships), moved up here next to the tier badge
            rather than sitting as its own row further down; tag badges
            (injury/sport/goal tags) have no backing field anywhere --
            omitted, Phase 3. */}
        <div className={styles.topbar}>
          <div className={styles.nameBlock}>
            <div className={styles.avatar}>{initials}</div>
            <div>
              <h1>
                {patient.first_name}
                {patient.last_name ? ` ${patient.last_name}` : ""}
              </h1>
              <div className={styles.muted} style={{ fontSize: 13, marginTop: 4 }}>
                {patient.email}
              </div>
              <div className={styles.nameSub} style={{ marginTop: 8 }}>
                <span className={`${styles.badge} ${styles[STATUS_BADGE_CLASS[standing.status]]}`}>
                  ● {STATUS_LABEL[standing.status]}
                </span>
                {membershipTier ? (
                  <span className={`${styles.badge} ${styles.badgeTier}`}>
                    <TierBadgeIcon size={14} />
                    {membershipTier.name}
                  </span>
                ) : (
                  <span className={`${styles.badge} ${styles.badgeNeutral}`}>No membership</span>
                )}
                {membershipRenewalLabel && (
                  <span className={styles.muted} style={{ fontSize: 12.5 }}>
                    {membershipRenewalLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={styles.rowActions}>
            <a href="#messages" className={`${styles.btn} ${styles.btnGhost}`}>
              Message
            </a>
            <EditDetailsButton
              patientId={patient.id}
              initial={{
                first_name: patient.first_name,
                last_name: patient.last_name,
                email: patient.email,
                date_of_birth: patient.date_of_birth,
                occupation: patient.occupation,
                sport: patient.sport,
                assigned_clinician: patient.assigned_clinician,
                clinic_location: patient.clinic_location,
              }}
            />
            {currentProgrammeId ? (
              <a href={`/clinic/programmes/${currentProgrammeId}`} className={`${styles.btn} ${styles.btnPrimary}`}>
                Adjust program
              </a>
            ) : (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} disabled title="Nothing assigned yet">
                Adjust program
              </button>
            )}
          </div>
        </div>

        {/* DETAILS STRIP -- patient since, occupation/sport, DOB, location
            and clinician are all real now (patients table, Phase 3
            columns), editable via "Edit details" above. Only next session
            still has no backing field wired in yet. Membership renewal and
            contact (email) moved up into the header, next to the name and
            the tier badge, rather than living here. */}
        <div className={styles.detailsStrip}>
          <div className={styles.detailItem}>
            <span className={styles.label}>Age / DOB</span>
            <span className={styles.val}>{patient.date_of_birth ? formatDobWithAge(patient.date_of_birth) : "Not recorded"}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Occupation</span>
            <span className={styles.val}>{patient.occupation || "Not recorded"}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Sport</span>
            <span className={styles.val}>{patient.sport || "Not recorded"}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Location</span>
            <span className={styles.val}>{patient.clinic_location || "Not recorded"}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Clinician</span>
            <span className={styles.val}>{patient.assigned_clinician || "Not recorded"}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Patient since</span>
            <span className={styles.val}>{formatDate(patient.created_at)}</span>
          </div>
          <div className={styles.detailItem}>
            <span className={styles.label}>Next session</span>
            <span className={styles.val}>Not tracked yet</span>
          </div>
        </div>

        {/* REFERRAL / PRESENTING COMPLAINT -- presenting complaint, onset,
            mechanism, referred via, and goals/history are all real
            (patients, wired in Phase 1's intake import). Irritability, red
            flags, and baseline outcome scores (NPRS/LEFS) have no backing
            field anywhere -- Phase 3. */}
        <div className={`${styles.card} ${styles.referralCard}`}>
          {hasReferralData ? (
            <>
              <div className={styles.referralTop}>
                <div>
                  <span className={styles.label}>Reason for referral</span>
                  <h3>{patient.presenting_complaint || "Not recorded"}</h3>
                </div>
                <a
                  href={`/clinic/patients/${id}`}
                  className={`${styles.btn} ${styles.btnGhost}`}
                  style={{ whiteSpace: "nowrap" }}
                >
                  View full intake ↗
                </a>
              </div>
              <div className={styles.referralGrid}>
                <div>
                  <span className={styles.label}>Onset</span>
                  <div className={styles.val}>{patient.date_of_onset || "Not recorded"}</div>
                </div>
                <div>
                  <span className={styles.label}>Mechanism</span>
                  <div className={styles.val}>{patient.mechanism_of_injury || "Not recorded"}</div>
                </div>
                <div>
                  <span className={styles.label}>Referred via</span>
                  <div className={styles.val}>{patient.referred_via || "Not recorded"}</div>
                </div>
                <div>
                  <span className={styles.label}>Irritability</span>
                  <div className={styles.val}>Not tracked yet</div>
                </div>
                <div>
                  <span className={styles.label}>Red flags</span>
                  <div className={styles.val}>Not tracked yet</div>
                </div>
                <div>
                  <span className={styles.label}>Goal / history</span>
                  <div className={styles.val}>{patient.referral_goals_history || "Not recorded"}</div>
                </div>
                <div>
                  <span className={styles.label}>Baseline pain (NPRS)</span>
                  <div className={styles.val}>Not tracked yet</div>
                </div>
                <div>
                  <span className={styles.label}>Baseline LEFS</span>
                  <div className={styles.val}>Not tracked yet</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <span className={styles.label}>Reason for referral</span>
              <p className={styles.muted} style={{ marginTop: 10 }}>
                No referral details on file yet.{" "}
                <a href={`/clinic/patients/${id}`} style={{ color: "#e8a5a5" }}>
                  Drag in an intake form to fill this in ↗
                </a>
              </p>
            </>
          )}
        </div>

        {/* CURRENT PROGRAM -- title/week/dates/progress all real
            (programmes, programme_workouts, session_completions). Phases
            are real now too (programme_phases, copied from the template at
            assignment time) -- shown only when the template this patient
            was assigned actually defined some; the honest "none defined"
            note stays for anything built before phases existed. The
            week-by-week strip itself is real regardless.
            Adherence/streak/this-week are all real, computed. Pain-today
            and LEFS are not tracked. The exercise table's Trend column
            (progressing/steady/pain-flagged) has no backing signal at all,
            no per-completion pain/quality field exists, shown as "Not
            tracked yet" rather than invented. */}
        <div className={styles.sectionTitle}>
          <h2>Current program</h2>
          <div className={styles.rowActions}>
            {currentProgrammeId ? (
              <>
                <a href={`/clinic/programmes/${currentProgrammeId}`} className={`${styles.btn} ${styles.btnGhost}`}>
                  Swap exercise
                </a>
                <a href={`/clinic/programmes/${currentProgrammeId}`} className={`${styles.btn} ${styles.btnGhost}`}>
                  View full program ↗
                </a>
              </>
            ) : (
              <>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled title="Nothing assigned yet">
                  Swap exercise
                </button>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} disabled title="Nothing assigned yet">
                  View full program ↗
                </button>
              </>
            )}
            <a href={`/clinic/programmes/new?patient=${id}`} className={`${styles.btn} ${styles.btnPrimary}`}>
              Assign new program
            </a>
          </div>
        </div>

        {scheduled ? (
          <div className={`${styles.card} ${styles.programCard}`}>
            <div className={styles.programTop}>
              <div>
                <h3>{scheduled.title}</h3>
                <div className={`${styles.muted} ${styles.programMeta}`}>
                  Week {Math.min(week, scheduled.block_length_weeks)} of {scheduled.block_length_weeks} · started{" "}
                  {formatDate(scheduled.start_date)}
                  {nextSessionLabel ? ` · next session ${nextSessionLabel}` : ""}
                </div>
              </div>
              <a href={`/clinic/programmes/${scheduled.id}`} className={`${styles.btn} ${styles.btnGhost}`}>
                Adjust this program
              </a>
            </div>
            <div className={styles.progressTrack}>
              <div
                className={styles.progressFill}
                style={{ width: `${Math.min(100, Math.round((week / scheduled.block_length_weeks) * 100))}%` }}
              />
            </div>

            <div className={styles.phaseStrip}>
              {phases.length > 0 ? (
                <div className={styles.weekRow} style={{ marginBottom: 12 }}>
                  {phases.map((p) => {
                    const isCurrent = week >= p.start_week && week <= p.end_week;
                    const isDone = week > p.end_week;
                    return (
                      <div
                        key={p.name}
                        className={`${styles.weekChip} ${isDone ? styles.weekChipDone : isCurrent ? styles.weekChipCurrent : ""}`}
                        style={{ flex: 1, width: "auto", padding: "6px 10px" }}
                        title={`Weeks ${p.start_week}-${p.end_week}`}
                      >
                        {p.name}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.muted} style={{ fontSize: 12, marginBottom: 10 }}>
                  No phases defined for this programme yet; add them from its template in the Vault.
                </p>
              )}
              <div className={styles.weekRow}>
                {Array.from({ length: scheduled.block_length_weeks }, (_, i) => i + 1).map((w) => (
                  <div
                    key={w}
                    className={`${styles.weekChip} ${
                      w < week ? styles.weekChipDone : w === week ? styles.weekChipCurrent : ""
                    }`}
                  >
                    W{w}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metric}>
                <span className={styles.label}>Adherence (7d)</span>
                <div className={styles.num}>{adherence7d ? `${adherence7d.percent}%` : "Not tracked yet"}</div>
                {adherence7d && adherence30d && (
                  <span className={styles.trendFlat}>
                    {adherence7d.percent >= adherence30d.percent ? "↑" : "↓"} vs {adherence30d.percent}% at 30d
                  </span>
                )}
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>Current streak</span>
                <div className={styles.num}>
                  {currentStreak} day{currentStreak === 1 ? "" : "s"}
                </div>
                <span className={styles.trendFlat}>
                  {longestStreak > 0 && currentStreak === longestStreak ? "Personal best" : `Best: ${longestStreak} days`}
                </span>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>This week</span>
                <div className={styles.num}>
                  {adherenceThisWeek ? `${adherenceThisWeek.completed} / ${adherenceThisWeek.prescribed}` : "N/A"}
                </div>
                <span className={styles.trendFlat}>sessions completed</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>Pain today (NPRS)</span>
                <div className={styles.num} style={{ fontSize: 17 }}>
                  Not tracked yet
                </div>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>LEFS score</span>
                <div className={styles.num} style={{ fontSize: 17 }}>
                  Not tracked yet
                </div>
              </div>
              <div className={styles.metric}>
                <span className={styles.label}>Last active</span>
                <div className={styles.num} style={{ fontSize: 17 }}>
                  {relativeDayLabel(lastActivityAt)}
                </div>
                {lastActivityAt && <span className={styles.trendFlat}>{formatDateTime(lastActivityAt)}</span>}
              </div>
            </div>

            <div className={styles.exerciseBlock}>
              <span className={styles.label}>This week&apos;s exercises</span>
              {resolvedItems.length === 0 ? (
                <p className={styles.muted} style={{ marginTop: 10 }}>
                  {currentWeekWorkout ? "Nothing prescribed in this workout yet." : "No workout scheduled this week."}
                </p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Exercise</th>
                      <th>Prescription</th>
                      <th>Last performed</th>
                      <th>Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resolvedItems.map((item) => {
                      const itemId = item.kind === "exercise" ? item.exercises.exercise_id : item.cardio.id;
                      const name = item.kind === "exercise" ? item.exercises.name_clinical : item.cardio.name;
                      const prescription =
                        item.kind === "exercise"
                          ? prescriptionSummary(item) || "Not set"
                          : `${cardioModalityLabel(item.cardio.modality, item.cardio.modality_other)} · ${cardioPlainSummary(item.cardio)}`;
                      return (
                        <tr key={itemId}>
                          <td className={styles.exName}>{name}</td>
                          <td>{prescription}</td>
                          <td>{relativeDayLabel(lastPerformed(itemId))}</td>
                          <td className={styles.muted}>Not tracked yet</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : open ? (
          <div className={`${styles.card} ${styles.programCard}`}>
            <div className={styles.programTop}>
              <div>
                <span className={`${styles.badge} ${styles.badgeNeutral}`}>Open routine</span>
                <h3>{open.title}</h3>
                <div className={`${styles.muted} ${styles.programMeta}`}>
                  Given {formatDate(open.created_at)} · no fixed weekly schedule
                </div>
              </div>
              <a href={`/clinic/programmes/${open.id}`} className={`${styles.btn} ${styles.btnGhost}`}>
                Adjust this program
              </a>
            </div>
            <p className={styles.muted} style={{ marginTop: 18 }}>
              Open routines aren&apos;t scheduled to specific days, so week/phase progress and adherence don&apos;t
              apply here.
            </p>
          </div>
        ) : (
          <div className={`${styles.card} ${styles.programCard}`}>
            <p className={styles.muted} style={{ margin: 0 }}>
              Nothing assigned yet.
            </p>
          </div>
        )}

        {/* BOTTOM CONTEXT ROW -- Forms & submissions is real
            (form_sends/form_responses/forms). Session history is
            reinterpreted honestly as in-app activity days (from
            session_completions), not clinic visits/appointments -- Cliniko
            and Setmore are external and not integrated, so there's no real
            visit/booking data to show here at all; that stays Phase 3.
            Clinical notes has no backing table anywhere -- Phase 3. */}
        <div className={styles.bottomGrid}>
          <div className={styles.card}>
            <h3>Session history</h3>
            {completionDates.size === 0 ? (
              <p className={styles.muted} style={{ fontSize: 13, margin: 0 }}>
                Nothing recorded yet. Clinic visits aren&apos;t tracked in Athena (Cliniko/Setmore are separate
                systems) -- this shows in-app activity only.
              </p>
            ) : (
              <ul className={styles.miniList}>
                {Array.from(completionDates)
                  .sort()
                  .reverse()
                  .slice(0, 3)
                  .map((date) => (
                    <li key={date}>
                      <span>Home session</span>
                      <span className={styles.miniListSub}>{formatDate(date)}</span>
                    </li>
                  ))}
              </ul>
            )}
            <a href={`/clinic/patients/${id}?tab=calendar`} className={styles.viewAll}>
              View full calendar ↗
            </a>
          </div>
          <div className={styles.card}>
            <h3>Forms &amp; submissions</h3>
            {sends.length === 0 ? (
              <p className={styles.muted} style={{ fontSize: 13, margin: 0 }}>
                Nothing sent yet.
              </p>
            ) : (
              <ul className={styles.miniList}>
                {sends.map((s) => {
                  const complete = responseBySend.has(s.id);
                  return (
                    <li key={s.id}>
                      <span>{s.forms?.title ?? "Untitled form"}</span>
                      <span className={`${styles.miniListSub} ${complete ? styles.ok : styles.flag}`}>
                        {complete ? "Complete" : "Pending"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <a href={`/clinic/patients/${id}?tab=submissions`} className={styles.viewAll}>
              View all forms ↗
            </a>
          </div>
          <div className={styles.card}>
            <h3>Clinical notes</h3>
            <p className={styles.muted} style={{ fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              Not yet available, there&apos;s no clinical notes feature built in Athena yet.
            </p>
          </div>
        </div>

        {/* MESSAGES -- real now (patient_messages, 0048_patient_messaging.sql).
            Membership-tier badge is real (patient_memberships); "unlimited"
            reflects the same isActiveMembership check the gate itself uses,
            not a guess. */}
        <div className={styles.sectionTitle} id="messages">
          <h2>Messages</h2>
        </div>
        <div className={`${styles.card} ${styles.messagesPanel}`}>
          <div className={styles.messagesHead}>
            <span className={`${styles.badge} ${styles.badgeTier}`}>
              {membershipTier ? (
                <>
                  Unlimited messaging · <TierBadgeIcon size={12} />
                  {membershipTier.name} tier
                </>
              ) : (
                "One free message per programme"
              )}
            </span>
          </div>
          <MessageThreadPanel patientId={id} patientFirstName={patient.first_name} />
        </div>
      </div>
    </div>
  );
}
