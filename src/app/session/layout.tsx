import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { createClient } from "@/lib/supabase/server";
import { metadataForClient, viewportForClient } from "@/lib/brandMetadata";

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

export default function SessionLayout({ children }: { children: ReactNode }) {
  return children;
}
