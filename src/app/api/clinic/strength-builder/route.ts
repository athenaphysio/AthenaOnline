import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildStrength,
  readStrengthBrief,
  type LibrarySession,
  type OtherCard,
  type PlanSlot,
} from "@/lib/strengthBuilder";

type Body = {
  patient_id?: string;
  slots?: PlanSlot[];
  others?: OtherCard[];
  weeks?: number;
  /** David pressed "Build strength" himself, so build even when the client's switch is off. */
  force?: boolean;
};

type WorkoutRow = {
  id: string;
  name: string;
  high_load: boolean | null;
  kind: string | null;
  designations: string[] | null;
  workout_items: { block_id: string | null }[];
};

// Works out the strength for a plan that has just opened in the builder.
// Returns which library session goes on which day; the builder then places
// each one as the client's own copy, exactly as if David had picked it.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const { patient_id, force } = body;
  const slots = Array.isArray(body.slots) ? body.slots : [];
  const others = Array.isArray(body.others) ? body.others : [];
  const weeks = Number.isInteger(body.weeks) && (body.weeks as number) > 0 ? (body.weeks as number) : 1;
  if (!patient_id) return NextResponse.json({ error: "Choose a client first." }, { status: 400 });

  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("first_name, auto_strength")
    .eq("id", patient_id)
    .maybeSingle<{ first_name: string; auto_strength: boolean | null }>();
  if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 });
  if (!patient) return NextResponse.json({ error: "That client no longer exists." }, { status: 404 });

  if (patient.auto_strength === false && !force) {
    return NextResponse.json({ built: false, reason: "off", firstName: patient.first_name });
  }

  const { data: entries, error: entriesError } = await supabaseAdmin
    .from("client_context_entries")
    .select("summary_text, notes_text")
    .eq("patient_id", patient_id)
    .returns<{ summary_text: string | null; notes_text: string | null }[]>();
  if (entriesError) return NextResponse.json({ error: entriesError.message }, { status: 500 });
  const texts = (entries ?? []).flatMap((e) => [e.summary_text ?? "", e.notes_text ?? ""]).filter(Boolean);
  const brief = readStrengthBrief(texts);

  // A plan from Claude with strength slots in it counts as strength having
  // come up, even if the notes themselves never say so.
  if (!brief.discussed && slots.length === 0 && !force) {
    return NextResponse.json({ built: false, reason: "not_discussed", firstName: patient.first_name });
  }

  const { data: workouts, error: workoutsError } = await supabaseAdmin
    .from("workouts")
    .select("id, name, high_load, kind, designations, workout_items(block_id)")
    .is("programme_id", null)
    .returns<WorkoutRow[]>();
  if (workoutsError) return NextResponse.json({ error: workoutsError.message }, { status: 500 });

  const blockIds = Array.from(new Set((workouts ?? []).flatMap((w) => w.workout_items.map((i) => i.block_id).filter((b): b is string => Boolean(b)))));
  const tagsByBlock = new Map<string, string[]>();
  const typeByBlock = new Map<string, string>();
  if (blockIds.length > 0) {
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from("blocks")
      .select("id, type, block_usage_tag_links(block_usage_tags(name))")
      .in("id", blockIds)
      .returns<{ id: string; type: string; block_usage_tag_links: { block_usage_tags: { name: string } | null }[] }[]>();
    if (blocksError) return NextResponse.json({ error: blocksError.message }, { status: 500 });
    for (const b of blocks ?? []) {
      typeByBlock.set(b.id, b.type);
      tagsByBlock.set(b.id, b.block_usage_tag_links.map((l) => l.block_usage_tags?.name).filter((n): n is string => Boolean(n)));
    }
  }

  const library: LibrarySession[] = (workouts ?? []).map((w) => {
    const ids = Array.from(new Set(w.workout_items.map((i) => i.block_id).filter((b): b is string => Boolean(b))));
    const tags = ids.flatMap((id) => {
      const t = tagsByBlock.get(id) ?? [];
      return typeByBlock.get(id) === "main_body" ? [...t, ...t] : t;
    });
    return {
      id: w.id,
      name: w.name,
      high_load: Boolean(w.high_load),
      kind: w.kind,
      designations: w.designations ?? [],
      tags,
      blockIds: ids,
    };
  });

  const result = buildStrength(brief, library, slots, others, weeks);

  return NextResponse.json({
    built: result.placements.length > 0,
    reason: result.placements.length > 0 ? "built" : "nothing_fits",
    firstName: patient.first_name,
    brief,
    choices: result.choices,
    notes: result.notes,
    placements: result.placements.map((p) => ({
      slotKey: p.slotKey,
      week: p.week,
      day: p.day,
      region: p.region,
      workout: { id: p.session.id, name: p.session.name, high_load: p.session.high_load, kind: p.session.kind ?? "standard" },
    })),
  });
}
