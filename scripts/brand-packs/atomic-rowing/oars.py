# Turns the Unsplash oars photo into the Atomic Rowing edge pattern:
# Source photo: Unsplash (free to use and adapt under the Unsplash licence).
# recoloured to the pack's purples (pink collars become the logo crimson),
# made to repeat top to bottom with no seam, faded towards the page centre,
# and mirrored for the left edge. Writes side-oars-right.webp / -left.webp.
#   python3 scripts/brand-packs/atomic-rowing/oars.py
import numpy as np
from PIL import Image

HERE = "scripts/brand-packs/atomic-rowing/"
OUT = "public/brand-packs/atomic-rowing/"
WIDTH = 1120  # drawn at twice the 560px it is shown at
BLEND = 150  # rows (in the original) cross-faded so the repeat has no seam
STRENGTH = 0.36  # how strongly it shows over the background, at the edge

src = np.asarray(Image.open(HERE + "oars-unsplash.jpg").convert("RGB")).astype(float) / 255
H, W, _ = src.shape

# Seamless top to bottom: the first BLEND rows fade from the photo's last
# rows into its first rows, and the tile stops BLEND rows early, so each
# repeat runs straight on from the one above it.
tile = src[: H - BLEND].copy()
t = np.linspace(0, 1, BLEND)[:, None, None]
tile[:BLEND] = src[H - BLEND :] * (1 - t) + src[:BLEND] * t

# Recolour by brightness. The grey water sinks into the page's own dark
# purple, while the black shafts lift to purple and the white blades to
# near white, so the oars are what you see.
lum = 0.299 * tile[..., 0] + 0.587 * tile[..., 1] + 0.114 * tile[..., 2]
stops = np.array(
    [[0x8A, 0x3A, 0xC0], [0x3A, 0x12, 0x72], [0x14, 0x08, 0x2A], [0x26, 0x10, 0x48], [0x9A, 0x33, 0xCC], [0xF3, 0xEE, 0xF8]], float
) / 255
pos = np.array([0, 0.22, 0.45, 0.66, 0.82, 1.0])
out = np.zeros_like(tile)
for c in range(3):
    out[..., c] = np.interp(lum, pos, stops[:, c])

# The pink oar collars become the logo crimson.
r, g, b = tile[..., 0], tile[..., 1], tile[..., 2]
pink = np.clip(((r - g) - 0.25) / 0.2, 0, 1) * np.clip((r - 0.45) / 0.2, 0, 1)
crimson = np.array([0xCB, 0x28, 0x52], float) / 255
out = out * (1 - pink[..., None]) + crimson * pink[..., None]

# Transparency: strongest at the boat edge, fading out towards the page
# centre, and a little stronger where the picture is light (the blades).
h, w = lum.shape
x = np.linspace(0, 1, w)
edge = np.clip(x / 0.3, 0, 1)
edge = edge * edge * (3 - 2 * edge)  # fades out only in the innermost part, past the blades' tips
detail = np.clip(np.abs(lum - 0.55) / 0.4, 0, 1)  # oars and blades, not plain water
alpha = STRENGTH * edge[None, :] * (0.25 + 0.75 * detail)
alpha = np.maximum(alpha, pink * edge[None, :] * 0.75)

rgba = np.dstack([out, alpha])
img = Image.fromarray((rgba * 255).round().astype("uint8"), "RGBA")
img = img.resize((WIDTH, round(h * WIDTH / w)), Image.LANCZOS)
img.save(OUT + "side-oars-right.webp", quality=82, method=6)
img.transpose(Image.FLIP_LEFT_RIGHT).save(OUT + "side-oars-left.webp", quality=82, method=6)
print(img.size)
