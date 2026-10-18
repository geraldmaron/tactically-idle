import fs from 'node:fs';
import path from 'node:path';
// Optional first argument: another checkout-shaped root (used by src/ui/art/validate-art.test.ts fixtures).
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const people = JSON.parse(read('src/content/personas.json'));
const portrait = JSON.parse(read('public/art/portraits/manifest.json'));
const gear = JSON.parse(read('public/art/gear/manifest.json'));
const materials = JSON.parse(read('public/art/materials/manifest.json'));
const managers = JSON.parse(read('public/art/managers/manifest.json'));
const emblems = JSON.parse(read('public/art/emblems/manifest.json'));
const MANAGER_IDS = ['watch_commander', 'training_sergeant', 'quartermaster'];
// Emblem ids are course ids, plus branch_<id> for each development branch.
const courseSource = read('src/content/courses.ts');
const COURSE_IDS = new Set([...courseSource.matchAll(/^ {2}([a-z_]+): \{/gm), ...courseSource.matchAll(/"id": "([a-z_]+)"/g)].map((m) => m[1]));
const BRANCH_IDS = (/BRANCHES: DevBranch\[\] = \[([^\]]*)\]/.exec(read('src/ui/components/labels.ts'))?.[1] ?? '').match(/[a-z_]+/g) ?? [];
const EMBLEM_IDS = new Set([...COURSE_IDS, ...BRANCH_IDS.map((id) => `branch_${id}`)]);
const errors=[];
if(!COURSE_IDS.size) errors.push('emblems: no course ids found in src/content/courses.ts');
if(!BRANCH_IDS.length) errors.push('emblems: no BRANCHES found in src/ui/components/labels.ts');
for(const [kind, manifest] of [['portraits',portrait],['gear',gear],['materials',materials],['managers',managers],['emblems',emblems]]) {
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
    if(kind==='emblems'&&!EMBLEM_IDS.has(id)) errors.push(`emblems/${id}: not a course or development branch`);
  }
}
for(const filename of ['header-lockup-dark.svg','favicon.svg','apple-touch-icon.png']) {
  if(!fs.existsSync(path.join(root,'public/brand',filename))) errors.push(`brand/${filename}: required asset missing`);
}
if(errors.length){ console.error(errors.join('\n'));process.exitCode=1; }
else console.log(JSON.stringify({identities:people.length,portraitsReady:portrait.readyIds.length,personnelFileCards:people.length-portrait.readyIds.length,gearReady:gear.readyIds.length,materialsReady:materials.readyIds.length,managersReady:managers.readyIds.length,emblemsReady:emblems.readyIds.length,emblemIds:EMBLEM_IDS.size,requiredBrandAssets:'present'},null,2));
