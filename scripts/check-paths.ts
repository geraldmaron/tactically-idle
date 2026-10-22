// Path-level measures for one call, from the real engine (docs/backlog.md `path-measures`):
//   npm run check:paths -- hostage_crisis
//   npm run check:paths -- hostage_crisis --calls 100 --walks 200 --cap 8000 --json
// Four measures per call: adverse routes into a named node per path, fact reach per balance style,
// dominance with the payoff grid at a node's first and median arrival, and 4-word echoes between
// stages on played paths. Report only: the flags are the zero floors and at-most-two rules in
// docs/calls/depth-mesh-method.md, not thresholds; nothing fails the build unless --strict is given.
// The measures are src/dev/lab/model/path-measures.ts; the plays that feed them path-collect.ts.
import { generateBuilding } from '../src/gen/building/index';
import { CALL_TREES } from '../src/content/call-trees';
import { POLICIES, drawCalls } from '../src/gen/incident/trees-v13/balance';
import type { Policy } from '../src/gen/incident/trees-v13/balance';
import { choiceIndex } from '../src/gen/incident/trees-v13/graph';
import { dominanceNodes, playedPaths, uniformPaths } from '../src/dev/lab/model/path-collect';
import { adverseNamed, adverseRoutes, beatenRows, echoSummary, factReach, flatRows, oddsDominated, pathEchoes, twoTails } from '../src/dev/lab/model/path-measures';
import type { DominanceNode, PathRecord } from '../src/dev/lab/model/path-measures';
import { openSession } from '../src/dev/lab/model/session';
import type { Session } from '../src/dev/lab/model/session';
import { parseLabUrl } from '../src/dev/lab/url';
import type { IncidentType } from '../src/sim/scenario-types';

void generateBuilding;

function flag(name: string, fallback: number): number {
  const at = process.argv.indexOf(`--${name}`);
  const value = at < 0 ? NaN : Number(process.argv[at + 1]);
  return Number.isFinite(value) ? value : fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);
const type = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : undefined) as IncidentType | undefined;
const arg = (name: string): string | undefined => { const at = process.argv.indexOf(`--${name}`); return at < 0 ? undefined : process.argv[at + 1]; };
const NAMED = arg('named');
const CALLS = flag('calls', 300), WALKS = flag('walks', 600), CAP = flag('cap', 40000), TIER = flag('tier', 2);

const die = (message: string): never => { console.error(message); process.exit(2); throw new Error(message); };
const found = type ? CALL_TREES[type] : undefined;
if (!type || !found) die(`usage: check:paths -- <type> [--named <regex>] [--calls ${CALLS}] [--walks ${WALKS}] [--cap ${CAP}] [--tier ${TIER}] [--grids] [--json] [--strict]\ncurated calls: ${Object.keys(CALL_TREES).join(', ') || 'none'}`);
const tree = found as NonNullable<typeof found>;

const pct = (x: number) => `${Math.round(x * 100)}%`;
const table = (head: string[], rows: string[][]) => {
  const width = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const line = (r: string[]) => r.map((cell, i) => i === 0 ? cell.padEnd(width[i]) : cell.padStart(width[i])).join('  ');
  return [line(head), ...rows.map(line)].join('\n');
};
const log = (text = '') => { if (!has('json')) console.log(text); };

const started = performance.now();
const seconds = () => `${Math.round((performance.now() - started) / 1000)}s`;
console.error(`playing ${CALLS} drawn calls of ${type} at tier ${TIER} in ${POLICIES.length} styles…`);
const calls = drawCalls(tree, TIER, CALLS);
const played = playedPaths(tree, calls, POLICIES as readonly Policy[]);
console.error(`  played ${played.length} paths (${seconds()})`);

const situations = tree.situations.length;
const uniform: PathRecord[] = [], dominance: DominanceNode[] = [];
const walks: { situation: number; states: number; truncated: boolean }[] = [];
for (let variant = 0; variant < situations; variant++) {
  const s = openSession(parseLabUrl(`?type=${type}&tier=${TIER}&variant=${variant}`).url, null);
  if (!('frames' in s)) die(`could not open situation ${variant}: ${s.message}`);
  const session = s as Session;
  uniform.push(...uniformPaths(session, WALKS, variant + 1).map(path => ({ ...path, source: `uniform:s${variant + 1}` })));
  const { nodes, walk } = dominanceNodes(session, CAP);
  dominance.push(...nodes);
  walks.push({ situation: variant + 1, states: walk.states, truncated: walk.truncated });
  console.error(`  situation ${variant + 1}: ${WALKS} uniform walks, ${walk.states} engine states${walk.truncated ? ' (cap hit)' : ''} (${seconds()})`);
}
const everyPath = [...played, ...uniform];

// ---------------------------------------------------------------- 1. adverse routes
const adverse = adverseRoutes(everyPath, tree);
const named = NAMED ? adverseNamed(everyPath, new RegExp(NAMED, 'i')) : [];
const factIds = Object.keys(tree.facts).map(id => `f_${id}`);
const reach = factReach(played, factIds).concat(factReach(uniform, factIds));
const echoes = echoSummary(everyPath);
const flagged = {
  adverse: adverse.filter(row => row.flagged), reach: reach.filter(row => row.flagged),
  dominance: dominance.filter(node => beatenRows(node).length || twoTails(node)), review: dominance.filter(node => !beatenRows(node).length && !twoTails(node) && oddsDominated(node).length), echoes: echoes.filter(row => row.flagged),
};

if (has('json')) {
  console.log(JSON.stringify({ type, tier: TIER, calls: CALLS, walks: WALKS, cap: CAP, engineWalks: walks, adverse, named, reach, echoes,
    dominance: dominance.map(node => ({ ...node, beaten: beatenRows(node).map(row => row.actionId), flat: flatRows(node).map(row => row.actionId), twoTails: twoTails(node), oddsDominated: oddsDominated(node) })) }, null, 1));
} else {
  log(`check:paths ${type}  tier ${TIER}, ${CALLS} drawn calls x ${POLICIES.length} styles, ${WALKS} uniform walks per situation, engine walk cap ${CAP}`);
  log('Report only. A flag is a method floor or at-most-two rule failing here, not a threshold the owner has set.\n');

  log('1. Adverse results that land in the same node, per path');
  log('   authored: adverse outcomes in the tree routing to the node; choices: how many choices carry them. max/mean are per path over every path of the source.');
  const authored = adverse.filter((row, i, all) => all.findIndex(r => r.node === row.node) === i);
  log(table(['source', 'node', 'authored', 'choices', 'paths', 'max', 'mean', '>=2', '>=3', ''],
    adverse.filter(row => row.max >= 2 || row.authored >= 4).map(row => [row.source, row.node, String(row.authored), String(row.choices), String(row.paths), String(row.max), String(row.mean), pct(row.atLeast2), pct(row.atLeast3), row.flagged ? 'FLAG' : ''])));
  log(`   (${authored.length} nodes receive adverse results; rows shown have a path with 2 or more, or 4 or more authored routes)`);
  if (named.length) {
    log(`   adverse results whose lines match /${NAMED}/, per path (what the player reads, not where it routes):`);
    log(table(['source', 'paths', 'max', 'mean', '>=3', ''], named.map(row => [row.source, String(row.paths), String(row.max), String(row.mean), pct(row.atLeast3), row.flagged ? 'FLAG' : ''])));
  }
  log();

  log('2. Facts settled (confirmed or disproved) by the end of the call, per source');
  const sources = [...new Set(reach.map(row => row.source))];
  log(table(['fact', ...sources, ''], factIds.map(fact => {
    const rows = sources.map(source => reach.find(row => row.fact === fact && row.source === source));
    return [fact.slice(2), ...rows.map(row => row ? pct(row.share) : '-'), rows.some(row => row?.flagged) ? 'FLAG' : ''];
  })));
  for (const fact of factIds) {
    const best = reach.filter(row => row.fact === fact && row.source.startsWith('played:')).map(row => `${row.source.slice(7)} ${Object.entries(row.firstBy).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([key, n]) => `${key} x${n}`).join(', ') || 'never'}`);
    log(`   ${fact.slice(2)} first settled by: ${best.join(' | ')}`);
  }
  log();

  log('3. Dominance at a node\'s first and median arrival (engine walk)');
  for (const w of walks) log(`   situation ${w.situation}: ${w.states} states${w.truncated ? ', cap hit, so arrivals are the shallow ones' : ', every state covered'}`);
  const index = choiceIndex(tree);
  const idOf = (actionId: string) => index.get(actionId)?.choice ?? actionId;
  log('   beaten: the Lab\'s strict rule (no column better for the loser), a FLAG. behind: another option is no worse on odds and 5+ points better on one; the loser\'s remaining edges are in the grid and a person decides whether they are a reason to pick it (REVIEW).');
  log(table(['situation', 'node', 'arrival', 'arrivals', 'options', 'beaten', 'behind', 'flat', ''],
    dominance.map(node => [`s${node.situation + 1}`, node.node, node.at, String(node.arrivals), String(node.rows.length), String(beatenRows(node).length), String(oddsDominated(node).length), String(flatRows(node).length),
      beatenRows(node).length || twoTails(node) ? 'FLAG' : oddsDominated(node).length ? 'REVIEW' : ''])));
  const shown = dominance.filter(node => has('grids') || beatenRows(node).length || twoTails(node) || oddsDominated(node).length);
  const sameAsFirst = (node: DominanceNode) => {
    const first = dominance.find(other => other.situation === node.situation && other.node === node.node && other.at === 'first');
    const key = (n: DominanceNode) => JSON.stringify(n.rows.map(row => [row.actionId, row.favorable, row.adverse, row.minutes]));
    return node.at === 'median' && !!first && key(first) === key(node);
  };
  for (const node of shown) {
    if (sameAsFirst(node)) { log(`\n   s${node.situation + 1} ${node.node} (median arrival): same odds as the first arrival`); continue; }
    log(`\n   s${node.situation + 1} ${node.node} (${node.at} arrival): ${twoTails(node) ? 'every option under 10% favorable. ' : ''}payoff grid`);
    log(table(['option', 'well', 'bad', 'min', 'unlocks', 'bad leads to', 'who pays', 'flags'], node.rows.map(row => [idOf(row.actionId), pct(row.favorable), pct(row.adverse), String(row.minutes),
      row.writes.map(key => key.replace(/^[a-z]+:/, '')).join('+') || '-', row.adverseTo ? (row.adverseTo.kind === 'node' ? row.adverseTo.node : `end:${row.adverseTo.ending}`) : '-',
      row.adverseHarm.join('+') || '-', row.flags.map(f => f.kind === 'beaten' ? `beaten by ${idOf(f.by)} (${f.columns.join(', ')})` : f.kind === 'flat' ? `flat with ${f.with.map(idOf).join(', ')}` : f.kind).join('; ') || '-'])));
    for (const d of oddsDominated(node)) {
      const loser = node.rows.find(row => row.actionId === d.loser)!;
      log(`     ${idOf(d.loser)} is behind ${idOf(d.winner)} (+${d.wellGap} well, -${d.badGap} bad); its edges: ${d.loserEdges.join(', ') || 'none (strict)'}`);
      log(`       ${idOf(d.loser)}: ${loser.costSeen.summary} | bad result: ${loser.costSeen.adversePreview}`);
    }
  }
  log();

  log('4. Four-word echoes between two steps of one path (names masked, function words ignored)');
  log(table(['source', 'paths', 'any echo', 'cross-stage', 'per path', ''], echoes.map(row => [row.source, String(row.paths), pct(row.shareEcho), pct(row.shareCrossStage), String(row.mean), row.flagged ? 'FLAG' : ''])));
  for (const row of echoes.filter(r => r.source === 'uniform:s1' || r.source === 'played:best_odds')) log(`   ${row.source} most repeated: ${row.top.slice(0, 5).map(t => `"${t.run}" (${t.paths})`).join(', ')}`);
  const example = uniform.map(path => ({ path, echoes: pathEchoes(path).filter(echo => echo.crossStage) })).find(entry => entry.echoes.length);
  if (example) log(`   example (${example.path.source}): "${example.echoes[0].run}" in step ${example.echoes[0].a.step + 1} (${example.echoes[0].a.stage}) and step ${example.echoes[0].b.step + 1} (${example.echoes[0].b.stage})`);
  log(`\nflags: adverse ${flagged.adverse.length}, fact reach ${flagged.reach.length}, dominance ${flagged.dominance.length} (${flagged.review.length} more to review), echoes ${flagged.echoes.length}  (${seconds()})`);
}
if (has('strict') && [flagged.adverse, flagged.reach, flagged.dominance, flagged.echoes].some(list => list.length)) process.exit(1);
