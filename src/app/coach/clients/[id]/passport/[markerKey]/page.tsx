import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import { loadClinicPassport, buildSummaries } from "@/lib/passportServer";
import { MarkerView } from "@/components/passport/PassportViews";
import CoachClientShell from "../../CoachClientShell";

export const dynamic = "force-dynamic";

// One passport measure in full, for a clinician who may see its area.
export default async function CoachPassportMarker({ params }: { params: Promise<{ id: string; markerKey: string }> }) {
  const { id, markerKey } = await params;
  const key = decodeURIComponent(markerKey);
  const ctx = await loadCoachClient(id);
  const { markers, results } = await loadClinicPassport(id);
  const domains = buildSummaries(markers, results).filter((d) => ctx.passportDomains.includes(d.key));
  const domain = domains.find((d) => d.series.some((s) => s.marker.marker_key === key));
  const series = domain?.series.find((s) => s.marker.marker_key === key);
  if (!domain || !series) notFound();
  await ctx.record([domain.key]);
  return (
    <CoachClientShell ctx={ctx} active="passport">
      <div style={{ background: "#f2ede4", color: "#1c1c1c", borderRadius: 20, padding: "14px 6px 6px", maxWidth: 760 }}>
        <MarkerView series={series} domain={domain} base={`/coach/clients/${id}/passport`} />
      </div>
    </CoachClientShell>
  );
}
