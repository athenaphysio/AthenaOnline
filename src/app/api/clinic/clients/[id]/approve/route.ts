import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { applyRegistration, findOpenRegistration } from "@/lib/registrations";
import { findBuilderForm, patientBrandPackId, sendFormToPatients } from "@/lib/sendForm";
import { fileHeldLinkIntakes, hasAnsweredIntake } from "@/lib/linkIntake";
import { sendClientApprovedEmail } from "@/lib/email";

// Approve does the whole job in one press: opens the client's app, copies
// across their sign-up form if they filled one in with the same email, and,
// for a remote client, sends the Programme intake form straight away. Their
// brand is already set from the link they signed up through.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { route?: "remote" | "one_to_one" };

  const { data: patient, error: fetchError } = await supabaseAdmin
    .from("patients")
    .select("id, email, photo_path, first_name, awaiting_approval")
    .eq("id", id)
    .maybeSingle<{ id: string; email: string | null; photo_path: string | null; first_name: string | null; awaiting_approval: boolean }>();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!patient) return NextResponse.json({ error: "Client not found." }, { status: 404 });

  const { error } = await supabaseAdmin.from("patients").update({ awaiting_approval: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const done: string[] = ["Approved"];

  if (patient.email) {
    const registration = await findOpenRegistration(patient.email);
    if (registration) {
      const applyError = await applyRegistration(registration, patient);
      done.push(applyError ? "their sign-up form could not be copied across" : "sign-up form copied across");
    }
  }

  // An intake form they filled in from a link before being approved.
  if (patient.email && (await fileHeldLinkIntakes(patient.id, patient.email)) > 0) {
    done.push("their intake form answers filed");
  }

  if (body.route === "remote" && (await hasAnsweredIntake(id))) {
    await supabaseAdmin.from("patients").update({ intake_form_enabled: true }).eq("id", id);
    done.push("intake form already filled in, so no new one sent");
  } else if (body.route === "remote") {
    const form = await findBuilderForm("intake", await patientBrandPackId(id));
    if (form) {
      await supabaseAdmin.from("patients").update({ intake_form_enabled: true }).eq("id", id);
      await sendFormToPatients(form.id, form.title, [id]);
      done.push("intake form sent");
    } else {
      done.push("intake form not sent, as it is not in your Forms library yet");
    }
  } else if (body.route === "one_to_one") {
    done.push("book their consultation in Setmore");
  }

  // Tell the client their app is open. Only on the first approval, and a
  // failed send never undoes the approval itself.
  if (patient.awaiting_approval && patient.email) {
    try {
      const sent = await sendClientApprovedEmail(id, patient.email, patient.first_name?.trim() || "there");
      done.push(sent.sent ? "welcome email sent" : "welcome email not sent, as its template is not approved");
    } catch (err) {
      console.error("approved welcome email failed", err);
      done.push("welcome email could not be sent");
    }
  }

  return NextResponse.json({ ok: true, note: done.join(", ") + "." });
}
