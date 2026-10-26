"""Draws the Aer Remote app icon and splash images into assets/images (python3 scripts/make-icons.py).

A rounded dispenser with a soft mist puff, in the light theme palette from src/theme/tokens.ts.
"""
from pathlib import Path

from PIL import Image, ImageDraw

CREAM = (0xFC, 0xF1, 0xDE)
TERRACOTTA = (0xC4, 0x50, 0x2A)
DEEP = (0xA3, 0x48, 0x2A)
SAFFRON = (0xF0, 0xB5, 0x6E)
WHITE = (255, 255, 255)

OUT = Path(__file__).resolve().parent.parent / "assets" / "images"
SS = 4  # draw at 4x, then shrink for smooth edges


def mark(size: int, scale: float, body, puff, detail, nozzle, bg=None) -> Image.Image:
    """The mark centred in a square canvas; `scale` is the fraction of the canvas it may fill."""
    big = size * SS
    img = Image.new("RGBA", (big, big), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    unit = big * scale / 100  # the mark is drawn on a 100 x 100 grid
    ox = oy = big * (1 - scale) / 2

    def box(x0, y0, x1, y1):
        return [ox + x0 * unit, oy + y0 * unit, ox + x1 * unit, oy + y1 * unit]

    # Mist puff: three soft circles above the nozzle.
    for cx, cy, r in [(50, 17, 10), (37, 25, 8), (63, 25, 8)]:
        d.ellipse(box(cx - r, cy - r, cx + r, cy + r), fill=puff)
    # Nozzle cap and body.
    d.rounded_rectangle(box(42, 33, 58, 45), radius=4 * unit, fill=nozzle)
    d.rounded_rectangle(box(27, 43, 73, 97), radius=14 * unit, fill=body)
    # A small window showing the refill.
    d.rounded_rectangle(box(38, 58, 62, 84), radius=7 * unit, fill=detail)
    d.rounded_rectangle(box(42, 70, 58, 80), radius=4 * unit, fill=puff)
    return img.resize((size, size), Image.LANCZOS)


def save(name: str, img: Image.Image) -> None:
    img.save(OUT / name)
    print("wrote", name, img.size)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Store icon: cream tile, terracotta dispenser, no transparency.
    save("icon.png", mark(1024, 0.72, TERRACOTTA, SAFFRON, CREAM, DEEP, bg=CREAM + (255,)).convert("RGB"))
    # Android adaptive: the mark stays inside the central 66% safe zone.
    save("android-icon-foreground.png", mark(512, 0.60, TERRACOTTA, SAFFRON, CREAM, DEEP))
    save("android-icon-background.png", Image.new("RGB", (512, 512), CREAM))
    save("android-icon-monochrome.png", mark(432, 0.60, WHITE, WHITE, (0, 0, 0, 0), WHITE))
    # Splash sits on the cream background colour from app.json.
    save("splash-icon.png", mark(256, 0.80, TERRACOTTA, SAFFRON, CREAM, DEEP))
    save("favicon.png", mark(48, 0.86, TERRACOTTA, SAFFRON, CREAM, DEEP, bg=CREAM + (255,)).convert("RGB"))


if __name__ == "__main__":
    main()
