import "server-only";
import { teamUserKeys } from "@/lib/roamMessenger/access";
import { sendPush } from "@/lib/roamMessenger/push";

// The content-free alerts. No client name and no message text go into any
// notification; the link inside carries only an id, never shown on screen.

export const MESSENGER_PATH = "/roam-messenger";

export function clientThreadPath(patientId: string): string {
  return `${MESSENGER_PATH}?c=${encodeURIComponent(patientId)}`;
}

/** A ROAM client has sent a message: tell everyone who may see it. */
export async function notifyClientMessage(patientId: string): Promise<void> {
  const keys = await teamUserKeys(patientId);
  await sendPush(keys, {
    title: "Roam Messenger",
    body: "You have a new client message.",
    url: clientThreadPath(patientId),
    tag: `client-${patientId}`,
  });
}

/** A care team message: tell the rest of the team who may see it. */
export async function notifyTeamMessage(authorKey: string, patientId: string | null): Promise<void> {
  const keys = (await teamUserKeys(patientId ?? undefined)).filter((k) => k !== authorKey);
  await sendPush(keys, {
    title: "Roam Messenger",
    body: "You have a new care team message.",
    url: patientId ? `${clientThreadPath(patientId)}&view=team` : `${MESSENGER_PATH}?tab=team`,
    tag: patientId ? `team-${patientId}` : "team",
  });
}
