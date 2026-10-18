// Cross-engine regression tripwires for current content. Recapture deliberately when content changes.
import { readFileSync } from 'node:fs';
import { generateBuilding } from '../src/gen/building/index';
import { generateIncident, parseIncidentId } from '../src/gen/incident/index';

const ROOT = new URL('../', import.meta.url);
const json = (path: string) => JSON.parse(readFileSync(new URL(path, ROOT), 'utf8'));
const strideArg = process.argv.indexOf('--stride');
const stride = strideArg > 0 ? Math.max(1, Number(process.argv[strideArg + 1]) || 1) : 1;

/** SHA-256 of JSON.stringify, exactly as the Vitest fingerprint suites compute it. */
async function digest(value: unknown): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))));
  return [...bytes].map((n) => n.toString(16).padStart(2, '0')).join('');
}

interface Suite { name: string; entries: [key: string, expected: string | number][]; compute: (key: string) => Promise<string | number> }

const buildingSuite = (name: string, path: string): Suite => ({
  name,
  entries: Object.entries(json(path)),
  // Keys are `<familyId>:<seed>`; the family id never contains a colon.
  compute: (key) => { const at = key.lastIndexOf(':'); return digest(generateBuilding(key.slice(0, at), Number(key.slice(at + 1)))); },
});

const incidentSuite = (name: string, path: string): Suite => ({
  name,
  entries: Object.entries(json(path)),
  compute: (key) => {
    const spec = parseIncidentId(key);
    if (!spec) throw new Error(`unparseable incident id ${key}`);
    return digest(generateIncident(spec));
  },
});

const SUITES: Suite[] = [
  buildingSuite('current generated buildings', 'src/gen/building/procedural-g2-fingerprints.json'),
  incidentSuite('v13 compiled calls', 'src/gen/incident/trees-v13/compiled-fingerprints.json'),
];

const engine = typeof (globalThis as { Bun?: { version: string } }).Bun !== 'undefined' ? `Bun ${(globalThis as unknown as { Bun: { version: string } }).Bun.version} (JavaScriptCore)` : `Node ${process.version} (V8)`;
console.log(`cross-engine fingerprints on ${engine}${stride > 1 ? `, every ${stride} entries` : ''}`);
const mismatches: string[] = [];
let checked = 0;
for (const suite of SUITES) {
  const t0 = performance.now();
  const sample = suite.entries.filter((_, i) => i % stride === 0);
  let matched = 0;
  for (const [key, expected] of sample) {
    let actual: string | number;
    try {
      actual = await suite.compute(key);
    } catch (error) {
      actual = `threw ${(error as Error).message}`;
    }
    if (actual === expected) matched++;
    else mismatches.push(`${suite.name}: ${key} expected ${expected}, got ${actual}`);
  }
  checked += sample.length;
  console.log(`${suite.name.padEnd(42)} ${String(matched).padStart(4)}/${sample.length} match  ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
if (mismatches.length) {
  console.log(`\n${mismatches.length} of ${checked} differ:\n${mismatches.join('\n')}`);
  process.exit(1);
}
console.log(`all ${checked} fingerprints match`);
