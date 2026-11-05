import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyDigest } from "@/lib/weeklyDigest";
import { sendWeeklyDigestEmail } from "@/lib/email";

// Monday at 7am UTC: 7am in London in winter, 8am while the clocks are on
// British Summer Time. (The Vercel plan allows each scheduled job one run a
// day, so it cannot follow the clock change on its own.)
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const digest = await buildWeeklyDigest();
  if (!digest) return NextResponse.json({ sent: false, reason: "nothing needs you this week" });
  await sendWeeklyDigestEmail(digest.subject, digest.body);
  return NextResponse.json({ sent: true, items: digest.count });
}
