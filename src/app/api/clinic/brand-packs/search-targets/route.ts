import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// One combined search across the two assignable kinds -- Screen 3 needs
// "find either a programme or a client", not two separate pickers.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  let programmeQuery = supabaseAdmin
    .from("programmes")
    .select("id, title, brand_pack_id")
    .order("title")
    .limit(20);
  let patientQuery = supabaseAdmin
    .from("patients")
    .select("id, first_name, last_name, email, brand_pack_id")
    .order("first_name")
    .limit(20);

  if (q) {
    programmeQuery = programmeQuery.ilike("title", `%${q}%`);
    patientQuery = patientQuery.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const [{ data: programmes, error: programmeError }, { data: patients, error: patientError }] = await Promise.all([
    programmeQuery,
    patientQuery,
  ]);
  if (programmeError) return NextResponse.json({ error: programmeError.message }, { status: 500 });
  if (patientError) return NextResponse.json({ error: patientError.message }, { status: 500 });

  return NextResponse.json({
    programmes: (programmes ?? []).map((p) => ({ id: p.id, title: p.title, brand_pack_id: p.brand_pack_id })),
    patients: (patients ?? []).map((p) => ({
      id: p.id,
      name: p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name,
      email: p.email,
      brand_pack_id: p.brand_pack_id,
    })),
  });
}
