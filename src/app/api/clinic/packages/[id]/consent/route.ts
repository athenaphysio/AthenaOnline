import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClinicAdminRequest } from "@/lib/clinicRequestAuth";

// Save the consent wording for a package as a draft, or publish it.
// Publishing creates a new numbered version that cannot be edited
// afterwards, and every client in the package is asked to sign it before
// any clinician can see their information.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isClinicAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: packageId } = await params;
  const { body, publish } = (await request.json()) as { body?: string; publish?: boolean };
  if (!body?.trim()) return NextResponse.json({ error: "The wording is empty." }, { status: 400 });

  const { data: versions } = await supabaseAdmin
    .from("consent_versions")
    .select("id, version, published_at")
    .eq("package_id", packageId)
    .order("version", { ascending: false })
    .returns<{ id: string; version: number; published_at: string | null }[]>();
  const latest = versions?.[0];
  const published_at = publish ? new Date().toISOString() : null;

  // An unpublished latest version is the working draft, so it is updated in
  // place. A published version is never changed; a new one is made instead.
  if (latest && !latest.published_at) {
    const { error } = await supabaseAdmin.from("consent_versions").update({ body: body.trim(), published_at }).eq("id", latest.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ version: latest.version, published: Boolean(publish) });
  }
  const version = (latest?.version ?? 0) + 1;
  const { error } = await supabaseAdmin.from("consent_versions").insert({ package_id: packageId, version, body: body.trim(), published_at });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ version, published: Boolean(publish) });
}
