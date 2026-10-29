import { notFound } from "next/navigation";
import ClientRecordShell from "../../ClientRecordShell";
import { buildSummaries, loadClinicPassport } from "@/lib/passportServer";
import { MarkerView } from "@/components/passport/PassportViews";
import PassportVisual from "../PassportVisual";

export const dynamic = "force-dynamic";

export default async function ClinicPassportMarkerPage({ params }: { params: Promise<{ id: string; markerKey: string }> }) {
  const { id, markerKey } = await params;
  const key = decodeURIComponent(markerKey);
  const { results, markers, patient } = await loadClinicPassport(id);
  const domains = buildSummaries(markers, results);
  const domain = domains.find((d) => d.series.some((s) => s.marker.marker_key === key));
  const series = domain?.series.find((s) => s.marker.marker_key === key);
  if (!domain || !series) notFound();

  return (
    <ClientRecordShell patientId={id} active="passport">
      <PassportVisual
        patientId={id}
        clientName={patient?.first_name ?? "the client"}
        enabled={patient?.passport_enabled ?? false}
        draftCount={results.filter((r) => r.status === "draft").length}>
        <MarkerView series={series} domain={domain} base={`/clinic/patients/${id}/passport`} />
      </PassportVisual>
    </ClientRecordShell>
  );
}
