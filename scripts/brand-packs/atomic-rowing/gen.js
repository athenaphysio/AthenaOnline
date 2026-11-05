// Builds the Atomic Rowing brand pack assets at the app's exact sizes
// (src/lib/brandPackSpec.ts), from the Atomic Rowing logo.
//   node scripts/brand-packs/atomic-rowing/gen.js
// Writes into public/brand-packs/atomic-rowing.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const OUT = path.join(DIR, "../../../public/brand-packs/atomic-rowing");
const b64 = (f) => "data:image/png;base64," + fs.readFileSync(path.join(DIR, f)).toString("base64");
const LOGO = b64("atomic-rowing-logo.png");
const LOGO_REV = b64("atomic-rowing-logo-reversed.png");

// Colours taken from the Atomic Rowing logo, plus a night-water base.
const C = {
  crimson: "#cb2852",
  purple: "#9a33cc",
  deep: "#330066",
  base: "#14082a",
  water: "#2a0f55",
  waterDeep: "#3a1272",
  light: "#f3eef8",
};

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// The double arrow from the logo, as a shape: two triangles.
function arrows(x, y, size, fill) {
  // Logo geometry: each triangle 314 wide, 604 tall, the second starting 312 along.
  const k = size / 604;
  const t = (ox) => `M ${x + ox * k} ${y} L ${x + (ox + 314) * k} ${y + 302 * k} L ${x + ox * k} ${y + 604 * k} Z`;
  return `<path d="${t(0)} ${t(312)}" fill="${fill}"/>`;
}

// Seamless water: every wave is a sum of sines whose periods divide the
// width exactly, and every ripple and oar is drawn again one width to the
// left and right, so the left and right edges always meet with no seam.
function water(W, H, opts = {}) {
  const top = opts.top ?? Math.round(H * 0.36);
  const r = rng(opts.seed ?? 7);
  const lines = opts.lines ?? 30;
  const paths = [];
  for (let i = 0; i < lines; i++) {
    const t = i / (lines - 1);
    const y0 = top + Math.pow(t, 1.5) * (H - top + 20);
    const amp = 2 + t * 13;
    const n1 = 2 + Math.floor(r() * 2);
    const n2 = 5 + Math.floor(r() * 3);
    const p1 = r() * Math.PI * 2;
    const p2 = r() * Math.PI * 2;
    let d = "";
    for (let x = 0; x <= W; x += 4) {
      const y = y0 + amp * (0.62 * Math.sin((2 * Math.PI * n1 * x) / W + p1) + 0.38 * Math.sin((2 * Math.PI * n2 * x) / W + p2));
      d += `${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)} `;
    }
    const colour = t < 0.55 ? C.purple : r() < 0.25 ? C.crimson : C.purple;
    const op = 0.18 + t * 0.55;
    const sw = 1.4 + t * 2.6;
    paths.push(`<path d="${d}" fill="none" stroke="${colour}" stroke-opacity="${op.toFixed(2)}" stroke-width="${sw.toFixed(2)}" stroke-linecap="round"/>`);
  }

  // Oar puddles: the swirls a blade leaves behind, drawn as broken rings.
  const puddles = [];
  const spots = opts.puddles ?? [
    [0.22, 0.8, 1],
    [0.58, 0.9, 1.25],
    [0.86, 0.74, 0.85],
  ];
  for (const [fx, fy, s] of spots) {
    for (const shift of [-W, 0, W]) {
      const cx = fx * W + shift;
      const cy = top + (H - top) * fy;
      for (let k = 0; k < 4; k++) {
        const rx = (34 + k * 26) * s;
        const ry = rx * 0.24;
        const dash = `${(18 + k * 9) * s} ${(10 + k * 6) * s}`;
        puddles.push(
          `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${C.light}" stroke-opacity="${(0.42 - k * 0.08).toFixed(2)}" stroke-width="${(2.4 - k * 0.35) * s}" stroke-dasharray="${dash}" transform="rotate(-4 ${cx} ${cy})"/>`
        );
      }
    }
  }

  // Oars: a blade dipping in beside two of the puddles, shaft rising out.
  const oars = [];
  const oarSpots = opts.oars ?? [
    [0.3, 0.76, 1, -24],
    [0.68, 0.86, 1.15, -24],
  ];
  for (const [fx, fy, s, ang] of oarSpots) {
    for (const shift of [-W, 0, W]) {
      const x = fx * W + shift;
      const y = top + (H - top) * fy;
      oars.push(`
        <g transform="translate(${x} ${y}) rotate(${ang}) scale(${s})">
          <rect x="-300" y="-5" width="250" height="10" rx="5" fill="${C.light}" fill-opacity="0.85"/>
          <rect x="-150" y="-8" width="26" height="16" rx="4" fill="${C.purple}"/>
          <path d="M -54 -6 C -20 -26, 40 -30, 66 -22 L 70 20 C 40 26, -20 22, -54 6 Z" fill="${C.crimson}"/>
          <path d="M 40 -27 L 44 23" stroke="${C.light}" stroke-opacity="0.85" stroke-width="5"/>
        </g>`);
    }
  }

  return `
    <defs>
      <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.water}" stop-opacity="0"/>
        <stop offset="${(top / H).toFixed(3)}" stop-color="${C.water}" stop-opacity="0"/>
        <stop offset="${Math.min(0.99, top / H + 0.18).toFixed(3)}" stop-color="${C.water}" stop-opacity="0.9"/>
        <stop offset="1" stop-color="${C.waterDeep}" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="wfade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/>
        <stop offset="${(top / H).toFixed(3)}" stop-color="#fff" stop-opacity="0"/>
        <stop offset="${Math.min(0.99, top / H + 0.14).toFixed(3)}" stop-color="#fff" stop-opacity="1"/>
        <stop offset="1" stop-color="#fff" stop-opacity="1"/>
      </linearGradient>
      <mask id="wmask"><rect width="${W}" height="${H}" fill="url(#wfade)"/></mask>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#wfill)"/>
    <g mask="url(#wmask)">${paths.join("")}${puddles.join("")}${oars.join("")}</g>`;
}

const page = (w, h, body, bg = "transparent") => `<!doctype html><html><head><style>
  html,body{margin:0;padding:0;background:${bg}}
  #c{width:${w}px;height:${h}px;position:relative;overflow:hidden}
  .t{font-family:"Inter";font-weight:800;letter-spacing:.32em;fill:${C.light}}
</style></head><body><div id="c">${body}</div></body></html>`;

const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`;

const ground = (w, h) => `
  <defs>
    <radialGradient id="glow" cx="50%" cy="28%" r="70%">
      <stop offset="0" stop-color="${C.deep}" stop-opacity="0.95"/>
      <stop offset="1" stop-color="${C.base}" stop-opacity="1"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>`;

async function shot(browser, name, w, h, html, { transparent = false, type = "png" } = {}) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "load" });
  await p.waitForTimeout(150);
  const el = await p.$("#c");
  await el.screenshot({ path: path.join(OUT, name), omitBackground: transparent, type, ...(type === "jpeg" ? { quality: 92 } : {}) });
  await p.close();
  console.log("wrote", name);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // Logo mark: just the double arrow, transparent.
  await shot(browser, "logo-mark.png", 1092, 1092, page(1092, 1092, svg(1092, 1092, arrows(546 - (626 / 604) * 895 / 2, 546 - 895 / 2, 895, C.crimson))), { transparent: true });

  // Wordmarks: the logo itself, fitted with breathing room.
  const fitLogo = (src, w, h, pad) => `<img src="${src}" style="position:absolute;left:${pad}px;top:${pad}px;width:${w - pad * 2}px;height:${h - pad * 2}px;object-fit:contain"/>`;
  await shot(browser, "wordmark.png", 1568, 504, page(1568, 504, fitLogo(LOGO, 1568, 504, 34)), { transparent: true });
  await shot(browser, "wordmark-reversed.png", 1568, 504, page(1568, 504, fitLogo(LOGO_REV, 1568, 504, 34)), { transparent: true });

  // Background texture: seamless water, fading out at the top.
  await shot(browser, "background-texture.png", 1568, 588, page(1568, 588, svg(1568, 588, water(1568, 588, { seed: 7 }))), { transparent: true });

  // Cover square: water, the reversed logo and the Athena Online line.
  await shot(
    browser,
    "cover-square.jpg",
    1092,
    1092,
    page(
      1092,
      1092,
      svg(1092, 1092, `${ground(1092, 1092)}${water(1092, 1092, { top: 560, lines: 26, seed: 11, puddles: [[0.3, 0.72, 1.1], [0.78, 0.86, 1.2]], oars: [[0.4, 0.68, 1.05, -24]] })}
        <text class="t" x="560" y="262" text-anchor="middle" font-size="30">ATHENA ONLINE PRESENTS</text>`) +
        `<img src="${LOGO_REV}" style="position:absolute;left:96px;top:296px;width:900px;height:240px;object-fit:contain"/>`,
      C.base
    ),
    { type: "jpeg" }
  );

  // Wide banner.
  await shot(
    browser,
    "wide-banner.jpg",
    1568,
    588,
    page(
      1568,
      588,
      svg(1568, 588, `${ground(1568, 588)}${water(1568, 588, { top: 330, lines: 24, seed: 5 })}
        <text class="t" x="796" y="92" text-anchor="middle" font-size="24">ATHENA ONLINE PRESENTS</text>`) +
        `<img src="${LOGO_REV}" style="position:absolute;left:384px;top:112px;width:800px;height:210px;object-fit:contain"/>`,
      C.base
    ),
    { type: "jpeg" }
  );

  // Small square and app icon: the double arrow over a little water.
  const iconArt = (s) =>
    svg(s, s, `${ground(s, s)}${water(s, s, { top: Math.round(s * 0.58), lines: 12, seed: 3, puddles: [[0.5, 0.75, s / 900]], oars: [] })}${arrows(s / 2 - (626 * s * 0.5) / 604 / 2 + s * 0.035, s * 0.16, s * 0.5, C.crimson)}`);
  await shot(browser, "small-square.jpg", 512, 512, page(512, 512, iconArt(512), C.base), { type: "jpeg" });
  await shot(browser, "app-icon.png", 1024, 1024, page(1024, 1024, iconArt(1024), C.base));

  // Canvas pattern: faint ripples tiled across the whole page. Every line
  // and ring is drawn again one tile away in each direction, and the wave
  // periods divide the tile exactly, so it repeats with no seams at all.
  {
    const T = 1120; // shown at 560px, drawn at twice that for sharp screens
    const r = rng(21);
    const parts = [];
    for (let i = 0; i < 14; i++) {
      const y0 = (i + 0.5) * (T / 14);
      const n1 = 1 + Math.floor(r() * 2);
      const n2 = 3 + Math.floor(r() * 3);
      const p1 = r() * Math.PI * 2;
      const p2 = r() * Math.PI * 2;
      const amp = 6 + r() * 8;
      for (const dy of [-T, 0, T]) {
        let d = "";
        for (let x = 0; x <= T; x += 8) {
          const y = y0 + dy + amp * (0.6 * Math.sin((2 * Math.PI * n1 * x) / T + p1) + 0.4 * Math.sin((2 * Math.PI * n2 * x) / T + p2));
          d += `${x === 0 ? "M" : "L"} ${x} ${y.toFixed(1)} `;
        }
        parts.push(`<path d="${d}" fill="none" stroke="${C.purple}" stroke-opacity="0.26" stroke-width="2.4"/>`);
      }
    }
    const rings = [
      [0.2, 0.18, 1],
      [0.68, 0.42, 1.3],
      [0.36, 0.74, 0.9],
      [0.88, 0.86, 0.8],
    ];
    for (const [fx, fy, sc] of rings) {
      for (const dx of [-T, 0, T]) {
        for (const dy of [-T, 0, T]) {
          const cx = fx * T + dx;
          const cy = fy * T + dy;
          for (let k = 0; k < 4; k++) {
            const rx = (40 + k * 30) * sc;
            parts.push(
              `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.3}" fill="none" stroke="${C.light}" stroke-opacity="${(0.22 - k * 0.04).toFixed(3)}" stroke-width="${2.4 - k * 0.4}" stroke-dasharray="${22 + k * 10} ${12 + k * 6}"/>`
            );
          }
        }
      }
    }
    await shot(browser, "canvas-ripples.png", T, T, page(T, T, svg(T, T, parts.join(""))), { transparent: true });
  }

  // Side rowers: an original, stylised rower, inspired by early twentieth
  // century rowing posters, at the catch and then at the finish, stacked in
  // one tall tile that repeats down each edge of the page as it scrolls.
  // Drawn faint on purpose; the right edge is the same tile mirrored, so
  // the rowers on both sides face in towards the page.
  {
    const TW = 340;
    const TH = 1100;
    const body = C.purple;
    const limb = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${body}" stroke-width="${w}" stroke-linecap="round"/>`;
    const blade = (x, y, ang) => `<ellipse cx="${x}" cy="${y}" rx="26" ry="11" fill="${C.crimson}" transform="rotate(${ang} ${x} ${y})"/>`;
    const waves = (oy) => {
      const r = rng(oy + 3);
      let out = "";
      for (let i = 0; i < 9; i++) {
        const x = 20 + r() * 290;
        const y = oy + 420 + r() * 60;
        const w = 22 + r() * 26;
        out += `<path d="M ${x} ${y} q ${w / 2} -10 ${w} 0" fill="none" stroke="${C.light}" stroke-width="3.2" stroke-linecap="round" stroke-opacity="0.55"/>`;
      }
      return out;
    };
    const hull = (oy) => `<path d="M 6 ${oy + 392} Q 170 ${oy + 414} 334 ${oy + 384}" fill="none" stroke="${body}" stroke-width="7" stroke-linecap="round"/>`;
    // A tapered torso from hips to broad shoulders, with a light line down
    // the back to suggest the muscle the painting celebrates.
    const torso = (hx, hy, sx, sy, wh, ws) => {
      const dx = sx - hx;
      const dy = sy - hy;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      const pts = [
        [hx + (nx * wh) / 2, hy + (ny * wh) / 2],
        [sx + (nx * ws) / 2, sy + (ny * ws) / 2],
        [sx - (nx * ws) / 2, sy - (ny * ws) / 2],
        [hx - (nx * wh) / 2, hy - (ny * wh) / 2],
      ];
      const poly = `<polygon points="${pts.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${body}" stroke="${body}" stroke-width="10" stroke-linejoin="round"/>`;
      const mx = (hx + sx) / 2 + (nx * ws) / 5;
      const my = (hy + sy) / 2 + (ny * ws) / 5;
      const spine = `<path d="M ${hx} ${hy} Q ${mx} ${my} ${sx} ${sy}" fill="none" stroke="${C.light}" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round"/>`;
      return poly + spine;
    };
    const catchPose = (oy) => `
      ${hull(oy)}
      <line x1="276" y1="${oy + 300}" x2="318" y2="${oy + 432}" stroke="${C.light}" stroke-width="6" stroke-linecap="round" stroke-opacity="0.7"/>
      ${blade(320, oy + 440, 72)}
      ${limb(132, oy + 360, 176, oy + 296, 26)}
      ${limb(176, oy + 296, 190, oy + 372, 20)}
      ${torso(132, oy + 358, 196, oy + 270, 26, 46)}
      <circle cx="216" cy="${oy + 244}" r="19" fill="${body}"/>
      ${limb(200, oy + 276, 276, oy + 300, 14)}
      ${waves(oy)}`;
    const finishPose = (oy) => `
      ${hull(oy)}
      <line x1="170" y1="${oy + 296}" x2="44" y2="${oy + 432}" stroke="${C.light}" stroke-width="6" stroke-linecap="round" stroke-opacity="0.7"/>
      ${blade(40, oy + 440, -48)}
      ${limb(142, oy + 360, 206, oy + 350, 26)}
      ${limb(206, oy + 350, 270, oy + 372, 20)}
      ${torso(142, oy + 358, 110, oy + 262, 26, 46)}
      <circle cx="100" cy="${oy + 236}" r="19" fill="${body}"/>
      ${limb(114, oy + 270, 140, oy + 312, 14)}
      ${limb(140, oy + 312, 172, oy + 294, 14)}
      ${waves(oy)}`;
    const tile = `<g opacity="0.2">${catchPose(20)}${finishPose(570)}</g>`;
    await shot(browser, "side-rowers-left.png", TW, TH, page(TW, TH, svg(TW, TH, tile)), { transparent: true });
    await shot(browser, "side-rowers-right.png", TW, TH, page(TW, TH, svg(TW, TH, `<g transform="translate(${TW} 0) scale(-1 1)">${tile}</g>`)), { transparent: true });

    // A look at the figures at full strength, for checking the drawing.
    await shot(browser, "../../../scripts/brand-packs/atomic-rowing/rowers-check.png", TW, TH, page(TW, TH, svg(TW, TH, `<rect width="${TW}" height="${TH}" fill="${C.base}"/>${catchPose(20)}${finishPose(570)}`), C.base));
  }

  // A seam check: three textures side by side, for a person to look at.
  const tex = "data:image/png;base64," + fs.readFileSync(path.join(OUT, "background-texture.png")).toString("base64");
  const rip = "data:image/png;base64," + fs.readFileSync(path.join(OUT, "canvas-ripples.png")).toString("base64");
  await shot(
    browser,
    "../../../scripts/brand-packs/atomic-rowing/seam-check.png",
    1500,
    900,
    page(
      1500,
      900,
      `<div style="position:absolute;inset:0;background:url(${tex}) repeat-x left bottom / auto 340px, url(${rip}) repeat 0 0 / 560px auto, ${C.base}"></div>`,
      C.base
    )
  );

  await browser.close();
})();
