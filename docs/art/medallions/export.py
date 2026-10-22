"""Export the call-type medallion masters to runtime WebP, and write the manifest.

Masters stay outside the repository (the Codex generated-images store). Pass `id=path` pairs:
  uv run --with pillow python docs/art/medallions/export.py hostage_crisis=/path/master.png ...
Each master is resized to 512 x 512 with Lanczos and encoded with cwebp (-q 88 -alpha_q 100 -exact).
"""
import json, subprocess, sys, tempfile
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "public/art/medallions"
IDS = ["hostage_crisis", "barricaded", "active_armed_incident", "protected_rescue"]

def main(pairs):
    OUT.mkdir(parents=True, exist_ok=True)
    existing = json.loads((OUT / "manifest.json").read_text())["readyIds"] if (OUT / "manifest.json").exists() else []
    ready = set(existing)
    for pair in pairs:
        cid, src = pair.split("=", 1)
        assert cid in IDS, cid
        img = Image.open(src).convert("RGBA").resize((512, 512), Image.LANCZOS)
        with tempfile.NamedTemporaryFile(suffix=".png") as tmp:
            img.save(tmp.name)
            subprocess.run(["cwebp", "-q", "88", "-alpha_q", "100", "-exact", tmp.name, "-o", str(OUT / f"{cid}.webp")], check=True, capture_output=True)
        ready.add(cid)
    (OUT / "manifest.json").write_text(json.dumps({"version": 1, "readyIds": sorted(ready, key=IDS.index), "width": 512, "height": 512}, indent=2) + "\n")

if __name__ == "__main__":
    main(sys.argv[1:])
