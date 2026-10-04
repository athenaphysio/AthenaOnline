import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ClinicSettings = {
  runningBuilderEnabled: boolean;
  runningLaddersEnabled: boolean;
  aiToolsEnabled: boolean;
  legacyPlanCalendarEnabled: boolean;
};

// The one place David can switch the old AI-driven Running Builder and
// Running ladders screens, and every in-app AI tool, back on -- none of
// their code or data was removed when these were hidden from the menu,
// see 0090_clinic_settings.sql and 0093_ai_tools_switch.sql.
export async function getClinicSettings(): Promise<ClinicSettings> {
  const { data } = await supabaseAdmin
    .from("clinic_settings")
    .select("running_builder_enabled, running_ladders_enabled, ai_tools_enabled, legacy_plan_calendar_enabled")
    .eq("id", true)
    .maybeSingle<{ running_builder_enabled: boolean; running_ladders_enabled: boolean; ai_tools_enabled: boolean; legacy_plan_calendar_enabled: boolean }>();
  return {
    runningBuilderEnabled: data?.running_builder_enabled ?? false,
    runningLaddersEnabled: data?.running_ladders_enabled ?? false,
    aiToolsEnabled: data?.ai_tools_enabled ?? false,
    legacyPlanCalendarEnabled: data?.legacy_plan_calendar_enabled ?? false,
  };
}
