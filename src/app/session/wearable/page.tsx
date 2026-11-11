import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROOK_PROVIDERS, WEARABLE_CONNECTIONS_LIVE } from "@/lib/rookProviders";
import ConnectWearableButton from "./ConnectWearableButton";
import sessionStyles from "../TodaySession.module.css";
import ClientTabBar from "../ClientTabBar";
import Link from "next/link";

type PatientRow = { wearable_tracking_enabled: boolean };

// Reached only when David has switched this on for a patient -- a direct
// visit with the toggle off redirects away, same defensive check as the
// route that actually starts a connection.
export default async function ConnectWearablePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/start");
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("wearable_tracking_enabled")
    .eq("id", user.id)
    .maybeSingle<PatientRow>();

  if (!WEARABLE_CONNECTIONS_LIVE || !patient?.wearable_tracking_enabled) {
    redirect("/session");
  }

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <div className={sessionStyles.head}>
          <h1>Connect your wearable</h1>
          <p>
            Link your device and your data flows straight in, nothing to install. Tap yours below, you&apos;ll
            finish on their own login page.
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.5 }}>
            Your device&apos;s data reaches us through a connection service called Rook, and we use it only for your programme. You can
            disconnect at any time from your device&apos;s own app, and the{" "}
            <Link href="/legal/privacy" style={{ color: "inherit" }}>
              privacy notice
            </Link>{" "}
            explains how we look after it.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 22px" }}>
          {ROOK_PROVIDERS.map((provider) => (
            <ConnectWearableButton key={provider.dataSource} dataSource={provider.dataSource} name={provider.name} />
          ))}
        </div>
      </div>
      <ClientTabBar userId={user.id} />
    </div>
  );
}
