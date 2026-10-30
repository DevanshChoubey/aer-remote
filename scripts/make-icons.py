"""Draws the Aer Remote app icon and splash images into assets/images (python3 scripts/make-icons.py).

A spray can with dotted mist from its side nozzle, in the light theme palette from
src/theme/tokens.ts.
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

CREAM = (0xFC, 0xF1, 0xDE)
TERRACOTTA = (0xC4, 0x50, 0x2A)
MIST = (0xE0, 0x91, 0x3F)  # a deeper saffron, so the dots read on cream
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
SS = 4  # draw at 4x, then shrink for smooth edges

# Mist: dots on three rays fanning out from the nozzle tip, on the 100 x 100 grid. Each ray is
# (angle in degrees, distances of its dots from the tip). The side rays start further out so the
# first dots don't touch, and dots shrink as they drift away.
NOZZLE_TIP = (56, 27)
RAYS = [(-32, (11, 17.5, 24)), (0, (5.5, 12, 18.5, 25)), (32, (11, 17.5, 24))]


def dot_radius(dist: float) -> float:
    return 1.9 - dist * 0.03


def mark(size: int, scale: float, can, mist, label, bg=None) -> Image.Image:
    """The mark centred in a square canvas; `scale` is the fraction of the canvas it may fill."""
    big = size * SS
    img = Image.new("RGBA", (big, big), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    unit = big * scale / 100  # the mark is drawn on a 100 x 100 grid
    ox = oy = big * (1 - scale) / 2

    def box(x0, y0, x1, y1):
        return [ox + x0 * unit, oy + y0 * unit, ox + x1 * unit, oy + y1 * unit]

    # Actuator cap with its side nozzle, the neck and the can.
    d.rounded_rectangle(box(32, 21.5, 48, 33.5), radius=3 * unit, fill=can)
    d.rounded_rectangle(box(47, 24.5, 55, 29.5), radius=1.5 * unit, fill=can)
    d.rounded_rectangle(box(30, 32.5, 50, 41.5), radius=3 * unit, fill=can)
    d.rounded_rectangle(box(24, 39.5, 56, 85.5), radius=9 * unit, fill=can)
    # Two label lines, cut out of the can.
    d.rounded_rectangle(box(29, 57.5, 51, 61), radius=1.75 * unit, fill=label)
    d.rounded_rectangle(box(29, 64.5, 43, 68), radius=1.75 * unit, fill=label)
    # Dotted mist fanning out from the nozzle.
    for angle, distances in RAYS:
        dx, dy = math.cos(math.radians(angle)), math.sin(math.radians(angle))
        for dist in distances:
            cx, cy = NOZZLE_TIP[0] + dx * dist, NOZZLE_TIP[1] + dy * dist
            r = dot_radius(dist)
            d.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=mist)
    return img.resize((size, size), Image.LANCZOS)


def save(name: str, img: Image.Image) -> None:
    img.save(OUT / name)
    print("wrote", name, img.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Store icon: cream tile, terracotta can, no transparency.
    save("icon.png", mark(1024, 0.86, TERRACOTTA, MIST, CREAM, bg=CREAM + (255,)).convert("RGB"))
    # Android adaptive: the mark stays inside the central 66% safe zone.
    save("android-icon-foreground.png", mark(512, 0.62, TERRACOTTA, MIST, CREAM))
    save("android-icon-background.png", Image.new("RGB", (512, 512), CREAM))
    save("android-icon-monochrome.png", mark(432, 0.62, WHITE, WHITE, (0, 0, 0, 0)))
    # Splash sits on the cream background colour from app.json.
    save("splash-icon.png", mark(256, 0.90, TERRACOTTA, MIST, CREAM))
    save("favicon.png", mark(48, 0.96, TERRACOTTA, MIST, CREAM, bg=CREAM + (255,)).convert("RGB"))


if __name__ == "__main__":
    main()
