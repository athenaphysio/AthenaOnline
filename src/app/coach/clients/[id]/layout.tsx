import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getCoachLogin } from "@/lib/coachAuth";
import { clientAccessFor } from "@/lib/clinicianAccess";
import { metadataForClient } from "@/lib/brandMetadata";

// One client, for a clinician who may see them: the tab shows the client's
// name and brand. Anyone else gets the plain tab, so nothing is given away.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const coach = await getCoachLogin().catch(() => null);
  if (!coach) return {};
  const access = await clientAccessFor(coach.id, id).catch(() => null);
  if (!access) return {};
  return metadataForClient(id, [access.firstName, access.lastName].filter(Boolean).join(" "));
}

export default function CoachClientLayout({ children }: { children: ReactNode }) {
  return children;
}
