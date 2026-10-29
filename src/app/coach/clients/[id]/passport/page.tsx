import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import { loadClinicPassport, buildSummaries } from "@/lib/passportServer";
import { DomainView, PassportSummary } from "@/components/passport/PassportViews";
import CoachClientShell from "../CoachClientShell";
import styles from "../../../../clinic/patients/[id]/dashboard/ClientDashboard.module.css";

export const dynamic = "force-dynamic";

// The visual passport, as the clinic sees it, showing only the areas this
// clinician may see.
export default async function CoachPassport({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ domain?: string }> }) {
  const { id } = await params;
  const { domain } = await searchParams;
  const ctx = await loadCoachClient(id);
  if (ctx.passportDomains.length === 0) notFound();
  const { markers, results } = await loadClinicPassport(id);
  const domains = buildSummaries(markers, results).filter((d) => ctx.passportDomains.includes(d.key));
  const selected = domain ? domains.find((d) => d.key === domain && d.series.length > 0) : null;
  await ctx.record(selected ? [selected.key] : ctx.passportDomains);
  const base = `/coach/clients/${id}/passport`;
  const drafts = results.filter((r) => r.status === "draft" && domains.some((d) => d.series.some((s) => s.marker.marker_key === r.marker_key))).length;

  return (
    <CoachClientShell ctx={ctx} active="passport">
      <p className={styles.muted} style={{ margin: "0 0 14px", fontSize: 13.5, maxWidth: 640 }}>
        The passport as the care team sees it{drafts > 0 ? `, including ${drafts} draft result${drafts === 1 ? "" : "s"} the client cannot see yet` : ""}.
      </p>
      <div style={{ background: "#f2ede4", color: "#1c1c1c", borderRadius: 20, padding: "14px 6px 6px", maxWidth: 760 }}>
        {selected ? <DomainView domain={selected} base={base} /> : <PassportSummary domains={domains} base={base} />}
      </div>
    </CoachClientShell>
  );
}
