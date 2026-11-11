import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendSafeguardingAlertEmail } from "@/lib/email";

// Raises a safeguarding alert: records it first, so it can never be lost,
// then emails the clinical team. The record stays on the clinic home page
// until a clinician marks it as reviewed, whether or not the email got
// through. Never throws.
export async function raiseSafeguardingAlert(patientId: string, formResponseId: string | null, formTitle: string | null): Promise<void> {
  const { data: alert, error } = await supabaseAdmin
    .from("safeguarding_alerts")
    .insert({ patient_id: patientId, form_response_id: formResponseId, form_title: formTitle })
    .select("id")
    .single<{ id: string }>();
  if (error) console.error("SAFEGUARDING ALERT RECORD FAILED", patientId, error.message);
  try {
    await sendSafeguardingAlertEmail(patientId);
    if (alert) await supabaseAdmin.from("safeguarding_alerts").update({ email_sent: true }).eq("id", alert.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("SAFEGUARDING ALERT EMAIL FAILED", patientId, message);
    if (alert) await supabaseAdmin.from("safeguarding_alerts").update({ email_error: message.slice(0, 500) }).eq("id", alert.id);
  }
}

export type OpenSafeguardingAlert = {
  id: string;
  patient_id: string;
  created_at: string;
  email_sent: boolean;
  form_title: string | null;
  patients: { first_name: string | null; last_name: string | null } | null;
};

export async function openSafeguardingAlerts(): Promise<OpenSafeguardingAlert[]> {
  const { data } = await supabaseAdmin
    .from("safeguarding_alerts")
    .select("id, patient_id, created_at, email_sent, form_title, patients(first_name, last_name)")
    .is("reviewed_at", null)
    .order("created_at", { ascending: false })
    .returns<OpenSafeguardingAlert[]>();
  return data ?? [];
}
