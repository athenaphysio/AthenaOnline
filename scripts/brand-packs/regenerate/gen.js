// Builds the Regenerate brand pack assets at the app's exact sizes.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const b64 = (f) => "data:image/png;base64," + fs.readFileSync(path.join(DIR, f)).toString("base64");
const LOGO = b64("../regen/Regenerate-logo.png"); // light letters, for dark grounds
const LOGO_DARK = b64("wordmark-dark.png"); // navy letters, for light grounds
const MARK = b64("mark-big.png");

// Colours taken from regeneratewellness.co.uk and the Regenerate logo.
const C = {
  navy: "#1B252F",
  deep: "#0E141A",
  black: "#07090C",
  orange: "#EB6F15",
  orangeLogo: "#F7941D",
  coral: "#C0584A",
  rust: "#A8420C",
};

// A small seeded random number generator, so the artwork is repeatable.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// One connector trace: a dot, a straight run, a 45 degree jog, another
// run, and a dot, exactly like the lines around the Regenerate mark.
function trace(r, x, y, scale, colour, opacity) {
  const dir = r() < 0.5 ? -1 : 1;
  const run1 = (40 + r() * 160) * scale;
  const jog = (14 + r() * 40) * scale * (r() < 0.5 ? -1 : 1);
  const run2 = (30 + r() * 220) * scale;
  const x1 = x + dir * run1;
  const x2 = x1 + dir * Math.abs(jog);
  const y2 = y + jog;
  const x3 = x2 + dir * run2;
  const sw = 2.2 * scale;
  const dot = 5.5 * scale;
  return `<g opacity="${opacity.toFixed(2)}" stroke="${colour}" fill="${colour}">
    <path d="M ${x} ${y} L ${x1} ${y} L ${x2} ${y2} L ${x3} ${y2}" fill="none" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x}" cy="${y}" r="${dot}" stroke="none"/>
    <circle cx="${x3}" cy="${y2}" r="${dot}" stroke="none"/>
  </g>`;
}

const PALETTE = [C.orange, C.orangeLogo, C.coral, C.rust];

// A field of traces. keepClear is a box to leave empty (for a logo);
// bias pushes traces towards the bottom.
function traceField({ w, h, n, seed, scale = 1, keepClear = null, bias = 0, minOpacity = 0.25, maxOpacity = 0.85 }) {
  const r = rng(seed);
  const out = [];
  let tries = 0;
  while (out.length < n && tries < n * 30) {
    tries++;
    const x = r() * w;
    let y = r() * h;
    if (bias) y = h - Math.pow(r(), 1 + bias) * h;
    y = Math.round(y / (18 * scale)) * 18 * scale; // sit on a loose grid, like circuitry
    if (keepClear && x > keepClear[0] - 260 * scale && x < keepClear[2] + 260 * scale && y > keepClear[1] && y < keepClear[3]) continue;
    const colour = PALETTE[Math.floor(r() * PALETTE.length)];
    const op = minOpacity + r() * (maxOpacity - minOpacity);
    out.push(trace(r, x, y, scale, colour, op));
  }
  return out.join("\n");
}

// The faded dark ground: navy lifting out of near black, with a low glow.
function darkGround(w, h, id, glow = 0.22) {
  return `<defs>
    <radialGradient id="${id}-g" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="${C.navy}"/>
      <stop offset="0.6" stop-color="${C.deep}"/>
      <stop offset="1" stop-color="${C.black}"/>
    </radialGradient>
    <radialGradient id="${id}-o" cx="50%" cy="100%" r="70%">
      <stop offset="0" stop-color="${C.orange}" stop-opacity="${glow}"/>
      <stop offset="1" stop-color="${C.orange}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-v" cx="50%" cy="50%" r="72%">
      <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#${id}-g)"/>
  <rect width="${w}" height="${h}" fill="url(#${id}-o)"/>`;
}
const vignette = (w, h, id) => `<rect width="${w}" height="${h}" fill="url(#${id}-v)"/>`;

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

const ASSETS = [
  {
    file: "logo_mark.png",
    w: 1092,
    h: 1092,
    transparent: true,
    body: (w, h) => `<image href="${MARK}" x="${(w - 477) / 2}" y="${(h - 900) / 2}" width="477" height="900"/>`,
  },
  {
    file: "wordmark.png",
    w: 1568,
    h: 504,
    transparent: true,
    body: (w, h) => {
      const lh = 480, lw = Math.round((1516 * lh) / 542);
      return `<image href="${LOGO_DARK}" x="${(w - lw) / 2}" y="${(h - lh) / 2}" width="${lw}" height="${lh}"/>`;
    },
  },
  {
    file: "wordmark_reversed.png",
    w: 1568,
    h: 504,
    transparent: true,
    body: (w, h) => {
      const lh = 480, lw = Math.round((1516 * lh) / 542);
      return `<image href="${LOGO}" x="${(w - lw) / 2}" y="${(h - lh) / 2}" width="${lw}" height="${lh}"/>`;
    },
  },
  {
    file: "cover_square.jpg",
    w: 1092,
    h: 1092,
    body: (w, h) => {
      const lw = 860, lh = Math.round((542 * lw) / 1516);
      const ly = (h - lh) / 2;
      return `${darkGround(w, h, "cs", 0.26)}
        ${traceField({ w, h, n: 46, seed: 7, scale: 1.1, keepClear: [(w - lw) / 2, ly - 40, (w + lw) / 2, ly + lh + 40], minOpacity: 0.18, maxOpacity: 0.7 })}
        ${vignette(w, h, "cs")}
        <image href="${LOGO}" x="${(w - lw) / 2}" y="${ly}" width="${lw}" height="${lh}"/>`;
    },
  },
  {
    file: "wide_banner.jpg",
    w: 1568,
    h: 588,
    body: (w, h) => `${darkGround(w, h, "wb", 0.2)}
      ${traceField({ w, h, n: 70, seed: 21, scale: 0.95, minOpacity: 0.16, maxOpacity: 0.72 })}
      ${vignette(w, h, "wb")}`,
  },
  {
    file: "small_square.png",
    w: 512,
    h: 512,
    transparent: true,
    body: (w, h) => {
      const mh = 400, mw = Math.round((477 * mh) / 900);
      return `<defs><radialGradient id="ss" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${C.navy}"/><stop offset="1" stop-color="${C.black}"/></radialGradient></defs>
        <rect width="${w}" height="${h}" rx="96" fill="url(#ss)"/>
        <image href="${MARK}" x="${(w - mw) / 2}" y="${(h - mh) / 2}" width="${mw}" height="${mh}"/>`;
    },
  },
  {
    // Fixed along the bottom of a dark page: dense at the foot, fading
    // away to nothing at the top, on a transparent background.
    file: "background_texture.png",
    w: 1568,
    h: 588,
    transparent: true,
    body: (w, h) => `<defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0"/>
          <stop offset="0.45" stop-color="#fff" stop-opacity="0.35"/>
          <stop offset="1" stop-color="#fff" stop-opacity="1"/>
        </linearGradient>
        <mask id="m"><rect width="${w}" height="${h}" fill="url(#fade)"/></mask>
      </defs>
      <g mask="url(#m)">${traceField({ w, h, n: 95, seed: 33, scale: 0.9, bias: 0.6, minOpacity: 0.3, maxOpacity: 0.9 })}</g>`,
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  fs.mkdirSync(path.join(DIR, "out"), { recursive: true });
  for (const a of ASSETS) {
    await page.setViewportSize({ width: a.w, height: a.h });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(a.w, a.h, a.body(a.w, a.h))}</body></html>`);
    await page.waitForTimeout(150);
    const file = path.join(DIR, "out", a.file);
    await page.screenshot({
      path: file,
      omitBackground: !!a.transparent,
      type: a.file.endsWith(".jpg") ? "jpeg" : "png",
      ...(a.file.endsWith(".jpg") ? { quality: 90 } : {}),
      clip: { x: 0, y: 0, width: a.w, height: a.h },
    });
    console.log("made", a.file);
  }
  await browser.close();
})();
