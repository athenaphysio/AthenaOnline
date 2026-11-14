import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { accessibleClients } from "@/lib/clinicianAccess";
import type { MessengerUser } from "@/lib/roamMessenger/identity";

// Which clients appear in Roam Messenger, and what each user may do there.
//
// A ROAM client is one whose app is ROAM: their brand pack (their own, or
// their package's, or failing those their programme's, the same order the
// app itself uses to decide what they see) has "ROAM" as its app name.
// That covers Regenerate and the workforce packs built on it.
//
// David sees and can reply to every ROAM client. A clinician sees a client
// only when the existing care team rules let them see that client's
// Messages section, and can reply only when "Reply to messages" is also
// switched on for them and agreed by the client. Nothing here widens what
// the clinic already allows.

export type MessengerClient = {
  patientId: string;
  firstName: string;
  lastName: string | null;
  canReply: boolean;
};

async function roamPackIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("brand_packs")
    .select("id, app_layout")
    .returns<{ id: string; app_layout: { app_name?: string } | null }[]>();
  if (error) throw new Error(error.message);
  return new Set(
    (data ?? []).filter((p) => (p.app_layout?.app_name ?? "").trim().toUpperCase() === "ROAM").map((p) => p.id)
  );
}

/** Every ROAM client, with their name. */
export async function roamClients(): Promise<Map<string, { firstName: string; lastName: string | null }>> {
  const packIds = await roamPackIds();
  const out = new Map<string, { firstName: string; lastName: string | null }>();
  if (packIds.size === 0) return out;

  const [{ data: patients }, { data: memberships }, { data: programmes }] = await Promise.all([
    supabaseAdmin
      .from("patients")
      .select("id, first_name, last_name, brand_pack_id")
      .returns<{ id: string; first_name: string; last_name: string | null; brand_pack_id: string | null }[]>(),
    supabaseAdmin
      .from("patient_packages")
      .select("patient_id, packages(name, brand_pack_id)")
      .returns<{ patient_id: string; packages: { name: string; brand_pack_id: string | null } | null }[]>(),
    supabaseAdmin
      .from("programmes")
      .select("patient_id, brand_pack_id, access_paused_at")
      .not("brand_pack_id", "is", null)
      .is("access_paused_at", null)
      .returns<{ patient_id: string; brand_pack_id: string | null; access_paused_at: string | null }[]>(),
  ]);

  // The first branded package by name, as the app itself chooses.
  const packagePack = new Map<string, { name: string; packId: string }>();
  for (const m of memberships ?? []) {
    const p = m.packages;
    if (!p?.brand_pack_id) continue;
    const existing = packagePack.get(m.patient_id);
    if (!existing || p.name.localeCompare(existing.name) < 0) packagePack.set(m.patient_id, { name: p.name, packId: p.brand_pack_id });
  }
  const programmeRoam = new Set((programmes ?? []).filter((p) => p.brand_pack_id && packIds.has(p.brand_pack_id)).map((p) => p.patient_id));

  for (const p of patients ?? []) {
    let isRoam: boolean;
    if (p.brand_pack_id) isRoam = packIds.has(p.brand_pack_id);
    else if (packagePack.has(p.id)) isRoam = packIds.has(packagePack.get(p.id)!.packId);
    else isRoam = programmeRoam.has(p.id);
    if (isRoam) out.set(p.id, { firstName: p.first_name, lastName: p.last_name });
  }
  return out;
}

export async function isRoamClient(patientId: string): Promise<boolean> {
  return (await roamClients()).has(patientId);
}

/** The ROAM clients this user may see in the messenger. */
export async function visibleClients(user: MessengerUser): Promise<MessengerClient[]> {
  const roam = await roamClients();
  if (user.kind === "owner") {
    return Array.from(roam.entries()).map(([patientId, n]) => ({ patientId, ...n, canReply: true }));
  }
  const access = await accessibleClients(user.staffId);
  return access
    .filter((a) => roam.has(a.patientId) && a.sections.includes("messages"))
    .map((a) => ({
      patientId: a.patientId,
      firstName: a.firstName,
      lastName: a.lastName,
      canReply: a.sections.includes("reply_messages"),
    }));
}

export async function clientForUser(user: MessengerUser, patientId: string): Promise<MessengerClient | null> {
  return (await visibleClients(user)).find((c) => c.patientId === patientId) ?? null;
}

/**
 * Everyone on the ROAM care team, as messenger user keys: David, plus every
 * clinician who can see at least one ROAM client. With a patientId, only
 * those who may see that client.
 */
export async function teamUserKeys(patientId?: string): Promise<string[]> {
  const keys = ["owner"];
  const { data: staff } = await supabaseAdmin
    .from("staff")
    .select("id, name")
    .eq("role", "coach")
    .returns<{ id: string; name: string }[]>();
  for (const s of staff ?? []) {
    const user: MessengerUser = { kind: "coach", key: `staff:${s.id}`, staffId: s.id, name: s.name };
    const clients = await visibleClients(user).catch(() => []);
    if (patientId ? clients.some((c) => c.patientId === patientId) : clients.length > 0) keys.push(user.key);
  }
  return keys;
}

/** Whether this user belongs on the team channel at all. */
export async function isTeamMember(user: MessengerUser): Promise<boolean> {
  if (user.kind === "owner") return true;
  return (await visibleClients(user)).length > 0;
}
