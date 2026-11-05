import { NextRequest, NextResponse } from "next/server";
import { buildWeeklyDigest } from "@/lib/weeklyDigest";
import { sendWeeklyDigestEmail } from "@/lib/email";

// Monday at 7am London time. Vercel runs this at 6am and 7am UTC every
// Monday so it lands at 7am whether the clocks are on GMT or BST; whichever
// run is not 7am in London does nothing.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const londonHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(new Date()));
  if (londonHour !== 7 && request.nextUrl.searchParams.get("force") !== "1") {
    return NextResponse.json({ skipped: "not 7am in London" });
  }
  const digest = await buildWeeklyDigest();
  if (!digest) return NextResponse.json({ sent: false, reason: "nothing needs you this week" });
  await sendWeeklyDigestEmail(digest.subject, digest.body);
  return NextResponse.json({ sent: true, items: digest.count });
}
