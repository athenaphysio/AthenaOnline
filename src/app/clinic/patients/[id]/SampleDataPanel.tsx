import { supabaseAdmin } from "@/lib/supabaseAdmin";
import RemoveSampleDataButton from "./RemoveSampleDataButton";

// Shown only while a client has sample data in their account, so it is
// always clear which entries are examples and easy to clear them out.
export default async function SampleDataPanel({ patientId, firstName }: { patientId: string; firstName: string }) {
  const { data } = await supabaseAdmin
    .from("programmes")
    .select("title")
    .eq("patient_id", patientId)
    .eq("is_sample", true)
    .returns<{ title: string }[]>();
  if (!data || data.length === 0) return null;
  return <RemoveSampleDataButton patientId={patientId} firstName={firstName} titles={data.map((p) => p.title)} />;
}
