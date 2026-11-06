import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { formatBuilderFormAnswers, type BuilderFormDefinition } from "@/lib/builderForms";

function formatUkDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Saves a Programme Builder form's answers to the client's background
// (Client profile), so "Copy for Programme Builder" picks them up alongside
// the Twofold notes. Used for forms answered in the app and from a link.
export async function saveBuilderAnswersToBackground(
  def: BuilderFormDefinition,
  patientId: string,
  rows: { answer_text: string | null; prompt_snapshot: string | null; question_order_snapshot: number | null }[],
  submittedOn: string = new Date().toISOString().slice(0, 10)
): Promise<void> {
  const answers = [...rows]
    .sort((a, b) => (a.question_order_snapshot ?? 0) - (b.question_order_snapshot ?? 0))
    .map((r) => ({ prompt: r.prompt_snapshot ?? "", answer: r.answer_text ?? "" }));
  const text = formatBuilderFormAnswers(def, answers, formatUkDate(submittedOn));

  const { error } = await supabaseAdmin.from("client_context_entries").insert({
    patient_id: patientId,
    timepoint: def.kind === "intake" ? "baseline" : "review",
    consulted_on: submittedOn,
    summary_text: text,
    notes_text: null,
  });
  if (error) throw new Error(error.message);
}
