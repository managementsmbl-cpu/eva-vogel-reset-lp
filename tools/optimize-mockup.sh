#!/usr/bin/env bash
#
# Macht aus einem beliebigen Quellbild das fertige Freebie-Thumbnail:
#   assets/freebie-mockup.webp  (primaer, Ziel < 60 KB)
#   assets/freebie-mockup.jpg   (Fallback fuer alte Browser)
#
# Aufruf aus dem Projekt-Root:
#   ./tools/optimize-mockup.sh ~/Desktop/thumbnail-original.jpg
#
# Bildaufbau: 16:9, Text/Motiv nach unten links oder aussen setzen —
# die Bildmitte wird vom Play-Button-Overlay der Seite verdeckt.

set -euo pipefail

SRC="${1:-}"
[ -z "$SRC" ] && { echo "Nutzung: $0 <quellbild>"; exit 1; }
[ -f "$SRC" ] || { echo "Datei nicht gefunden: $SRC"; exit 1; }

OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/assets"
BASE="$OUT_DIR/freebie-mockup"
WIDTH=960          # 2x der groessten Anzeigebreite -> reicht fuer alle Retina-Displays
Q_WEBP=86
Q_JPG=82

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "→ skaliere auf ${WIDTH}px Breite"
if command -v magick >/dev/null 2>&1; then
  magick "$SRC" -resize "${WIDTH}x" -strip "$work/resized.png"
else
  cp "$SRC" "$work/resized.png"
  sips --resampleWidth "$WIDTH" "$work/resized.png" >/dev/null   # macOS-Bordmittel
fi

echo "→ WebP"
if command -v cwebp >/dev/null 2>&1; then                        # brew install webp
  cwebp -q "$Q_WEBP" -m 6 -mt "$work/resized.png" -o "$BASE.webp" >/dev/null 2>&1
elif command -v magick >/dev/null 2>&1; then
  magick "$work/resized.png" -quality "$Q_WEBP" "$BASE.webp"
elif python3 -c "import PIL" >/dev/null 2>&1; then
  python3 - "$work/resized.png" "$BASE.webp" "$Q_WEBP" <<'PY'
import sys
from PIL import Image
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
Image.open(src).convert("RGB").save(dst, "WEBP", quality=q, method=6)
PY
else
  sips -s format webp -s formatOptions "$Q_WEBP" "$work/resized.png" --out "$BASE.webp" >/dev/null
fi

echo "→ JPG-Fallback"
if command -v magick >/dev/null 2>&1; then
  magick "$work/resized.png" -quality "$Q_JPG" -interlace Plane -strip "$BASE.jpg"
elif python3 -c "import PIL" >/dev/null 2>&1; then
  python3 - "$work/resized.png" "$BASE.jpg" "$Q_JPG" <<'PY'
import sys
from PIL import Image
src, dst, q = sys.argv[1], sys.argv[2], int(sys.argv[3])
Image.open(src).convert("RGB").save(dst, "JPEG", quality=q, optimize=True, progressive=True)
PY
else
  sips -s format jpeg -s formatOptions "$Q_JPG" "$work/resized.png" --out "$BASE.jpg" >/dev/null
fi

echo
for f in "$BASE.webp" "$BASE.jpg"; do
  kb=$(( $(wc -c < "$f") / 1024 ))
  printf '%-42s %4s KB\n' "$(basename "$f")" "$kb"
  if [ "$f" = "$BASE.webp" ] && [ "$kb" -gt 80 ]; then
    echo "   ⚠ ueber 80 KB — Q_WEBP im Skript auf 78 senken und erneut laufen lassen."
  fi
done

echo
echo "Falls die Seitenverhaeltnisse nicht 16:9 sind: width/height im <img> in"
echo "index.html anpassen, sonst springt das Layout beim Laden."
echo "Ohne Tools auf dem Rechner geht es auch im Browser: https://squoosh.app"
echo "  -> WebP, Quality 86, Breite 960 -> als assets/freebie-mockup.webp speichern."
