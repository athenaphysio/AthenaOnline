import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendClinicianReply } from "@/lib/messaging";

type MessageRow = {
  id: string;
  sender: "patient" | "clinician";
  body: string;
  created_at: string;
  read_at: string | null;
};

// Every message across every one of this patient's programmes -- Owner's
// view is patient-centric (one conversation with this person), not
// programme-centric like the patient-facing composer. Marks every unread
// patient-sent message as read on the way out, same "viewing it is reading
// it" model the in-app notification bell already uses.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;

  const { data: messages, error } = await supabaseAdmin
    .from("patient_messages")
    .select("id, sender, body, created_at, read_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const unreadIds = (messages ?? []).filter((m) => m.sender === "patient" && !m.read_at).map((m) => m.id);
  if (unreadIds.length > 0) {
    const { error: markError } = await supabaseAdmin
      .from("patient_messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
    if (markError) console.error("mark messages read failed", markError.message);
  }

  return NextResponse.json({ messages: messages ?? [] });
}

// David's reply -- attached to whichever of this patient's programmes is
// currently their active one (scheduled, else open), same "current
// programme" resolution the dashboard itself uses, if one exists. No gate,
// ever -- and no requirement that a programme exists at all. A patient with
// no programme yet (most commonly a brand-new signup, exactly when they're
// most likely to need to reach him) is just as messageable; the reply
// simply has no programme_id attached in that case (nullable since
// 0057_patient_messages_programme_optional.sql).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const body = await request.json();
  const { body: messageBody } = body as { body?: string };
  if (!messageBody?.trim()) {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }

  const { data: programmes, error: programmesError } = await supabaseAdmin
    .from("programmes")
    .select("id, delivery_mode, access_paused_at, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false });
  if (programmesError) {
    return NextResponse.json({ error: programmesError.message }, { status: 500 });
  }

  const active = (programmes ?? []).filter((p) => !p.access_paused_at);
  const programmeId =
    active.find((p) => p.delivery_mode === "scheduled")?.id ??
    active.find((p) => p.delivery_mode === "open")?.id ??
    active[0]?.id ??
    null;

  try {
    const message = await sendClinicianReply({ patientId, programmeId, body: messageBody });
    return NextResponse.json({ message });
  } catch (err) {
    console.error("send clinician reply failed", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
