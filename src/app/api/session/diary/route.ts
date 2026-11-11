import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteSlot, loadPlanner, plannerEnabled, saveSlot } from "@/lib/diaryServer";

// The client planning their own week.

async function clientId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await plannerEnabled(user.id))) return null;
  return user.id;
}

export async function GET() {
  const id = await clientId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await loadPlanner(id, "client"));
}

export async function POST(request: NextRequest) {
  const id = await clientId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await saveSlot(id, await request.json(), "client");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ slot: result.slot });
}

export async function DELETE(request: NextRequest) {
  const id = await clientId();
  if (!id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slotId } = (await request.json()) as { slotId?: unknown };
  if (!(await deleteSlot(id, slotId))) return NextResponse.json({ error: "That slot couldn't be removed." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
