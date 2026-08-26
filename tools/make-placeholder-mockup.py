#!/usr/bin/env python3
"""Erzeugt den Platzhalter fuer das Freebie-Thumbnail (WebP + JPG-Fallback).

Komposition: Text unten links, Bildmitte bleibt frei fuer den Play-Button-Overlay
der Landingpage. Genauso sollte auch das spaetere echte Thumbnail aufgebaut sein.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1]
W, H = 960, 540

INK = (10, 9, 10)
BORDEAUX = (74, 15, 34)
CREAM = (247, 244, 238)

img = Image.new("RGB", (W, H), INK)

# weicher Bordeaux-Verlauf von links oben
glow = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow).ellipse((-300, -340, 780, 620), fill=195)
glow = glow.filter(ImageFilter.GaussianBlur(150))
img = Image.composite(Image.new("RGB", (W, H), BORDEAUX), img, glow)

# zweiter, waermerer Lichtpunkt rechts oben fuer Tiefe
glow2 = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow2).ellipse((660, -140, 1160, 360), fill=64)
glow2 = glow2.filter(ImageFilter.GaussianBlur(130))
img = Image.composite(Image.new("RGB", (W, H), (74, 58, 50)), img, glow2)

# Vignette
vig = Image.new("L", (W, H), 0)
ImageDraw.Draw(vig).rectangle((60, 50, W - 60, H - 50), fill=255)
vig = vig.filter(ImageFilter.GaussianBlur(95))
img = Image.composite(img, Image.new("RGB", (W, H), (4, 3, 4)), vig)

d = ImageDraw.Draw(img)


def font(path, size, index=0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return ImageFont.load_default()


didot = font("/System/Library/Fonts/Supplemental/Didot.ttc", 50)
helv = font("/System/Library/Fonts/Helvetica.ttc", 18)
helv_s = font("/System/Library/Fonts/Helvetica.ttc", 14)

# duenner Rahmen
d.rectangle((28, 28, W - 29, H - 29), outline=(112, 96, 90), width=1)


def tracked(text, f, x, y, fill, spacing=0):
    for c in text:
        d.text((x, y), c, font=f, fill=fill)
        x += d.textlength(c, font=f) + spacing


X = 72
tracked("EVA VOGEL", helv_s, X, 348, (196, 166, 156), spacing=5)
d.text((X - 4, 376), "The Audition", font=didot, fill=CREAM)
d.text((X - 4, 432), "Nerves Reset", font=didot, fill=CREAM)

# dezenter Platzhalter-Hinweis (verschwindet, sobald das echte Bild gesetzt ist)
tag = "PLACEHOLDER — REPLACE WITH REAL THUMBNAIL"
d.text((W - 72 - d.textlength(tag, font=helv_s), 62), tag, font=helv_s, fill=(126, 104, 104))

img.save(OUT + ".webp", "WEBP", quality=74, method=6)
img.save(OUT + ".jpg", "JPEG", quality=76, optimize=True, progressive=True)

for ext in ("webp", "jpg"):
    p = f"{OUT}.{ext}"
    print(f"{os.path.basename(p):32s} {os.path.getsize(p)/1024:6.1f} KB")
