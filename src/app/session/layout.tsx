import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { metadataForClient, viewportForClient } from "@/lib/brandMetadata";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveBrandPack } from "@/lib/brandPackResolve";
import AwaitingApproval from "./AwaitingApproval";

// The client's app: the browser tab, and the name under the icon when it is
// added to a phone's home screen, follow the client's brand pack.
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return metadataForClient(user?.id, null, true);
}

export async function generateViewport(): Promise<Viewport> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return viewportForClient(user?.id);
}

// A client who created their own account sees only the waiting page until
// David approves it (see 0111_patient_sign_up_approval.sql).
export default async function SessionLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("first_name, awaiting_approval")
      .eq("id", user.id)
      .maybeSingle<{ first_name: string | null; awaiting_approval: boolean }>();
    if (patient?.awaiting_approval) {
      const brand = await resolveBrandPack({ patientId: user.id }).catch(() => null);
      return <AwaitingApproval brand={brand} firstName={patient.first_name ?? ""} />;
    }
  }
  return children;
}
