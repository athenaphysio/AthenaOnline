import "server-only";
import { circuitSteps } from "@/lib/runCircuit";
import { Document, Page, Text, View, Image, renderToBuffer } from "@react-pdf/renderer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { pdfStyles as styles, PdfFooter, SAFETY_LINE, buildExerciseRows, type ExerciseRowData } from "@/lib/runningPlanPdf";
import { resolveWorkoutItems } from "@/lib/workoutResolution";
import type { AthenaPlanV1, PlanSession, PlanWeek } from "@/lib/athenaPlan";
import { loadAllSessions, loadAnyDaySessions } from "@/lib/programmeCards";

// The athena-plan-v1 equivalent of runningPlanPdf.tsx (Step 5 of the new
// direction) -- same cover, same styles, same footer, same run log, but
// reading straight from a plan's own raw_json instead of a rung
// computation. Shows every week the plan has, not just the next few --
// there's no "whole ladder" to hide here, this plan already IS the whole
// thing David and Claude chat agreed on.

export type PlanPdfData = {
  clientFirstName: string;
  brandIsDefault: boolean;
  brandWordmarkUrl: string | null;
  brandAccent: string;
  blockTitle: string;
  intro: string;
  weeks: PlanWeek[];
  moveOnText: string;
  flareText: string;
  /** Monday the block starts, YYYY-MM-DD, when known: dates each week. */
  startDate?: string | null;
  blockLengthWeeks?: number;
  /** restCode values (week * 10 + day) and bare days 1 to 7, as programmes store them. */
  restDays?: number[];
  /** Adds the "look it over and reply to confirm" line to the cover. */
  askToConfirm?: boolean;
  /** Each strength session in the block, once, with its exercises in full. */
  strengthSessions?: StrengthSessionDetail[];
};

export type StrengthSessionDetail = {
  name: string;
  /** "Mondays", or "Mondays and Thursdays". */
  when: string;
  rows: ExerciseRowData[];
};

const TYPE_LABEL: Record<string, string> = { run: "Run", bike: "Bike", swim: "Swim", row: "Row", strength: "Strength", rest: "Rest", other: "Other", run_circuit: "Run Circuit" };
const DAY_LABEL: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun", any: "Any day" };

async function gatherImportedPlanData(importedPlanId: string): Promise<PlanPdfData | null> {
  const { data: planRow } = await supabaseAdmin
    .from("imported_plans")
    .select("raw_json, patient_id, status")
    .eq("id", importedPlanId)
    .maybeSingle<{ raw_json: AthenaPlanV1; patient_id: string; status: string }>();
  if (!planRow) return null;
  const plan = planRow.raw_json;

  const [{ data: patient }, brand] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name").eq("id", planRow.patient_id).maybeSingle<{ first_name: string }>(),
    resolveBrandPack({ patientId: planRow.patient_id }),
  ]);
  if (!patient) return null;

  return {
    clientFirstName: patient.first_name,
    brandIsDefault: brand.isAllDefault,
    brandWordmarkUrl: brand.wordmark_url,
    brandAccent: brand.isAllDefault ? "#9B1C1C" : brand.accent_color,
    blockTitle: plan.block_title,
    intro: plan.intro,
    weeks: [...plan.weeks].sort((a, b) => a.week - b.week),
    moveOnText: plan.rules.move_on,
    flareText: plan.rules.flare,
  };
}

function SessionRow({ session, strengthInFull }: { session: PlanSession; strengthInFull: boolean }) {
  // A Run Circuit is written out from its blocks, round by round.
  const steps = session.circuit && session.steps.length === 0 ? circuitSteps(session.circuit) : session.steps;
  const stepsText = steps.map((s) => (s.label ? `${s.label}: ${s.detail}` : s.detail)).join("; ");
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 1.1 }]}>
        {TYPE_LABEL[session.type] ?? session.type}
        {session.day !== "any" ? ` (${DAY_LABEL[session.day] ?? session.day})` : ""}
        {"\n"}
        {session.title}
      </Text>
      <Text style={[styles.td, { flex: 2 }]}>{session.type === "strength" ? (strengthInFull ? "Set out in full on your strength pages, and in your app" : "Strength, set out in full in your app") : stepsText}</Text>
      <Text style={[styles.td, { flex: 1 }]}>{session.target}</Text>
      <Text style={[styles.td, { flex: 1, borderRightWidth: 0 }]}>{session.total}</Text>
    </View>
  );
}

function WeekTable({ week, accent, monday, strengthInFull = false }: { week: PlanWeek; accent: string; monday: Date | null; strengthInFull?: boolean }) {
  const sessions = [...week.sessions].sort((a, b) => a.order - b.order);
  return (
    <View wrap={false} style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: accent }}>
        {`Week ${week.week}${week.label ? `, ${week.label}` : ""}`}
        {monday ? <Text style={{ fontSize: 9.5, fontWeight: 400, color: "#6B6B6B" }}>{`   from ${shortDate(monday)}`}</Text> : null}
      </Text>
      {week.focus && <Text style={{ fontSize: 10, color: "#4A4A4A", marginBottom: 6 }}>{week.focus}</Text>}
      <View style={styles.table}>
        <View style={styles.tr}>
          <Text style={[styles.th, { flex: 1.1 }]}>Session</Text>
          <Text style={[styles.th, { flex: 2 }]}>Steps</Text>
          <Text style={[styles.th, { flex: 1 }]}>Target</Text>
          <Text style={[styles.th, { flex: 1, borderRightWidth: 0 }]}>Total</Text>
        </View>
        {sessions.map((s) => (
          <SessionRow key={s.id} session={s} strengthInFull={strengthInFull} />
        ))}
      </View>
    </View>
  );
}

// Session colours on the at-a-glance page, chosen to differ in lightness
// as well as hue so they still read when printed in black and white.
const TYPE_TINT: Record<string, { bg: string; fg: string }> = {
  run: { bg: "#F3D9D9", fg: "#6B1111" },
  bike: { bg: "#DCE6F2", fg: "#1F3A5C" },
  swim: { bg: "#D8EEF0", fg: "#14535A" },
  row: { bg: "#E4E0F2", fg: "#3A2F6B" },
  strength: { bg: "#2A2A2A", fg: "#FFFFFF" },
  other: { bg: "#EFE6D2", fg: "#5A4415" },
};
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function weekMonday(startDate: string | null | undefined, week: number): Date | null {
  if (!startDate) return null;
  const d = new Date(`${startDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + (week - 1) * 7);
  return d;
}

function shortDate(d: Date | null): string {
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
}

function isRest(restDays: number[] | undefined, week: number, dayIdx: number): boolean {
  if (!restDays) return false;
  return restDays.includes(dayIdx + 1) || restDays.includes(week * 10 + dayIdx + 1);
}

function GlancePage({ data }: { data: PlanPdfData }) {
  const accent = data.brandAccent;
  // Rows grow to fill the page for shorter blocks; a 12 week block still fits.
  const rowHeight = Math.max(30, Math.min(64, Math.floor(400 / Math.max(1, data.weeks.length))));
  const cell = { flex: 1, minHeight: rowHeight, padding: 3, borderRightWidth: 1, borderRightColor: "#D8D3C8", borderBottomWidth: 1, borderBottomColor: "#D8D3C8" };
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <Text style={{ fontSize: 16, marginBottom: 2 }}>Your block at a glance</Text>
      <Text style={styles.note}>
        {data.weeks.length} week{data.weeks.length === 1 ? "" : "s"}, one row per week. The pages after this one set out each cardio session in full.
      </Text>
      <View style={{ borderWidth: 1, borderColor: "#D8D3C8", borderTopWidth: 2, borderTopColor: accent }}>
        <View style={{ flexDirection: "row" }}>
          <Text style={[styles.th, { flex: 0.9 }]}>Week</Text>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
            <Text key={d} style={[styles.th, { flex: 1 }, i === 6 ? { borderRightWidth: 0 } : {}]}>{d}</Text>
          ))}
        </View>
        {data.weeks.map((week) => {
          const monday = weekMonday(data.startDate, week.week);
          return (
            <View key={week.week} style={{ flexDirection: "row" }} wrap={false}>
              <View style={[cell, { flex: 0.9 }]}>
                <Text style={{ fontSize: 9.5, fontWeight: 700 }}>Week {week.week}</Text>
                {monday ? <Text style={{ fontSize: 7.5, color: "#6B6B6B" }}>from {shortDate(monday)}</Text> : null}
                {week.label ? <Text style={{ fontSize: 7.5, color: accent }}>{week.label}</Text> : null}
                {week.sessions.filter((s) => s.day === "any").map((s) => (
                  <Text key={s.id} style={{ fontSize: 7, color: "#6B6B6B", marginTop: 2 }}>Any day: {s.title}</Text>
                ))}
              </View>
              {DAY_ORDER.map((dayKey, di) => {
                const today = week.sessions.filter((s) => s.day === dayKey).sort((a, b) => a.order - b.order);
                const rest = today.length === 0 && isRest(data.restDays, week.week, di);
                return (
                  <View key={dayKey} style={[cell, di === 6 ? { borderRightWidth: 0 } : {}]}>
                    {today.map((s) => {
                      const tint = TYPE_TINT[s.type === "run_circuit" ? "run" : s.type] ?? TYPE_TINT.other;
                      return (
                        <View key={s.id} style={{ backgroundColor: tint.bg, borderRadius: 3, padding: 2, marginBottom: 2 }}>
                          <Text style={{ fontSize: 6.5, fontWeight: 700, color: tint.fg }}>{(TYPE_LABEL[s.type] ?? s.type).toUpperCase()}</Text>
                          <Text style={{ fontSize: 7, color: tint.fg }}>{s.title}</Text>
                        </View>
                      );
                    })}
                    {rest ? <Text style={{ fontSize: 7.5, color: "#8A8A8A" }}>Rest</Text> : null}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
      <PdfFooter />
    </Page>
  );
}

// One page section per strength session, set out the way the app shows it:
// each exercise with its sets and reps, the reason it is there, and a code
// that opens its video. The heading travels with the first exercise so a
// session never starts at the foot of a page.
function StrengthPages({ data }: { data: PlanPdfData }) {
  const sessions = data.strengthSessions ?? [];
  if (sessions.length === 0) return null;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ ...styles.sectionHeading, marginTop: 0, borderBottomColor: data.brandAccent }}>Your strength sessions</Text>
      <Text style={styles.note}>
        Each session stays the same from week to week, so these pages cover the whole block. Scan a code with your phone camera to see that exercise on video.
      </Text>
      {sessions.map((session, si) => (
        <View key={si} style={{ marginTop: si === 0 ? 4 : 16 }}>
          <View minPresenceAhead={90}>
            <Text style={{ fontSize: 12.5, fontWeight: 700, color: data.brandAccent }}>{session.name}</Text>
            <Text style={{ fontSize: 9.5, color: "#6B6B6B", marginBottom: 4 }}>{session.when}</Text>
          </View>
          {session.rows.map((row, i) => (
            <View key={i} style={styles.exerciseRow} wrap={false}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName}>{row.name}</Text>
                <Text style={styles.exerciseMeta}>{row.prescription}</Text>
                {row.load && <Text style={styles.exerciseMeta}>{row.load}</Text>}
                {row.cue && <Text style={styles.exerciseMeta}>{row.cue}</Text>}
              </View>
              {row.qrDataUrl && <Image src={row.qrDataUrl} style={styles.qr} />}
            </View>
          ))}
        </View>
      ))}
      <PdfFooter />
    </Page>
  );
}

function ImportedPlanDocument({ data }: { data: PlanPdfData }) {
  const createdOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const headingStyle = { ...styles.sectionHeading, borderBottomColor: data.brandAccent };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {!data.brandIsDefault && data.brandWordmarkUrl ? (
          <Image src={data.brandWordmarkUrl} style={{ height: 22, width: "auto", marginBottom: 14, objectFit: "contain" }} />
        ) : (
          <Text style={styles.eyebrow}>ATHENA PHYSIO</Text>
        )}
        <Text style={styles.title}>Your plan</Text>
        <Text style={styles.coverLine}>{data.clientFirstName}</Text>
        <Text style={styles.coverLine}>{data.blockTitle}</Text>
        {data.intro && <Text style={styles.coverLine}>{data.intro}</Text>}
        {data.startDate ? (
          <Text style={styles.coverLine}>
            {`Starts ${weekMonday(data.startDate, 1)?.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) ?? ""}, ${data.weeks.length} weeks`}
          </Text>
        ) : null}
        <Text style={styles.coverLine}>Plan from Dr David Silver PhD</Text>
        <Text style={styles.note}>Created on {createdOn}. Your app always has the latest version of your plan.</Text>
        {data.askToConfirm ? (
          <View style={{ borderLeftWidth: 3, borderLeftColor: data.brandAccent, paddingLeft: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 10.5 }}>
              Have a look through the whole block, then reply to the email this came with to let David know it fits your week, or what you would change. Your app shows you each day as it comes.
            </Text>
          </View>
        ) : null}

        {data.startDate === undefined &&
          data.weeks.map((week) => <WeekTable key={week.week} week={week} accent={data.brandAccent} monday={null} />)}

        {data.moveOnText ? (
          <View wrap={false}>
            <Text style={headingStyle}>Moving on</Text>
            <Text style={{ fontSize: 10.5, margin: 0 }}>{data.moveOnText}</Text>
          </View>
        ) : null}
        {data.flareText ? (
          <View wrap={false} style={{ marginTop: 12 }}>
            <Text style={headingStyle}>If you have a flare-up</Text>
            <Text style={{ fontSize: 10.5, marginBottom: 6 }}>{data.flareText}</Text>
            <Text style={{ fontSize: 9.5, color: "#9B1C1C" }}>{SAFETY_LINE}</Text>
          </View>
        ) : null}

        <PdfFooter />
      </Page>

      {data.startDate !== undefined && <GlancePage data={data} />}

      {data.startDate !== undefined && (
        <Page size="A4" style={styles.page}>
          <Text style={{ ...styles.sectionHeading, marginTop: 0, borderBottomColor: data.brandAccent }}>Week by week</Text>
          {data.weeks.map((week) => (
            <WeekTable
              key={week.week}
              week={week}
              accent={data.brandAccent}
              monday={weekMonday(data.startDate, week.week)}
              strengthInFull={(data.strengthSessions ?? []).length > 0}
            />
          ))}
          <PdfFooter />
        </Page>
      )}

      <StrengthPages data={data} />
    </Document>
  );
}

export async function generateImportedPlanPdf(importedPlanId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await gatherImportedPlanData(importedPlanId);
  if (!data) return null;

  const buffer = await renderToBuffer(<ImportedPlanDocument data={data} />);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = data.clientFirstName.replace(/[^a-zA-Z0-9]/g, "");
  const filename = `Athena_plan_${safeName}_${dateStr}.pdf`;
  return { buffer, filename };
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

// The same document, built from a client's programme: cardio cards and
// strength sessions together, week by week.
export async function generateProgrammePlanPdf(
  programmeId: string,
  options: { askToConfirm?: boolean } = {}
): Promise<{ buffer: Buffer; filename: string } | null> {
  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select("title, intro, block_length_weeks, patient_id, plan_rules, week_labels, start_date, rest_days")
    .eq("id", programmeId)
    .maybeSingle<{
      title: string;
      intro: string | null;
      block_length_weeks: number;
      patient_id: string;
      plan_rules: { move_on?: string; flare?: string } | null;
      week_labels: Record<string, string> | null;
      start_date: string | null;
      rest_days: number[] | null;
    }>();
  if (!programme) return null;

  const [{ data: patient }, brand, sessions, anyDay] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name").eq("id", programme.patient_id).maybeSingle<{ first_name: string }>(),
    resolveBrandPack({ patientId: programme.patient_id, programmeId }),
    loadAllSessions(programmeId),
    loadAnyDaySessions(programmeId),
  ]);
  if (!patient) return null;

  const weeks: PlanWeek[] = Array.from({ length: programme.block_length_weeks }, (_, i) => {
    const week = i + 1;
    const here = sessions
      .filter((s) => s.week == null || s.week === week)
      .sort((a, b) => a.day - b.day || a.sortOrder - b.sortOrder);
    return {
      week,
      label: programme.week_labels?.[String(week)] ?? "",
      focus: "",
      sessions: here.map((s, order) => ({
        id: `${s.workoutId}:${week}`,
        day: DAY_KEYS[s.day - 1],
        order,
        type: s.plan ? s.plan.type : "strength",
        title: s.plan ? s.plan.title || s.name : s.name,
        summary: s.plan?.summary ?? "",
        steps: s.plan?.steps ?? [],
        target: s.plan?.target ?? "",
        total: s.plan?.total ?? "",
        notes: s.plan?.notes ?? "",
        ...(s.plan?.circuit ? { circuit: s.plan.circuit } : {}),
      })),
    };
  }).map((w) => {
    const extra = anyDay
      .filter((a) => a.week === w.week)
      .map((a, i) => ({
        id: `${a.workoutId}:${w.week}:any`,
        day: "any" as const,
        order: 100 + i,
        type: "strength" as const,
        title: a.name,
        summary: "",
        steps: [],
        target: "",
        total: "",
        notes: "",
      }));
    return { ...w, sessions: [...w.sessions, ...extra] };
  }).filter((w) => w.sessions.length > 0);

  const strengthSessions = await loadStrengthSessions([
    ...sessions,
    ...anyDay.map((a) => ({ workoutId: a.workoutId, name: a.name, day: 0, week: a.week, plan: null })),
  ]);

  const data: PlanPdfData = {
    strengthSessions,
    clientFirstName: patient.first_name,
    brandIsDefault: brand.isAllDefault,
    brandWordmarkUrl: brand.wordmark_url,
    brandAccent: brand.isAllDefault ? "#9B1C1C" : brand.accent_color,
    blockTitle: programme.title,
    intro: programme.intro ?? "",
    weeks,
    moveOnText: programme.plan_rules?.move_on ?? "",
    flareText: programme.plan_rules?.flare ?? "",
    startDate: programme.start_date ? programme.start_date.slice(0, 10) : null,
    blockLengthWeeks: programme.block_length_weeks,
    restDays: programme.rest_days ?? [],
    askToConfirm: options.askToConfirm ?? false,
  };

  const buffer = await renderToBuffer(<ImportedPlanDocument data={data} />);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = data.clientFirstName.replace(/[^a-zA-Z0-9]/g, "");
  return { buffer, filename: `Athena_plan_${safeName}_${dateStr}.pdf` };
}

// Renders the document from data already gathered (used for previews).
export async function renderPlanPdf(data: PlanPdfData): Promise<Buffer> {
  return renderToBuffer(<ImportedPlanDocument data={data} />);
}

const DAY_PLURAL = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];

// Every library strength session in the programme, once each, in the order
// it first falls in the week. Its exercises are read for the first week it
// appears, since a strength session stays the same week to week.
async function loadStrengthSessions(
  sessions: { workoutId: string; name: string; day: number; week: number | null; plan: unknown }[]
): Promise<StrengthSessionDetail[]> {
  const byWorkout = new Map<string, { name: string; days: Set<number>; firstWeek: number; firstDay: number }>();
  for (const s of sessions) {
    if (s.plan) continue;
    const week = s.week ?? 1;
    const entry = byWorkout.get(s.workoutId);
    if (entry) {
      entry.days.add(s.day);
      if (week < entry.firstWeek) entry.firstWeek = week;
      if (s.day < entry.firstDay) entry.firstDay = s.day;
    } else {
      byWorkout.set(s.workoutId, { name: s.name, days: new Set([s.day]), firstWeek: week, firstDay: s.day });
    }
  }

  const ordered = [...byWorkout.entries()].sort((a, b) => a[1].firstDay - b[1].firstDay);
  const result: StrengthSessionDetail[] = [];
  for (const [workoutId, info] of ordered) {
    try {
      const rows = await buildExerciseRows(await resolveWorkoutItems(workoutId, info.firstWeek));
      if (rows.length === 0) continue;
      const days = [...info.days].sort((a, b) => a - b).map((d) => (d === 0 ? "any day you choose each week" : DAY_PLURAL[d - 1]));
      const when = days.length <= 1 ? days.join("") : `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
      result.push({ name: info.name, when, rows });
    } catch (err) {
      // One session that cannot be read should never stop the whole PDF.
      console.error("strength session for PDF failed", workoutId, err);
    }
  }
  return result;
}
