import ClientRecordShell from "../ClientRecordShell";
import SessionHistory from "@/components/record/SessionHistory";

export const dynamic = "force-dynamic";

// Sessions: the weekly plan for the current programme, and every practice
// the client has logged in the app, newest first. Shared with the coach
// portal's Sessions tab (src/components/record/SessionHistory.tsx).
export default async function SessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ClientRecordShell patientId={id} active="sessions">
      <SessionHistory patientId={id} />
    </ClientRecordShell>
  );
}
