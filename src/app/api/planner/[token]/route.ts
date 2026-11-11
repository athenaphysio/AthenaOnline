import { NextRequest, NextResponse } from "next/server";
import { deleteSlot, loadPlanner, patientForToken, saveSlot, touchLink } from "@/lib/diaryServer";

// The PA's planner link. No login: the token in the address is the key, it
// opens one client's planner and nothing else, and it stops working the
// moment the client or David revokes it.

type Ctx = { params: Promise<{ token: string }> };

async function who(ctx: Ctx) {
  const { token } = await ctx.params;
  return patientForToken(token);
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const link = await who(ctx);
  if (!link) return NextResponse.json({ error: "This planner link is no longer active." }, { status: 404 });
  return NextResponse.json(await loadPlanner(link.patientId, "pa"));
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const link = await who(ctx);
  if (!link) return NextResponse.json({ error: "This planner link is no longer active." }, { status: 404 });
  const result = await saveSlot(link.patientId, await request.json(), "pa");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await touchLink(link.linkId);
  return NextResponse.json({ slot: result.slot });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const link = await who(ctx);
  if (!link) return NextResponse.json({ error: "This planner link is no longer active." }, { status: 404 });
  const { slotId } = (await request.json()) as { slotId?: unknown };
  if (!(await deleteSlot(link.patientId, slotId))) return NextResponse.json({ error: "That slot couldn't be removed." }, { status: 400 });
  await touchLink(link.linkId);
  return NextResponse.json({ ok: true });
}
