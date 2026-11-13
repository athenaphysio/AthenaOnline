import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isLang } from "@/i18n/languages";

// The client has chosen the language their app is shown in. Only ever
// changes the signed in client's own record.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { language?: unknown };
  if (!isLang(body.language)) {
    return NextResponse.json({ ok: false, error: "That language is not available." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("patients").update({ language: body.language }).eq("id", user.id);
  if (error) {
    console.error("language save failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
