import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUnlocked } from "@/lib/roamMessenger/guard";
import { clientForUser } from "@/lib/roamMessenger/access";
import { markRead, type ClientMessage, type TeamMessage } from "@/lib/roamMessenger/threads";
import { sendClinicianReply } from "@/lib/messaging";
import { notifyTeamMessage } from "@/lib/roamMessenger/notify";

// One client's conversation, and the care team's notes beside it. Opening
// it marks both as read for this user.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const { id } = await params;
  const client = await clientForUser(user, id);
  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const view = request.nextUrl.searchParams.get("view") === "team" ? "team" : "client";

  const [{ data: messages }, { data: notes }] = await Promise.all([
    supabaseAdmin
      .from("patient_messages")
      .select("id, sender, body, created_at, sent_by_name")
      .eq("patient_id", id)
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<ClientMessage[]>(),
    supabaseAdmin
      .from("roam_team_messages")
      .select("id, author_key, author_name, patient_id, body, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: true })
      .limit(500)
      .returns<TeamMessage[]>(),
  ]);

  await markRead(user, view === "team" ? `team:${id}` : `client:${id}`);

  return NextResponse.json({
    client: { patientId: id, name: `${client.firstName}${client.lastName ? ` ${client.lastName}` : ""}`, canReply: client.canReply },
    messages: messages ?? [],
    teamNotes: (notes ?? []).map((n) => ({ ...n, mine: n.author_key === user.key })),
  });
}

// { body, to: "client" } replies to the client; { body, to: "team" } adds a
// care team note about them, never seen by the client.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  const { id } = await params;
  const client = await clientForUser(user, id);
  if (!client) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { body, to } = (await request.json().catch(() => ({}))) as { body?: string; to?: string };
  const text = body?.trim();
  if (!text) return NextResponse.json({ error: "Please write a message first." }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  if (to === "team") {
    const { data, error } = await supabaseAdmin
      .from("roam_team_messages")
      .insert({ author_key: user.key, author_name: user.name, patient_id: id, body: text })
      .select("id, author_key, author_name, patient_id, body, created_at")
      .single<TeamMessage>();
    if (error) return NextResponse.json({ error: "The note could not be sent." }, { status: 500 });
    await markRead(user, `team:${id}`);
    await notifyTeamMessage(user.key, id).catch((err) => console.error("roam team push failed", err));
    return NextResponse.json({ note: { ...data, mine: true } });
  }

  if (!client.canReply) {
    return NextResponse.json({ error: "You can read this conversation but replying is not switched on for you." }, { status: 403 });
  }

  // The same "current programme" choice the clinic's own reply makes.
  const { data: programmes } = await supabaseAdmin
    .from("programmes")
    .select("id, delivery_mode, access_paused_at, created_at")
    .eq("patient_id", id)
    .order("created_at", { ascending: false })
    .returns<{ id: string; delivery_mode: string; access_paused_at: string | null }[]>();
  const active = (programmes ?? []).filter((p) => !p.access_paused_at);
  const programmeId =
    active.find((p) => p.delivery_mode === "scheduled")?.id ?? active.find((p) => p.delivery_mode === "open")?.id ?? active[0]?.id ?? null;

  try {
    const message = await sendClinicianReply({ patientId: id, programmeId, body: text, sentBy: { key: user.key, name: user.name } });
    await markRead(user, `client:${id}`);
    return NextResponse.json({ message: { ...message, sent_by_name: user.name } });
  } catch (err) {
    console.error("roam reply failed", err);
    return NextResponse.json({ error: "The reply could not be sent. Please try again." }, { status: 500 });
  }
}
