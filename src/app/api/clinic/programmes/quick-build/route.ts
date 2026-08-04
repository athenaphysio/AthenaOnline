import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deepCopyAssignments } from "@/lib/copyProgrammeContent";

type TemplateSource = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  delivery_mode: "scheduled" | "open";
  programme_template_workouts: { workout_id: string; day_of_week: number | null }[];
};

type ProgrammeSource = {
  id: string;
  title: string;
  block_length_weeks: number;
  patient_first_name: string;
  delivery_mode: "scheduled" | "open";
  programme_workouts: { workout_id: string; day_of_week: number | null }[];
};

// Runs the real deep copy behind the Quick Build picker (and, via the
// ?source= links on the templates/programmes list pages, the old "Use this
// template" / "Duplicate & retitle" entry points too) -- see
// copyProgrammeContent.ts for why the copy has to be real rows, not shared
// references, and why that has to happen here rather than on page load.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const sourceType = body?.source_type;
  const sourceId = body?.source_id;

  if (sourceType !== "template" && sourceType !== "programme") {
    return NextResponse.json({ error: "source_type must be 'template' or 'programme'." }, { status: 400 });
  }
  if (typeof sourceId !== "string" || !sourceId) {
    return NextResponse.json({ error: "source_id is required." }, { status: 400 });
  }

  try {
    if (sourceType === "template") {
      const { data: template, error } = await supabaseAdmin
        .from("programme_templates")
        .select(
          "id, name, block_length_weeks, is_under_18, delivery_mode, programme_template_workouts(workout_id, day_of_week)"
        )
        .eq("id", sourceId)
        .maybeSingle<TemplateSource>();
      if (error) throw new Error(error.message);
      if (!template) {
        return NextResponse.json({ error: "Template not found." }, { status: 404 });
      }

      const assignments = await deepCopyAssignments(template.programme_template_workouts);

      return NextResponse.json({
        programmeId: crypto.randomUUID(),
        title: template.name,
        blockLengthWeeks: template.block_length_weeks,
        isUnder18Template: template.is_under_18,
        sourceTemplateId: template.id,
        deliveryMode: template.delivery_mode,
        assignments,
        copyNotice: null,
      });
    }

    const { data: programme, error } = await supabaseAdmin
      .from("programmes")
      .select(
        "id, title, block_length_weeks, patient_first_name, delivery_mode, programme_workouts(workout_id, day_of_week)"
      )
      .eq("id", sourceId)
      .maybeSingle<ProgrammeSource>();
    if (error) throw new Error(error.message);
    if (!programme) {
      return NextResponse.json({ error: "Programme not found." }, { status: 404 });
    }

    const assignments = await deepCopyAssignments(programme.programme_workouts);

    return NextResponse.json({
      programmeId: crypto.randomUUID(),
      title: programme.title,
      blockLengthWeeks: programme.block_length_weeks,
      // Under-18 status is deliberately template-only in this app (see
      // 0018_under_18_programmes.sql) -- a past programme's own participant
      // data is never carried over, not reinterpreted as a new flag.
      isUnder18Template: false,
      sourceTemplateId: null,
      deliveryMode: programme.delivery_mode,
      assignments,
      copyNotice: `Copied from ${programme.patient_first_name}'s programme — review the intro line and check for anything personal to them before sending.`,
    });
  } catch (err) {
    console.error("quick build copy failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Copy failed: ${detail}` }, { status: 500 });
  }
}
