import { NextResponse } from "next/server";
import { lockNow } from "@/lib/roamMessenger/identity";

// The lock button, and what the app calls when it goes into the background.
export async function POST() {
  await lockNow();
  return NextResponse.json({ ok: true });
}
