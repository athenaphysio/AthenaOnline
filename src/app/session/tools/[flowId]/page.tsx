import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadClientApp, tabAllowed } from "@/lib/clientApp";
import { getLiveToolFlow } from "@/lib/flowsServer";
import { vimeoEmbedUrl } from "@/lib/vimeo";
import { armForFlow } from "@/lib/tools";
import ClientShell from "../../ClientShell";
import ToolPlayer from "./ToolPlayer";
import styles from "../../screens/Screens.module.css";

export const dynamic = "force-dynamic";

// One practice from the Tools tab: the video when it has been filmed, and
// the timed follow along with its breath pacer whenever it has moves.
export default async function Page({ params }: { params: Promise<{ flowId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/start");
  const ctx = await loadClientApp(user.id);
  if (!tabAllowed(ctx, "tools")) redirect("/session");
  const { flowId } = await params;
  const flow = await getLiveToolFlow(flowId);
  if (!flow) notFound();
  const arm = armForFlow(flow);
  const video = vimeoEmbedUrl(flow.vimeoUrl || null);

  return (
    <ClientShell ctx={ctx} active="tools" title={flow.title} lead={flow.summary || undefined}>
      <Link href={`/session/tools${arm ? `?arm=${arm.key}` : ""}`} className={styles.link} style={{ marginTop: 0, marginBottom: 12 }}>
        Back to {arm ? arm.label : "Tools"}
      </Link>
      <div className={styles.stack}>
        {video && (
          <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 14, overflow: "hidden", background: "#000" }}>
            <iframe
              src={video}
              title={flow.title}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          </div>
        )}
        {flow.moves.length > 0 && <ToolPlayer moves={flow.moves} withVideo={Boolean(video)} lowLight={arm?.key === "recovery"} />}
        {flow.entryPoint && (
          <p className={styles.muted} style={{ textAlign: "center" }}>
            Best done: {flow.entryPoint.charAt(0).toLowerCase() + flow.entryPoint.slice(1)}
          </p>
        )}
      </div>
    </ClientShell>
  );
}
