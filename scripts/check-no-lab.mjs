// The Scenario Lab is dev-only: a normal build must fold the lab branch in src/main.tsx away, so the
// lab root's marker never ships, and the retired story sheet page must stay gone. A normal build also
// loads the game up front: its entry chunk imports App statically (src/dev/game-app-loader.ts), so
// index.html preloads the game's chunks and stylesheets, and has no import() that would fetch them only
// after the entry runs. Nor does the dev-only "Open in lab" control's stylesheet ship. Part of `verify`.
//   node scripts/check-no-lab.mjs              check dist/ (after `npm run build`)
//   node scripts/check-no-lab.mjs --expect-lab check that a `npm run build:lab` output does carry the lab
import fs from 'node:fs';
import path from 'node:path';

const MARKER = 'ti-lab-build-marker';
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const expectLab = process.argv.includes('--expect-lab');

if (!fs.existsSync(dist)) {
  console.error('check-no-lab: dist/ is missing; run `npm run build` first.');
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) files.push(full);
  }
};
walk(dist);

const marked = files.filter((file) => fs.readFileSync(file).includes(MARKER)).map((file) => path.relative(root, file));
const errors = [];
if (expectLab) {
  if (!marked.length) errors.push(`no file under dist/ carries the lab marker "${MARKER}"; was this built with VITE_LAB=1?`);
} else {
  for (const file of marked) errors.push(`${file}: carries the lab marker "${MARKER}"; the lab branch reached a normal build`);
  if (fs.existsSync(path.join(dist, 'story.html'))) errors.push('dist/story.html: the retired story sheet page was built');
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const entry = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
  const entryFile = entry && files.find((file) => path.basename(file) === path.basename(entry));
  if (!entryFile) errors.push('dist/index.html: no module entry script found');
  else if (fs.readFileSync(entryFile, 'utf8').includes('import(')) {
    errors.push(`${path.relative(root, entryFile)}: the game's entry imports a chunk on demand, so index.html can't preload it; the plain build should import App statically (src/dev/game-app-loader.ts)`);
  }
  for (const file of files.filter((file) => fs.readFileSync(file, 'utf8').includes('open-in-lab'))) {
    errors.push(`${path.relative(root, file)}: carries the dev-only "Open in lab" control (open-in-lab)`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ filesScanned: files.length, labMarker: expectLab ? `present in ${marked.length} file(s)` : 'absent' }));
}
