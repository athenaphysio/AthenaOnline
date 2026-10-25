import { notFound } from "next/navigation";
import { getFlow } from "@/lib/flowsServer";
import FlowPrompter from "./FlowPrompter";

export const dynamic = "force-dynamic";

export default async function FlowPrompterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const flow = await getFlow(id);
  if (!flow) notFound();
  return <FlowPrompter flow={flow} />;
}
