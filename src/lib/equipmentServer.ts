import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Equipment } from "@/lib/equipment";

export async function getEquipmentCatalog(): Promise<Equipment[]> {
  const { data, error } = await supabaseAdmin.from("equipment").select("id, name, icon_url").order("name").returns<Equipment[]>();
  if (error) throw new Error(`Equipment catalog query failed: ${error.message}`);
  return data ?? [];
}

// exercise_id -> equipment_id[]
export async function getExerciseEquipmentMap(): Promise<Map<string, string[]>> {
  const { data, error } = await supabaseAdmin
    .from("exercise_equipment")
    .select("exercise_id, equipment_id")
    .returns<{ exercise_id: string; equipment_id: string }[]>();
  if (error) throw new Error(`Exercise equipment query failed: ${error.message}`);

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!map.has(row.exercise_id)) map.set(row.exercise_id, []);
    map.get(row.exercise_id)!.push(row.equipment_id);
  }
  return map;
}
