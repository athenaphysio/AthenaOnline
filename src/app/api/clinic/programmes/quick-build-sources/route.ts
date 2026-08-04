import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TemplateRow = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  delivery_mode: "scheduled" | "open";
};
type ProgrammeRow = {
  id: string;
  title: string;
  block_length_weeks: number;
  patient_first_name: string;
  delivery_mode: "scheduled" | "open";
};

// No dedicated "focus area" field exists on either table -- rather than add
// one (a schema change plus a new input to fill in on every future
// programme/template), this derives it from the title/name text, which
// already carries it in practice (e.g. "Return to Running - Week 1"). Takes
// everything before the first " — " / " - " / " : ", falling back to the
// full title when there's no such delimiter.
function deriveFocusArea(text: string): string {
  const idx = text.search(/\s[—\-:]\s/);
  return (idx === -1 ? text : text.slice(0, idx)).trim();
}

// Combined list for the Quick Build picker -- everything a new programme
// could start from: saved templates and past clients' programmes.
export async function GET() {
  const [{ data: templates, error: templatesError }, { data: programmes, error: programmesError }] =
    await Promise.all([
      supabaseAdmin
        .from("programme_templates")
        .select("id, name, block_length_weeks, is_under_18, delivery_mode")
        .order("name")
        .returns<TemplateRow[]>(),
      supabaseAdmin
        .from("programmes")
        .select("id, title, block_length_weeks, patient_first_name, delivery_mode")
        .order("created_at", { ascending: false })
        .returns<ProgrammeRow[]>(),
    ]);

  if (templatesError) {
    return NextResponse.json({ error: templatesError.message }, { status: 500 });
  }
  if (programmesError) {
    return NextResponse.json({ error: programmesError.message }, { status: 500 });
  }

  return NextResponse.json({
    templates: (templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      block_length_weeks: t.block_length_weeks,
      is_under_18: t.is_under_18,
      delivery_mode: t.delivery_mode,
      focus_area: deriveFocusArea(t.name),
    })),
    programmes: (programmes ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      block_length_weeks: p.block_length_weeks,
      patient_first_name: p.patient_first_name,
      delivery_mode: p.delivery_mode,
      focus_area: deriveFocusArea(p.title),
    })),
  });
}
