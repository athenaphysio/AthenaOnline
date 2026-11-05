import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { applyRegistration, findOpenRegistration } from "@/lib/registrations";
import { findBuilderForm, sendFormToPatients } from "@/lib/sendForm";

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
    .select("id, email, photo_path")
    .eq("id", id)
    .maybeSingle<{ id: string; email: string | null; photo_path: string | null }>();
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

  if (body.route === "remote") {
    const form = await findBuilderForm("intake");
    if (form) {
      await sendFormToPatients(form.id, form.title, [id]);
      done.push("intake form sent");
    } else {
      done.push("intake form not sent, as it is not in your Forms library yet");
    }
  } else if (body.route === "one_to_one") {
    done.push("book their consultation in Setmore");
  }

  return NextResponse.json({ ok: true, note: done.join(", ") + "." });
}
