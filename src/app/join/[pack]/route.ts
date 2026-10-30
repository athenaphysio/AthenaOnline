import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isPackId } from "@/lib/brandApp";
import { packSlug } from "@/lib/loginBrand";
import { BRAND_PACK_COOKIE, BRAND_PACK_COOKIE_MAX_AGE } from "@/lib/brandPackCookie";

// A brand's own link to the app, for example /join/regenerate. Opening it
// marks this phone as belonging to that brand and goes on to the login page,
// which then shows the brand's colours, logo and home screen icon. An
// unknown name simply goes to the standard login page.
export async function GET(req: Request, { params }: { params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  const wanted = decodeURIComponent(pack).toLowerCase();
  const target = new URL("/start", req.url);

  const { data: packs } = await supabaseAdmin
    .from("brand_packs")
    .select("id, name, is_default")
    .returns<{ id: string; name: string; is_default: boolean }[]>();
  const match = (packs ?? []).find(
    (p) =>
      !p.is_default &&
      (p.id === wanted || packSlug(p.name) === wanted || packSlug(p.name).split("-")[0] === wanted),
  );

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
