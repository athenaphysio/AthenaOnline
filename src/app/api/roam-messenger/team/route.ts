import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUnlocked } from "@/lib/roamMessenger/guard";
import { isTeamMember } from "@/lib/roamMessenger/access";
import { markRead, type TeamMessage } from "@/lib/roamMessenger/threads";
import { notifyTeamMessage } from "@/lib/roamMessenger/notify";

// The general care team channel. Anything about a particular client
// belongs in that client's own care team notes instead, where only people
// who may see that client can read it.
export async function GET() {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  if (!(await isTeamMember(user))) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("roam_team_messages")
    .select("id, author_key, author_name, patient_id, body, created_at")
    .is("patient_id", null)
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<TeamMessage[]>();
  await markRead(user, "team");
  return NextResponse.json({ messages: (data ?? []).map((m) => ({ ...m, mine: m.author_key === user.key })) });
}

export async function POST(request: NextRequest) {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { user } = guard;
  if (!(await isTeamMember(user))) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { body } = (await request.json().catch(() => ({}))) as { body?: string };
  const text = body?.trim();
  if (!text) return NextResponse.json({ error: "Please write a message first." }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: "That message is too long." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("roam_team_messages")
    .insert({ author_key: user.key, author_name: user.name, patient_id: null, body: text })
    .select("id, author_key, author_name, patient_id, body, created_at")
    .single<TeamMessage>();
  if (error) return NextResponse.json({ error: "The message could not be sent." }, { status: 500 });
  await markRead(user, "team");
  await notifyTeamMessage(user.key, null).catch((err) => console.error("roam team push failed", err));
  return NextResponse.json({ message: { ...data, mine: true } });
}
