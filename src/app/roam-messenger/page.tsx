import { redirect } from "next/navigation";
import { getMessengerLogin } from "@/lib/roamMessenger/identity";
import Messenger from "./Messenger";

export const dynamic = "force-dynamic";

// Signing in uses the logins that already exist: clinicians use their care
// team login (email, password and a code on a new device), David uses the
// clinic login. Once signed in, the messenger itself handles Face ID.
export default async function RoamMessengerPage({ searchParams }: { searchParams: Promise<{ c?: string; tab?: string; view?: string }> }) {
  const login = await getMessengerLogin();
  if (login.state === "needs_device_code") redirect("/coach/verify?next=/roam-messenger");
  if (login.state === "signed_out") redirect("/roam-messenger/sign-in");
  const sp = await searchParams;
  return <Messenger initialClient={sp.c ?? null} initialTab={sp.tab === "team" ? "team" : "clients"} initialView={sp.view === "team" ? "team" : "client"} />;
}
