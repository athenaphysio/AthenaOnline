import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import { getPackGuide } from "@/lib/brandPackGuide";
import ClientGuide from "../ClientGuide";

export const dynamic = "force-dynamic";

// The client's brand pack guide, opened again from the home screen.
export default async function GuidePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");

  const brand = await resolveBrandPack({ patientId: user.id });
  const guide = await getPackGuide(brand.id);
  if (!guide) redirect("/session");

  return (
    <ClientGuide
      brand={brand}
      packId={guide.packId}
      title={guide.title}
      body={guide.body}
      firstName={(user.user_metadata?.first_name as string | undefined) ?? ""}
      mode="reread"
    />
  );
}
