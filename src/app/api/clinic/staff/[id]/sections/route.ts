import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";
import { SECTIONS } from "@/lib/clinicianAccess";

// Switch one section on or off for one clinician in one package.
// Off takes effect at once. On only reaches a client once that client has
// signed a consent that names this clinician and this section.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: staffId } = await params;
  const { package_id, section, on } = (await request.json()) as { package_id?: string; section?: string; on?: boolean };
  if (!package_id || !section || typeof on !== "boolean" || !SECTIONS.some((s) => s.key === section)) {
    return NextResponse.json({ error: "package_id, a known section and on are required." }, { status: 400 });
  }
  const result = on
    ? await supabaseAdmin
        .from("staff_package_sections")
        .upsert({ staff_id: staffId, package_id, section }, { onConflict: "staff_id,package_id,section", ignoreDuplicates: true })
    : await supabaseAdmin.from("staff_package_sections").delete().match({ staff_id: staffId, package_id, section });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
