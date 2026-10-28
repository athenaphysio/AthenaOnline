import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientPassport, requirePassportClient } from "@/lib/passportServer";
import { PassportSummary, DomainView } from "@/components/passport/PassportViews";
import PassportTabBar from "@/components/passport/PassportTabBar";
import sessionStyles from "../TodaySession.module.css";

// My Passport. With no ?domain this is the summary of all six areas; with
// ?domain=blood (for example) it is that one area in detail.
export default async function MyPassportPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const supabase = await createClient();
  const client = await requirePassportClient(supabase);
  if (!client) redirect("/session");

  const { domain } = await searchParams;
  const domains = await loadClientPassport(supabase, client.userId);
  const selected = domain ? domains.find((d) => d.key === domain && d.series.length > 0) : null;

  return (
    <div className={sessionStyles.app}>
      <div className={sessionStyles.inner}>
        {selected ? <DomainView domain={selected} /> : <PassportSummary domains={domains} />}
      </div>
      <PassportTabBar active="passport" />
    </div>
  );
}
