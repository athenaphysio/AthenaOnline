import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientPassport, requirePassportClient } from "@/lib/passportServer";
import { MarkerView } from "@/components/passport/PassportViews";
import PassportTabBar from "@/components/passport/PassportTabBar";
import sessionStyles from "../../TodaySession.module.css";

// One marker in full: the trend chart across every reading, the note from
// the care team and the plain English explanation.
export default async function PassportMarkerPage({ params }: { params: Promise<{ markerKey: string }> }) {
  const supabase = await createClient();
  const client = await requirePassportClient(supabase);
  if (!client) redirect("/session");

  const { markerKey } = await params;
  const key = decodeURIComponent(markerKey);
  const domains = await loadClientPassport(supabase, client.userId);
  const domain = domains.find((d) => d.series.some((s) => s.marker.marker_key === key));
  const series = domain?.series.find((s) => s.marker.marker_key === key);
  if (!domain || !series) notFound();

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        <MarkerView series={series} domain={domain} />
      </div>
      <PassportTabBar active="passport" />
    </div>
  );
}
