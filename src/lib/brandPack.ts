import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type BrandPack = {
  id: string;
  name: string;
  is_default: boolean;
  accent_color: string;
  background_color: string;
  logo_mark_url: string | null;
  wordmark_url: string | null;
  cover_square_url: string | null;
  wide_banner_url: string | null;
  small_square_url: string | null;
  background_texture_url: string | null;
  created_at: string;
  updated_at: string;
};

const BRAND_PACK_COLUMNS =
  "id, name, is_default, accent_color, background_color, logo_mark_url, wordmark_url, cover_square_url, wide_banner_url, small_square_url, background_texture_url, created_at, updated_at";

export async function getBrandPackCatalog(): Promise<BrandPack[]> {
  const { data, error } = await supabaseAdmin
    .from("brand_packs")
    .select(BRAND_PACK_COLUMNS)
    .order("is_default", { ascending: false })
    .order("name")
    .returns<BrandPack[]>();
  if (error) throw new Error(`Brand pack catalog query failed: ${error.message}`);
  return data ?? [];
}

export async function getBrandPack(id: string): Promise<BrandPack | null> {
  const { data, error } = await supabaseAdmin
    .from("brand_packs")
    .select(BRAND_PACK_COLUMNS)
    .eq("id", id)
    .maybeSingle<BrandPack>();
  if (error) throw new Error(`Brand pack query failed: ${error.message}`);
  return data;
}

export type BrandPackUsage = {
  programmeNames: string[];
  patientNames: string[];
};

// Everywhere a pack can currently be in use -- both direct-override
// columns Feature 2's lookup will read. Used to word the delete warning
// specifically (who, not just how many) rather than a bare count.
export async function getBrandPackUsage(id: string): Promise<BrandPackUsage> {
  const [programmesRes, patientsRes] = await Promise.all([
    supabaseAdmin.from("programmes").select("title").eq("brand_pack_id", id).returns<{ title: string }[]>(),
    supabaseAdmin
      .from("patients")
      .select("first_name, last_name")
      .eq("brand_pack_id", id)
      .returns<{ first_name: string; last_name: string | null }[]>(),
  ]);
  if (programmesRes.error) throw new Error(`Brand pack usage query failed: ${programmesRes.error.message}`);
  if (patientsRes.error) throw new Error(`Brand pack usage query failed: ${patientsRes.error.message}`);

  return {
    programmeNames: (programmesRes.data ?? []).map((p) => p.title),
    patientNames: (patientsRes.data ?? []).map((p) => (p.last_name ? `${p.first_name} ${p.last_name}` : p.first_name)),
  };
}
