import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ResolvedBrandPack } from "@/lib/brandPackResolve";

// Whether the Human Passport is part of this client's care, in the clinic
// as well as in their app: the hexagons on Client profile, the Passport tab
// and the passport lines on the Overview.
//
// Many Athena and Ergon clients have no passport, so for them it follows
// the client's own passport switch. A brand whose programme always includes
// one (Regenerate, set by passport_always on its pack) shows it in the
// clinic whatever the switch says, since the team builds the passport
// before the client is shown it; there the switch only decides whether the
// client can see it yet.
export function passportFeaturesOn(enabled: boolean | null | undefined, brand: ResolvedBrandPack | null): boolean {
  return Boolean(enabled) || Boolean(brand?.app_layout.passport_always);
}

export async function passportEnabledFor(patientId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("passport_enabled")
    .eq("id", patientId)
    .maybeSingle<{ passport_enabled: boolean | null }>();
  return Boolean(data?.passport_enabled);
}
