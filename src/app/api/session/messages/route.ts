import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProgrammeMessages, sendPatientMessage } from "@/lib/messaging";

// Ownership of programme_id is always re-checked against this patient's
// own RLS-scoped rows before either reading or sending -- never trusted
// from the client, same discipline as /api/session/complete.
async function assertOwnsProgramme(programmeId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("programmes").select("id").eq("id", programmeId).eq("patient_id", userId).maybeSingle();
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const programmeId = request.nextUrl.searchParams.get("programme_id");
  if (!programmeId) {
    return NextResponse.json({ error: "programme_id is required." }, { status: 400 });
  }
  if (!(await assertOwnsProgramme(programmeId, user.id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const messages = await getProgrammeMessages(programmeId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("fetch programme messages failed", err);
    return NextResponse.json({ error: "Couldn't load messages." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { programme_id, body: messageBody } = body as { programme_id?: string; body?: string };
  if (!programme_id || !messageBody?.trim()) {
    return NextResponse.json({ error: "programme_id and body are required." }, { status: 400 });
  }
  if (!(await assertOwnsProgramme(programme_id, user.id))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const result = await sendPatientMessage({ patientId: user.id, programmeId: programme_id, body: messageBody });
    return NextResponse.json(result);
  } catch (err) {
    console.error("send patient message failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
