import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ClientRecordShell from "../ClientRecordShell";
import SendFormPicker from "../SendFormPicker";
import styles from "../dashboard/ClientDashboard.module.css";
import FormSubmissions from "@/components/record/FormSubmissions";

export const dynamic = "force-dynamic";

// Forms: everything sent to this client, whether it has come back, and
// their answers. The list itself is shared with the coach portal.
export default async function FormsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: allForms } = await supabaseAdmin
    .from("forms")
    .select("id, title")
    .order("title")
    .returns<{ id: string; title: string }[]>();
  return (
    <ClientRecordShell patientId={id} active="forms">
      <FormSubmissions
        patientId={id}
        actions={<SendFormPicker patientId={id} forms={allForms ?? []} buttonClassName={`${styles.btn} ${styles.btnGhost}`} />}
      />
    </ClientRecordShell>
  );
}
