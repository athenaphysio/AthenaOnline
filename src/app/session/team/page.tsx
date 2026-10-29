import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientApp, tabAllowed } from "@/lib/clientApp";
import TeamScreen from "../screens/TeamScreen";

export const dynamic = "force-dynamic";

// The team tab of the client's app. Only reachable when the client's brand
// pack shows this tab.
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "team")) redirect("/session");
  return <TeamScreen ctx={ctx} />;
}
