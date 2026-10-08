// What each incident template can produce, counted from its data (docs/incident-domain-model.md,
// §12). Setups and signatures come from countTemplate; playthroughs walk the story graph for every
// situation and turn draw, counting each choice, band and hidden-truth branch to an ending.
import type { CallTree, TreeIf, TreeOutcome, TreeState } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { countTemplate } from '../../gen/incident/instance';
import type { TemplateCount } from '../../gen/incident/instance';
import type { OutcomeBand } from '../../sim/types';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

export interface Coverage extends TemplateCount {
  nodes: number;
  choices: number;
  endings: number;
  /** Distinct choice, band and hidden-truth sequences that reach an ending, over every setup. */
  playthroughs: number;
}

/** How long a call can run, for whether a clock can get low or run out in it at all. */
const CALL_HORIZON_MIN = 240;

export function playthroughs(tree: CallTree, situations: IncidentTemplate['situations'] = []): number {
  const nodes = new Map(tree.nodes.map(node => [node.id, node]));
  const groups = Object.entries(tree.turns ?? {});
  const draws = groups.reduce<Record<string, string>[]>((acc, [group, ids]) => acc.flatMap(draw => ids.map(id => ({ ...draw, [group]: id }))), [{}]);
  let total = 0;
  tree.situations.forEach((situation, index) => draws.forEach(draw => {
    const truth = (fact: string) => tree.facts[fact]?.truth ?? situation.truth[fact];
    // A clock branch is a time branch: either side can happen if the situation's clock can get
    // there within a call. Without the clock, it is never low and never out.
    const clocks = situations.find(entry => entry.index === index)?.clocks ?? [];
    const can = (c: Extract<TreeIf, { clock: string }>) => {
      const clock = clocks.find(entry => entry.id === c.clock);
      const want = 'low' in c ? c.low : c.out;
      if (!want) return true;
      const reach = clock ? clock.start - clock.ratePerMin * (1 + (clock.rateSpread ?? 0)) * CALL_HORIZON_MIN : 100;
      return 'low' in c ? reach <= (clock?.cues[0]?.at ?? -1) : reach <= 0;
    };
    const ifHolds = (outcome: TreeOutcome) => ([] as TreeIf[]).concat(outcome.if ?? []).every(c => 'fact' in c ? truth(c.fact) === c.is : 'meter' in c ? true : can(c));
    const stateHolds = (w: TreeState | undefined, marks: Set<string>, safe: Set<string>) => !w || ((w.marks ?? []).every(m => marks.has(m)) && (w.notMarks ?? []).every(m => !marks.has(m))
      && (w.safe ?? []).every(r => safe.has(r)) && (w.notSafe ?? []).every(r => !safe.has(r)));
    const walk = (id: string, marks: Set<string>, safe: Set<string>, depth: number) => {
      const node = nodes.get(id);
      if (!node || depth > 12) return;
      for (const choice of node.choices) {
        if (!stateHolds(choice.onlyIf, marks, safe)) continue;
        for (const band of BANDS) {
          const outs = choice.outcomes[band].filter(outcome => ifHolds(outcome) && stateHolds(outcome.when, marks, safe));
          const nextMarks = new Set(marks), nextSafe = new Set(safe);
          // Routed outcomes that hold together are one path; clock branches that both hold are two.
          const routed = outs.filter(outcome => outcome.next);
          const timeBranches = routed.filter(outcome => ([] as TreeIf[]).concat(outcome.if ?? []).some(c => 'clock' in c));
          const paths = timeBranches.length > 1 ? timeBranches : routed.slice(0, 1);
          for (const outcome of outs.filter(outcome => !outcome.next)) { (outcome.mark ?? []).forEach(m => nextMarks.add(m)); (outcome.safe ?? []).forEach(r => nextSafe.add(r)); }
          for (const path of paths) {
            const marks2 = new Set([...nextMarks, ...path.mark ?? []]), safe2 = new Set([...nextSafe, ...path.safe ?? []]);
            const route = path.next!;
            if ('ending' in route) total++;
            else walk('node' in route ? route.node : draw[route.turn], marks2, safe2, depth + 1);
          }
        }
      }
    };
    walk(tree.root, new Set(), new Set(), 0);
  }));
  return total;
}

const cache = new Map<string, Coverage>();
export function coverageOf(template: IncidentTemplate): Coverage {
  const hit = cache.get(template.type);
  if (hit) return hit;
  const tree = template.tree;
  const result: Coverage = { ...countTemplate(template), nodes: tree.nodes.length, choices: tree.nodes.reduce((sum, node) => sum + node.choices.length, 0),
    endings: Object.keys(tree.endings).length, playthroughs: playthroughs(tree, template.situations) };
  cache.set(template.type, result);
  return result;
}
