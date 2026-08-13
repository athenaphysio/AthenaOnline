import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// A tiny generic key/value lookup for single, site-wide image assets that
// don't belong to any one row -- see 0058_cardio_button_sequences.sql.
export async function getAppAssetUrl(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_assets")
    .select("url")
    .eq("key", key)
    .maybeSingle<{ url: string | null }>();
  return data?.url ?? null;
}

export const CARDIO_PM5_BUTTON_KEY_ASSET = "cardio_pm5_button_key";
