// Run the swat-call-prose string checker on every call template (or the types given), and send the
// rows to the skill's own checker, which stays the one implementation of the house rules. Each call
// runs three times:
//   - bound with the longest names in the civilian pools and singular they, the worst case for the
//     length budgets (strings.ts longestNamesCast, shared with the Scenario Lab);
//   - bound with distinct longest names per person, everyone he, then everyone she, so repeats and
//     openers that depend on names or verb agreement show (hostage review N7).
// Then one pass over every call's rows at once reports sentences and runs repeated across calls
// (N9). That pass reports only; the per-call runs decide the exit code.
// Output is byte-stable: the checker sorts its own findings, and this wrapper sorts each run's
// finding rows and the cross-call rows it keeps, so two runs of the same content print the same thing.
//   npm run check:strings                    # every template
//   npm run check:strings -- hostage_crisis  # one
// Exits 1 when the checker finds a blocking issue in any per-call run.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateBuilding } from '../src/gen/building/index';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../src/content/call-trees/civilian-names';
import { INCIDENT_TEMPLATES } from '../src/content/incidents';
import type { IncidentTemplate } from '../src/content/incidents/types';
import { callsWith } from '../src/gen/incident/gates/cross-call';
import { bindRoleTokens } from '../src/gen/incident/trees-v13/compile';
import type { CastIdentity } from '../src/gen/incident/trees-v13/compile';
import { callStringRows, longestNamesCast, toTsv } from '../src/gen/incident/trees-v13/strings';
import type { StringRow } from '../src/gen/incident/trees-v13/strings';

void generateBuilding;
const ROOT = new URL('../', import.meta.url).pathname;
const CHECKER = join(ROOT, '.agents/skills/swat-call-prose/scripts/game_string_checks.py');
const LINT = join(ROOT, 'src/gen/incident/gates/prose-lint.ts');

const only = process.argv.slice(2);
const dir = mkdtempSync(join(tmpdir(), 'ti-strings-'));

/** A checker finding row (`kind situation where detail`), as opposed to the run's closing report. */
const FINDING = /^[a-z][a-z-]*\s{2,}/;
const TRAILER = /^(lead uses|sentence length|opener share|rule-of-three|lint |summary )/;
/** The checker's stdout with its leading block of finding rows sorted, the closing report kept in order. */
function stable(stdout: string): string {
  const lines = stdout.split('\n');
  let end = 0;
  while (end < lines.length && FINDING.test(lines[end]) && !TRAILER.test(lines[end])) end++;
  return [...lines.slice(0, end).sort(), ...lines.slice(end)].join('\n');
}

function check(name: string, rows: readonly StringRow[], castWords: readonly string[], extra: readonly string[] = []): { status: number | null; stdout: string } {
  const path = join(dir, `${name}.tsv`);
  writeFileSync(path, toTsv(rows));
  const run = spawnSync('python3', [CHECKER, path, '--lint-source', LINT, '--cast', ...castWords, ...extra], { encoding: 'utf8' });
  if (run.stderr) process.stderr.write(run.stderr);
  return { status: run.status, stdout: stable(run.stdout) };
}

/** Everyone in the call with a distinct name, the longest the pools hold, all with these pronouns. */
function distinctCast(ids: readonly string[], pronouns: 'he' | 'she'): Record<string, CastIdentity> {
  const byLength = (names: readonly string[]) => [...names].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const firsts = byLength(CIVILIAN_FIRST_NAMES[pronouns]), surnames = byLength(CIVILIAN_SURNAMES);
  if (ids.length > firsts.length || ids.length > surnames.length) throw new Error(`${ids.length} people need distinct names; the ${pronouns} pool has ${firsts.length}`);
  return Object.fromEntries(ids.map((id, i) => [id, { firstName: firsts[i], surname: surnames[i], pronouns, age: 17 }]));
}

const words = (cast: Record<string, CastIdentity>) => [...new Set(Object.values(cast).flatMap(who => [who.firstName, who.surname]))];

let failed = false;
const everyCall: StringRow[] = [];
const callOf = new Map<StringRow, string>();
for (const template of Object.values(INCIDENT_TEMPLATES) as (IncidentTemplate | undefined)[]) {
  if (!template || (only.length && !only.includes(template.type))) continue;
  // Groups at their largest size, every person with the longest names, singular they.
  const { cast, groups, rooms, place, counts, clockNexts } = longestNamesCast(template);
  // The place's own words are a name too, never a repeated run or an opener.
  const placeWords = place.split(' ').filter(word => word !== 'The' && /^[A-Z]/.test(word));
  const rowsWith = (people: Record<string, CastIdentity>) =>
    callStringRows(template.tree, text => bindRoleTokens(text, people, place, rooms, groups), Object.keys(counts).length ? counts : undefined, clockNexts);
  const ids = Object.keys(cast);
  const runs: [label: string, people: Record<string, CastIdentity>][] = [
    ['longest names, they', cast], ['distinct names, he', distinctCast(ids, 'he')], ['distinct names, she', distinctCast(ids, 'she')]];
  for (const [label, people] of runs) {
    const rows = rowsWith(people);
    const run = check(`${template.type}-${label.replace(/\W+/g, '-')}`, rows, [...words(people), ...placeWords]);
    console.log(`\n=== ${template.type} (${rows.length} strings, ${label}) exit ${run.status}`);
    process.stdout.write(run.stdout);
    if (run.status !== 0) failed = true;
    if (people === cast) for (const row of rows) { const keyed = { ...row, where: `${template.type}/${row.where}` }; everyCall.push(keyed); callOf.set(keyed, template.type); }
  }
}

// Repeats across calls (N9): the checker over every call's rows at once, its repeat and run rows kept
// where the sentence or run turns up in two or more calls. Report only.
if (new Set(callOf.values()).size > 1) {
  const castWords = [...new Set(Object.values(INCIDENT_TEMPLATES).flatMap(template => template ? words(longestNamesCast(template).cast) : []))];
  const run = check('every-call', everyCall, castWords, ['--min-repeat', '2']);
  const rows = everyCall.map(row => ({ text: row.text, call: callOf.get(row)! }));
  const across: string[] = [];
  for (const line of run.stdout.split('\n')) {
    const calls = callsWith(line, rows);
    if (calls.length > 1) across.push(`${line.trimEnd()}  [${calls.join(', ')}]`);
  }
  console.log(`\n=== every call (${everyCall.length} strings, longest names, they): ${across.length} repeated across calls (report only)`);
  for (const line of across.sort()) console.log(line);
}
process.exit(failed ? 1 : 0);
