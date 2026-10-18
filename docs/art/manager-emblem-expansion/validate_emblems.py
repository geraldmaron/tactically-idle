"""Read-only checks for the course and branch emblem set; writes validation.json next to this file.

Run: uv run --with pillow python docs/art/manager-emblem-expansion/validate_emblems.py
"""
import hashlib, json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).parent
EMBLEMS = ROOT / 'public/art/emblems'
prompts = {p['id'] for p in json.loads((HERE / 'generation-prompts.json').read_text())}
manifest = json.loads((EMBLEMS / 'manifest.json').read_text())
ids = manifest['readyIds']
assert len(ids) == len(set(ids)), 'duplicate ready id'
assert set(ids) == prompts, (set(ids) - prompts, prompts - set(ids))
assert (manifest['width'], manifest['height']) == (512, 512)
entries = []
for id in ids:
    path = EMBLEMS / f'{id}.webp'
    with Image.open(path) as im:
        im.load()
        assert im.size == (512, 512), (id, im.size)
        assert im.mode == 'RGBA', (id, im.mode)
        alpha = im.getchannel('A')
        assert alpha.getextrema() == (0, 255), (id, alpha.getextrema())
        entries.append({'id': id, 'file': path.name, 'bytes': path.stat().st_size, 'dimensions': list(im.size), 'mode': im.mode,
                        'alphaRange': list(alpha.getextrema()), 'alphaBoundingBox': list(alpha.getbbox()),
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
assert len({e['sha256'] for e in entries}) == len(entries), 'two emblems share a file'
report = {'emblemCount': len(entries), 'allDimensions': [512, 512], 'allTrueAlpha': True, 'allDistinctHashes': True,
          'runtimeBytes': sum(e['bytes'] for e in entries), 'entries': entries}
(HERE / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'entries'}, indent=2))
