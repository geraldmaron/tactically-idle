import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const people = JSON.parse(fs.readFileSync(path.join(root, 'src/content/personas.json')));
const portrait = JSON.parse(fs.readFileSync(path.join(root, 'public/art/portraits/manifest.json')));
const gear = JSON.parse(fs.readFileSync(path.join(root, 'public/art/gear/manifest.json')));
const materials = JSON.parse(fs.readFileSync(path.join(root, 'public/art/materials/manifest.json')));
const managers = JSON.parse(fs.readFileSync(path.join(root, 'public/art/managers/manifest.json')));
const MANAGER_IDS = ['watch_commander', 'training_sergeant', 'quartermaster'];
const errors=[];
for(const [kind, manifest] of [['portraits',portrait],['gear',gear],['materials',materials],['managers',managers]]) {
  if(new Set(manifest.readyIds).size!==manifest.readyIds.length) errors.push(`${kind}: duplicate ready id`);
  for(const id of manifest.readyIds) {
    const file=path.join(root,`public/art/${kind}/${id}.webp`);
    if(!fs.existsSync(file)) errors.push(`${kind}/${id}: marked ready but file missing`);
    else {
      const bytes=fs.readFileSync(file);
      if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP') errors.push(`${kind}/${id}: invalid WebP signature`);
    }
    if(kind==='portraits'&&!people.some(p=>p.id===id)) errors.push(`${id}: no authored identity`);
    if(kind==='managers'&&!MANAGER_IDS.includes(id)) errors.push(`managers/${id}: not a Command Staff manager`);
  }
}
for(const filename of ['header-lockup-dark.svg','favicon.svg','apple-touch-icon.png']) {
  if(!fs.existsSync(path.join(root,'public/brand',filename))) errors.push(`brand/${filename}: required asset missing`);
}
if(errors.length){ console.error(errors.join('\n'));process.exitCode=1; }
else console.log(JSON.stringify({identities:people.length,portraitsReady:portrait.readyIds.length,personnelFileCards:people.length-portrait.readyIds.length,gearReady:gear.readyIds.length,materialsReady:materials.readyIds.length,managersReady:managers.readyIds.length,requiredBrandAssets:'present'},null,2));
