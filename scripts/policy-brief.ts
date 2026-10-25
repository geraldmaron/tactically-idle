// Print the editorial brief for a surface, built from the content controls (src/content/policy).
// The editorial pass hands this to its reviewer, so the reviewer reads the same rules the gates enforce.
//   bun scripts/policy-brief.ts                # call_text
//   bun scripts/policy-brief.ts threat_text    # one surface
import { CONTROLS, editorialBrief } from '../src/content/policy';
import type { Surface } from '../src/content/policy';

const surfaces = [...new Set(CONTROLS.flatMap((control) => control.surfaces))];
const surface = process.argv[2] ?? 'call_text';
if (!surfaces.includes(surface as Surface)) { console.error(`Unknown surface "${surface}". Surfaces: ${surfaces.join(', ')}`); process.exit(2); }
process.stdout.write(editorialBrief(surface as Surface));
