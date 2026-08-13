import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Basic identity/details fields only -- first/last name, contact, and the
// details-strip fields (DOB, occupation, sport, clinician, location). The
// separate referral/intake fields (presenting complaint, mechanism, etc.)
// have their own save path (intake/save/route.ts) and their own review
// flow -- not conflated with this one.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const {
    first_name,
    last_name,
    email,
    date_of_birth,
    occupation,
    sport,
    assigned_clinician,
    clinic_location,
  } = body as {
    first_name?: string;
    last_name?: string | null;
    email?: string;
    date_of_birth?: string | null;
    occupation?: string | null;
    sport?: string | null;
    assigned_clinician?: string | null;
    clinic_location?: string | null;
  };

  if (!first_name?.trim()) {
    return NextResponse.json({ error: "First name is required." }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from("patients")
      .update({
        first_name: first_name.trim(),
        last_name: last_name?.trim() || null,
        email: email.trim(),
        date_of_birth: date_of_birth || null,
        occupation: occupation?.trim() || null,
        sport: sport?.trim() || null,
        assigned_clinician: assigned_clinician?.trim() || null,
        clinic_location: clinic_location?.trim() || null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ id });
  } catch (err) {
    console.error("update patient details failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Save failed: ${detail}` }, { status: 500 });
  }
}
