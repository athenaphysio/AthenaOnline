import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A brand pack's client guide (0125_brand_pack_guide.sql): the guide a
// client on that pack reads before they start, for example the Return to
// Strength guide in Athena Concussion.

export type PackGuide = {
  packId: string;
  title: string;
  body: string;
  required: boolean;
};

// The guide on one pack, or null when the pack has none written.
export async function getPackGuide(packId: string): Promise<PackGuide | null> {
  const { data, error } = await supabaseAdmin
    .from("brand_packs")
    .select("id, guide_title, guide_body, guide_required")
    .eq("id", packId)
    .maybeSingle<{ id: string; guide_title: string | null; guide_body: string | null; guide_required: boolean }>();
  if (error || !data || !data.guide_body?.trim()) return null;
  return {
    packId: data.id,
    title: data.guide_title?.trim() || "Your guide",
    body: data.guide_body,
    required: data.guide_required === true,
  };
}

export async function hasReadGuide(patientId: string, packId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("patient_guide_reads")
    .select("read_at")
    .eq("patient_id", patientId)
    .eq("brand_pack_id", packId)
    .maybeSingle<{ read_at: string }>();
  return Boolean(data);
}

export async function markGuideRead(patientId: string, packId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("patient_guide_reads")
    .upsert({ patient_id: patientId, brand_pack_id: packId }, { onConflict: "patient_id,brand_pack_id", ignoreDuplicates: true });
  if (error) throw new Error(`Saving guide read failed: ${error.message}`);
}
