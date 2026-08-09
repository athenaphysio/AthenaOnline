import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SLOT_TYPES } from "@/lib/slotTypes";

const VALID_CATEGORIES = new Set(SLOT_TYPES.map((t) => t.value));

export type ExerciseFields = {
  name_clinical: string;
  default_category: string | null;
  default_dosage_text: string | null;
  cues_notes: string | null;
  vimeo_url: string | null;
};

export function parseExerciseFields(body: unknown): ExerciseFields | { error: string } {
  const b = body as Record<string, unknown>;
  const name = typeof b.name_clinical === "string" ? b.name_clinical.trim() : "";
  if (!name) return { error: "Exercise name is required." };

  const category = typeof b.default_category === "string" ? b.default_category.trim() : "";
  if (category && !VALID_CATEGORIES.has(category as never)) {
    return { error: "Unrecognised category." };
  }

  return {
    name_clinical: name,
    default_category: category || null,
    default_dosage_text: typeof b.default_dosage_text === "string" ? b.default_dosage_text.trim() || null : null,
    cues_notes: typeof b.cues_notes === "string" ? b.cues_notes.trim() || null : null,
    vimeo_url: typeof b.vimeo_url === "string" ? b.vimeo_url.trim() || null : null,
  };
}

// Continues the real EX-001... sequence -- checks the actual highest stable
// ID in the table rather than assuming a fixed count, since the library
// keeps growing as incomplete rows get finished and new ones get added.
export async function nextExerciseId(): Promise<string> {
  const { data, error } = await supabaseAdmin.from("exercises").select("exercise_id");
  if (error) throw new Error(error.message);

  let max = 0;
  for (const row of data ?? []) {
    const match = /^EX-(\d+)$/.exec(row.exercise_id);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }

  const next = max + 1;
  const digits = Math.max(3, String(next).length);
  return `EX-${String(next).padStart(digits, "0")}`;
}
