import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { answersByCode, scoreLifestyle, scoreWellbeing } from "@/lib/corporateAthlete";
import { londonDateKey } from "@/lib/diary";
import type { TimepointKey } from "@/lib/passport";

// Questionnaire scores into the Human Passport. When a client submits the
// Wellbeing survey or a Lifestyle check, each complete score is saved as a
// draft passport result so it can be followed over time beside their other
// results. Drafts are invisible to the client and follow the same
// multidisciplinary sign-off as everything else before any release.

const MEASURE_MARKER: Record<string, string> = {
  "PHQ-9": "mind_behaviour.phq-9",
  "GAD-7": "mind_behaviour.gad-7",
  "DASS-21 Stress": "mind_behaviour.dass-21-stress",
  "WHO-5": "mind_behaviour.who-5",
  "CBI personal burnout": "mind_behaviour.cbi-personal-burnout",
  "CBI work-related burnout": "mind_behaviour.cbi-work-burnout",
  "Brief Resilience Scale": "mind_behaviour.brief-resilience-scale",
  "Fatigue Assessment Scale": "mind_behaviour.fatigue-assessment-scale",
  "Jenkins Sleep Scale": "sleep_energy.jenkins-sleep-scale",
  "AUDIT-C": "mind_behaviour.audit-c",
};

// Lifestyle checks name their month; the Wellbeing survey is one form used
// at months 1, 3 and 6, so its timepoint comes from how many the client has
// submitted. Either can be corrected on the result afterwards.
async function timepointFor(patientId: string, formTitle: string): Promise<TimepointKey> {
  const month = formTitle.match(/month\s*(\d+)/i)?.[1];
  if (month === "1") return "baseline";
  if (month === "3") return "month_3";
  if (month === "6") return "month_6";
  const { data } = await supabaseAdmin
    .from("form_responses")
    .select("id, form_sends!inner(forms!inner(title))")
    .eq("patient_id", patientId)
    .eq("form_sends.forms.title", formTitle);
  const n = data?.length ?? 1;
  return n <= 1 ? "baseline" : n === 2 ? "month_3" : n === 3 ? "month_6" : "review";
}

export async function saveQuestionnaireScoresToPassport(
  patientId: string,
  formTitle: string,
  answers: { prompt: string; answer: string }[]
): Promise<number> {
  const isWellbeing = /wellbeing survey/i.test(formTitle);
  const isLifestyle = /lifestyle check/i.test(formTitle);
  if (!isWellbeing && !isLifestyle) return 0;

  const byCode = answersByCode(answers);
  const scores = isWellbeing ? scoreWellbeing(byCode) : scoreLifestyle(byCode);
  const wanted = scores.filter((s) => s.complete && s.value != null && MEASURE_MARKER[s.measure]);
  if (wanted.length === 0) return 0;

  const keys = wanted.map((s) => MEASURE_MARKER[s.measure]);
  const { data: markers } = await supabaseAdmin
    .from("passport_markers")
    .select("marker_key, range_low, range_high, optimal_low, optimal_high")
    .in("marker_key", keys)
    .returns<{ marker_key: string; range_low: number | null; range_high: number | null; optimal_low: number | null; optimal_high: number | null }[]>();
  const markerByKey = new Map((markers ?? []).map((m) => [m.marker_key, m]));

  const timepoint = await timepointFor(patientId, formTitle);
  const takenOn = londonDateKey(new Date());
  const rows = wanted
    .filter((s) => markerByKey.has(MEASURE_MARKER[s.measure]))
    .map((s) => {
      const m = markerByKey.get(MEASURE_MARKER[s.measure])!;
      return {
        patient_id: patientId,
        marker_key: m.marker_key,
        value: Math.round(Number(s.value) * 100) / 100,
        timepoint,
        taken_on: takenOn,
        source: `${formTitle}, scored in the app`,
        range_low: m.range_low,
        range_high: m.range_high,
        optimal_low: m.optimal_low,
        optimal_high: m.optimal_high,
        status: "draft",
        released_at: null,
        updated_at: new Date().toISOString(),
      };
    });
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("passport_results").upsert(rows, { onConflict: "patient_id,marker_key,taken_on" });
  if (error) throw new Error(error.message);
  return rows.length;
}
