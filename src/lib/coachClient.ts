import "server-only";
import { notFound } from "next/navigation";
import { requireCoach, type CoachIdentity } from "@/lib/coachAuth";
import { clientAccessFor, logAccess, type ClientAccess } from "@/lib/clinicianAccess";
import { PASSPORT_SECTIONS } from "@/lib/clinicianAccessSections";
import { resolveBrandPack, type ResolvedBrandPack } from "@/lib/brandPackResolve";

// Everything a clinician page about one client needs: who the clinician
// is, what they may see of this client, and the client's brand. Anyone
// without access gets a plain not found, never a hint that the client
// exists.
export type CoachClientContext = {
  coach: CoachIdentity;
  patientId: string;
  access: ClientAccess;
  brand: ResolvedBrandPack | null;
  can: (section: string) => boolean;
  passportDomains: string[];
  /** Every section shown on this page is recorded against the clinician. */
  record: (sections: string[]) => Promise<void>;
};

export async function loadCoachClient(patientId: string): Promise<CoachClientContext> {
  const coach = await requireCoach();
  const access = await clientAccessFor(coach.id, patientId);
  if (!access) notFound();
  const brand = await resolveBrandPack({ patientId }).catch(() => null);
  const can = (s: string) => access.sections.includes(s as never);
  return {
    coach,
    patientId,
    access,
    brand,
    can,
    passportDomains: PASSPORT_SECTIONS.filter((d) => can(d)),
    record: (sections) => logAccess(coach.id, patientId, sections.filter((s) => can(s))),
  };
}
