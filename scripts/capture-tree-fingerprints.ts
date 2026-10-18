// Re-capture src/gen/incident/trees-v13/compiled-fingerprints.json after a deliberate change to
// call-tree content or compilation (see that test's header). Same digest as the test.
//   bun scripts/capture-tree-fingerprints.ts
import { writeFileSync } from 'node:fs';
import { generateBuilding } from '../src/gen/building/index';
import { generateIncident, incidentId } from '../src/gen/incident/index';
import { digest, TREE_FINGERPRINT_SPECS } from '../src/gen/incident/trees-v13/fingerprint-specs';

void generateBuilding;
const out: Record<string, string> = {};
for (const spec of TREE_FINGERPRINT_SPECS) out[incidentId(spec)] = await digest(generateIncident(spec));
writeFileSync(new URL('../src/gen/incident/trees-v13/compiled-fingerprints.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`captured ${Object.keys(out).length} call-tree fingerprints`);
