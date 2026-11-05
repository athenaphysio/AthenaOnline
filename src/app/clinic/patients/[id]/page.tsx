import { redirect } from "next/navigation";

// There is one client page now: the record's Overview (./dashboard), with
// every tool the older page held brought across into it. Any link, bookmark
// or old tab address that still lands here is forwarded there, so David
// never sees an out of date version of a client.
export default async function ClientRecordRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const base = `/clinic/patients/${id}`;
  if (tab === "submissions") redirect(`${base}/forms`);
  redirect(`${base}/dashboard`);
}
