import "server-only";
import { supabase } from "@/lib/supabase";

export type LibraryExercise = {
  exercise_id: string;
  name_clinical: string;
  body_site: string | null;
  target_muscles: string | null;
  nature: string | null;
  movement_pattern: string | null;
  rehab_stage: string | null;
  primary_aim: string | null;
  equipment: string | null;
  position: string | null;
  difficulty: string | null;
  default_dosage_text: string | null;
  progression: string | null;
  regression: string | null;
  condition_use_case: string | null;
  contraindication_flags: string | null;
};

export async function fetchExerciseLibrary(): Promise<LibraryExercise[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "exercise_id, name_clinical, body_site, target_muscles, nature, movement_pattern, rehab_stage, primary_aim, equipment, position, difficulty, default_dosage_text, progression, regression, condition_use_case, contraindication_flags"
    )
    .eq("active", true)
    .order("exercise_id");

  if (error || !data) return [];
  return data;
}

// One compact line per exercise (id + attributes) rather than verbose JSON,
// to keep the library affordable in every prompt.
export function formatLibraryForPrompt(exercises: LibraryExercise[]): string {
  return exercises
    .map((e) => {
      const fields = [
        `id=${e.exercise_id}`,
        `name=${e.name_clinical}`,
        e.body_site && `body_site=${e.body_site}`,
        e.target_muscles && `muscles=${e.target_muscles}`,
        e.nature && `nature=${e.nature}`,
        e.movement_pattern && `pattern=${e.movement_pattern}`,
        e.rehab_stage && `stage=${e.rehab_stage}`,
        e.primary_aim && `aim=${e.primary_aim}`,
        e.equipment && `equipment=${e.equipment}`,
        e.position && `position=${e.position}`,
        e.difficulty && `difficulty=${e.difficulty}`,
        e.default_dosage_text && `default_dosage=${e.default_dosage_text}`,
        e.progression && `progression=${e.progression}`,
        e.regression && `regression=${e.regression}`,
        e.condition_use_case && `use_case=${e.condition_use_case}`,
        e.contraindication_flags && `contraindications=${e.contraindication_flags}`,
      ].filter(Boolean);
      return fields.join(" | ");
    })
    .join("\n");
}
