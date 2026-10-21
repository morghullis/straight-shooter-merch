"""
Builds the pen strokes that write the hero signature on.

The site shows the real signature (a transparent PNG cut from the brand artwork), revealed along
these strokes, so not a detail of the signature changes. The strokes follow PEN below, the route a
pen takes when this signature is written (rough points, in order), snapped onto the centre of the
ink. Anything the strokes miss is listed so it can be added; the page shows the whole signature
when the writing ends anyway.

usage:  python3 tools/signature/build.py          (needs numpy and Pillow)
reads:  assets-src/signature/stephen-a-signature.png
writes: src/components/brand/signature-paths.ts and public/images/brand/signature.webp
"""

import json
import math
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets-src/signature/stephen-a-signature.png"
WEB = ROOT / "public/images/brand/signature.webp"
WEB_URL = "/images/brand/signature.webp"
OUT = ROOT / "src/components/brand/signature-paths.ts"

# The route of the pen, stroke by stroke, in image pixels (1640 x 585). Between two strokes the pen
# leaves the paper.
PEN = [
    # S: from the top, down and round to the middle, round the bowl, into the hook.
    [(296, 74), (250, 95), (200, 127), (150, 165), (110, 205), (84, 240), (80, 262), (95, 272), (130, 275),
     (190, 277), (225, 285), (250, 300), (270, 318), (283, 350), (281, 385), (265, 425), (235, 460),
     (195, 490), (160, 505), (145, 510)],
    # The little tick under the S.
    [(106, 452), (112, 470), (118, 490)],
    # The narrow loop at the bottom left, then the long upstroke to the right.
    [(80, 494), (66, 504), (56, 526), (44, 544), (28, 554), (16, 568), (24, 572), (30, 556), (40, 520), (50, 508), (62, 502), (78, 480),
     (94, 462), (118, 432), (150, 398), (190, 360), (250, 300), (288, 288), (312, 272), (336, 262),
     (348, 244), (378, 232), (405, 218)],
    # t: down the stem, into the e, up to the p and down its stem.
    [(372, 136), (368, 150), (360, 190), (350, 204), (346, 242), (336, 266), (332, 292), (326, 324),
     (324, 360), (325, 392), (334, 410), (350, 410), (364, 398), (374, 382), (388, 366), (398, 346), (414, 340), (428, 320),
     (432, 302), (428, 298), (410, 306), (402, 318), (396, 344), (390, 372), (420, 384), (452, 364),
     (482, 342), (494, 293), (488, 340), (484, 380), (478, 410), (474, 436), (466, 480), (458, 526)],
    # The bowl of the p.
    [(488, 340), (496, 318), (512, 300), (538, 286), (552, 292), (552, 308), (546, 328), (536, 344), (522, 360),
     (505, 372), (488, 374)],
    # h, e, n and the long tail of the n.
    [(618, 130), (612, 150), (604, 200), (594, 242), (586, 282), (581, 318), (576, 360), (574, 372), (588, 348),
     (600, 322), (614, 298), (626, 298), (636, 320), (642, 346), (660, 348), (684, 332), (684, 305),
     (692, 282), (705, 268), (720, 268), (726, 282), (718, 300), (705, 322), (698, 340), (716, 338), (740, 330),
     (752, 310), (770, 296), (776, 280), (776, 300), (774, 330), (780, 312), (794, 300), (808, 284),
     (822, 290), (836, 308), (850, 318), (866, 314), (890, 300), (920, 280), (944, 258), (966, 238),
     (972, 233)],
    # The long crossbar of the t.
    [(220, 242), (234, 236), (250, 230), (276, 222), (300, 214), (324, 208), (348, 202), (360, 192),
     (400, 182), (440, 172), (486, 164), (498, 160), (560, 152), (610, 148), (654, 150)],
    # A: up the left leg to the top, down the right leg.
    [(950, 468), (958, 438), (970, 400), (980, 362), (992, 340), (1004, 294), (1014, 264), (1022, 244),
     (1040, 190), (1058, 140), (1066, 122), (1074, 98), (1080, 75), (1092, 52), (1100, 44), (1094, 70), (1090, 84),
     (1088, 150), (1085, 230), (1082, 318), (1080, 328), (1082, 400), (1084, 468)],
    # The flourish: from the hook through the A, off to the right.
    [(940, 356), (956, 356), (980, 352), (994, 342), (1012, 342), (1040, 334), (1060, 328), (1084, 320),
     (1152, 308), (1224, 296), (1278, 288), (1400, 276), (1500, 272), (1616, 270), (1630, 270)],
    # The full stop.
    [(1141, 430), (1149, 434)],
]

STEP = 3  # px between points along a stroke before snapping
SNAP = 10  # how far a route point may move to reach the centre of the ink


def load():
    img = Image.open(SOURCE).convert("RGBA")
    alpha = np.asarray(img.getchannel("A")).astype(float) / 255
    return img, alpha


def half_thickness(ink):
    """For each ink pixel, how many 3x3 erosions it survives: about half the local stroke width."""
    dist = np.zeros(ink.shape, float)
    cur = Image.fromarray((ink * 255).astype(np.uint8))
    for k in range(1, 30):
        cur = cur.filter(ImageFilter.MinFilter(3))
        alive = np.asarray(cur) > 0
        if not alive.any():
            break
        dist[alive] = k
    return dist + ink  # 1 at the edge


def catmull_rom(points, step):
    pts = [np.array(p, float) for p in points]
    if len(pts) < 2:
        return pts
    pts = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        n = max(1, int(np.linalg.norm(p2 - p1) / step))
        for j in range(n):
            t = j / n
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-2])
    return out


def snap(points, dist):
    h, w = dist.shape
    ys, xs = np.mgrid[-SNAP : SNAP + 1, -SNAP : SNAP + 1]
    near = np.hypot(xs, ys)
    out = []
    for p in points:
        x, y = int(round(p[0])), int(round(p[1]))
        x0, x1, y0, y1 = max(0, x - SNAP), min(w, x + SNAP + 1), max(0, y - SNAP), min(h, y + SNAP + 1)
        win = dist[y0:y1, x0:x1]
        if win.max() <= 0:
            out.append((float(p[0]), float(p[1])))
            continue
        d = near[(y0 - y + SNAP) : (y1 - y + SNAP), (x0 - x + SNAP) : (x1 - x + SNAP)]
        score = win - 0.35 * d
        score[win <= 0] = -1e9
        j = np.unravel_index(np.argmax(score), score.shape)
        out.append((float(x0 + j[1]), float(y0 + j[0])))
    return out


def smooth(points, k=3):
    if len(points) <= 2 * k:
        return points
    arr = np.array(points)
    out = arr.copy()
    for i in range(k, len(arr) - k):
        out[i] = arr[i - k : i + k + 1].mean(axis=0)
    return [tuple(p) for p in out]


def simplify(points, eps):
    if len(points) < 3:
        return points
    a, b = np.array(points[0]), np.array(points[-1])
    ab = b - a
    norm = np.linalg.norm(ab) or 1.0
    best, idx = 0.0, 0
    for i in range(1, len(points) - 1):
        d = abs(ab[0] * (a[1] - points[i][1]) - ab[1] * (a[0] - points[i][0])) / norm
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [points[0], points[-1]]
    return simplify(points[: idx + 1], eps)[:-1] + simplify(points[idx:], eps)


def main():
    img, alpha = load()
    h, w = alpha.shape
    ink = alpha > 0.35
    dist = half_thickness(ink)

    strokes = []
    cover = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(cover)
    for route in PEN:
        snapped = smooth(snap(catmull_rom(route, STEP), dist))
        pts = simplify(snapped, 0.8)
        local = [dist[min(h - 1, int(y)), min(w - 1, int(x))] for x, y in snapped]
        width = 2 * float(np.percentile(local, 85)) + 7
        length = sum(math.dist(pts[i - 1], pts[i]) for i in range(1, len(pts)))
        strokes.append({"d": "M" + "L".join(f"{x:.1f} {y:.1f}" for x, y in pts), "width": round(width, 1), "length": round(length, 1)})
        draw.line(pts, fill=255, width=int(round(width)), joint="curve")
        r = width / 2
        for x, y in (pts[0], pts[-1]):
            draw.ellipse((x - r, y - r, x + r, y + r), fill=255)

    missed = ink & (np.asarray(cover) == 0)
    share = missed.sum() / max(1, ink.sum())
    print(f"{len(strokes)} pen strokes, {sum(s['length'] for s in strokes):.0f} px of ink path; {share:.2%} of the ink not on a stroke")
    if share > 0:
        ys, xs = np.nonzero(missed)
        Image.fromarray((missed * 255).astype(np.uint8)).save("/tmp/signature-missed.png")
        print(f"  missed ink spans x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()} (see /tmp/signature-missed.png)")

    img.save(WEB, "WEBP", quality=92, alpha_quality=100, method=6)
    data = {"image": WEB_URL, "width": w, "height": h, "strokes": strokes}
    OUT.write_text(
        "// Generated by tools/signature/build.py from assets-src/signature/stephen-a-signature.png. Do not edit by hand.\n"
        "// Units: pixels of the signature image.\n\n"
        f"export const signature = {json.dumps(data, indent=2)} as const;\n"
    )


if __name__ == "__main__":
    main()
