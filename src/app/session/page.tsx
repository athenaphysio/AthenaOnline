import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClientHome from "./ClientHome";

// The client's home screen in the live app. The screen itself lives in
// ClientHome, shared with the clinic's Client view so the two never differ.
export default async function SessionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/start");
  }

  const firstName = (user.user_metadata?.first_name as string | undefined) || "there";
  return <ClientHome db={supabase} userId={user.id} firstName={firstName} />;
}
