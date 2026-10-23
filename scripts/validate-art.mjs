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
const plates = JSON.parse(read('public/art/plates/manifest.json'));
const medallions = JSON.parse(read('public/art/medallions/manifest.json'));
const crests = JSON.parse(read('public/art/crests/manifest.json'));
// Plates are scene_<call type>, banner_<tab>, tex_<texture> (src/ui/art/Plates.tsx) or room_<facility>_<lit|dark> (Build vignettes).
const PLATE_ID = /^(scene_[a-z_]+|banner_(hq|squad|ops|develop|gear)|hub_hq|tex_[a-z_]+|room_(personnel|training|information|recovery|equipment|garage)_(lit|dark))$/;
const MANAGER_IDS = ['watch_commander', 'training_sergeant', 'quartermaster', 'recruiter', 'peer_support_lead'];
// Squad crests are the NATO-style squad names on the Team screen.
const CREST_IDS = ['alpha', 'bravo', 'charlie', 'delta'];
// Emblem ids are course ids, plus branch_<id> for each development branch.
const courseSource = read('src/content/courses.ts');
const COURSE_IDS = new Set([...courseSource.matchAll(/^ {2}([a-z_]+): \{/gm), ...courseSource.matchAll(/"id": "([a-z_]+)"/g)].map((m) => m[1]));
const BRANCH_IDS = (/BRANCHES: DevBranch\[\] = \[([^\]]*)\]/.exec(read('src/ui/components/labels.ts'))?.[1] ?? '').match(/[a-z_]+/g) ?? [];
const EMBLEM_IDS = new Set([...COURSE_IDS, ...BRANCH_IDS.map((id) => `branch_${id}`)]);
// Medallion ids are the call types: the keys of CALL_TYPE_ICON in src/ui/icons/kit.ts.
const CALL_TYPE_IDS = new Set(((/CALL_TYPE_ICON[^{]*\{([^}]*)\}/.exec(read('src/ui/icons/kit.ts'))?.[1] ?? '').match(/^\s*[a-z_]+(?=:)/gm) ?? []).map((id) => id.trim()));
const errors=[];
// One style per set: the files of a set share a canvas and a kind of background, so no surface mixes a
// cutout with a photograph or a disc with a flat tile. Header-only reads; a stub file too short to carry a
// header (the unit-test fixtures) is skipped.
const CUTOUT_SETS=new Set(['gear','emblems','medallions','crests']);
const OPAQUE_SETS=new Set(['portraits','managers','materials']);
function webpHeader(bytes){
  if(bytes.length<30) return null;
  const type=bytes.toString('ascii',12,16);
  if(type==='VP8X') return {width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3),alpha:!!(bytes[20]&0x10)};
  if(type==='VP8L'){ const v=bytes.readUInt32LE(21); return {width:(v&0x3fff)+1,height:((v>>14)&0x3fff)+1,alpha:!!((v>>28)&1)}; }
  if(type==='VP8 ') return {width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff,alpha:false};
  return null;
}
if(!COURSE_IDS.size) errors.push('emblems: no course ids found in src/content/courses.ts');
if(!BRANCH_IDS.length) errors.push('emblems: no BRANCHES found in src/ui/components/labels.ts');
if(!CALL_TYPE_IDS.size) errors.push('medallions: no CALL_TYPE_ICON keys found in src/ui/icons/kit.ts');
for(const [kind, manifest] of [['portraits',portrait],['gear',gear],['materials',materials],['managers',managers],['emblems',emblems],['plates',plates],['medallions',medallions],['crests',crests]]) {
  if(new Set(manifest.readyIds).size!==manifest.readyIds.length) errors.push(`${kind}: duplicate ready id`);
  for(const id of manifest.readyIds) {
    const file=path.join(root,`public/art/${kind}/${id}.webp`);
    if(!fs.existsSync(file)) errors.push(`${kind}/${id}: marked ready but file missing`);
    else {
      const bytes=fs.readFileSync(file);
      if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP') errors.push(`${kind}/${id}: invalid WebP signature`);
      else {
        const header=webpHeader(bytes);
        if(header&&kind!=='plates'){
          if(manifest.width&&manifest.height&&(header.width!==manifest.width||header.height!==manifest.height)) errors.push(`${kind}/${id}: ${header.width}x${header.height}, the set is ${manifest.width}x${manifest.height}`);
          if(CUTOUT_SETS.has(kind)&&!header.alpha) errors.push(`${kind}/${id}: no alpha channel; this set is cutouts or discs`);
          if(OPAQUE_SETS.has(kind)&&header.alpha) errors.push(`${kind}/${id}: has an alpha channel; this set is full-bleed`);
        }
      }
    }
    if(kind==='portraits'&&!people.some(p=>p.id===id)) errors.push(`${id}: no authored identity`);
    if(kind==='managers'&&!MANAGER_IDS.includes(id)) errors.push(`managers/${id}: not a Command Staff manager`);
    if(kind==='emblems'&&!EMBLEM_IDS.has(id)) errors.push(`emblems/${id}: not a course or development branch`);
    if(kind==='medallions'&&!CALL_TYPE_IDS.has(id)) errors.push(`medallions/${id}: not a call type`);
    if(kind==='crests'&&!CREST_IDS.includes(id)) errors.push(`crests/${id}: not a squad crest`);
    if(kind==='plates'&&!PLATE_ID.test(id)) errors.push(`plates/${id}: not a scene, banner or texture id`);
  }
}
// A file the manifest does not list never renders, so it is dead weight or a missing manifest entry.
for(const [kind, manifest] of [['portraits',portrait],['gear',gear],['materials',materials],['managers',managers],['emblems',emblems],['plates',plates],['medallions',medallions],['crests',crests]]) {
  const dir=path.join(root,`public/art/${kind}`);
  if(!fs.existsSync(dir)) continue;
  for(const file of fs.readdirSync(dir)) if(file.endsWith('.webp')&&!manifest.readyIds.includes(file.slice(0,-5))) errors.push(`${kind}/${file.slice(0,-5)}: file is not listed in the manifest`);
}
// Complete sets: a thing without its painting would show a line icon beside paintings (two styles in one list),
// so adding an item, course, branch, call type or manager takes its art in the same change.
const ITEM_IDS=fs.existsSync(path.join(root,'src/content/items.ts'))?[...read('src/content/items.ts').matchAll(/^ {2}([a-z_]+): \{/gm)].map((m)=>m[1]):[];
for(const [kind, manifest, ids] of [['gear',gear,ITEM_IDS],['emblems',emblems,[...EMBLEM_IDS]],['medallions',medallions,[...CALL_TYPE_IDS]],['crests',crests,CREST_IDS],['managers',managers,MANAGER_IDS]]) {
  for(const id of ids) if(!manifest.readyIds.includes(id)) errors.push(`${kind}/${id}: no art; every ${kind==='gear'?'item':kind==='emblems'?'course and branch':kind==='medallions'?'call type':kind==='crests'?'squad':'manager'} has its own painting`);
}
for(const filename of ['header-lockup-dark.svg','favicon.svg','apple-touch-icon.png']) {
  if(!fs.existsSync(path.join(root,'public/brand',filename))) errors.push(`brand/${filename}: required asset missing`);
}
if(errors.length){ console.error(errors.join('\n'));process.exitCode=1; }
else console.log(JSON.stringify({identities:people.length,portraitsReady:portrait.readyIds.length,personnelFileCards:people.length-portrait.readyIds.length,gearReady:gear.readyIds.length,materialsReady:materials.readyIds.length,managersReady:managers.readyIds.length,emblemsReady:emblems.readyIds.length,emblemIds:EMBLEM_IDS.size,medallionsReady:medallions.readyIds.length,callTypeIds:CALL_TYPE_IDS.size,crestsReady:crests.readyIds.length,requiredBrandAssets:'present'},null,2));
