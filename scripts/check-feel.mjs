// The feel checks (scripts/ui-gates/feel.mjs): negative controls, then the matrix walk of the slice screens,
// then the tap budget. Reports every finding; fails only on a rule that FEEL_ON switches on for that screen.
//   npm run check:feel -- [baseURL] [--scenarios w390,text200] [--screens board,live]
//                         [--all]                  enforce every rule on every screen (what the old UI fails)
//                         [--on board:F1.primary,F4.density,path:F6.taps]   enforce just these
//                         [--no-controls] [--controls-only] [--no-taps]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { FEEL_ON, FEEL_RULES, FEEL_SCREENS, enforced, judgeTaps } from './ui-gates/feel.mjs';
import { runFeelControls } from './ui-gates/feel-controls.mjs';
import { SCENARIOS, feelWalk } from './ui-gates/feel-walk.mjs';
import { serve } from './ui-gates/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['scenarios', 'screens', 'on'].includes(args[i - 1].slice(2)) && args[i - 1].startsWith('--')));
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** FEEL_ON, widened by --all or --on for this run. */
function enforcement() {
  if (flag('all')) return Object.fromEntries([...Object.keys(FEEL_ON).filter((k) => k !== 'path'), 'path'].map((k) => [k, ['*', 'F6.taps']]));
  const on = Object.fromEntries(Object.entries(FEEL_ON).map(([k, v]) => [k, [...v]]));
  for (const item of (option('on') ?? '').split(',').filter(Boolean)) { const [screen, rule] = item.split(':'); (on[screen] ??= []).push(rule); }
  return on;
}

async function main() {
  const require = createRequire(path.join(ROOT, 'package.json'));
  const { chromium } = require('playwright-core');
  const on = enforcement();
  if (!flag('no-controls')) {
    const { failed, ran } = await runFeelControls({ chromium, executablePath: CHROME });
    console.log(`feel controls: ${ran - failed.length}/${ran} behaved`);
    if (failed.length) { console.error(`\nA feel rule did not do what its control expects:\n  ${failed.join('\n  ')}`); process.exit(1); }
    if (flag('controls-only')) return;
  }
  const wanted = option('scenarios')?.split(',');
  const screens = option('screens')?.split(',');
  const scenarios = SCENARIOS.filter((s) => !wanted || wanted.includes(s.id));
  const server = await serve({ root: ROOT, given: positional[0] });
  const failures = [];
  const hard = [];
  try {
    const walked = await feelWalk({ chromium, executablePath: CHROME, baseURL: server.url, scenarios, log: () => {} });
    failures.push(...walked.failures);
    const rows = new Map(); // `${screen}\t${rule}` -> { scenarios: Map(id -> details) }
    for (const r of walked.results) {
      const screen = r.screen.replace(/-reentry$/, '');
      if (screens && !screens.includes(screen)) continue;
      for (const f of r.findings) {
        const key = `${r.screen}\t${f.rule}`;
        if (!rows.has(key)) rows.set(key, new Map());
        rows.get(key).set(r.scenario, `${f.id}: ${f.detail}`);
      }
    }
    console.log(`\n${'screen'.padEnd(14)}${'rule'.padEnd(16)}${'enforced'.padEnd(10)}failing scenarios`);
    for (const [key, byScenario] of [...rows].sort()) {
      const [screen, rule] = key.split('\t');
      const isOn = enforced(rule, screen.replace(/-reentry$/, ''), on);
      console.log(`${screen.padEnd(14)}${rule.padEnd(16)}${(isOn ? 'ON' : 'off').padEnd(10)}${[...byScenario.keys()].join(' ')}`);
      const [firstScenario, detail] = [...byScenario][0];
      console.log(`${' '.repeat(40)}e.g. ${firstScenario}: ${detail}`);
      if (isOn) hard.push(`${screen} ${rule} in ${[...byScenario.keys()].join(', ')}`);
    }
    if (!rows.size) console.log('(no findings)');
    // What F5 actually saw, so a clean result can be told from a blind one.
    for (const sc of scenarios.filter((x) => x.paint)) {
      const seen = walked.results.filter((r) => r.scenario === sc.id).map((r) => `${r.screen} ${(r.raw.plates ?? []).filter((p) => p.pendingArt > 0).length}/${(r.raw.plates ?? []).length}`);
      console.log(`F5 ${sc.id}: plates with art pending on the first frame / plates in view: ${seen.join(', ')}`);
    }
    for (const c of walked.cold) console.log(`\ncold load (${c.scenario}, ${c.note}): FCP ${c.firstContentfulPaintMs} ms, LCP ${c.largestContentfulPaintMs} ms. Reported only; not a gate.`);
    if (!screens && !flag('no-taps')) {
      const { playTaps } = await import('./check-feel-taps.mjs');
      const t = await playTaps({ chromium, executablePath: CHROME, baseURL: server.url });
      console.log(`\nboard -> first live decision: ${t.boardToDecision.length} taps: ${t.boardToDecision.join(' > ')}`);
      console.log(`debrief -> board: ${t.debriefToBoard.length} taps: ${t.debriefToBoard.join(' > ')}`);
      for (const f of [...judgeTaps('board-to-decision', t.boardToDecision), ...judgeTaps('debrief-to-board', t.debriefToBoard)]) {
        const isOn = (on.path ?? []).includes('F6.taps') || (on.path ?? []).includes('*');
        console.log(`F6.taps ${isOn ? 'ON ' : 'off'} ${f.id}: ${f.detail}`);
        if (isOn) hard.push(`path F6.taps ${f.id}`);
      }
    }
  } finally { server.stop(); }
  if (failures.length) { console.error(`\nThe walk could not reach:\n  ${failures.join('\n  ')}`); }
  console.log(`\nrules: ${Object.keys(FEEL_RULES).join(', ')}; screens: ${Object.keys(FEEL_SCREENS).join(', ')}`);
  if (hard.length || (failures.length && !flag('all'))) { console.error(`\ncheck:feel failed on switched-on rules:\n  ${hard.join('\n  ') || 'a walk step failed'}`); process.exit(1); }
  console.log(`check:feel passed${Object.values(on).every((v) => !v.length) ? ' (no rule switched on yet: FEEL_ON in scripts/ui-gates/feel.mjs)' : ''}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
