# Turns the Unsplash sunset water photo into the Atomic Rowing page
# background: recoloured from teal and orange into the pack's night purples
# with crimson light on the ripples, then cross-faded at both edges so it
# repeats across and down with no seam. Writes canvas-water.webp.
# Source photo: Unsplash (free to use and adapt under the Unsplash licence).
#   python3 scripts/brand-packs/atomic-rowing/water.py
import numpy as np
from PIL import Image, ImageFilter

HERE = "scripts/brand-packs/atomic-rowing/"
OUT = "public/brand-packs/atomic-rowing/"
WIDTH = 1200
BLEND = 0.12  # share of each edge cross-faded into the opposite edge
STRENGTH = 0.45  # how far the water shows over the plain base colour

img = Image.open(HERE + "water-unsplash.jpg").convert("RGB")
# Only the evenly rippled middle of the photo, not its blurred top and bottom.
img = img.crop((0, round(img.height * 0.28), img.width, round(img.height * 0.78)))
img = img.resize((WIDTH, round(img.height * WIDTH / img.width)), Image.LANCZOS)
# A touch of softening hides the photo's grain once it is recoloured.
img = img.filter(ImageFilter.GaussianBlur(1.2))
src = np.asarray(img).astype(float) / 255


def seamless(a, axis):
    n = a.shape[axis]
    b = int(n * BLEND)
    a = np.moveaxis(a, axis, 0)
    out = a[: n - b].copy()
    t = np.linspace(0, 1, b)[:, None, None]
    out[:b] = a[n - b :] * (1 - t) + a[:b] * t
    return np.moveaxis(out, 0, axis)


tile = seamless(seamless(src, 0), 1)

lum = 0.299 * tile[..., 0] + 0.587 * tile[..., 1] + 0.114 * tile[..., 2]
# Even out the photo's broad light and dark areas, keeping the ripples, so
# no band of darker water repeats down the page.
broad = np.asarray(Image.fromarray((lum * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(90))).astype(float) / 255
lum = lum - broad + broad.mean()
lo, hi = np.percentile(lum, 2), np.percentile(lum, 98)
lum = np.clip((lum - lo) / (hi - lo), 0, 1)
stops = np.array(
    [[0x0E, 0x05, 0x1F], [0x22, 0x0C, 0x46], [0x45, 0x18, 0x80], [0x9A, 0x33, 0xCC], [0xCB, 0x28, 0x52]], float
) / 255
pos = np.array([0, 0.3, 0.55, 0.8, 1.0])
col = np.zeros_like(tile)
for c in range(3):
    col[..., c] = np.interp(lum, pos, stops[:, c])

base = np.array([0x14, 0x08, 0x2A], float) / 255
out = base * (1 - STRENGTH) + col * STRENGTH

Image.fromarray((out * 255).round().astype("uint8"), "RGB").save(OUT + "canvas-water.webp", quality=80, method=6)
print(out.shape)
