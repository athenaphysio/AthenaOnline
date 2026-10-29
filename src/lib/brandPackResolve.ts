import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BrandPack, BrandPackTheme } from "@/lib/brandPack";
import { normaliseAppLayout, type AppLayout } from "@/lib/appLayout";

// Every patient-facing surface resolves to one of these -- every field
// guaranteed present in the sense that the two colours are always real
// hex strings (never null) and every image field is either a real URL or
// null (genuinely no image anywhere in the fallback chain, which the
// caller renders as "no image" exactly as it does today).
export type ResolvedBrandPack = {
  accent_color: string;
  background_color: string;
  /** Follows the colour pack, since a dark page only makes sense with the
   * colours that were chosen for it. */
  theme: BrandPackTheme;
  logo_mark_url: string | null;
  wordmark_url: string | null;
  cover_square_url: string | null;
  wide_banner_url: string | null;
  small_square_url: string | null;
  background_texture_url: string | null;
  wordmark_reversed_url: string | null;
  /** The pack's own heading typeface, if it has one. Follows the colour
   * pack, like the theme. */
  heading_font?: string | null;
  /** What the client sees in the app: toolbar, home items, sign-off, team.
   * Follows the colour pack, like the theme. */
  app_layout: AppLayout;
  /** True only when nothing but the default pack applied anywhere in the
   * chain -- lets a caller skip building a custom-gradient banner, etc.
   * when the result is identical to today's fixed styling anyway. */
  isAllDefault: boolean;
  /** The name of the pack the colours came from, for the browser tab. */
  name: string;
};

const IMAGE_FIELDS = [
  "logo_mark_url",
  "wordmark_url",
  "cover_square_url",
  "wide_banner_url",
  "small_square_url",
  "background_texture_url",
  "wordmark_reversed_url",
] as const;

const PACK_COLUMNS =
  "id, name, is_default, accent_color, background_color, theme, logo_mark_url, wordmark_url, cover_square_url, wide_banner_url, small_square_url, background_texture_url, wordmark_reversed_url, heading_font, app_layout, created_at, updated_at";

// Deliberately no caching here. A module-level cache used to hold this for
// the life of the server process, but Vercel keeps serverless instances
// warm across many requests, so David editing the default pack in the
// builder would keep serving the old row -- sometimes for a long time --
// on whichever instances didn't happen to get recycled, with no way for
// him to force it past short of a redeploy. It's one indexed lookup,
// cheap enough to just run fresh every time.
async function getDefaultBrandPack(): Promise<BrandPack> {
  const { data, error } = await supabaseAdmin
    .from("brand_packs")
    .select(PACK_COLUMNS)
    .eq("is_default", true)
    .maybeSingle<BrandPack>();
  if (error) throw new Error(`Default brand pack query failed: ${error.message}`);
  if (!data) throw new Error("No default brand pack exists -- the app always needs exactly one.");
  return data;
}

// Reuses the exact "active programme" concept already driving the clinic's
// own patient dashboard (clinic/patients/[id]/dashboard/page.tsx): the
// single delivery_mode: 'scheduled', not-access-paused programme, if the
// patient has one. A patient can also have Open programmes running
// alongside it, but those were never "the" programme for dashboard
// purposes and aren't here either.
export async function getActiveProgrammeId(patientId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("programmes")
    .select("id, delivery_mode, access_paused_at")
    .eq("patient_id", patientId)
    .is("access_paused_at", null)
    .order("created_at", { ascending: false })
    .returns<{ id: string; delivery_mode: string; access_paused_at: string | null }[]>();
  if (error) throw new Error(`Active programme lookup failed: ${error.message}`);
  const scheduled = (data ?? []).find((p) => p.delivery_mode === "scheduled");
  return scheduled?.id ?? null;
}

// The core lookup: client's own pack (if any) wins field-by-field over the
// active programme's pack, which wins field-by-field over the default --
// never a single all-or-nothing pack choice. A pack with only a cover
// square and colours uploaded still works everywhere else, quietly
// inheriting the default's wordmark/banner/etc.
export async function resolveBrandPack(opts: {
  patientId?: string | null;
  /** Pass this when the caller already knows which programme is relevant
   * (e.g. a specific email tied to one programme) -- skips the active-
   * programme lookup. Falls back to looking it up from patientId when
   * omitted. */
  programmeId?: string | null;
}): Promise<ResolvedBrandPack> {
  const patientId = opts.patientId ?? null;
  let programmeId = opts.programmeId ?? null;

  const [patientRes, defaultPack, packagePackId] = await Promise.all([
    patientId
      ? supabaseAdmin.from("patients").select("brand_pack_id").eq("id", patientId).maybeSingle<{ brand_pack_id: string | null }>()
      : Promise.resolve({ data: null, error: null }),
    getDefaultBrandPack(),
    patientId ? packageBrandPackId(patientId) : Promise.resolve(null),
  ]);
  if (patientRes.error) throw new Error(`Patient brand pack lookup failed: ${patientRes.error.message}`);

  if (programmeId === null && patientId) {
    programmeId = await getActiveProgrammeId(patientId);
  }

  const programmeRes = programmeId
    ? await supabaseAdmin.from("programmes").select("brand_pack_id").eq("id", programmeId).maybeSingle<{ brand_pack_id: string | null }>()
    : null;
  if (programmeRes?.error) throw new Error(`Programme brand pack lookup failed: ${programmeRes.error.message}`);

  const patientPackId = patientRes.data?.brand_pack_id ?? null;
  const programmePackId = programmeRes?.data?.brand_pack_id ?? null;
  const idsToFetch = [patientPackId, packagePackId, programmePackId].filter((id): id is string => Boolean(id));

  const packsById = new Map<string, BrandPack>();
  if (idsToFetch.length > 0) {
    const { data, error } = await supabaseAdmin.from("brand_packs").select(PACK_COLUMNS).in("id", idsToFetch).returns<BrandPack[]>();
    if (error) throw new Error(`Brand pack fetch failed: ${error.message}`);
    for (const pack of data ?? []) packsById.set(pack.id, pack);
  }

  const clientPack = patientPackId ? packsById.get(patientPackId) ?? null : null;
  const programmePack = programmePackId ? packsById.get(programmePackId) ?? null : null;
  // A client in a branded package (for example Regenerate) takes that
  // package's brand, unless they have their own pack set directly.
  const packagePack = packagePackId ? packsById.get(packagePackId) ?? null : null;

  // Colours are never null on any saved pack, so "the first pack in the
  // chain that's actually assigned" is equivalent to per-field fallback
  // for these two -- there's no "pack assigned but colour missing" state.
  const colorPack = clientPack ?? packagePack ?? programmePack ?? defaultPack;

  const resolved: ResolvedBrandPack = {
    accent_color: colorPack.accent_color,
    background_color: colorPack.background_color,
    theme: colorPack.theme === "dark" ? "dark" : "light",
    heading_font: colorPack.heading_font ?? null,
    app_layout: normaliseAppLayout(colorPack.app_layout),
    logo_mark_url: null,
    wordmark_url: null,
    cover_square_url: null,
    wide_banner_url: null,
    small_square_url: null,
    background_texture_url: null,
    wordmark_reversed_url: null,
    isAllDefault: !clientPack && !packagePack && !programmePack,
    name: colorPack.name,
  };
  for (const field of IMAGE_FIELDS) {
    resolved[field] = clientPack?.[field] ?? packagePack?.[field] ?? programmePack?.[field] ?? defaultPack[field] ?? null;
  }
  return resolved;
}

// The brand pack of the first branded package this client is in, by package
// name, or null. Never throws: a failure here just means no package brand.
async function packageBrandPackId(patientId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("patient_packages")
    .select("packages(name, brand_pack_id)")
    .eq("patient_id", patientId)
    .returns<{ packages: { name: string; brand_pack_id: string | null } | null }[]>();
  if (error) return null;
  const branded = (data ?? [])
    .map((r) => r.packages)
    .filter((p): p is { name: string; brand_pack_id: string } => Boolean(p?.brand_pack_id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return branded[0]?.brand_pack_id ?? null;
}

// One brand pack on its own, filled in from the default pack where it has
// no image of its own. For pages that belong to a package rather than to a
// single client, such as a clinician's own area.
export async function resolvePackById(packId: string): Promise<ResolvedBrandPack | null> {
  const [{ data: pack }, defaultPack] = await Promise.all([
    supabaseAdmin.from("brand_packs").select(PACK_COLUMNS).eq("id", packId).maybeSingle<BrandPack>(),
    getDefaultBrandPack(),
  ]);
  if (!pack) return null;
  const resolved: ResolvedBrandPack = {
    accent_color: pack.accent_color,
    background_color: pack.background_color,
    theme: pack.theme === "dark" ? "dark" : "light",
    heading_font: pack.heading_font ?? null,
    app_layout: normaliseAppLayout(pack.app_layout),
    logo_mark_url: null,
    wordmark_url: null,
    cover_square_url: null,
    wide_banner_url: null,
    small_square_url: null,
    background_texture_url: null,
    wordmark_reversed_url: null,
    isAllDefault: pack.is_default,
    name: pack.name,
  };
  for (const field of IMAGE_FIELDS) resolved[field] = pack[field] ?? defaultPack[field] ?? null;
  return resolved;
}
