import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUnlocked } from "@/lib/roamMessenger/guard";
import { isTeamMember, visibleClients } from "@/lib/roamMessenger/access";
import { lastReads, shortName, type ClientMessage, type TeamMessage } from "@/lib/roamMessenger/threads";

// The inbox: every ROAM conversation this user may see, newest first, and
// the care team channel.
export async function GET() {
  const guard = await requireUnlocked();
  if ("response" in guard) return guard.response;
  const { user } = guard;

  const clients = await visibleClients(user);
  const ids = clients.map((c) => c.patientId);
  const teamMember = await isTeamMember(user);

  const [{ data: messages }, { data: teamMessages }, reads] = await Promise.all([
    ids.length > 0
      ? supabaseAdmin
          .from("patient_messages")
          .select("id, patient_id, sender, body, created_at, sent_by_name")
          .in("patient_id", ids)
          .order("created_at", { ascending: true })
          .returns<(ClientMessage & { patient_id: string })[]>()
      : Promise.resolve({ data: [] as (ClientMessage & { patient_id: string })[] }),
    teamMember
      ? supabaseAdmin
          .from("roam_team_messages")
          .select("id, author_key, author_name, patient_id, body, created_at")
          .or(ids.length > 0 ? `patient_id.is.null,patient_id.in.(${ids.join(",")})` : "patient_id.is.null")
          .order("created_at", { ascending: true })
          .returns<TeamMessage[]>()
      : Promise.resolve({ data: [] as TeamMessage[] }),
    lastReads(user),
  ]);

  const byClient = new Map<string, (ClientMessage & { patient_id: string })[]>();
  for (const m of messages ?? []) {
    if (!byClient.has(m.patient_id)) byClient.set(m.patient_id, []);
    byClient.get(m.patient_id)!.push(m);
  }
  const teamByClient = new Map<string, TeamMessage[]>();
  const general: TeamMessage[] = [];
  for (const t of teamMessages ?? []) {
    if (!t.patient_id) general.push(t);
    else {
      if (!teamByClient.has(t.patient_id)) teamByClient.set(t.patient_id, []);
      teamByClient.get(t.patient_id)!.push(t);
    }
  }

  const after = (iso: string, since: string | undefined) => !since || iso > since;

  const rows = clients
    .map((c) => {
      const thread = byClient.get(c.patientId) ?? [];
      const team = teamByClient.get(c.patientId) ?? [];
      const last = thread[thread.length - 1];
      const lastTeam = team[team.length - 1];
      const readClient = reads.get(`client:${c.patientId}`);
      const readTeam = reads.get(`team:${c.patientId}`);
      const lastAt = [last?.created_at, lastTeam?.created_at].filter(Boolean).sort().pop() ?? null;
      return {
        patientId: c.patientId,
        name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}`,
        canReply: c.canReply,
        lastAt,
        snippet: last ? (last.sender === "clinician" ? `${last.sent_by_name ? shortName(last.sent_by_name) : "Care team"}: ${last.body}` : last.body) : null,
        unread: thread.filter((m) => m.sender === "patient" && after(m.created_at, readClient)).length,
        teamUnread: team.filter((t) => t.author_key !== user.key && after(t.created_at, readTeam)).length,
        awaitingReply: last?.sender === "patient",
      };
    })
    .filter((r) => r.lastAt)
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  const readGeneral = reads.get("team");
  const lastGeneral = general[general.length - 1];

  return NextResponse.json({
    me: { name: user.name, kind: user.kind },
    clients: rows,
    // Clients with no conversation yet, so a care team note can be started.
    quietClients: clients
      .filter((c) => !rows.some((r) => r.patientId === c.patientId))
      .map((c) => ({ patientId: c.patientId, name: `${c.firstName}${c.lastName ? ` ${c.lastName}` : ""}` }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    team: teamMember
      ? {
          lastAt: lastGeneral?.created_at ?? null,
          snippet: lastGeneral ? `${shortName(lastGeneral.author_name)}: ${lastGeneral.body}` : null,
          unread: general.filter((t) => t.author_key !== user.key && after(t.created_at, readGeneral)).length,
        }
      : null,
  });
}
