import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientApp, tabAllowed } from "@/lib/clientApp";
import MessagesScreen from "../screens/MessagesScreen";

export const dynamic = "force-dynamic";

// The messages tab of the client's app. Only reachable when the client's brand
// pack shows this tab.
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "messages")) redirect("/session");
  return <MessagesScreen ctx={ctx} />;
}
