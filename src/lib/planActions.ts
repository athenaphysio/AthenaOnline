import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// "Repeat this week" -- plain, or via the flare button (same mechanism,
// different tag for the clinic's activity view and David's copy-log).
// Pushes the whole rest of the plan back by 7 days rather than touching
// any specific week's content, so nothing in raw_json ever changes.
export async function repeatPlanWeek(importedPlanId: string, patientId: string, weekNumber: number, kind: "repeat_week" | "flare_up"): Promise<void> {
  const { data: plan } = await supabaseAdmin
    .from("imported_plans")
    .select("effective_start_date")
    .eq("id", importedPlanId)
    .maybeSingle<{ effective_start_date: string }>();
  if (!plan) throw new Error("Plan not found.");

  const next = new Date(plan.effective_start_date);
  next.setDate(next.getDate() + 7);

  const { error: updateError } = await supabaseAdmin
    .from("imported_plans")
    .update({ effective_start_date: next.toISOString().slice(0, 10) })
    .eq("id", importedPlanId);
  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabaseAdmin.from("plan_events").insert({
    imported_plan_id: importedPlanId,
    patient_id: patientId,
    kind,
    week_number: weekNumber,
  });
  if (eventError) throw new Error(eventError.message);
}
