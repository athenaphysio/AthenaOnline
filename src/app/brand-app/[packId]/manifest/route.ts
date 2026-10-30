import { resolvePackById } from "@/lib/brandPackResolve";
import { brandIconPath, isPackId } from "@/lib/brandApp";
import { homeScreenName } from "@/lib/brandAppName";

// A brand pack's own app manifest. Android reads this when a client adds the
// app to their home screen, for the icon, the name under it and the colours
// of the splash screen. Phones fetch a manifest without the client's login,
// so it is found by the pack's id in the address, which reveals nothing
// private: only the pack's name, colours and logo, all of which the client
// already sees in the app.
export async function GET(_req: Request, { params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  if (!isPackId(packId)) return new Response("Not found", { status: 404 });

  const pack = await resolvePackById(packId).catch(() => null);
  if (!pack) return new Response("Not found", { status: 404 });

  const v = pack.updated_at;
  const manifest = {
    // A separate id per pack, so a phone treats each brand's app as its own.
    id: `/session?app=${pack.id}`,
    name: pack.app_layout.app_name || pack.name,
    short_name: homeScreenName(pack.app_layout.app_name || pack.name),
    description: `Your programme with ${pack.name}.`,
    start_url: "/session",
    scope: "/",
    display: "standalone",
    background_color: pack.background_color,
    theme_color: pack.background_color,
    icons: [
      { src: brandIconPath(pack.id, 192, v), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: brandIconPath(pack.id, 512, v), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: brandIconPath(pack.id, 512, v, true), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
    },
  });
}
