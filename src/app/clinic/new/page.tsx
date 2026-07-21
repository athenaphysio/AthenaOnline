import { supabase } from "@/lib/supabase";
import NewProgrammeClient from "./NewProgrammeClient";

export default async function NewProgrammePage() {
  const { data } = await supabase
    .from("exercises")
    .select("exercise_id, name_clinical")
    .eq("active", true)
    .order("exercise_id");

  return <NewProgrammeClient exerciseLibrary={data ?? []} />;
}
