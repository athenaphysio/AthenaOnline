import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findBuilderForm } from "@/lib/sendForm";
import { builderFormForTitle } from "@/lib/builderForms";
import { isPackId } from "@/lib/brandApp";
import { sendLinkIntakeAlertEmail } from "@/lib/email";
import { fileLinkIntake, findPatientIdByEmail, type LinkAnswer, type LinkIntakeSubmission } from "@/lib/linkIntake";

type Body = {
  first_name?: string;
  last_name?: string;
  email?: string;
  brand?: string | null;
  form_id?: string;
  after_registration?: boolean;
  answers?: { question_id: string; answer_text: string }[];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The Programme intake form from a link (/intake): public, with no login.
// The answers are stored first, then filed straight into the client's record
// if their email matches a client already in the app. Otherwise they are held
// until their registration is confirmed (see src/lib/linkIntake.ts).
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body;
  const firstName = body.first_name?.trim() ?? "";
  const lastName = body.last_name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "Please give your first name, last name and email." }, { status: 400 });
  }
  if (!EMAIL.test(email)) {
    return NextResponse.json({ error: "That email address does not look quite right." }, { status: 400 });
  }
  if (!Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json({ error: "Please answer the questions before sending." }, { status: 400 });
  }

  // The version of the intake form the page showed (standard, or the pack's
  // own), checked to be an intake form; otherwise the pack's version.
  const brandPackId = typeof body.brand === "string" && isPackId(body.brand) ? body.brand : null;
  let form: { id: string; title: string } | null = null;
  if (typeof body.form_id === "string") {
    const { data: shown } = await supabaseAdmin.from("forms").select("id, title").eq("id", body.form_id).maybeSingle<{ id: string; title: string }>();
    if (shown && builderFormForTitle(shown.title)?.kind === "intake") form = shown;
  }
  form ??= await findBuilderForm("intake", brandPackId);
  if (!form) return NextResponse.json({ error: "This form is not available at the moment." }, { status: 404 });

  // Only answers to the form's own questions are kept, each with the
  // wording it had when it was answered.
  const { data: questions } = await supabaseAdmin
    .from("form_questions")
    .select("id, prompt, question_order, required")
    .eq("form_id", form.id)
    .returns<{ id: string; prompt: string; question_order: number; required: boolean }[]>();
  const byId = new Map((questions ?? []).map((q) => [q.id, q]));
  const answers: LinkAnswer[] = body.answers
    .filter((a) => byId.has(a.question_id) && typeof a.answer_text === "string" && a.answer_text.trim())
    .map((a) => {
      const q = byId.get(a.question_id)!;
      return { question_id: q.id, prompt: q.prompt, question_order: q.question_order, answer: a.answer_text.trim().slice(0, 5000) };
    })
    .sort((a, b) => a.question_order - b.question_order);
  const missing = (questions ?? []).some((q) => q.required && !answers.some((a) => a.question_id === q.id));
  if (missing) return NextResponse.json({ error: "Please answer every question that is not marked optional." }, { status: 400 });

  const { data: submission, error } = await supabaseAdmin
    .from("link_intake_submissions")
    .insert({
      brand_pack_id: brandPackId,
      form_id: form.id,
      first_name: firstName,
      last_name: lastName,
      email,
      answers,
      after_registration: !!body.after_registration,
    })
    .select("id, created_at, first_name, last_name, email, answers, patient_id, filed_at, form_id")
    .single<LinkIntakeSubmission>();
  if (error) {
    console.error("link intake not stored", error.message);
    return NextResponse.json({ error: "Your answers could not be sent. Please try again." }, { status: 500 });
  }

  // Filed now if they are already in the app. The answers are safe either
  // way, so a problem here never fails the client's submission.
  let patientId: string | null = null;
  try {
    patientId = await findPatientIdByEmail(email);
    if (patientId) await fileLinkIntake(submission, patientId);
  } catch (err) {
    console.error("filing link intake failed", err);
  }

  try {
    await sendLinkIntakeAlertEmail(`${firstName} ${lastName}`, email, patientId);
  } catch (err) {
    console.error("link intake alert email failed", err);
  }

  return NextResponse.json({ ok: true });
}
