import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { markGuideRead } from "@/lib/brandPackGuide";

// The client has read their brand pack's guide, so the app opens for them.
// Only ever records the pack the client is actually on.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { packId?: string };
  const brand = await resolveBrandPack({ patientId: user.id });
  if (!body.packId || body.packId !== brand.id) {
    return NextResponse.json({ ok: false, error: "That guide is not on your account." }, { status: 400 });
  }

  try {
    await markGuideRead(user.id, brand.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("guide read failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
