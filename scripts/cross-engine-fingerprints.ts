// Recompute frozen content fingerprints on another JavaScript engine and compare them with the
// JSON captured under V8 (Node/Vitest). Issued incidents and generated buildings regenerate from
// their IDs on whatever engine a player runs, so the same ID must give the same bytes everywhere.
//
//   bun scripts/cross-engine-fingerprints.ts            # every entry (JavaScriptCore under Bun)
//   bun scripts/cross-engine-fingerprints.ts --stride 4 # every fourth entry of each suite
//
// Suites: `_g1` and `_g2` generated buildings (plain and furnished), published v4 definitions,
// issued v6-v8 (authored buildings with v7 furnishing from content v7), v9, v10 and v11 incidents.
// Exits 1 on any mismatch and lists it. A mismatch in a frozen suite is a finding to report; never
// re-baseline frozen JSON to make this pass.
//
// The six v4 decision-exercise entries were dropped on the owner's ruling (2026-10-08): practice and
// its exercises left the game in 721536c, so those IDs no longer resolve to a scenario.
//
// Bun runs the TypeScript sources directly. The building index is imported before the generator
// modules: they form an import cycle that only resolves from that end.
import { readFileSync } from 'node:fs';
import { generateBuilding } from '../src/gen/building/index';
import { generateIncident, parseIncidentId, INCIDENT_TYPES_V4 } from '../src/gen/incident/index';
import { hashSeed } from '../src/sim/rng';
import type { IncidentSpec } from '../src/sim/scenario-types';

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

/** The definition embeds its spec object as given, so key order is part of the bytes. `capturedOrder`
 * rebuilds the spec in the order its Vitest suite passed it (v6-v8: catalog-v9.test.ts puts `seed`
 * before `buildingSeed`); otherwise the spec is parseIncidentId's, as the game builds it. */
const incidentSuite = (name: string, path: string, capturedOrder?: (spec: IncidentSpec) => IncidentSpec): Suite => ({
  name,
  entries: Object.entries(json(path)),
  compute: (key) => {
    const spec = parseIncidentId(key);
    if (!spec) throw new Error(`unparseable incident id ${key}`);
    return digest(generateIncident(capturedOrder ? capturedOrder(spec) : spec));
  },
});

// v4 was captured with hashSeed over the JSON (v4-story-compatibility.test.ts), keyed type/family/seed at building seed 7.
const v4 = json('src/gen/incident/v4-published-fingerprints.json') as { definitions: Record<string, number> };
const v4Types = new Set(INCIDENT_TYPES_V4.map((t) => t.type));
const v4Suite: Suite = {
  name: 'published v4 definitions',
  entries: Object.entries(v4.definitions),
  compute: async (key) => {
    const [type, familyId, seed] = key.split('/');
    if (!v4Types.has(type as IncidentSpec['type'])) throw new Error(`unknown v4 type ${type}`);
    return hashSeed(JSON.stringify(generateIncident({ type: type as IncidentSpec['type'], familyId, buildingSeed: 7, seed: Number(seed), tier: 2, contentVersion: 4 })));
  },
};

const SUITES: Suite[] = [
  buildingSuite('generated buildings _g1', 'src/gen/building/procedural-g1-fingerprints.json'),
  buildingSuite('generated buildings _g2', 'src/gen/building/procedural-g2-fingerprints.json'),
  v4Suite,
  incidentSuite('issued v6-v8 (authored, v7 furnishing)', 'src/gen/incident/issued-v6-v8-fingerprints.json',
    ({ type, familyId, seed, buildingSeed, tier, contentVersion }) => ({ type, familyId, seed, buildingSeed, tier, contentVersion })),
  incidentSuite('issued v9', 'src/gen/incident/issued-v9-fingerprints.json'),
  incidentSuite('issued v10', 'src/gen/incident/issued-v10-fingerprints.json'),
  incidentSuite('issued v11', 'src/gen/incident/issued-v11-fingerprints.json'),
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
