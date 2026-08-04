import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// The single "unassign" mechanism -- removes active access to a programme
// without deleting the programme row or any of its content (blocks,
// workouts, exercises, completion history all stay exactly as they were).
// A paused programme simply stops being returned to the patient's own
// session pages, same as it would if nothing had ever been assigned.
//
// Called from two places: the clinician's own manual pause/resume action
// on the patient record, and automatically the moment a patient's
// membership lapses (Stripe webhook, or the daily prepay-expiry sweep).
export async function pauseProgrammeAccess(programmeId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("programmes")
    .update({ access_paused_at: new Date().toISOString() })
    .eq("id", programmeId);
  if (error) throw new Error(error.message);
}

export async function resumeProgrammeAccess(programmeId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("programmes").update({ access_paused_at: null }).eq("id", programmeId);
  if (error) throw new Error(error.message);
}

// A lapsing membership only ever touches programmes whose access genuinely
// depends on that membership -- "owned" (a shop purchase, free or paid) and
// "clinician_assigned" (Quick Assign, or anything given directly with no
// payment involved) are never affected by any membership lapsing, ever;
// only a manual unassign removes those. This is the fix for the bug where
// an unrelated lapsed membership could previously pause a programme with
// no connection to it at all.
export async function pauseSubscriptionGatedProgrammesForPatient(patientId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("programmes")
    .update({ access_paused_at: new Date().toISOString() })
    .eq("patient_id", patientId)
    .eq("source", "subscription_gated")
    .is("access_paused_at", null);
  if (error) throw new Error(error.message);
}
