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
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../src/content/call-trees/civilian-names';
import { bindRoleTokens } from '../src/gen/incident/trees-v13/compile';
import { callStringRows, toTsv } from '../src/gen/incident/trees-v13/strings';

void generateBuilding;
const ROOT = new URL('../', import.meta.url).pathname;
const CHECKER = join(ROOT, '.agents/skills/swat-call-prose/scripts/game_string_checks.py');
const LINT = join(ROOT, 'src/gen/incident/gates/prose-lint.ts');
const longest = (names: readonly string[]) => names.reduce((a, b) => (b.length > a.length ? b : a));
const first = longest(CIVILIAN_FIRST_NAMES.they), surname = longest(CIVILIAN_SURNAMES);

const only = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), 'ti-strings-'));
let failed = false;
for (const template of Object.values(INCIDENT_TEMPLATES)) {
  if (!template || (only.length && !only.includes(template.type))) continue;
  // A group binds at the largest size its slot allows, every member with the longest names.
  const groups = Object.fromEntries(Object.entries(template.tree.groups ?? {}).map(([group, spec]) => {
    const slot = template.cast.find(entry => entry.id === spec.slot);
    const size = slot ? Math.max(0, slot.count.max - slot.keyRoles.length) : 0;
    return [group, Array.from({ length: size }, (_, i) => `${group}_${i + 1}`)];
  }));
  const ids = [...template.tree.roles.map(role => role.id), ...Object.values(groups).flat()];
  const cast = Object.fromEntries(ids.map(id => [id, { firstName: first, surname, pronouns: 'they' as const, age: 17 }]));
  const rooms = { scene: 'storage room', ...Object.fromEntries([...ids, ...Object.keys(groups)].map(id => [id, 'sales floor'])) };
  const counts = Object.fromEntries(Object.entries(groups).map(([group, members]) => [group, members.length]));
  const rows = callStringRows(template.tree, text => bindRoleTokens(text, cast, 'The Fox and Pheasant', rooms, groups), Object.keys(counts).length ? counts : undefined);
  const path = join(dir, `${template.type}.tsv`);
  writeFileSync(path, toTsv(rows));
  // The place's own words are a name too, never a repeated run or an opener.
  const run = spawnSync('python3', [CHECKER, path, '--lint-source', LINT, '--cast', first, surname, 'Fox', 'Pheasant'], { encoding: 'utf8' });
  console.log(`\n=== ${template.type} (${rows.length} strings) exit ${run.status}`);
  process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
