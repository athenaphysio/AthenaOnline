import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getShopProgramme } from "@/lib/shopProgrammes";
import { deepCopyAssignments, flattenAssignments } from "@/lib/copyProgrammeContent";
import { instantiateProgramme } from "@/lib/instantiateProgramme";
import { logCommunication } from "@/lib/communications";

type TemplateRow = {
  id: string;
  name: string;
  block_length_weeks: number;
  is_under_18: boolean;
  delivery_mode: "scheduled" | "open";
  access: "paid" | "free";
  programme_template_workouts: { workout_id: string; day_of_week: number | null }[];
};

type PatientRow = { first_name: string; email: string };

// The no-payment counterpart to /api/shop/checkout-session -- for a Free
// template, this is the entire fulfilment path: no Stripe session, no
// webhook, just the same deep-copy-and-instantiate work the webhook does
// for a paid purchase, called directly from a logged-in patient's own
// click. access is re-checked against the live template here rather than
// trusted from the request, same reasoning as every other server-side
// check in this app.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sectionSlug, programmeSlug } = body as { sectionSlug?: string; programmeSlug?: string };
  if (!sectionSlug || !programmeSlug) {
    return NextResponse.json({ error: "sectionSlug and programmeSlug are required." }, { status: 400 });
  }

  const shopProgramme = getShopProgramme(sectionSlug, programmeSlug);
  if (!shopProgramme?.templateId) {
    return NextResponse.json({ error: "This programme isn't available yet." }, { status: 404 });
  }

  try {
    const { data: template, error: templateError } = await supabaseAdmin
      .from("programme_templates")
      .select(
        "id, name, block_length_weeks, is_under_18, delivery_mode, access, programme_template_workouts(workout_id, day_of_week)"
      )
      .eq("id", shopProgramme.templateId)
      .maybeSingle<TemplateRow>();
    if (templateError) throw new Error(templateError.message);
    if (!template) {
      return NextResponse.json({ error: "This programme isn't available yet." }, { status: 404 });
    }
    if (template.access !== "free") {
      return NextResponse.json({ error: "This programme requires payment." }, { status: 400 });
    }
    if (template.is_under_18) {
      return NextResponse.json(
        { error: "This programme needs guardian confirmation. Please contact the clinic to set it up." },
        { status: 400 }
      );
    }

    // No limit and no dedupe -- unlike a paid purchase, there's no money at
    // stake in claiming the same free template twice, so a repeat claim
    // just gets a fresh copy rather than being blocked or redirected to an
    // earlier one.
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("patients")
      .select("first_name, email")
      .eq("id", user.id)
      .maybeSingle<PatientRow>();
    if (patientError) throw new Error(patientError.message);
    if (!patient) throw new Error("Patient account not found.");

    const copiedAssignments = await deepCopyAssignments(template.programme_template_workouts);
    const programmeId = crypto.randomUUID();
    await instantiateProgramme({
      id: programmeId,
      patientId: user.id,
      patientFirstName: patient.first_name,
      patientEmail: patient.email,
      title: template.name,
      blockLengthWeeks: template.block_length_weeks,
      deliveryMode: template.delivery_mode,
      assignments: flattenAssignments(copiedAssignments, template.delivery_mode),
      // Free or paid, "via the shop" is "owned outright" -- never touched
      // by a membership lapsing, same guarantee as a paid purchase.
      source: "owned",
      sourceTemplateId: template.id,
    });

    // Distinct from the "programme's ready" entry instantiateProgramme
    // already logs -- that one's the same for every fulfilment path, this
    // one records specifically how the patient got it, so it reads "added"
    // rather than "purchased" here, with no purchases row to back it up.
    await logCommunication({
      patientId: user.id,
      channel: "in_app",
      type: "programme_added_free",
      title: `Added ${template.name}`,
      body: `${patient.first_name} added this free programme themselves, no payment involved.`,
    });

    return NextResponse.json({ programmeId });
  } catch (err) {
    console.error("shop claim failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't add this programme: ${detail}` }, { status: 500 });
  }
}
