import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { computePatientStanding, type PatientStatus } from "@/lib/patientStatus";
import { formatPriceGBP } from "@/lib/currency";
import { PickerThumb } from "../../builder/PickerCanvas";
import clinicStyles from "../../clinic.module.css";
import styles from "./PatientRecord.module.css";
import PatientGroupsEditor from "./PatientGroupsEditor";
import ProgrammeAccessToggle from "./ProgrammeAccessToggle";
import MembershipPauseToggle from "./MembershipPauseToggle";
import CompletionAudioRecorder from "./CompletionAudioRecorder";
import WearableToggle from "./WearableToggle";
import IntakeUploader from "./IntakeUploader";
import { getPatientMembership } from "@/lib/membership";
import { getMembershipTier } from "@/lib/membershipTiers";
import { elapsedWeeks } from "@/lib/programmeWeek";
import { getIntakeFileSignedUrl } from "@/lib/intakeFileUpload";
import ClinicBrandbar from "../../ClinicBrandbar";

type PatientDetail = {
  id: string;
  first_name: string;
  email: string;
  created_at: string;
  last_seen_at: string | null;
  wearable_tracking_enabled: boolean;
  presenting_complaint: string | null;
  date_of_onset: string | null;
  mechanism_of_injury: string | null;
  body_region: string | null;
  referred_via: string | null;
  referral_goals_history: string | null;
};

type IntakeDocumentRow = {
  id: string;
  storage_path: string;
  file_name: string;
  uploaded_at: string;
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
  completion_audio_url: string | null;
};

type CompletionRow = {
  programme_id: string;
  exercise_id: string;
  week_number: number;
  day_of_week: number;
  completed_at: string;
};

type ProgrammeWorkoutRow = {
  workout_id: string;
  day_of_week: number | null;
  workouts: { name: string };
};

type GroupRow = { id: string; name: string };
type GroupMemberRow = { group_id: string };

type CommunicationRow = {
  id: string;
  channel: "email" | "in_app";
  type: string;
  title: string;
  body: string | null;
  sent_at: string;
};

type PurchaseRow = {
  id: string;
  section_slug: string;
  programme_slug: string;
  programme_title: string;
  amount_gbp: number;
  status: "paid" | "refunded";
  created_at: string;
};

type FormSendRow = { id: string; form_id: string; sent_at: string; forms: { title: string } | null };
type FormResponseRow = { id: string; form_send_id: string; submitted_at: string };
type FormAnswerRow = {
  question_id: string | null;
  answer_text: string | null;
  prompt_snapshot: string | null;
  question_order_snapshot: number | null;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ReferralFieldKey =
  | "presenting_complaint"
  | "date_of_onset"
  | "mechanism_of_injury"
  | "body_region"
  | "referred_via"
  | "referral_goals_history";

const REFERRAL_FIELD_ORDER: ReferralFieldKey[] = [
  "presenting_complaint",
  "date_of_onset",
  "mechanism_of_injury",
  "body_region",
  "referred_via",
  "referral_goals_history",
];

const REFERRAL_FIELD_LABELS: Record<ReferralFieldKey, string> = {
  presenting_complaint: "Presenting complaint",
  date_of_onset: "Date of onset",
  mechanism_of_injury: "Mechanism of injury",
  body_region: "Body region",
  referred_via: "Referred via",
  referral_goals_history: "Goals / relevant history",
};

const STATUS_LABEL: Record<PatientStatus, string> = {
  brand_new: "Brand new",
  no_programme: "No programme",
  active: "Active",
  ending_soon: "Ending soon",
  lapsed: "Lapsed",
  block_ended: "Block ended",
};

const CHANNEL_LABEL: Record<CommunicationRow["channel"], string> = {
  email: "Email",
  in_app: "In-app notification",
};

const STATUS_CLASS: Record<PatientStatus, string> = {
  brand_new: clinicStyles.statusBrandNew,
  no_programme: clinicStyles.statusNoProgramme,
  active: clinicStyles.statusActive,
  ending_soon: clinicStyles.statusEndingSoon,
  lapsed: clinicStyles.statusLapsed,
  block_ended: clinicStyles.statusBlockEnded,
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "calendar", label: "Calendar" },
  { key: "submissions", label: "Submissions" },
  { key: "subscriptions", label: "Subscriptions" },
  { key: "purchases", label: "Purchase History" },
  { key: "communications", label: "Communications" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// The record as a whole is the Patients/Dashboard zone (Teal, see .tabActive).
// Submissions and Communications are their own named zones elsewhere in the
// app (the Forms tile, a future Communications surface), so their tabs pick
// up that zone's accent instead of the page default.
const TAB_ACTIVE_CLASS: Record<TabKey, string> = {
  overview: styles.tabActive,
  calendar: styles.tabActive,
  submissions: styles.tabActiveForms,
  subscriptions: styles.tabActive,
  purchases: styles.tabActive,
  communications: styles.tabActiveCommunications,
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ tab?: string }>;

export default async function PatientRecordPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab: TabKey = (TABS.find((t) => t.key === tab)?.key ?? "overview") as TabKey;

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select(
      "id, first_name, email, created_at, last_seen_at, wearable_tracking_enabled, presenting_complaint, date_of_onset, mechanism_of_injury, body_region, referred_via, referral_goals_history"
    )
    .eq("id", id)
    .maybeSingle<PatientDetail>();

  if (!patient) {
    notFound();
  }

  const [{ data: programmes }, { data: completions }, { data: allGroups }, { data: myGroupMemberships }, { data: intakeDocuments }] =
    await Promise.all([
      supabaseAdmin
        .from("programmes")
        .select(
          "id, title, delivery_mode, block_length_weeks, start_date, created_at, access_paused_at, source, completion_audio_url"
        )
        .eq("patient_id", id)
        .order("created_at", { ascending: false })
        .returns<ProgrammeRow[]>(),
      supabaseAdmin
        .from("session_completions")
        .select("programme_id, exercise_id, week_number, day_of_week, completed_at")
        .eq("patient_id", id)
        .order("completed_at", { ascending: false })
        .returns<CompletionRow[]>(),
      supabaseAdmin.from("patient_groups").select("id, name").order("name").returns<GroupRow[]>(),
      supabaseAdmin.from("patient_group_members").select("group_id").eq("patient_id", id).returns<GroupMemberRow[]>(),
      supabaseAdmin
        .from("patient_intake_documents")
        .select("id, storage_path, file_name, uploaded_at")
        .eq("patient_id", id)
        .order("uploaded_at", { ascending: false })
        .returns<IntakeDocumentRow[]>(),
    ]);

  const intakeDocumentsWithUrls = await Promise.all(
    (intakeDocuments ?? []).map(async (doc) => ({
      ...doc,
      url: await getIntakeFileSignedUrl(doc.storage_path),
    }))
  );

  const allProgrammes = programmes ?? [];
  const allCompletions = completions ?? [];
  const scheduled = allProgrammes.find((p) => p.delivery_mode === "scheduled") ?? null;
  const open = allProgrammes.find((p) => p.delivery_mode === "open") ?? null;

  const lastCompletionAt = allCompletions[0]?.completed_at ?? null;
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

  let calendarWorkouts: ProgrammeWorkoutRow[] = [];
  if (activeTab === "calendar" && scheduled) {
    const { data } = await supabaseAdmin
      .from("programme_workouts")
      .select("workout_id, day_of_week, workouts(name)")
      .eq("programme_id", scheduled.id)
      .returns<ProgrammeWorkoutRow[]>();
    calendarWorkouts = data ?? [];
  }

  let formSends: FormSendRow[] = [];
  let responseBySend = new Map<string, FormResponseRow>();
  let answersByResponse = new Map<string, FormAnswerRow[]>();
  if (activeTab === "submissions") {
    const { data: sends } = await supabaseAdmin
      .from("form_sends")
      .select("id, form_id, sent_at, forms(title)")
      .eq("patient_id", id)
      .order("sent_at", { ascending: false })
      .returns<FormSendRow[]>();
    formSends = sends ?? [];

    const sendIds = formSends.map((s) => s.id);
    if (sendIds.length > 0) {
      const { data: responses } = await supabaseAdmin
        .from("form_responses")
        .select("id, form_send_id, submitted_at")
        .in("form_send_id", sendIds)
        .returns<FormResponseRow[]>();
      responseBySend = new Map((responses ?? []).map((r) => [r.form_send_id, r]));

      const responseIds = (responses ?? []).map((r) => r.id);
      if (responseIds.length > 0) {
        const { data: answers } = await supabaseAdmin
          .from("form_answers")
          .select("question_id, answer_text, prompt_snapshot, question_order_snapshot, form_response_id")
          .in("form_response_id", responseIds)
          .returns<(FormAnswerRow & { form_response_id: string })[]>();
        for (const a of answers ?? []) {
          const list = answersByResponse.get(a.form_response_id) ?? [];
          list.push(a);
          answersByResponse.set(a.form_response_id, list);
        }
        for (const list of answersByResponse.values()) {
          list.sort((a, b) => (a.question_order_snapshot ?? 0) - (b.question_order_snapshot ?? 0));
        }
      }
    }
  }

  const membership = activeTab === "subscriptions" ? await getPatientMembership(id) : null;

  let purchases: PurchaseRow[] = [];
  if (activeTab === "purchases") {
    const { data } = await supabaseAdmin
      .from("purchases")
      .select("id, section_slug, programme_slug, programme_title, amount_gbp, status, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<PurchaseRow[]>();
    purchases = data ?? [];
  }

  let communications: CommunicationRow[] = [];
  if (activeTab === "communications") {
    const { data } = await supabaseAdmin
      .from("communications")
      .select("id, channel, type, title, body, sent_at")
      .eq("patient_id", id)
      .order("sent_at", { ascending: false })
      .returns<CommunicationRow[]>();
    communications = data ?? [];
  }

  function completionsFor(programmeId: string) {
    const rows = allCompletions.filter((c) => c.programme_id === programmeId);
    return { count: rows.length, lastAt: rows[0]?.completed_at ?? null };
  }

  return (
    <div className={clinicStyles.app}>
      <div className={clinicStyles.wideInner}>
        <ClinicBrandbar />

        <p className={clinicStyles.subheading} style={{ marginBottom: -4 }}>
          <Link href="/clinic" className={clinicStyles.canvasLink}>
            ← Patients
          </Link>
        </p>
        <h1 className={clinicStyles.heading} style={{ marginBottom: 2 }}>
          {patient.first_name}
        </h1>
        <p className={clinicStyles.subheading} style={{ marginBottom: 0 }}>
          {patient.email} · Joined {formatDate(patient.created_at)} · Last active {relativeTime(lastActivityAt)}
        </p>

        <nav className={styles.tabRow}>
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/clinic/patients/${id}` : `/clinic/patients/${id}?tab=${t.key}`}
              className={`${styles.tab} ${activeTab === t.key ? TAB_ACTIVE_CLASS[t.key] : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {activeTab === "overview" && (
          <div className={styles.layout}>
            <div>
              <div className={clinicStyles.card}>
                <div className={clinicStyles.cardTitle}>Referral details</div>
                {REFERRAL_FIELD_ORDER.some((key) => patient[key]) ? (
                  <div style={{ marginBottom: 16 }}>
                    {REFERRAL_FIELD_ORDER.filter((key) => patient[key]).map((key) => (
                      <div key={key} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {REFERRAL_FIELD_LABELS[key]}
                        </div>
                        <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{patient[key]}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                    Nothing on file yet. Drag in an intake form exported from Cliniko or Setmore to fill this in.
                  </p>
                )}

                <IntakeUploader patientId={id} />

                {intakeDocumentsWithUrls.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                      Uploaded documents
                    </div>
                    {intakeDocumentsWithUrls.map((doc) => (
                      <div key={doc.id} style={{ fontSize: 13, marginBottom: 4 }}>
                        {doc.url ? (
                          <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: "var(--crimson)" }}>
                            {doc.file_name}
                          </a>
                        ) : (
                          <span>{doc.file_name}</span>
                        )}
                        <span style={{ color: "var(--muted)", marginLeft: 8 }}>{formatDate(doc.uploaded_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={clinicStyles.card}>
                <div className={clinicStyles.cardTitle}>Activity</div>
                {allCompletions.length === 0 ? (
                  <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                    Nothing recorded yet. Open routines don&apos;t track completion — there&apos;s nothing to be
                    on or off.
                  </p>
                ) : (
                  <div>
                    {allCompletions.slice(0, 20).map((c, i) => (
                      <div key={i} className={styles.timelineRow}>
                        <div className={styles.timelineDot} />
                        <div style={{ flex: 1 }}>
                          Completed an exercise — week {c.week_number}, {DAY_LABELS[c.day_of_week - 1]}
                        </div>
                        <div className={styles.timelineTime}>{relativeTime(c.completed_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className={clinicStyles.card}>
                <div className={clinicStyles.cardTitle}>Every programme built for {patient.first_name}</div>
                {allProgrammes.length === 0 && (
                  <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                    Nothing yet.
                  </p>
                )}
                {allProgrammes.map((p) => {
                  const stats = completionsFor(p.id);
                  return (
                    <div key={p.id} className={styles.assignedRow}>
                      <PickerThumb src={null} label={p.title} />
                      <div style={{ flex: 1 }}>
                        <Link href={`/clinic/programmes/${p.id}`} style={{ color: "var(--crimson)", fontWeight: 500 }}>
                          {p.title}
                        </Link>
                        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>
                          {p.delivery_mode === "open" ? "Open routine" : `Scheduled · ${p.block_length_weeks}wk`} · given{" "}
                          {formatDate(p.created_at)}
                          {p.delivery_mode === "scheduled" &&
                            ` · ${stats.count} session${stats.count === 1 ? "" : "s"} completed${
                              stats.lastAt ? `, last ${relativeTime(stats.lastAt)}` : ""
                            }`}
                        </div>
                      </div>
                      <ProgrammeAccessToggle
                        programmeId={p.id}
                        initialPaused={p.access_paused_at != null}
                        initialSource={p.source}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.sidebar}>
              {scheduled && elapsedWeeks(scheduled.start_date) >= scheduled.block_length_weeks && (
                <CompletionAudioRecorder
                  programmeId={scheduled.id}
                  programmeTitle={scheduled.title}
                  existingUrl={scheduled.completion_audio_url}
                />
              )}

              <div className={clinicStyles.card}>
                <div className={clinicStyles.cardTitle}>Assigned</div>
                <div style={{ marginBottom: 10 }}>
                  <span className={`${clinicStyles.statusPill} ${STATUS_CLASS[standing.status]}`}>
                    {STATUS_LABEL[standing.status]}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{standing.whatTheyreOn}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 2 }}>{standing.cyclePosition}</div>
                <Link
                  href={`/clinic/programmes/new?patient=${id}`}
                  className={clinicStyles.button}
                  style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}
                >
                  Assign
                </Link>
              </div>

              {scheduled && (
                <div className={clinicStyles.card}>
                  <div className={clinicStyles.cardTitle}>Progress</div>
                  <div style={{ fontSize: 13.5 }}>
                    {completionsFor(scheduled.id).count} session
                    {completionsFor(scheduled.id).count === 1 ? "" : "s"} completed this block
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                    Last done {relativeTime(completionsFor(scheduled.id).lastAt)}
                  </div>
                </div>
              )}

              <WearableToggle patientId={id} initialEnabled={patient.wearable_tracking_enabled} />

              <PatientGroupsEditor
                patientId={id}
                allGroups={allGroups ?? []}
                initialGroupIds={(myGroupMemberships ?? []).map((m) => m.group_id)}
              />
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div>
            {!scheduled && (
              <p className={clinicStyles.notice} style={{ color: "var(--clinic-on-canvas-muted)" }}>
                {open
                  ? "Open routines aren't scheduled to specific days — there's nothing to show here."
                  : "No scheduled programme yet."}
              </p>
            )}
            {scheduled && (
              <>
                <p className={clinicStyles.subheading}>
                  {scheduled.title} — {standing.cyclePosition}
                </p>
                <div className={styles.calendarGrid}>
                  {DAY_LABELS.map((label, i) => {
                    const day = i + 1;
                    const assignment = calendarWorkouts.find((w) => w.day_of_week === day);
                    return (
                      <div key={day} className={styles.calendarDay}>
                        <div className={styles.calendarDayLabel}>{label}</div>
                        {assignment ? (
                          <div className={styles.calendarWorkout}>{assignment.workouts.name}</div>
                        ) : (
                          <div className={styles.calendarRest}>rest</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "submissions" && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>Forms sent to {patient.first_name}</div>
            {formSends.length === 0 && (
              <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                No forms sent yet.
              </p>
            )}
            {formSends.map((s) => {
              const response = responseBySend.get(s.id);
              const answers = response ? answersByResponse.get(response.id) ?? [] : [];
              return (
                <div key={s.id} style={{ padding: "12px 0", borderTop: "1px solid var(--cream)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{s.forms?.title ?? "Untitled form"}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>Sent {formatDate(s.sent_at)}</div>
                    </div>
                    {response ? (
                      <span className={`${clinicStyles.statusPill} ${clinicStyles.statusActive}`}>
                        Completed {formatDate(response.submitted_at)}
                      </span>
                    ) : (
                      <span className={`${clinicStyles.statusPill} ${clinicStyles.statusLapsed}`}>
                        Not yet completed
                      </span>
                    )}
                  </div>
                  {answers.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      {answers.map((a) => (
                        <div key={a.question_id}>
                          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                            {a.prompt_snapshot ?? "Question"}
                          </div>
                          <div style={{ fontSize: 14 }}>{a.answer_text || "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {activeTab === "subscriptions" && membership && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>Membership</div>
            {membership.tier === "none" ? (
              <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                No membership yet.
              </p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>
                    {getMembershipTier(membership.tier)?.name ?? membership.tier}
                  </span>
                  <span
                    className={`${clinicStyles.statusPill} ${
                      membership.status === "active"
                        ? clinicStyles.statusActive
                        : membership.status === "paused"
                          ? clinicStyles.statusEndingSoon
                          : membership.status === "cancelled"
                            ? clinicStyles.statusBlockEnded
                            : clinicStyles.statusLapsed
                    }`}
                  >
                    {membership.status === "active"
                      ? "Active"
                      : membership.status === "paused"
                        ? "Paused"
                        : membership.status === "cancelled"
                          ? "Cancelled"
                          : "Lapsed"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>
                  {membership.billingType === "recurring" ? "Monthly, recurring" : "Paid upfront"}
                  {membership.billingType === "prepay" && membership.expiresAt
                    ? ` · runs until ${formatDate(membership.expiresAt)}`
                    : ""}
                </div>
                {membership.pausedAt && (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
                    Paused {relativeTime(membership.pausedAt)}
                  </div>
                )}
                {membership.status !== "lapsed" && membership.status !== "cancelled" && (
                  <div style={{ marginTop: 14 }}>
                    <MembershipPauseToggle patientId={id} initialPaused={membership.status === "paused"} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {activeTab === "purchases" && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>Bought by {patient.first_name}</div>
            {purchases.length === 0 && (
              <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                Nothing bought yet.
              </p>
            )}
            {purchases.map((p) => (
              <div key={p.id} style={{ padding: "12px 0", borderTop: "1px solid var(--cream)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.programme_title}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{formatDate(p.created_at)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{formatPriceGBP(p.amount_gbp)}</span>
                    <span
                      className={`${clinicStyles.statusPill} ${
                        p.status === "paid" ? clinicStyles.statusActive : clinicStyles.statusLapsed
                      }`}
                    >
                      {p.status === "paid" ? "Paid" : "Refunded"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === "communications" && (
          <div className={clinicStyles.card}>
            <div className={clinicStyles.cardTitle}>Sent to {patient.first_name}</div>
            {communications.length === 0 && (
              <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
                Nothing sent yet.
              </p>
            )}
            {communications.map((c) => (
              <div key={c.id} style={{ padding: "12px 0", borderTop: "1px solid var(--cream)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{c.title}</div>
                    {c.body && <div style={{ fontSize: 13, color: "var(--stone)", marginTop: 3 }}>{c.body}</div>}
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{formatDate(c.sent_at)}</div>
                  </div>
                  <span
                    className={`${clinicStyles.statusPill} ${
                      c.channel === "email" ? clinicStyles.statusActive : clinicStyles.statusNoProgramme
                    }`}
                    style={{ flexShrink: 0 }}
                  >
                    {CHANNEL_LABEL[c.channel]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StubTab({ text }: { text: string }): ReactNode {
  return (
    <div className={clinicStyles.card}>
      <p className={clinicStyles.notice} style={{ marginTop: 0 }}>
        {text}
      </p>
    </div>
  );
}
