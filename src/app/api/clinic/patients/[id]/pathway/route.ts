import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { entryStage, validatePathway, type AthenaPathwayV1, type PathwayStage } from "@/lib/pathways";
import { spreadDays } from "@/lib/planToBuilder";
import type { SavedDraftState } from "@/app/clinic/programmes/ProgrammeBuilder";

// Builds a client's programme from a working diagnosis: an approved
// pathway and the client's presentation. The presentation decides the
// entry stage; all of that stage's drills, core first and then optional,
// become one workout belonging to this client only (David finds it far
// easier to remove an exercise than to add one, so pre-made plans always
// include more rather than fewer), scheduled for the sessions a week asked for, and the
// whole thing is saved as a draft under "Saved, not sent". Nothing reaches
// the client until David opens it in the builder and sends it.

type ExerciseRow = { exercise_id: string; name_clinical: string; default_sets: number | null; default_reps: number | null; active: boolean };

function ruleText(stage: PathwayStage, p: AthenaPathwayV1): string {
  const r = stage.progress_rule ?? p.progress_rule;
  return [r.load, r.completion, r.symptoms].filter(Boolean).join("; ");
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    pathway_id?: string;
    presentation?: string;
    weeks?: number;
    sessions_per_week?: number;
  };
  if (!body.pathway_id) return NextResponse.json({ error: "Choose a pathway first." }, { status: 400 });
  const weeks = Math.max(1, Math.min(12, Math.round(Number(body.weeks) || 4)));
  const perWeek = Math.max(1, Math.min(7, Math.round(Number(body.sessions_per_week) || 3)));

  const [{ data: patient }, { data: row }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, email")
      .eq("id", patientId)
      .maybeSingle<{ id: string; first_name: string; last_name: string | null; email: string }>(),
    supabaseAdmin
      .from("pathways")
      .select("id, status, definition")
      .eq("id", body.pathway_id)
      .maybeSingle<{ id: string; status: string; definition: unknown }>(),
  ]);
  if (!patient) return NextResponse.json({ error: "That client could not be found." }, { status: 404 });
  if (!row) return NextResponse.json({ error: "That pathway could not be found." }, { status: 404 });
  if (row.status !== "approved") return NextResponse.json({ error: "Approve this pathway in the Vault before building from it." }, { status: 400 });

  const checked = validatePathway(row.definition);
  if (!checked.valid) return NextResponse.json({ error: `The pathway needs fixing first: ${checked.errors.join(" ")}` }, { status: 400 });
  const p = checked.pathway;
  const presentation = body.presentation?.trim() ?? "";
  const stage = entryStage(p, presentation);
  if (!stage) return NextResponse.json({ error: "This pathway has no stages." }, { status: 400 });
  const stageNumber = p.stages.indexOf(stage) + 1;

  // Every drill becomes one exercise, using its first linked library
  // exercise: core drills first, then optional ones for David to keep or
  // remove. Drills with no library exercise yet are listed in the
  // clinician notes, since they can't be placed.
  const wanted = Array.from(new Set(stage.drills.flatMap((d) => d.exercise_ids)));
  const { data: exRows } = wanted.length
    ? await supabaseAdmin
        .from("exercises")
        .select("exercise_id, name_clinical, default_sets, default_reps, active")
        .in("exercise_id", wanted)
        .returns<ExerciseRow[]>()
    : { data: [] as ExerciseRow[] };
  const library = new Map((exRows ?? []).filter((e) => e.active).map((e) => [e.exercise_id, e]));

  const placed: { drill: string; exercise: ExerciseRow; optional: boolean }[] = [];
  const unlinked: string[] = [];
  const ordered = [...stage.drills.filter((x) => x.role === "core"), ...stage.drills.filter((x) => x.role === "optional")];
  for (const d of ordered) {
    const ex = d.exercise_ids.map((x) => library.get(x)).find(Boolean);
    if (ex && !placed.some((x) => x.exercise.exercise_id === ex.exercise_id)) placed.push({ drill: d.name, exercise: ex, optional: d.role === "optional" });
    else if (!ex) unlinked.push(d.name);
  }
  const optional = placed.filter((x) => x.optional).map((x) => `${x.drill} (${x.exercise.exercise_id})`);

  const programmeId = crypto.randomUUID();
  const workoutId = crypto.randomUUID();
  const workoutName = `${p.name}: Stage ${stageNumber}, ${stage.title}`;

  const { error: workoutError } = await supabaseAdmin
    .from("workouts")
    .insert({ id: workoutId, name: workoutName, programme_id: programmeId, kind: "standard" });
  if (workoutError) return NextResponse.json({ error: workoutError.message }, { status: 500 });

  if (placed.length > 0) {
    const items = placed.map((x, i) => ({
      workout_id: workoutId,
      item_order: i + 1,
      slot_type: "main_body",
      exercise_id: x.exercise.exercise_id,
      sets: x.exercise.default_sets ?? 2,
      reps: x.exercise.default_reps ?? 8,
      rationale: stage.rationale || null,
      prescription_mode: "reps_and_sets",
      is_run_block: false,
    }));
    const { error: itemsError } = await supabaseAdmin.from("workout_items").insert(items);
    if (itemsError) {
      await supabaseAdmin.from("workouts").delete().eq("id", workoutId);
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }
  }

  const notes = [
    `Built from the ${p.name} pathway${presentation ? ` for a "${presentation}" presentation` : ""}, starting at Stage ${stageNumber}: ${stage.title}.`,
    `Move on when: ${ruleText(stage, p)}.`,
    p.flare_up ? `If a flare-up: ${[p.flare_up.trigger, p.flare_up.action, p.flare_up.return].filter(Boolean).join("; ")}.` : "",
    optional.length ? `Included as optional, remove any that don't suit this client: ${optional.join("; ")}.` : "",
    unlinked.length ? `Drills with no library exercise yet, to add by hand: ${unlinked.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const days = spreadDays([], perWeek).sort((a, b) => a - b);
  const state: SavedDraftState = {
    patient: { id: patient.id, first_name: patient.first_name, last_name: patient.last_name, email: patient.email },
    title: `${p.name}: ${stage.title}`,
    blockLengthWeeks: weeks,
    accessWindowWeeks: 6,
    startDate: new Date().toISOString().slice(0, 10),
    restDays: [],
    intro: "",
    planRules: {
      move_on: ruleText(stage, p),
      flare: p.flare_up ? [p.flare_up.action, p.flare_up.return].filter(Boolean).join(" ") : "",
    },
    weekLabels: {},
    audioUrl: null,
    assignments: [{ key: `pathway-${workoutId}`, workout_id: workoutId, workout_name: workoutName, days, week: null, kind: "standard" }],
    deliveryMode: "scheduled",
    notes,
    sourceTemplateId: null,
    isUnder18Template: false,
  };

  const { error: draftError } = await supabaseAdmin
    .from("programme_drafts")
    .insert({ id: programmeId, patient_id: patient.id, title: state.title, state });
  if (draftError) {
    await supabaseAdmin.from("workouts").delete().eq("id", workoutId);
    return NextResponse.json({ error: draftError.message }, { status: 500 });
  }

  const { data: assignment } = await supabaseAdmin
    .from("pathway_assignments")
    .insert({ patient_id: patient.id, pathway_id: row.id, presentation, current_stage: stage.id, programme_id: programmeId })
    .select("id")
    .single<{ id: string }>();
  if (assignment) {
    await supabaseAdmin.from("pathway_decision_log").insert({
      assignment_id: assignment.id,
      kind: "build",
      suggested: { stage: stage.id, exercises: placed.map((x) => x.exercise.exercise_id), optional, unlinked, weeks, sessions_per_week: perWeek },
    });
  }

  return NextResponse.json({
    draft_id: programmeId,
    url: `/clinic/programmes/new?patient=${patient.id}&saved=${programmeId}`,
    placed: placed.length,
    unlinked,
  });
}
