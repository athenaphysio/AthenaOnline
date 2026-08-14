import "server-only";
import sharp from "sharp";

// Automates the second half of David's own manual process (see
// claude_code_instructions_equipment_icons.md Phase 4 and the
// equipment_icons_crimson/ reference batch) -- the duotone recolour and
// bordered-square framing. Subject isolation stays David's own job: he
// uploads an already-cut-out PNG (real transparency, background removed),
// since reliable background removal for an arbitrary photo needs an ML
// model or a paid API, not something plain code can do well. Confirmed
// with David rather than guessed.
const FRAME_SIZE = 320;
const PADDING = 40;
const CORNER_RADIUS = 24;
const BORDER_WIDTH = 4;
const CREAM = "#f2ede4";
const CRIMSON = { r: 155, g: 28, b: 28 };

export async function processEquipmentIcon(input: Buffer): Promise<Buffer> {
  const contentSize = FRAME_SIZE - PADDING * 2;

  // Duotone: tint() desaturates by luminance and reapplies the crimson hue
  // across that tonal range in one step -- dark shadows stay dark, light
  // areas take on the tint colour, the same single-hue tonal effect the
  // reference batch shows, not a flat silhouette. (A preceding .greyscale()
  // call looks like the right way to get there but silently breaks tint()
  // in this sharp version -- confirmed by testing, not assumed.)
  const subject = await sharp(input)
    .resize(contentSize, contentSize, { fit: "inside", withoutEnlargement: true })
    .tint(CRIMSON)
    .png()
    .toBuffer();

  const subjectMeta = await sharp(subject).metadata();
  const left = Math.round((FRAME_SIZE - (subjectMeta.width ?? contentSize)) / 2);
  const top = Math.round((FRAME_SIZE - (subjectMeta.height ?? contentSize)) / 2);

  // Rounded-square cream base, clipped with a mask rather than just drawn
  // square, so the corners are genuinely transparent outside the frame --
  // matches the reference batch's own bordered-square look at any size,
  // not dependent on a wrapping element's own CSS border-radius.
  const half = BORDER_WIDTH / 2;
  const roundedRectSvg = (stroke: string | null, fill: string | null) => `
    <svg width="${FRAME_SIZE}" height="${FRAME_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${half}" y="${half}" width="${FRAME_SIZE - BORDER_WIDTH}" height="${FRAME_SIZE - BORDER_WIDTH}"
        rx="${CORNER_RADIUS}" ry="${CORNER_RADIUS}"
        ${fill ? `fill="${fill}"` : "fill=\"none\""}
        ${stroke ? `stroke="${stroke}" stroke-width="${BORDER_WIDTH}"` : ""} />
    </svg>`;

  const creamBase = await sharp({ create: { width: FRAME_SIZE, height: FRAME_SIZE, channels: 4, background: CREAM } })
    .composite([{ input: Buffer.from(roundedRectSvg(null, "white")), blend: "dest-in" }])
    .png()
    .toBuffer();

  return sharp(creamBase)
    .composite([
      { input: subject, left, top },
      { input: Buffer.from(roundedRectSvg(CRIMSON_HEX(), null)), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

function CRIMSON_HEX(): string {
  return `#${CRIMSON.r.toString(16).padStart(2, "0")}${CRIMSON.g.toString(16).padStart(2, "0")}${CRIMSON.b.toString(16).padStart(2, "0")}`;
}
