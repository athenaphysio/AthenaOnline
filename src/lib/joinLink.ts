import "server-only";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPackId } from "@/lib/brandApp";
import { packSlug } from "@/lib/loginBrand";
import { normaliseAppLayout } from "@/lib/appLayout";
import { BRAND_PACK_COOKIE, BRAND_PACK_COOKIE_MAX_AGE } from "@/lib/brandPackCookie";

// A brand's own link to the app (/join/concussion), to its registration
// form (/join/concussion/register), to registration followed by the Programme
// intake form (/join/concussion/register-intake), or to the intake form on its
// own (/join/concussion/intake). Opening it
// marks this phone as belonging to that brand and goes on to the login page
// with the brand named in the address, so the page, the home screen icon and
// the preview shown when the link is pasted into WhatsApp or an email are
// all in the brand's own look. An unknown name simply goes to the standard
// login page.
//
// A pack is found by the link name set on its page in the clinic, then by
// its full name (/join/regenerate-wellness), then by the first word of its
// name (/join/regenerate) as long as no other pack starts with that word and
// it is not the standard pack's own first word.
export async function joinRedirect(req: Request, pack: string, path: "/start" | "/register" | "/register?then=intake" | "/intake"): Promise<NextResponse> {
  const wanted = decodeURIComponent(pack).toLowerCase();
  const target = new URL(path, req.url);

  const { data: packs } = await supabaseAdmin
    .from("brand_packs")
    .select("id, name, is_default, app_layout")
    .returns<{ id: string; name: string; is_default: boolean; app_layout: unknown }[]>();
  const candidates = (packs ?? []).filter((p) => !p.is_default);
  const firstWord = (p: { name: string }) => packSlug(p.name).split("-")[0];
  // The standard pack's own first word (athena) never picks a specialist
  // pack such as Athena Concussion just because it shares the word.
  const standardWord = (packs ?? []).find((p) => p.is_default);
  const byFirstWord =
    standardWord && firstWord(standardWord) === wanted ? [] : candidates.filter((p) => firstWord(p) === wanted);
  const match =
    candidates.find((p) => p.id === wanted) ??
    candidates.find((p) => normaliseAppLayout(p.app_layout).link_name === wanted) ??
    candidates.find((p) => packSlug(p.name) === wanted) ??
    (byFirstWord.length === 1 ? byFirstWord[0] : undefined);

  if (match && isPackId(match.id)) target.searchParams.set("brand", match.id);
  const res = NextResponse.redirect(target, 302);
  if (match && isPackId(match.id)) {
    res.cookies.set(BRAND_PACK_COOKIE, match.id, {
      path: "/",
      maxAge: BRAND_PACK_COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: target.protocol === "https:",
    });
  }
  return res;
}
