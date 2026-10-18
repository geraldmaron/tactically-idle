// Run the swat-call-prose string checker on every call template (or the types given). Each call is
// bound with the longest names in the civilian pools and singular they, the worst case for the
// length budgets, and sent to the skill's own checker, which stays the one implementation of the
// house rules.
//   npm run check:strings                    # every template
//   npm run check:strings -- hostage_crisis  # one
// Exits 1 when the checker finds a blocking issue in any call.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateBuilding } from '../src/gen/building/index';
import { INCIDENT_TEMPLATES } from '../src/content/incidents';
import { bindRoleTokens } from '../src/gen/incident/trees-v13/compile';
import { callStringRows, longestNamesCast, toTsv } from '../src/gen/incident/trees-v13/strings';

void generateBuilding;
const ROOT = new URL('../', import.meta.url).pathname;
const CHECKER = join(ROOT, '.agents/skills/swat-call-prose/scripts/game_string_checks.py');
const LINT = join(ROOT, 'src/gen/incident/gates/prose-lint.ts');

const only = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), 'ti-strings-'));
let failed = false;
for (const template of Object.values(INCIDENT_TEMPLATES)) {
  if (!template || (only.length && !only.includes(template.type))) continue;
  // The worst case for the budgets (strings.ts longestNamesCast, shared with the Scenario Lab):
  // groups at their largest size, every person with the longest names.
  const { cast, groups, rooms, place, counts, clockNexts } = longestNamesCast(template);
  const { firstName: first, surname } = Object.values(cast)[0];
  const rows = callStringRows(template.tree, text => bindRoleTokens(text, cast, place, rooms, groups), Object.keys(counts).length ? counts : undefined, clockNexts);
  const path = join(dir, `${template.type}.tsv`);
  writeFileSync(path, toTsv(rows));
  // The place's own words are a name too, never a repeated run or an opener.
  const placeWords = place.split(' ').filter(word => word !== 'The' && /^[A-Z]/.test(word));
  const run = spawnSync('python3', [CHECKER, path, '--lint-source', LINT, '--cast', first, surname, ...placeWords], { encoding: 'utf8' });
  console.log(`\n=== ${template.type} (${rows.length} strings) exit ${run.status}`);
  process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
