import ClientRecordShell from "../ClientRecordShell";
import { buildSummaries, loadClinicFindings, loadClinicPassport } from "@/lib/passportServer";
import { DomainView, PassportSummary } from "@/components/passport/PassportViews";
import PassportVisual from "./PassportVisual";

export const dynamic = "force-dynamic";

// The Passport tab: the client's results as trends, drawn with the same
// screens the client sees. Uploading and editing the data lives in Client
// background, Health passport.
export default async function ClinicPassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ domain?: string }>;
}) {
  const { id } = await params;
  const { domain } = await searchParams;
  const [{ results, markers, patient }, findings] = await Promise.all([loadClinicPassport(id), loadClinicFindings(id)]);
  const domains = buildSummaries(markers, results);
  const selected = domain ? domains.find((d) => d.key === domain && d.series.length > 0) : null;
  const base = `/clinic/patients/${id}/passport`;

  return (
    <ClientRecordShell patientId={id} active="passport">
      <PassportVisual
        patientId={id}
        clientName={patient?.first_name ?? "the client"}
        enabled={patient?.passport_enabled ?? false}
        draftCount={results.filter((r) => r.status === "draft").length + findings.filter((f) => f.status === "draft").length}>
        {selected ? <DomainView domain={selected} base={base} /> : <PassportSummary domains={domains} base={base} findings={findings} clinicianView />}
      </PassportVisual>
    </ClientRecordShell>
  );
}
