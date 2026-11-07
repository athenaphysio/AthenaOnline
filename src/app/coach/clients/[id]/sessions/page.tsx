import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import SessionHistory from "@/components/record/SessionHistory";
import CoachClientShell from "../CoachClientShell";

export const dynamic = "force-dynamic";

// The client's weekly plan and every practice they have logged, exactly as
// the clinic sees it, read only. Shown only with "Sessions and practice log".
export default async function CoachSessions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCoachClient(id);
  if (!ctx.can("sessions")) notFound();
  await ctx.record(["sessions"]);
  return (
    <CoachClientShell ctx={ctx} active="sessions">
      <SessionHistory patientId={id} />
    </CoachClientShell>
  );
}
