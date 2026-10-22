"""Rebuild contact-sheet.png: each medallion at 40px, 64px and 128px on the app's card colour."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/art/medallions"
ids = json.loads((OUT / "manifest.json").read_text())["readyIds"]
sizes = [40, 64, 128]
pad = 16
w = pad + sum(s + pad for s in sizes)
sheet = Image.new("RGB", (w, pad + len(ids) * (128 + pad)), (0x11, 0x18, 0x21))
for row, cid in enumerate(ids):
    src = Image.open(OUT / f"{cid}.webp").convert("RGBA")
    x = pad
    y0 = pad + row * (128 + pad)
    for s in sizes:
        tile = src.resize((s, s), Image.LANCZOS)
        sheet.paste(tile, (x, y0 + (128 - s) // 2), tile)
        x += s + pad
sheet.save(Path(__file__).with_name("contact-sheet.png"))
