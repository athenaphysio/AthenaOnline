import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClinicSettings = {
  runningBuilderEnabled: boolean;
  runningLaddersEnabled: boolean;
};

// The one place David can switch the old AI-driven Running Builder and
// Running ladders screens back on -- neither their code nor their data was
// removed when Step 1 of the athena-plan-v1 direction hid them from the
// menu, see 0090_clinic_settings.sql.
export async function getClinicSettings(): Promise<ClinicSettings> {
  const { data } = await supabaseAdmin
    .from("clinic_settings")
    .select("running_builder_enabled, running_ladders_enabled")
    .eq("id", true)
    .maybeSingle<{ running_builder_enabled: boolean; running_ladders_enabled: boolean }>();
  return {
    runningBuilderEnabled: data?.running_builder_enabled ?? false,
    runningLaddersEnabled: data?.running_ladders_enabled ?? false,
  };
}
