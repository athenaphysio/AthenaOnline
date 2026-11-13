import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { DEFAULT_LANG, isLang, type Lang } from "./languages";

// The language a client has chosen for their app. Read on its own and
// defensively, so that if anything goes wrong here (or the language column
// has not reached the database yet) the app simply shows English.
export async function clientLanguage(userId: string): Promise<Lang> {
  const { data, error } = await supabaseAdmin
    .from("patients")
    .select("language")
    .eq("id", userId)
    .maybeSingle<{ language: string | null }>();
  if (error) return DEFAULT_LANG;
  return isLang(data?.language) ? data.language : DEFAULT_LANG;
}
