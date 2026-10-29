import ClientShell from "../ClientShell";
import Conversation from "./Conversation";
import { getPatientConversation } from "@/lib/messaging";
import type { ClientAppContext } from "@/lib/clientApp";

// The Messages tab: the whole conversation with the care team.
export default async function MessagesScreen({ ctx, preview = false }: { ctx: ClientAppContext; preview?: boolean }) {
  const messages = await getPatientConversation(ctx.userId);
  const team = ctx.layout.team_name || "the team";
  return (
    <ClientShell ctx={ctx} active="messages" title="Messages" lead={`Your conversation with ${team}. Questions, things you noticed, how a practice felt: it all helps.`}>
      <Conversation initial={messages} readOnly={preview} />
    </ClientShell>
  );
}
