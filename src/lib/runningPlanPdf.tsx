import "server-only";
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveBrandPack, type ResolvedBrandPack } from "@/lib/brandPackResolve";
import { resolveWorkoutItems, type Resolved } from "@/lib/workoutResolution";
import { currentWeekNumber } from "@/lib/programmeWeek";
import { prescriptionSummary } from "@/lib/prescription";
import { cardioModalityLabel, cardioPlainSummary } from "@/lib/cardioBlock";
import { runItemFieldsFromRung, type LadderRungRow } from "@/lib/runBlockFromRung";
import { runPlainSummary, type RunBlockFields } from "@/lib/runBlock";

// The client's running plan as a phone-readable, print-clean A4 PDF -- a
// snapshot of the live programme, generated fresh on every download so it
// always reflects the client's current rung. See the Running Builder
// brief's PDF step. Only ever produced for a programme that's actually a
// Running Builder one (has a running_programme_state row) -- called from
// both src/app/api/session/running-plan-pdf/route.ts (client) and
// src/app/api/clinic/programmes/[id]/running-plan-pdf/route.ts (David).

export const SAFETY_LINE =
  "If the pain is severe, constant, or you notice new symptoms such as numbness, tingling or weakness, contact David directly or call NHS 111. In an emergency, call 999.";

function firstLine(text: string | null): string | null {
  if (!text) return null;
  const line = text.split("\n")[0]?.trim();
  return line || null;
}

function toRunBlockFields(
  rung: LadderRungRow,
  opts: { easierEffort: boolean; treadmill: boolean },
  warmupWalk: string | null,
  cooldown: string | null
): RunBlockFields {
  const f = runItemFieldsFromRung(rung, opts);
  return {
    run_title: f.run_title,
    run_warmup_walk: warmupWalk,
    run_repeats: f.run_repeats,
    run_portion_value: f.run_portion_value,
    run_portion_unit: f.run_portion_unit,
    run_recovery_duration: f.run_recovery_duration,
    run_recovery_type: f.run_recovery_type,
    run_target_pace: f.run_target_pace,
    run_effort_cue: f.run_effort_cue,
    run_surface: f.run_surface,
    run_cooldown: cooldown,
  };
}

type ExerciseRowData = {
  name: string;
  prescription: string;
  load: string | null;
  cue: string | null;
  qrDataUrl: string | null;
};

type UpcomingRung = { label: "Now" | "Next" | "After that"; fields: RunBlockFields };

type PlanData = {
  clientFirstName: string;
  brand: ResolvedBrandPack;
  goal: string;
  event: string | null;
  eventDate: string | null;
  weekGlance: { day: string; label: string | null }[];
  prepExercises: ExerciseRowData[];
  upcomingRungs: UpcomingRung[];
  strengthExercises: ExerciseRowData[];
  crossTraining: { name: string; summary: string }[];
  painLimit: number;
  rules: string | null;
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function buildExerciseRows(resolved: Resolved[]): Promise<ExerciseRowData[]> {
  const exerciseItems = resolved.filter((r): r is Extract<Resolved, { kind: "exercise" }> => r.kind === "exercise");
  const exerciseIds = exerciseItems.map((r) => r.exercises.exercise_id);
  const { data: cueRows } = exerciseIds.length
    ? await supabaseAdmin.from("exercises").select("exercise_id, cues_notes").in("exercise_id", exerciseIds).returns<{ exercise_id: string; cues_notes: string | null }[]>()
    : { data: [] as { exercise_id: string; cues_notes: string | null }[] };
  const cueByExercise = new Map((cueRows ?? []).map((r) => [r.exercise_id, r.cues_notes]));

  return Promise.all(
    exerciseItems.map(async (r) => {
      const vimeoUrl = r.exercises.vimeo_url;
      const qrDataUrl = vimeoUrl ? await QRCode.toDataURL(vimeoUrl, { width: 160, margin: 1 }) : null;
      return {
        name: r.exercises.name_patient_facing || r.exercises.name_clinical,
        prescription: prescriptionSummary(r),
        load: r.rationale,
        cue: firstLine(cueByExercise.get(r.exercises.exercise_id) ?? null),
        qrDataUrl,
      };
    })
  );
}

async function gatherRunningPlanData(programmeId: string): Promise<PlanData | null> {
  const { data: programme } = await supabaseAdmin
    .from("programmes")
    .select("id, patient_id, start_date, block_length_weeks")
    .eq("id", programmeId)
    .maybeSingle<{ id: string; patient_id: string; start_date: string; block_length_weeks: number }>();
  if (!programme) return null;

  const { data: state } = await supabaseAdmin
    .from("running_programme_state")
    .select("ladder_id, current_rung_number, quality_run_workout_id, easy_run_workout_id")
    .eq("programme_id", programmeId)
    .maybeSingle<{ ladder_id: string; current_rung_number: number; quality_run_workout_id: string | null; easy_run_workout_id: string | null }>();
  if (!state) return null;

  const { data: draft } = await supabaseAdmin
    .from("running_builder_drafts")
    .select("header, weekly_structure, rules, strength_workout_id, cross_training_workout_id")
    .eq("programme_id", programmeId)
    .maybeSingle<{
      header: { goal: string; event: string | null; event_date: string | null };
      weekly_structure: unknown;
      rules: string | null;
      strength_workout_id: string | null;
      cross_training_workout_id: string | null;
    }>();

  const [{ data: patient }, brand] = await Promise.all([
    supabaseAdmin.from("patients").select("first_name, running_pain_limit").eq("id", programme.patient_id).maybeSingle<{ first_name: string; running_pain_limit: number }>(),
    resolveBrandPack({ patientId: programme.patient_id, programmeId: programme.id }),
  ]);
  if (!patient) return null;

  const week = currentWeekNumber(programme.start_date, programme.block_length_weeks);

  // Week at a glance -- label each scheduled day by matching its workout
  // id against the ones this programme was actually built from.
  const labelByWorkoutId = new Map<string, string>();
  if (state.quality_run_workout_id) labelByWorkoutId.set(state.quality_run_workout_id, "Quality run");
  if (state.easy_run_workout_id) labelByWorkoutId.set(state.easy_run_workout_id, "Easy run");
  if (draft?.strength_workout_id) labelByWorkoutId.set(draft.strength_workout_id, "Strength");
  if (draft?.cross_training_workout_id) labelByWorkoutId.set(draft.cross_training_workout_id, "Cross-training");

  const { data: assignments } = await supabaseAdmin
    .from("programme_workouts")
    .select("day_of_week, workout_id")
    .eq("programme_id", programmeId)
    .returns<{ day_of_week: number | null; workout_id: string }[]>();
  const labelByDay = new Map((assignments ?? []).filter((a) => a.day_of_week != null).map((a) => [a.day_of_week as number, labelByWorkoutId.get(a.workout_id) ?? null]));
  const weekGlance = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ day: DAY_NAMES[d - 1], label: labelByDay.get(d) ?? null }));

  // Before every run -- the Quality run workout's own warm-up block, minus
  // the Run block item itself.
  const prepExercises = state.quality_run_workout_id ? await buildExerciseRows(await resolveWorkoutItems(state.quality_run_workout_id, week)) : [];

  // Your running sessions -- current rung plus the next two, never the
  // whole ladder. Static warm-up walk/cool-down/surface carried from the
  // live Quality run item (never rung-specific), rung-specific fields
  // (repeats, portion, recovery, pace, cue) computed fresh per rung, the
  // same way progression itself computes them (runItemFieldsFromRung).
  const upcomingRungs: UpcomingRung[] = [];
  if (state.quality_run_workout_id) {
    const liveResolved = await resolveWorkoutItems(state.quality_run_workout_id, week);
    const liveRun = liveResolved.find((r): r is Extract<Resolved, { kind: "run" }> => r.kind === "run");
    const treadmill = liveRun?.run.run_surface === "Treadmill";
    const warmupWalk = liveRun?.run.run_warmup_walk ?? null;
    const cooldown = liveRun?.run.run_cooldown ?? null;

    const rungNumbers = [state.current_rung_number, state.current_rung_number + 1, state.current_rung_number + 2];
    const { data: rungRows } = await supabaseAdmin
      .from("running_rungs")
      .select("rung_number, repeats, run_portion, recovery, target_pace, effort_cue, total_running_minutes")
      .eq("ladder_id", state.ladder_id)
      .in("rung_number", rungNumbers)
      .returns<LadderRungRow[]>();
    const rungByNumber = new Map((rungRows ?? []).map((r) => [r.rung_number, r]));

    const labels: ("Now" | "Next" | "After that")[] = ["Now", "Next", "After that"];
    rungNumbers.forEach((num, i) => {
      const rung = rungByNumber.get(num);
      if (!rung) return;
      upcomingRungs.push({ label: labels[i], fields: toRunBlockFields(rung, { easierEffort: false, treadmill }, warmupWalk, cooldown) });
    });
  }

  const strengthExercises = draft?.strength_workout_id ? await buildExerciseRows(await resolveWorkoutItems(draft.strength_workout_id, week)) : [];

  let crossTraining: { name: string; summary: string }[] = [];
  if (draft?.cross_training_workout_id) {
    const resolved = await resolveWorkoutItems(draft.cross_training_workout_id, week);
    crossTraining = resolved
      .filter((r): r is Extract<Resolved, { kind: "cardio" }> => r.kind === "cardio")
      .map((r) => ({ name: r.cardio.name, summary: `${cardioModalityLabel(r.cardio.modality, r.cardio.modality_other)}, ${cardioPlainSummary(r.cardio)}` }));
  }

  return {
    clientFirstName: patient.first_name,
    brand,
    goal: draft?.header.goal || "Running programme",
    event: draft?.header.event ?? null,
    eventDate: draft?.header.event_date ?? null,
    weekGlance,
    prepExercises,
    upcomingRungs,
    strengthExercises,
    crossTraining,
    painLimit: patient.running_pain_limit,
    rules: draft?.rules ?? null,
  };
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10.5, fontFamily: "Helvetica", color: "#2A2A2A" },
  eyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#6B6B6B", marginBottom: 6 },
  title: { fontSize: 20, marginBottom: 10 },
  coverLine: { fontSize: 11, marginBottom: 3 },
  sectionHeading: { fontSize: 13, marginTop: 18, marginBottom: 8, paddingBottom: 4, borderBottomWidth: 1.5 },
  note: { fontSize: 9.5, color: "#6B6B6B", marginBottom: 8 },
  table: { width: "100%", borderWidth: 1, borderColor: "#D8D3C8" },
  tr: { flexDirection: "row" },
  th: { flex: 1, padding: 6, fontSize: 9.5, fontWeight: 700, borderRightWidth: 1, borderRightColor: "#D8D3C8", borderBottomWidth: 1, borderBottomColor: "#D8D3C8" },
  td: { flex: 1, padding: 6, fontSize: 9.5, borderRightWidth: 1, borderRightColor: "#D8D3C8", borderBottomWidth: 1, borderBottomColor: "#D8D3C8" },
  exerciseRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EDE9DE", paddingVertical: 8, alignItems: "center" },
  exerciseName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  exerciseMeta: { fontSize: 9.5, color: "#4A4A4A", marginBottom: 2 },
  qr: { width: 46, height: 46, marginLeft: 10 },
  rungCard: { borderWidth: 1, borderColor: "#D8D3C8", padding: 10, marginBottom: 10 },
  rungLabel: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  rungLine: { fontSize: 10, marginBottom: 3 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#8A8A8A" },
});

function ExerciseSection({ heading, note, rows }: { heading: string; note?: string; rows: ExerciseRowData[] }) {
  if (rows.length === 0) return null;
  return (
    <View wrap={false}>
      <Text style={styles.sectionHeading}>{heading}</Text>
      {note && <Text style={styles.note}>{note}</Text>}
      {rows.map((row, i) => (
        <View key={i} style={styles.exerciseRow}>
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
  );
}

export function PdfFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>Athena Physio. This plan was set for you personally by David and is not a substitute for medical advice.</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

// Shared with importedPlanPdf.tsx -- same styles, same footer, same
// "reuse the existing PDF download" instruction the Step 5 brief gave.
export { styles as pdfStyles };

function RunningPlanDocument({ data }: { data: PlanData }) {
  const accent = data.brand.isAllDefault ? "#9B1C1C" : data.brand.accent_color;
  const createdOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const headingStyle = { ...styles.sectionHeading, borderBottomColor: accent };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {!data.brand.isAllDefault && data.brand.wordmark_url ? (
          <Image src={data.brand.wordmark_url} style={{ height: 22, width: "auto", marginBottom: 14, objectFit: "contain" }} />
        ) : (
          <Text style={styles.eyebrow}>ATHENA PHYSIO</Text>
        )}
        <Text style={styles.title}>Your running plan</Text>
        <Text style={styles.coverLine}>{data.clientFirstName}</Text>
        <Text style={styles.coverLine}>
          {data.goal}
          {data.event ? `, ${data.event}` : ""}
          {data.eventDate ? `, ${data.eventDate}` : ""}
        </Text>
        <Text style={styles.coverLine}>Plan from Dr David Silver PhD</Text>
        <Text style={styles.note}>Created on {createdOn}. Your app always has the latest version of your plan.</Text>

        <Text style={headingStyle}>Your week at a glance</Text>
        <View style={styles.table}>
          {data.weekGlance.map((d, i) => (
            <View key={d.day} style={styles.tr}>
              <Text style={[styles.th, { flex: 0.6 }]}>{d.day}</Text>
              <Text style={[styles.td, { flex: 1, borderBottomWidth: i === data.weekGlance.length - 1 ? 0 : 1, borderRightWidth: 0 }]}>{d.label ?? "Rest"}</Text>
            </View>
          ))}
        </View>

        <ExerciseSection heading="Before every run" note="Scan a code to watch the video." rows={data.prepExercises} />

        {data.upcomingRungs.length > 0 && (
          <View>
            <Text style={headingStyle}>Your running sessions</Text>
            {data.upcomingRungs.map((r) => (
              <View key={r.label} style={styles.rungCard} wrap={false}>
                <Text style={styles.rungLabel}>{r.label}</Text>
                {r.fields.run_warmup_walk && <Text style={styles.rungLine}>Warm-up walk: {r.fields.run_warmup_walk}</Text>}
                <Text style={styles.rungLine}>{runPlainSummary(r.fields)}</Text>
                {r.fields.run_effort_cue && <Text style={styles.rungLine}>Cue: {r.fields.run_effort_cue}</Text>}
                {r.fields.run_surface && <Text style={styles.rungLine}>Surface: {r.fields.run_surface}</Text>}
                {r.fields.run_cooldown && <Text style={styles.rungLine}>Cool-down: {r.fields.run_cooldown}</Text>}
              </View>
            ))}
            <Text style={styles.note}>Only move on when your app (or David) tells you you're ready.</Text>
          </View>
        )}

        <ExerciseSection heading="Strength session" note="Scan a code to watch the video." rows={data.strengthExercises} />

        {data.crossTraining.length > 0 && (
          <View wrap={false}>
            <Text style={headingStyle}>Cross-training options</Text>
            {data.crossTraining.map((c, i) => (
              <Text key={i} style={styles.rungLine}>
                {c.name}: {c.summary}
              </Text>
            ))}
          </View>
        )}

        <View wrap={false}>
          <Text style={headingStyle}>How to know it's going well</Text>
          <Text style={styles.rungLine}>
            A little ache up to {data.painLimit} out of 10 is fine and normal while your body adapts.
          </Text>
          <Text style={styles.rungLine}>If it feels worse the next morning, repeat the same session rather than stepping up.</Text>
          {data.rules && (
            <Text style={styles.rungLine}>If you have a flare-up: {data.rules}</Text>
          )}
          <Text style={[styles.rungLine, { marginTop: 6 }]}>{SAFETY_LINE}</Text>
        </View>

        <PdfFooter />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={headingStyle}>Run log</Text>
        <Text style={styles.note}>Log your runs in the app when you can, so David can see how you're getting on.</Text>
        <View style={styles.table}>
          <View style={styles.tr}>
            <Text style={styles.th}>Date</Text>
            <Text style={styles.th}>Session</Text>
            <Text style={styles.th}>Finished?</Text>
            <Text style={styles.th}>Pain during (0-10)</Text>
            <Text style={styles.th}>Next morning</Text>
            <Text style={[styles.th, { borderRightWidth: 0 }]}>Notes</Text>
          </View>
          {Array.from({ length: 12 }).map((_, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22 }]}> </Text>
              <Text style={[styles.td, { minHeight: 22, borderRightWidth: 0 }]}> </Text>
            </View>
          ))}
        </View>
        <PdfFooter />
      </Page>
    </Document>
  );
}

export async function generateRunningPlanPdf(programmeId: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await gatherRunningPlanData(programmeId);
  if (!data) return null;

  const buffer = await renderToBuffer(<RunningPlanDocument data={data} />);
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeName = data.clientFirstName.replace(/[^a-zA-Z0-9]/g, "");
  const filename = `Athena_running_plan_${safeName}_${dateStr}.pdf`;

  // Marks "the plan as of right now has been downloaded" -- see
  // planChangedSincePdf below, which is how the "your plan has changed"
  // note on the programme page decides whether to show.
  await supabaseAdmin
    .from("running_programme_state")
    .update({ pdf_generated_at: new Date().toISOString() })
    .eq("programme_id", programmeId);

  return { buffer, filename };
}

// True only when a PDF was downloaded at least once AND the programme's
// rung has moved since -- never shown to a client who's never touched the
// PDF, and never shown for a plan that hasn't actually changed.
export async function planChangedSincePdf(programmeId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("running_programme_state")
    .select("updated_at, pdf_generated_at")
    .eq("programme_id", programmeId)
    .maybeSingle<{ updated_at: string; pdf_generated_at: string | null }>();
  if (!data || !data.pdf_generated_at) return false;
  return new Date(data.updated_at) > new Date(data.pdf_generated_at);
}
