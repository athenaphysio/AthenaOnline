import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// David's switch to bring the old Running Builder / Running ladders
// screens back into the menu -- see 0090_clinic_settings.sql. Neither
// screen's own code or data was touched when Step 1 hid them; this just
// flips whether they're offered.
export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { running_builder_enabled, running_ladders_enabled } = body as {
    running_builder_enabled?: boolean;
    running_ladders_enabled?: boolean;
  };

  const update: Record<string, boolean> = {};
  if (typeof running_builder_enabled === "boolean") update.running_builder_enabled = running_builder_enabled;
  if (typeof running_ladders_enabled === "boolean") update.running_ladders_enabled = running_ladders_enabled;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("clinic_settings").update(update).eq("id", true);
  if (error) {
    console.error("update clinic settings failed", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
