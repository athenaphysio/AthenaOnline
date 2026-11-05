import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logCommunications } from "@/lib/communications";
import { builderFormForTitle, type BuilderFormKind } from "@/lib/builderForms";

// Sends one form to one or more clients: a send each, an in-app
// notification that opens it, and a line in their communications.
// Returns the number sent. Used by Send form, Approve and the automatic
// Quick update.
export async function sendFormToPatients(formId: string, formTitle: string, patientIds: string[]): Promise<number> {
  if (patientIds.length === 0) return 0;
  const { data: sends, error: sendsError } = await supabaseAdmin
    .from("form_sends")
    .insert(patientIds.map((pid) => ({ form_id: formId, patient_id: pid })))
    .select("id, patient_id")
    .returns<{ id: string; patient_id: string }[]>();
  if (sendsError) throw new Error(sendsError.message);

  // Best-effort: a missing notification never blocks the send itself; the
  // form still shows up next time the client opens the app.
  const notificationTitle = "David sent you a form";
  const notificationBody = `"${formTitle}" is ready for you to fill in.`;
  const { error: notifyError } = await supabaseAdmin.from("notifications").insert(
    (sends ?? []).map((send) => ({
      patient_id: send.patient_id,
      type: "form_sent",
      title: notificationTitle,
      body: notificationBody,
      link: `/forms/${send.id}`,
    }))
  );
  if (notifyError) console.error("form-sent notification failed", notifyError.message);

  await logCommunications(
    patientIds.map((pid) => ({ patientId: pid, channel: "in_app" as const, type: "form_sent", title: notificationTitle, body: notificationBody }))
  );
  return patientIds.length;
}

// The library form for the Programme intake or the Quick update, if it has
// been added to the Forms library.
export async function findBuilderForm(kind: BuilderFormKind): Promise<{ id: string; title: string } | null> {
  const { data } = await supabaseAdmin.from("forms").select("id, title").returns<{ id: string; title: string }[]>();
  return (data ?? []).find((f) => builderFormForTitle(f.title)?.kind === kind) ?? null;
}
