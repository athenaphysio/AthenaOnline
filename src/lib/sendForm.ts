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
// been added to the Forms library. A pack with its own version of a form
// (Regenerate's intake) gets that version, so pass the client's brand pack
// where there is one; everyone else gets the standard form.
export async function findBuilderForm(
  kind: BuilderFormKind,
  brandPackId?: string | null
): Promise<{ id: string; title: string } | null> {
  const [{ data }, { data: pack }] = await Promise.all([
    supabaseAdmin.from("forms").select("id, title").returns<{ id: string; title: string }[]>(),
    brandPackId
      ? supabaseAdmin.from("brand_packs").select("name").eq("id", brandPackId).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null as { name: string } | null }),
  ]);
  const forms = (data ?? []).map((f) => ({ ...f, def: builderFormForTitle(f.title) })).filter((f) => f.def?.kind === kind);
  const packName = pack?.name.trim().toLowerCase();
  const own = packName ? forms.find((f) => f.def?.brandPackName?.toLowerCase() === packName) : undefined;
  const chosen = own ?? forms.find((f) => !f.def?.brandPackName);
  return chosen ? { id: chosen.id, title: chosen.title } : null;
}

// The brand pack a client is on, for choosing their version of a form.
export async function patientBrandPackId(patientId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("patients").select("brand_pack_id").eq("id", patientId).maybeSingle<{ brand_pack_id: string | null }>();
  return data?.brand_pack_id ?? null;
}
