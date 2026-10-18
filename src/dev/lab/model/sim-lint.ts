// Lint from played runs (spec 6.3, simulation rows): what a reach tally shows that the static lint
// can't. A node or ending this call can reach that no run reached; a choice offered but locked for
// the squad in every visit; a node where most visits offered flat odds (choices within 5 points, or
// all at 90% or more); runs that stopped without an ending. Each finding names the population it was
// counted over (`scopeLabel`, "this call · random style · 400 runs").
import type { CallTree } from '../../../content/call-trees/types';
import { sentenceCase } from '../../../gen/incident/trees-v13/dependencies';
import type { LintFinding } from '../../../gen/incident/trees-v13/dependencies';
import { truthReach } from '../../../gen/incident/trees-v13/graph';
import type { CallGraph } from '../../../gen/incident/trees-v13/graph';
import type { ReachTally } from '../jobs/tally';

/** A flat node is reported when at least this share of its visits were flat. */
export const FLAT_SHARE = 0.5;

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** Splits a tally's choice key: `node/choice`, or a compiled action id the graph knows. */
function choiceOf(key: string, graph: CallGraph): { node: string; choice: string } | null {
  const slash = key.indexOf('/');
  if (slash > 0) return { node: key.slice(0, slash), choice: key.slice(slash + 1) };
  const found = graph.choices.find(entry => entry.actionId === key);
  return found ? { node: found.node, choice: found.choice } : null;
}

/** never_reached, locked_for_squad, flat_odds and stuck_runs for one tally. With the tree, "can reach"
 * also respects the graph's hidden truth (truthReach); without it, every vertex in the call counts.
 * The exhausted-choices fallback (handed_over) is never reported unreached. */
export function simLint(tally: ReachTally, graph: CallGraph, scopeLabel: string, tree?: CallTree): LintFinding[] {
  const findings: LintFinding[] = [];
  if (!tally.runs) return findings;
  const runs = plural(tally.runs, 'run');
  const reach = tree ? truthReach(graph, tree) : null;
  for (const vertex of graph.vertices) {
    if (vertex.kind === 'turn' || !vertex.inCall || (reach && !reach.has(vertex.id))) continue;
    if (vertex.kind === 'node') {
      if ((tally.visits[vertex.treeId] ?? 0) > 0) continue;
      findings.push({ id: `never_reached:node:${vertex.treeId}`, code: 'never_reached', severity: 'warn', node: vertex.treeId, sites: [],
        message: `${sentenceCase(vertex.treeId)} can be reached in this call, but none of ${runs} reached it (${scopeLabel}).` });
    } else if (vertex.treeId !== 'handed_over' && !(tally.endings[vertex.treeId]?.n ?? 0)) {
      findings.push({ id: `never_reached:ending:${vertex.treeId}`, code: 'never_reached', severity: 'warn', ending: vertex.treeId, sites: [],
        message: `The ending ${vertex.treeId} can be reached in this call, but none of ${runs} ended there (${scopeLabel}).` });
    }
  }
  for (const [key, entry] of Object.entries(tally.locked)) {
    if (!entry.offered || entry.locked < entry.offered) continue;
    const parts = choiceOf(key, graph);
    const top = Object.entries(entry.reasons).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const where = parts ? `${sentenceCase(parts.choice)} at ${sentenceCase(parts.node)}` : key;
    findings.push({ id: `locked_for_squad:${parts ? `${parts.node}/${parts.choice}` : key}`, code: 'locked_for_squad', severity: 'info', ...(parts ? { node: parts.node } : {}),
      sites: parts ? [{ node: parts.node, choice: parts.choice, field: 'engine' }] : [],
      message: `${where} was offered in ${plural(entry.offered, 'visit')} and locked in every one${top ? `: ${top}` : ''} (${scopeLabel}).` });
  }
  for (const [node, flat] of Object.entries(tally.flatVisits)) {
    const visits = tally.visits[node] ?? 0;
    if (!flat || !visits || flat / visits < FLAT_SHARE) continue;
    findings.push({ id: `flat_odds:node:${node}`, code: 'flat_odds', severity: 'warn', node, sites: [],
      message: `${sentenceCase(node)} offered flat odds in ${flat} of ${plural(visits, 'visit')}: choices within 5 points, or every choice at 90% or more (${scopeLabel}).` });
  }
  if (tally.stuck > 0)
    findings.push({ id: 'stuck_runs:call', code: 'stuck_runs', severity: 'warn', sites: [],
      message: `${tally.stuck} of ${runs} stopped without an ending and count as unresolved (${scopeLabel}).` });
  return findings;
}
