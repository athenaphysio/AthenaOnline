import AppTabBar from "@/components/app/AppTabBar";
import { loadClientApp } from "@/lib/clientApp";
import type { ToolbarTab } from "@/lib/appLayout";

// The client's toolbar for a screen that sits outside the tabs themselves
// (connecting a wearable, uploading a workout, signing consent), so the
// way home and to every tab is always along the bottom.
export default async function ClientTabBar({ userId, active }: { userId: string; active?: ToolbarTab["key"] }) {
  const ctx = await loadClientApp(userId);
  return <AppTabBar tabs={ctx.tabs} active={active} />;
}
