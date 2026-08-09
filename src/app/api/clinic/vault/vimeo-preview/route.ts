import { NextRequest, NextResponse } from "next/server";
import { getVimeoInfo } from "@/lib/vimeo";

// Live status check as David pastes a Vimeo link into the builder -- lets
// the form tell him immediately whether a cover was found automatically,
// or whether he needs to fall back to a manual upload.
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const info = await getVimeoInfo(url);
  return NextResponse.json({ found: info != null, thumbnailUrl: info?.thumbnailUrl ?? null });
}
