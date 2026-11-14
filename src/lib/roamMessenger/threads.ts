import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { MessengerUser } from "@/lib/roamMessenger/identity";

// Reading and marking threads. Each user's own "last looked at" time is
// kept per thread, so a clinician reading a conversation does not clear it
// for David. When David reads a client's conversation here, it is also
// marked read in the clinic inbox, the same as opening it there.

export type ThreadKey = "team" | `team:${string}` | `client:${string}`;

export async function lastReads(user: MessengerUser): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from("roam_messenger_reads")
    .select("thread_key, last_read_at")
    .eq("user_key", user.key)
    .returns<{ thread_key: string; last_read_at: string }[]>();
  return new Map((data ?? []).map((r) => [r.thread_key, r.last_read_at]));
}

export async function markRead(user: MessengerUser, thread: ThreadKey): Promise<void> {
  await supabaseAdmin
    .from("roam_messenger_reads")
    .upsert({ user_key: user.key, thread_key: thread, last_read_at: new Date().toISOString() }, { onConflict: "user_key,thread_key" });
  if (user.kind === "owner" && thread.startsWith("client:")) {
    await supabaseAdmin
      .from("patient_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("patient_id", thread.slice("client:".length))
      .eq("sender", "patient")
      .is("read_at", null);
  }
}

export type ClientMessage = {
  id: string;
  sender: "patient" | "clinician";
  body: string;
  created_at: string;
  sent_by_name: string | null;
};

export type TeamMessage = {
  id: string;
  author_key: string;
  author_name: string;
  patient_id: string | null;
  body: string;
  created_at: string;
};

/** A first name for a short label, without a title: "Dr David Silver PhD" is "David". */
export function shortName(name: string): string {
  return name.replace(/^(dr|prof|professor|mr|mrs|ms|miss)\.?\s+/i, "").split(" ")[0] || name;
}
