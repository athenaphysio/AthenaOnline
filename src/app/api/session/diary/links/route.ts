import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLink, plannerEnabled, revokeLink } from "@/lib/diaryServer";
import { APP_URL } from "@/lib/appUrl";

// The client making, or revoking, a planner link for their PA. Making one
// is the client's recorded consent for that person to place their sessions.

async function clientId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await plannerEnabled(user.id))) return null;
  return user.id;
}

export async function POST(request: NextRequest) {
  const id = await clientId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { paName, consent } = (await request.json()) as { paName?: unknown; consent?: unknown };
  const name = typeof paName === "string" ? paName.trim() : "";
  if (!name) return NextResponse.json({ error: "Add the name of the person you are sharing with." }, { status: 400 });
  if (consent !== true) return NextResponse.json({ error: "Tick the box to confirm you are happy to share." }, { status: 400 });
  const link = await createLink(id, name);
  if (!link) return NextResponse.json({ error: "The link couldn't be made. Try again in a moment." }, { status: 500 });
  return NextResponse.json({ link: { ...link, url: `${APP_URL}/planner/${link.token}` } });
}

export async function DELETE(request: NextRequest) {
  const id = await clientId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { linkId } = (await request.json()) as { linkId?: unknown };
  if (!(await revokeLink(id, linkId))) return NextResponse.json({ error: "The link couldn't be switched off." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
