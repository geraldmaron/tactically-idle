// The rendered UI gate and the baseline writer. See docs/visual-kit.md, "UI gates".
//   npm run check:ui -- [baseURL] [--widths 320,390,430]   run the controls, then the walk, and compare with src/ui/ui-debt.json
//   npm run ui:baseline -- [baseURL]                        rewrite src/ui/ui-debt.json from today's UI
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { STATIC_RULES, collectStatic, countByFile } from './ui-gates/static.mjs';
import { entry, readBaseline, writeBaseline } from './ui-gates/ratchet.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);

async function main() {
  if (flag('baseline')) {
    const baseline = readBaseline(ROOT);
    const found = collectStatic(ROOT);
    baseline.static = Object.fromEntries(Object.keys(STATIC_RULES).map((id) => [id, entry(countByFile(found[id]))]).filter(([, e]) => e.total > 0));
    writeBaseline(ROOT, baseline);
    console.log('wrote src/ui/ui-debt.json (static rules)');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
