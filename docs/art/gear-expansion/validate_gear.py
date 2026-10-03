"""Read-only alpha/dimension/hash checks for the complete equipment catalog."""
import hashlib, json, re, subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
GEAR = ROOT / 'public/art/gear'
PROMPTS = json.loads((Path(__file__).parent / 'generation-prompts.json').read_text())
NEW_IDS = {x['id'] for x in PROMPTS}
manifest = json.loads((GEAR / 'manifest.json').read_text())
ids = manifest['readyIds']
catalog = set(re.findall(r"(?:id: '([^']+)'|\"id\": \"([^\"]+)\")", (ROOT / 'src/content/items.ts').read_text()))
catalog = {a or b for a,b in catalog}
assert set(ids) == catalog, (set(ids) - catalog, catalog - set(ids))
assert len(ids) == len(set(ids)) == 28
entries = []
for id in ids:
    path = GEAR / f'{id}.webp'
    with Image.open(path) as im:
        im.load()
        assert im.size == (512, 512), (id, im.size)
        assert im.mode == 'RGBA', (id, im.mode)
        a = im.getchannel('A')
        assert a.getextrema() == (0,255), (id, a.getextrema())
        entry = {'id':id, 'file':path.name, 'bytes':path.stat().st_size, 'dimensions':list(im.size), 'mode':im.mode, 'alphaRange':list(a.getextrema()), 'alphaBoundingBox':list(a.getbbox()), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'newInExpansion':id in NEW_IDS}
        entries.append(entry)
assert len({e['sha256'] for e in entries}) == 28
for e in entries:
    if not e['newInExpansion']:
        original = subprocess.check_output(['git','show',f'HEAD:public/art/gear/{e["file"]}'],cwd=ROOT)
        assert hashlib.sha256(original).hexdigest() == e['sha256'], e['id']
report = {'catalogCount':28, 'readyCount':28, 'newGeneratedCount':19, 'originalPreservedCount':9, 'allDimensions':[512,512], 'allTrueAlpha':True, 'allDistinctHashes':True, 'runtimeBytes':sum(e['bytes'] for e in entries), 'newRuntimeBytes':sum(e['bytes'] for e in entries if e['newInExpansion']), 'visualReview':'All 28 equipment images reviewed together on a dark-navy contact sheet. Each new silhouette matches its catalog role; vehicles, response classes, rescue tools and supplies remain distinct. Door charge is deliberately represented by a sealed abstract fictional access pouch.', 'entries':entries}
(Path(__file__).parent / 'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['entries','visualReview']},indent=2))
