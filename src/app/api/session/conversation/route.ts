import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPatientConversation, sendPatientMessage } from "@/lib/messaging";
import { loadClientApp, tabAllowed } from "@/lib/clientApp";

// The Messages tab: the client's whole conversation with the care team.
// Only for clients whose brand pack shows that tab.
async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "messages")) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ messages: await getPatientConversation(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await signedIn();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "messages")) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { body } = (await request.json()) as { body?: string };
  if (!body?.trim()) return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
  if (body.length > 5000) return NextResponse.json({ error: "That message is longer than expected. Please split it in two." }, { status: 400 });
  try {
    const result = await sendPatientMessage({
      patientId: user.id,
      programmeId: ctx.scheduledProgrammeId,
      body,
      included: ctx.layout.messaging_included,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("send conversation message failed", err);
    return NextResponse.json({ error: "That message could not be sent. Please try again." }, { status: 500 });
  }
}
