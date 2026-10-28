import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { consentFingerprint, consentStatus } from "@/lib/clinicianAccess";

// The client signs, or withdraws, consent for one package. Who is named and
// what each can see is worked out here on the server, never taken from the
// browser, and a signature is refused if anything changed since the client
// opened the page.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const body = (await request.json()) as {
    action?: "sign" | "withdraw";
    package_id?: string;
    signed_name?: string;
    fingerprint?: string;
    agreed?: boolean;
  };
  if (!body.package_id) return NextResponse.json({ error: "Missing package." }, { status: 400 });

  const { data: member } = await supabaseAdmin
    .from("patient_packages")
    .select("package_id")
    .eq("patient_id", user.id)
    .eq("package_id", body.package_id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "This consent is not for you." }, { status: 403 });

  if (body.action === "withdraw") {
    const { data: latest } = await supabaseAdmin
      .from("patient_consents")
      .select("id")
      .eq("patient_id", user.id)
      .eq("package_id", body.package_id)
      .is("withdrawn_at", null)
      .order("signed_at", { ascending: false })
      .returns<{ id: string }[]>();
    const ids = (latest ?? []).map((r) => r.id);
    if (ids.length > 0) {
      const { error } = await supabaseAdmin.from("patient_consents").update({ withdrawn_at: new Date().toISOString() }).in("id", ids);
      if (error) return NextResponse.json({ error: "That did not work. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const name = body.signed_name?.trim() ?? "";
  if (!body.agreed || name.length < 2) {
    return NextResponse.json({ error: "Please tick the box and type your full name to sign." }, { status: 400 });
  }

  const status = await consentStatus(user.id, body.package_id);
  if (status.state === "no_wording") return NextResponse.json({ error: "There is nothing to sign yet." }, { status: 400 });
  if (consentFingerprint(status.version.id, status.clinicians) !== body.fingerprint) {
    return NextResponse.json(
      { error: "The details on this page have just been updated. Please read the page again before signing.", refresh: true },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin.from("patient_consents").insert({
    patient_id: user.id,
    package_id: body.package_id,
    consent_version_id: status.version.id,
    signed_name: name.slice(0, 200),
    clinicians: status.clinicians,
    user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  });
  if (error) return NextResponse.json({ error: "That did not work. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
