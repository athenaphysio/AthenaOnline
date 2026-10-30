import { ImageResponse } from "next/og";
import { resolvePackById } from "@/lib/brandPackResolve";
import { isPackId } from "@/lib/brandApp";

// A brand pack's home screen icon, drawn from the pack itself: its logo mark
// centred on a square of its background colour. Every pack gets a proper,
// solid square icon at the sizes phones ask for, with nothing extra to
// upload, and a new logo or colour in the pack shows on the next install.
const SIZES = new Set([180, 192, 512]);

function fallback(req: Request) {
  return Response.redirect(new URL("/icons/icon-512.png", req.url), 302);
}

async function asDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ packId: string; size: string }> }) {
  const { packId, size: sizeParam } = await params;
  const size = Number(sizeParam);
  if (!isPackId(packId) || !SIZES.has(size)) return new Response("Not found", { status: 404 });

  const pack = await resolvePackById(packId).catch(() => null);
  if (!pack) return new Response("Not found", { status: 404 });

  // A pack with its own finished icon uses it whole, filling the square.
  // Its artwork keeps the mark well inside the middle, so Android's circle
  // crop of a maskable icon only trims the outer edges.
  const ownIcon = pack.app_layout.app_icon;
  const full = ownIcon ? await asDataUrl(new URL(ownIcon, req.url).toString()) : null;

  const logoUrl = pack.logo_mark_url || pack.small_square_url;
  const logo = full ?? (logoUrl ? await asDataUrl(logoUrl) : null);
  if (!logo) return fallback(req);

  // Android may crop a maskable icon to a circle, so its logo sits well
  // inside the safe zone; the standard icon can fill more of the square.
  const maskable = new URL(req.url).searchParams.get("maskable") === "1";
  const inner = full ? size : Math.round(size * (maskable ? 0.56 : 0.72));

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: pack.background_color,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={inner} height={inner} style={{ objectFit: "contain" }} alt="" />
        </div>
      ),
      {
        width: size,
        height: size,
        headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" },
      },
    );
  } catch {
    return fallback(req);
  }
}
