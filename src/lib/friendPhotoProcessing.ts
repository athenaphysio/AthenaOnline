import "server-only";
import sharp from "sharp";

// A plain photographic crop plus a border stroke -- no duotone tint, no
// cream background fill, unlike processEquipmentIcon (that treatment is
// for a cut-out equipment icon, not a real photo; confirmed with David to
// keep the two visually distinct). David uploads an ordinary photo; this
// crops it to fill a portrait rectangle exactly (a real photo has colour
// at every edge, so cover-crop needs no letterboxing the way an icon's
// isolated subject would), then clips the corners and draws the border.
const WIDTH = 480;
const HEIGHT = 640;
const CORNER_RADIUS = 20;
const BORDER_WIDTH = 4;
const CRIMSON = "#9b1c1c";

export async function processFriendPhoto(input: Buffer): Promise<Buffer> {
  const cropped = await sharp(input)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "attention" })
    .png()
    .toBuffer();

  const half = BORDER_WIDTH / 2;
  const roundedRectSvg = (stroke: string | null, fill: string | null) => `
    <svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${half}" y="${half}" width="${WIDTH - BORDER_WIDTH}" height="${HEIGHT - BORDER_WIDTH}"
        rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}"
        ${fill ? `fill="${fill}"` : 'fill="none"'}
        ${stroke ? `stroke="${stroke}" stroke-width="${BORDER_WIDTH}"` : ""} />
    </svg>`;

  // Genuinely transparent rounded corners (a dest-in mask), same technique
  // as processEquipmentIcon, so the corner radius holds at any display size
  // rather than depending on a wrapping element's own CSS border-radius.
  const masked = await sharp(cropped)
    .composite([{ input: Buffer.from(roundedRectSvg(null, "white")), blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp(masked)
    .composite([{ input: Buffer.from(roundedRectSvg(CRIMSON, null)), left: 0, top: 0 }])
    .png()
    .toBuffer();
}
