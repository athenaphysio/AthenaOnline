import { notFound } from "next/navigation";
import { loadCoachClient } from "@/lib/coachClient";
import FormSubmissions from "@/components/record/FormSubmissions";
import CoachClientShell from "../CoachClientShell";

export const dynamic = "force-dynamic";

// Forms sent to the client and their answers, with scores, read only.
// Shown only with "Forms and answers".
export default async function CoachForms({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadCoachClient(id);
  if (!ctx.can("forms")) notFound();
  await ctx.record(["forms"]);
  return (
    <CoachClientShell ctx={ctx} active="forms">
      <FormSubmissions patientId={id} />
    </CoachClientShell>
  );
}
