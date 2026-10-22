// The rendered UI gate and the baseline writer. See docs/visual-kit.md, "UI gates".
//   npm run check:ui -- [baseURL] [--widths 320,390,430]   controls, then the walk, compared with src/ui/ui-debt.json
//   npm run ui:baseline -- [baseURL]                        rewrite src/ui/ui-debt.json from today's UI
// Without a baseURL it starts its own dev server on port 5174 (or uses the one already there).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STATIC_RULES, collectStatic, countByFile } from './ui-gates/static.mjs';
import { FELL_HELP, RAISED_HELP, entry, readBaseline, writeBaseline } from './ui-gates/ratchet.mjs';
import { RENDERED_RULES, aggregate, compareRendered, countsOf, coverage, firstChoiceVerdict } from './ui-gates/evaluate.mjs';
import { STATES, WIDTHS } from './ui-gates/manifest.mjs';
import { runControls } from './ui-gates/controls.mjs';
import { walk } from '../docs/captures/ui-ux-audit/tools/capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['widths'].includes(args[i - 1].slice(2))));
const PORT = 5174;
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function reachable(url) { try { return (await fetch(url)).ok; } catch { return false; } }

/** The URL to walk: the one given, the dev server already on 5174, or one this run starts and stops. */
async function serve() {
  const given = positional[0] ?? process.env.UI_GATES_URL;
  if (given) return { url: given, stop: () => {} };
  const url = `http://localhost:${PORT}/`;
  if (await reachable(url)) return { url, stop: () => {} };
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: false });
  for (let i = 0; i < 60 && !(await reachable(url)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await reachable(url))) { child.kill(); throw new Error(`could not start a dev server on port ${PORT}`); }
  return { url, stop: () => child.kill() };
}

function renderedCounts(result, widths) {
  const { report, failures } = result;
  const agg = aggregate(result.frames);
  const extra = { R16: {}, R17: {} };
  const detail = {};
  for (const frame of result.frames) {
    const decision = frame.probe.decision;
    if (frame.segment === 0 && STATES.find((s) => s.id === frame.name)?.decision) {
      const verdict = firstChoiceVerdict(frame.width, decision);
      if (!verdict.ok) { extra.R16[`${frame.name}@${frame.width}`] = 1; detail[`R16 ${frame.name}@${frame.width}`] = verdict.why; }
    }
  }
  for (const [key, why] of coverage(report, widths, failures)) { extra.R17[key] = 1; detail[`R17 ${key}`] = why; }
  return { counts: countsOf(agg, extra), agg, detail };
}

async function main() {
  const require = createRequire(path.join(ROOT, 'package.json'));
  const widths = (option('widths') ?? WIDTHS.join(',')).split(',').map(Number);
  if (flag('static-only')) return;
  if (!flag('no-controls')) {
    const { chromium } = require('playwright-core');
    const { failed, ran } = await runControls({ chromium, executablePath: CHROME });
    console.log(`controls: ${ran - failed.length}/${ran} behaved`);
    if (failed.length) { console.error(`\nA rendered rule did not do what its control expects:\n  ${failed.join('\n  ')}`); process.exit(1); }
    if (flag('controls-only')) return;
  }
  const server = await serve();
  try {
    const frames = [];
    const result = await walk({ repo: ROOT, baseURL: server.url, widths, onFrame: (f) => frames.push(f), log: (...a) => console.log(...a) });
    result.frames = frames;
    const { counts, agg, detail } = renderedCounts(result, widths);
    const baseline = readBaseline(ROOT);
    if (flag('baseline')) {
      baseline.static = Object.fromEntries(Object.keys(STATIC_RULES).map((id) => [id, entry(countByFile(collectStatic(ROOT)[id]))]).filter(([, e]) => e.total > 0));
      const fresh = Object.fromEntries(Object.keys(RENDERED_RULES).map((id) => [id, entry(counts[id] ?? {})]).filter(([, e]) => e.total > 0));
      if (widths.length === WIDTHS.length) baseline.rendered = fresh;
      else {
        // A partial run rewrites only the widths it walked.
        for (const id of Object.keys(RENDERED_RULES)) {
          const kept = Object.fromEntries(Object.entries(baseline.rendered[id]?.counts ?? {}).filter(([k]) => !widths.some((w) => k.includes(`@${w}`))));
          const merged = entry({ ...kept, ...(counts[id] ?? {}) });
          if (merged.total > 0) baseline.rendered[id] = merged; else delete baseline.rendered[id];
        }
      }
      writeBaseline(ROOT, baseline);
      console.log(`wrote src/ui/ui-debt.json (${Object.keys(baseline.static).length} static rules, ${Object.keys(baseline.rendered).length} rendered rules)`);
      return;
    }
    const problems = compareRendered(counts, baseline, widths);
    for (const rule of Object.keys(RENDERED_RULES)) console.log(`${rule.padEnd(14)} ${String(Object.values(counts[rule] ?? {}).reduce((a, b) => a + b, 0)).padStart(5)}  ${RENDERED_RULES[rule]}`);
    if (problems.length) {
      console.error('');
      for (const p of problems) {
        console.error(`${p.rule} ${p.kind === 'rose' ? 'rose' : 'fell'}. ${p.kind === 'rose' ? RAISED_HELP : FELL_HELP}`);
        for (const line of p.lines.slice(0, 12)) {
          const key = line.split(':')[0];
          const sample = [...(agg[p.rule]?.[key] ?? new Map())].slice(0, 3).map(([id, d]) => `      ${id} :: ${d}`).join('\n');
          console.error(`  ${line}${detail[`${p.rule} ${key}`] ? ` (${detail[`${p.rule} ${key}`]})` : ''}${p.kind === 'rose' && sample ? `\n${sample}` : ''}`);
        }
      }
      process.exit(1);
    }
    console.log('\ncheck:ui passed: every rendered count matches src/ui/ui-debt.json');
  } finally {
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
