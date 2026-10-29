import { NextRequest, NextResponse } from "next/server";
import { redeemInviteLink } from "@/lib/clientInvite";

// The welcome link has been opened: swap it for a fresh one time login
// token, which the page uses straight away.
export async function POST(request: NextRequest) {
  const { invite } = (await request.json().catch(() => ({}))) as { invite?: string };
  const result = await redeemInviteLink(invite ?? "");
  if (!result.ok) return NextResponse.json({ reason: result.reason }, { status: 400 });
  return NextResponse.json({ token_hash: result.tokenHash, type: result.type });
}
