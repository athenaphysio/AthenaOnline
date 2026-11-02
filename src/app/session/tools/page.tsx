import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientApp, tabAllowed } from "@/lib/clientApp";
import { getLiveToolFlows } from "@/lib/flowsServer";
import ToolsScreen from "../screens/ToolsScreen";

export const dynamic = "force-dynamic";

// The Tools tab of the client's app. ?arm=breath, nervous or mind chooses
// the open hexagon; breath unless chosen.
export default async function Page({ searchParams }: { searchParams: Promise<{ arm?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "tools")) redirect("/session");
  const [{ arm }, flows] = await Promise.all([searchParams, getLiveToolFlows()]);
  return <ToolsScreen ctx={ctx} flows={flows} arm={arm} />;
}
