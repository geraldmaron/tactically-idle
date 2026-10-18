"""Build contact-sheet.png: every emblem at 40px (its in-game size) and at 128px, labeled.

Run: uv run --with pillow python docs/art/manager-emblem-expansion/contact_sheet.py
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
ids = json.loads((ROOT / 'public/art/emblems/manifest.json').read_text())['readyIds']
COLS, CELL, BG, PANEL, TEXT = 6, 150, (11, 17, 28), (19, 28, 42), (170, 183, 202)
rows = -(-len(ids) // COLS)
sheet = Image.new('RGB', (COLS * CELL + 20, 40 + rows * 90 + 40 + rows * (CELL + 30) + 20), BG)
draw = ImageDraw.Draw(sheet)
font = ImageFont.load_default()
draw.text((10, 12), '40px, as shown in Training and Develop', fill=TEXT, font=font)
def label(x, y, id):
    w = draw.textlength(id, font=font)
    draw.text((x + (CELL - 10 - w) / 2, y), id, fill=TEXT, font=font)
for i, id in enumerate(ids):
    x, y = 10 + (i % COLS) * CELL, 40 + (i // COLS) * 90
    draw.rounded_rectangle((x, y, x + CELL - 10, y + 80), 8, fill=PANEL)
    im = Image.open(ROOT / f'public/art/emblems/{id}.webp').convert('RGBA').resize((40, 40), Image.LANCZOS)
    sheet.paste(im, (x + (CELL - 10 - 40) // 2, y + 10), im)
    label(x, y + 60, id)
top = 40 + rows * 90 + 20
draw.text((10, top), '128px review size', fill=TEXT, font=font)
for i, id in enumerate(ids):
    x, y = 10 + (i % COLS) * CELL, top + 20 + (i // COLS) * (CELL + 30)
    im = Image.open(ROOT / f'public/art/emblems/{id}.webp').convert('RGBA').resize((128, 128), Image.LANCZOS)
    sheet.paste(im, (x + (CELL - 10 - 128) // 2, y), im)
    label(x, y + 134, id)
sheet.save(HERE / 'contact-sheet.png', optimize=True)
print(sheet.size)
