import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import { loadHub } from "@/lib/onboardingHubServer";
import HubBoard from "./HubBoard";

export const dynamic = "force-dynamic";

// Consultation hub: the fourteen part onboarding conversation, with
// everything already known from other sources shown in place, so the
// client confirms rather than repeats. Clinic only for now.
export default async function ConsultationHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [hub, { data: patient }] = await Promise.all([
    loadHub(id),
    supabaseAdmin.from("patients").select("first_name, preferred_name").eq("id", id).maybeSingle<{ first_name: string; preferred_name: string | null }>(),
  ]);
  const name = patient?.preferred_name || patient?.first_name || "the client";
  return (
    <ClientRecordShell patientId={id} active="hub">
      <HubBoard key={hub.imports[0]?.id ?? "none"} patientId={id} clientName={name} initial={hub} />
    </ClientRecordShell>
  );
}
