import type { ReactNode } from "react";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { metadataForClient } from "@/lib/brandMetadata";

// Every page of a client's record: the browser tab wears the client's
// brand pack, named for the client, when they have one.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data } = await supabaseAdmin.from("patients").select("first_name, last_name").eq("id", id).maybeSingle<{ first_name: string | null; last_name: string | null }>();
  const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ") || null;
  return metadataForClient(id, name);
}

export default function ClientRecordLayout({ children }: { children: ReactNode }) {
  return children;
}
