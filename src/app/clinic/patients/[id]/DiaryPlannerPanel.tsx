import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { activeLinks, loadPlanner, locationEquipment } from "@/lib/diaryServer";
import DiaryPlannerControls from "./DiaryPlannerControls";

// David's view of one client's diary planner: whether it is on, who it is
// shared with, whether Google Calendar is linked, the slots placed for this
// week and next, and what equipment the client has in each place.
export default async function DiaryPlannerPanel({ patientId, firstName }: { patientId: string; firstName: string }) {
  const { data: patient } = await supabaseAdmin
    .from("patients")
    .select("diary_planner_enabled")
    .eq("id", patientId)
    .maybeSingle<{ diary_planner_enabled: boolean }>();
  const enabled = patient?.diary_planner_enabled === true;

  if (!enabled) {
    return <DiaryPlannerControls patientId={patientId} firstName={firstName} enabled={false} />;
  }

  const [planner, links, equipmentByLocation, { data: equipment }] = await Promise.all([
    loadPlanner(patientId, "clinic"),
    activeLinks(patientId),
    locationEquipment(patientId),
    supabaseAdmin.from("equipment").select("id, name").order("name").returns<{ id: string; name: string }[]>(),
  ]);

  const slots = planner.weeks.flatMap((w) =>
    w.sessions.map((s) => ({ key: `${w.programmeId}:${w.weekNumber}:${s.programmeWorkoutId}`, label: `${s.label}, week ${w.weekNumber}`, slot: s.slot })),
  );

  return (
    <DiaryPlannerControls
      patientId={patientId}
      firstName={firstName}
      enabled
      google={planner.google}
      links={links.map((l) => ({ id: l.id, paName: l.paName, lastUsedAt: l.lastUsedAt }))}
      slots={slots}
      equipment={equipment ?? []}
      equipmentByLocation={equipmentByLocation}
    />
  );
}
