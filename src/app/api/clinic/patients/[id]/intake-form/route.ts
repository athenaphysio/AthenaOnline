import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { builderFormForTitle } from "@/lib/builderForms";
import { findBuilderForm, patientBrandPackId, sendFormToPatients } from "@/lib/sendForm";
import { hasAnsweredIntake } from "@/lib/linkIntake";

// Switches the Programme intake form on or off for one client. Off means the
// form is hidden from their home screen. On makes sure there is an intake
// form waiting for them, sending one if they have none left to fill in.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { enabled } = (await request.json()) as { enabled?: boolean };
  if (typeof enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });

  const { error } = await supabaseAdmin.from("patients").update({ intake_form_enabled: enabled }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = false;
  if (enabled) {
    const [{ data: sends }, { data: responses }] = await Promise.all([
      supabaseAdmin
        .from("form_sends")
        .select("id, forms(title)")
        .eq("patient_id", id)
        .returns<{ id: string; forms: { title: string } | null }[]>(),
      supabaseAdmin.from("form_responses").select("form_send_id").eq("patient_id", id).returns<{ form_send_id: string }[]>(),
    ]);
    const answered = new Set((responses ?? []).map((r) => r.form_send_id));
    const waiting = (sends ?? []).some(
      (s) => !answered.has(s.id) && s.forms && builderFormForTitle(s.forms.title)?.kind === "intake"
    );
    // A client who has already answered it (in the app or from a link) is
    // not sent a second blank one.
    if (!waiting && !(await hasAnsweredIntake(id))) {
      const form = await findBuilderForm("intake", await patientBrandPackId(id));
      if (form) {
        await sendFormToPatients(form.id, form.title, [id]);
        sent = true;
      }
    }
  }

  return NextResponse.json({ id, enabled, sent });
}
