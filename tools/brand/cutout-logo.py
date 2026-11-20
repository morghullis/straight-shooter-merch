"""Cut the Straight Shooter Shop logo (pink silhouette + orange lettering) out of its white background.

    python3 tools/brand/cutout-logo.py

Reads assets-src/brand/2026-11-silhouette/logo-original.jpg and writes, with a transparent background:
  - logo-full.png     the owner's composition as given, cropped to the artwork (footer)
  - logo-lockup.png   the same pieces side by side, the figure closer to the lettering, so the
                      lettering stays readable at header size (the figure is 5x the lettering's
                      height in the original; at 52px tall the letters would be 4px)

The artwork is two flat inks on white, so every pixel is "ink over white" in some amount: the alpha
is the pixel's projection on the white -> ink line of its closer ink, and its colour is the pure ink.
That removes the background without a white fringe (the edges stay anti-aliased) and drops the JPEG
noise inside the shapes.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "assets-src/brand/2026-11-silhouette/logo-original.jpg"
OUT = SRC.parent

WHITE = np.array([255.0, 255.0, 255.0])


def ink_of(rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """The solid ink colour: the median of the most saturated pixels of that shape."""
    return np.median(rgb[mask], axis=0)


def cutout(rgb: np.ndarray, inks: list[np.ndarray]) -> np.ndarray:
    h, w, _ = rgb.shape
    flat = rgb.reshape(-1, 3)
    best_alpha = np.zeros(len(flat))
    best_err = np.full(len(flat), np.inf)
    best_ink = np.zeros((len(flat), 3))
    d = WHITE - flat  # how far each pixel is from white
    for ink in inks:
        v = WHITE - ink
        a = np.clip(d @ v / (v @ v), 0.0, 1.0)
        err = np.linalg.norm(d - a[:, None] * v, axis=1)  # distance from the white -> ink line
        better = err < best_err
        best_err[better], best_alpha[better], best_ink[better] = err[better], a[better], ink
    # Clean the extremes: JPEG ringing in the white is not ink, solid ink is fully opaque.
    alpha = np.where(best_alpha < 0.04, 0.0, np.where(best_alpha > 0.94, 1.0, best_alpha)).reshape(h, w)
    # JPEG specks: faint pixels with no solid ink within 2px are noise around the shapes, not edges.
    solid = alpha > 0.6
    near = np.zeros_like(solid)
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            near |= np.roll(np.roll(solid, dy, axis=0), dx, axis=1)
    alpha = np.where(near, alpha, 0.0).reshape(-1)
    out = np.concatenate([best_ink, (alpha * 255.0)[:, None]], axis=1).round().clip(0, 255)
    return out.reshape(h, w, 4).astype(np.uint8)


def bbox(alpha: np.ndarray, x0=0, x1=None):
    sub = alpha[:, x0:x1]
    ys, xs = np.nonzero(sub > 0)
    return xs.min() + x0, ys.min(), xs.max() + x0 + 1, ys.max() + 1


def main() -> None:
    rgb = np.asarray(Image.open(SRC).convert("RGB"), dtype=np.float64)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    pink = ink_of(rgb, (r > 200) & (g < 60) & (b > 150))
    orange = ink_of(rgb, (r > 200) & (g > 130) & (g < 200) & (b < 30))
    print("inks: pink", pink.round(), "orange", orange.round())

    rgba = cutout(rgb, [pink, orange])
    alpha = rgba[..., 3]
    img = Image.fromarray(rgba, "RGBA")

    # The two pieces: the figure on the left, the lettering on the right.
    split = 390
    fx0, fy0, fx1, fy1 = bbox(alpha, 0, split)
    tx0, ty0, tx1, ty1 = bbox(alpha, split)
    figure, letters = img.crop((fx0, fy0, fx1, fy1)), img.crop((tx0, ty0, tx1, ty1))
    print("figure", figure.size, "lettering", letters.size)

    pad = 6
    # 1. As given: the whole composition, cropped to the artwork.
    x0, y0, x1, y1 = min(fx0, tx0), min(fy0, ty0), max(fx1, tx1), max(fy1, ty1)
    full = img.crop((x0 - pad, y0 - pad, x1 + pad, y1 + pad))
    full.save(OUT / "logo-full.png", optimize=True)

    # 2. Header lockup: the figure 2.2x the lettering's height, the lettering's bottom on the same
    # line as in the original (just above the feet), the gap between them as in the original.
    fig_h = round(letters.height * 2.2)
    fig_w = round(figure.width * fig_h / figure.height)
    small = figure.resize((fig_w, fig_h), Image.LANCZOS)
    gap = round((tx0 - fx1) * 0.8)
    feet_below_letters = round((fy1 - ty1) * fig_h / figure.height)
    W = pad + fig_w + gap + letters.width + pad
    H = pad + fig_h + pad
    lock = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    lock.alpha_composite(small, (pad, pad))
    lock.alpha_composite(letters, (pad + fig_w + gap, pad + fig_h - feet_below_letters - letters.height))
    lock.save(OUT / "logo-lockup.png", optimize=True)
    print("full", full.size, f"{full.width / full.height:.3f}:1", "| lockup", lock.size, f"{lock.width / lock.height:.3f}:1")


if __name__ == "__main__":
    main()
