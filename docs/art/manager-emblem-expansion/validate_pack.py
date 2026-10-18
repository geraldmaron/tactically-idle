"""Read-only checks for the emblem set and the Command Staff portraits; writes validation.json next to this file.

Run: uv run --with pillow python docs/art/manager-emblem-expansion/validate_pack.py
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
MANAGERS = ROOT / 'public/art/managers'
briefs = {p['id'] for p in json.loads((HERE / 'manager-prompts.json').read_text())}
mmanifest = json.loads((MANAGERS / 'manifest.json').read_text())
assert set(mmanifest['readyIds']) == briefs and len(mmanifest['readyIds']) == len(briefs), (mmanifest['readyIds'], briefs)
assert (mmanifest['width'], mmanifest['height']) == (512, 532)
managers = []
for id in mmanifest['readyIds']:
    path = MANAGERS / f'{id}.webp'
    with Image.open(path) as im:
        im.load()
        assert im.size == (512, 532), (id, im.size)
        assert im.mode == 'RGB', (id, im.mode)
        managers.append({'id': id, 'file': path.name, 'bytes': path.stat().st_size, 'dimensions': list(im.size), 'mode': im.mode,
                         'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
portraits = ROOT / 'public/art/portraits'
officer_hashes = {hashlib.sha256(p.read_bytes()).hexdigest() for p in portraits.glob('*.webp')}
assert not officer_hashes & {m['sha256'] for m in managers}, 'a manager portrait duplicates an officer portrait'
assert len({m['sha256'] for m in managers}) == len(managers), 'two managers share a file'
report = {'emblemCount': len(entries), 'allDimensions': [512, 512], 'allTrueAlpha': True, 'allDistinctHashes': True,
          'runtimeBytes': sum(e['bytes'] for e in entries), 'entries': entries,
          'managerCount': len(managers), 'managerDimensions': [512, 532], 'managerRuntimeBytes': sum(m['bytes'] for m in managers),
          'managersDistinctFromOfficers': True, 'managers': managers}
(HERE / 'validation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ('entries', 'managers')}, indent=2))
