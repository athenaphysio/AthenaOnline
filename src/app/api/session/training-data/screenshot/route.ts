import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveTrainingScreenshot } from "@/lib/trainingData";

// A screenshot of a PM5, watch or app screen, kept for Dr David Silver PhD
// to read. Nothing is read from it automatically.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a picture first." }, { status: 400 });
  const note = String(form.get("note") || "").trim().slice(0, 500) || null;
  const error = await saveTrainingScreenshot(user.id, file, note);
  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
