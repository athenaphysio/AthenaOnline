import "server-only";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Phone notifications for Roam Messenger. Every notification is
// deliberately content free: it says only that there is a new message, so
// nothing about a client ever shows on a lock screen. Tapping it opens the
// right conversation, after Face ID.

type VapidKeys = { publicKey: string; privateKey: string };

// The signing keys come from Vercel settings if they are set there, and
// otherwise are made once and kept in the database, so notifications work
// without anyone having to set anything up.
let cached: VapidKeys | null = null;
export async function vapidKeys(): Promise<VapidKeys> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const { data } = await supabaseAdmin
    .from("roam_messenger_config")
    .select("vapid_public_key, vapid_private_key")
    .eq("id", true)
    .maybeSingle<{ vapid_public_key: string; vapid_private_key: string }>();
  if (data) {
    cached = { publicKey: data.vapid_public_key, privateKey: data.vapid_private_key };
    return cached;
  }
  const fresh = webpush.generateVAPIDKeys();
  await supabaseAdmin
    .from("roam_messenger_config")
    .upsert({ id: true, vapid_public_key: fresh.publicKey, vapid_private_key: fresh.privateKey }, { onConflict: "id", ignoreDuplicates: true });
  // Read back, in case two requests made keys at the same moment.
  const { data: saved } = await supabaseAdmin
    .from("roam_messenger_config")
    .select("vapid_public_key, vapid_private_key")
    .eq("id", true)
    .single<{ vapid_public_key: string; vapid_private_key: string }>();
  cached = { publicKey: saved!.vapid_public_key, privateKey: saved!.vapid_private_key };
  return cached;
}

export type PushPayload = { title: string; body: string; url: string; tag: string };

export async function sendPush(userKeys: string[], payload: PushPayload): Promise<void> {
  if (userKeys.length === 0) return;
  const { data: subs } = await supabaseAdmin
    .from("roam_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_key", userKeys)
    .returns<{ id: string; endpoint: string; p256dh: string; auth: string }[]>();
  if (!subs || subs.length === 0) return;

  const keys = await vapidKeys();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:David@drdavidsilverphd.com", keys.publicKey, keys.privateKey);
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
        await supabaseAdmin.from("roam_push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // The phone has removed the app or turned notifications off.
        if (status === 404 || status === 410) {
          await supabaseAdmin.from("roam_push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("roam push failed", status, err);
        }
      }
    })
  );
}
