#!/usr/bin/env bash
# Renders the README images in docs/images/ from the HTML in docs/images/src/.
# Needs Google Chrome (or Chromium), python3 with Pillow (as scripts/make-icons.py does), and
# `bun install` first so the Fraunces and Nunito font files exist in node_modules.
#
#   scripts/render-doc-images.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/images/src"
OUT="$ROOT/docs/images"
CHROME="${CHROME:-$(command -v google-chrome || command -v chromium || command -v chromium-browser)}"
SCALE="${SCALE:-2}"

# Headless Chrome's viewport is shorter than --window-size, so render taller and crop to size.
shot() {
  local name="$1" width="$2" height="$3" scale="${4:-$SCALE}"
  "$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor="$scale" \
    --virtual-time-budget=8000 --window-size="$width,$((height + 200))" \
    --screenshot="$OUT/$name.png" "file://$SRC/$name.html" >/dev/null 2>&1
  python3 - "$OUT/$name.png" "$((width * scale))" "$((height * scale))" <<'PY'
import sys
from PIL import Image

path, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
img = Image.open(path).convert("RGB").crop((0, 0, w, h))
img.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(
    path, optimize=True
)
PY
  echo "docs/images/$name.png"
}

shot screen-home 470 1000
shot screen-dispenser 470 1000
shot screen-schedule 470 1000
shot screen-settings 470 1000
shot screen-dispenser-dark 470 1000
# The showcase and the diagram embed or sit beside the files above, so they go last.
shot screens 1600 735
shot connection 1280 680 1
shot banner 1280 640 1
