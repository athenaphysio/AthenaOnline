import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadClientFindings, loadClientPassport, requirePassportClient } from "@/lib/passportServer";
import { PassportSummary, DomainView } from "@/components/passport/PassportViews";
import PassportShell from "./PassportShell";
import { loadClientApp } from "@/lib/clientApp";

// My Passport. With no ?domain this is the summary: the three hexagons,
// with the open one (?arm=, physiology unless chosen) showing its areas.
// With ?domain=blood (for example) it is that one area in detail.
export default async function MyPassportPage({ searchParams }: { searchParams: Promise<{ domain?: string; arm?: string }> }) {
  const supabase = await createClient();
  const client = await requirePassportClient(supabase);
  if (!client) redirect("/session");

  const { domain, arm } = await searchParams;
  const [domains, findings] = await Promise.all([loadClientPassport(supabase, client.userId), loadClientFindings(supabase, client.userId)]);
  const selected = domain ? domains.find((d) => d.key === domain && d.series.length > 0) : null;

  const ctx = await loadClientApp(client.userId);
  return <PassportShell ctx={ctx}>{selected ? <DomainView domain={selected} /> : <PassportSummary domains={domains} findings={findings} arm={arm} />}</PassportShell>;
}

