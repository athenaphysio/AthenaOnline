import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientApp, tabAllowed } from "@/lib/clientApp";
import ProgrammeScreen from "../screens/ProgrammeScreen";

export const dynamic = "force-dynamic";

// The programme tab of the client's app. Only reachable when the client's brand
// pack shows this tab.
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "programme")) redirect("/session");
  return <ProgrammeScreen ctx={ctx} />;
}
