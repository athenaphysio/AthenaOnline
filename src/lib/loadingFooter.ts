import type { AppLayout } from "@/lib/appLayout";

// The name at the foot of the holding page, following the pack's sign-off.
export function loadingFooter(layout: AppLayout): string {
  if (layout.signoff === "team") return layout.team_name || "";
  if (layout.signoff === "none") return "";
  return "Dr David Silver PhD";
}
