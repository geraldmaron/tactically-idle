// The rendered UI gate and the baseline writer. See docs/visual-kit.md, "UI gates".
//   npm run check:ui -- [baseURL] [--widths 320,390,430]   controls, then the walk, compared with src/ui/ui-debt.json
//   npm run ui:baseline -- [baseURL]                        rewrite src/ui/ui-debt.json from today's UI
// Without a baseURL it starts this worktree's own dev server on a free port and stops it afterwards; it never
// reuses a server already running. A baseURL (or UI_GATES_URL) is reused only if its served code files match
// this worktree's, byte for byte (scripts/ui-gates/serve.mjs); otherwise the run is refused.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STATIC_RULES, collectStatic, countByFile } from './ui-gates/static.mjs';
import { FELL_HELP, RAISED_HELP, entry, readBaseline, writeBaseline } from './ui-gates/ratchet.mjs';
import { RENDERED_RULES, aggregate, compareRendered, countsOf, coverage, firstChoiceVerdict } from './ui-gates/evaluate.mjs';
import { STATES, WIDTHS } from './ui-gates/manifest.mjs';
import { runControls } from './ui-gates/controls.mjs';
import { serve } from './ui-gates/serve.mjs';
import { walk } from '../docs/captures/ui-ux-audit/tools/capture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && ['widths'].includes(args[i - 1].slice(2))));
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

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
  const server = await serve({ root: ROOT, given: positional[0] });
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
      process.exitCode = 1; // not process.exit: the finally below must stop the server this run started
      return;
    }
    console.log('\ncheck:ui passed: every rendered count matches src/ui/ui-debt.json');
  } finally {
    server.stop();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
