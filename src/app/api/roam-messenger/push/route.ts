import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUnlocked } from "@/lib/roamMessenger/guard";
import { vapidKeys } from "@/lib/roamMessenger/push";

// GET gives the phone the public key it needs to turn notifications on.
// POST saves this phone's subscription; DELETE removes it.
export async function GET() {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { publicKey } = await vapidKeys();
  return NextResponse.json({ publicKey });
}

export async function POST(request: NextRequest) {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { subscription } = (await request.json().catch(() => ({}))) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "That notification setup was not complete." }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("roam_push_subscriptions")
    .upsert({ user_key: guard.user.key, endpoint, p256dh, auth }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Notifications could not be turned on." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (endpoint) await supabaseAdmin.from("roam_push_subscriptions").delete().eq("endpoint", endpoint).eq("user_key", guard.user.key);
  return NextResponse.json({ ok: true });
}
