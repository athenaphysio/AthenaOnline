import type { ReactNode } from "react";
import type { Metadata } from "next";
import { getCoachLogin } from "@/lib/coachAuth";
import { coachBrandFor } from "@/lib/coachBrand";
import { metadataForBrand } from "@/lib/brandMetadata";

// The clinician area: a clinician who works within one branded package sees
// that brand's name and mark in the browser tab.
export async function generateMetadata(): Promise<Metadata> {
  const coach = await getCoachLogin().catch(() => null);
  if (!coach) return {};
  const brand = await coachBrandFor(coach.id).catch(() => null);
  return metadataForBrand(brand, "Clinician area");
}

export default function CoachLayout({ children }: { children: ReactNode }) {
  return children;
}
