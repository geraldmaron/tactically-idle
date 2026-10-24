// Every call forces conflict (owner 2026-10-20). A decision point always has something getting worse
// while the player decides, a stage always offers different kinds of act, and an adverse result always
// costs something. These gates fail a tree that drifts back to free holds and interchangeable options.
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import type { CallTree, TreeOutcome } from '../../../content/call-trees/types';

/** The trees written before the redesign, exempt by name until their model-first rewrites land
 * (docs/backlog.md armed-model-first, rescue-model-first). Nothing else is: the barricaded kind is the warrant
 * call now (The Room Next Door), written model-first, and holds to every gate below. */
const LEGACY = new Set(['active_armed_incident', 'protected_rescue']);

const trees = Object.values(CALL_TREES).filter((tree): tree is CallTree => !!tree && !LEGACY.has(tree.type));

/** Words that make a threat line a threat to life. A threat raises costs and urgency; harm to a
 * person and a weapon used belong to routed outcomes and threat marks (E12.4). */
const TO_LIFE = /\b(?:aim(?:s|ed|ing)?|point(?:s|ed|ing)?|fir(?:e|es|ed|ing)|shoot(?:s|ing)?|shot|kill(?:s|ed|ing)?|die(?:s|d)?|dead|trigger|level(?:s|ed|led)?|wound(?:s|ed)?|bleed(?:s|ing)?|hostage)\b/i;

/** An outcome that costs something or ends the call. A route to the next node alone is not a cost:
 * an adverse result that only moves the call on is a favorable result read slower. */
const costs = (outcome: TreeOutcome) => !!(outcome.mark?.length || outcome.moves || (outcome.pressure ?? 0) > 0 || (outcome.civilian ?? 0) < 0
  || outcome.harm || outcome.force || outcome.fire || outcome.officer || outcome.breaks?.length || (outcome.minutes ?? 0) > 0
  || (outcome.next && 'ending' in outcome.next));

describe('every call forces conflict', () => {
  it('exempts only the legacy trees', () => {
    expect(Object.values(CALL_TREES).filter(tree => tree && LEGACY.has(tree.type)).length).toBeLessThanOrEqual(2);
    expect(trees.length).toBeGreaterThan(0);
  });

  for (const tree of trees) describe(tree.type, () => {
    it('gives every decision point a threat', () => {
      expect(tree.nodes.filter(node => !node.threat).map(node => node.id)).toEqual([]);
    });

    it('offers at least three kinds of act on every stage', () => {
      const kinds = new Map<string, Set<string>>();
      for (const node of tree.nodes) for (const choice of node.choices) (kinds.get(node.stage) ?? kinds.set(node.stage, new Set()).get(node.stage)!).add(choice.check.kind);
      const thin = [...kinds].filter(([, set]) => set.size < 3).map(([stage, set]) => `${stage}: ${[...set].join(', ')}`);
      expect(thin).toEqual([]);
    });

    it('offers a certificate on every stage', () => {
      const stages = new Set(tree.nodes.map(node => node.stage));
      const with_ = new Set(tree.nodes.filter(node => node.choices.some(choice => choice.certBonus)).map(node => node.stage));
      expect([...stages].filter(stage => !with_.has(stage))).toEqual([]);
    });

    it('keeps every threat short of a threat to life', () => {
      const bad = tree.nodes.flatMap(node => node.threat && (TO_LIFE.test(node.threat.text) || TO_LIFE.test(node.threat.label)) ? [`${node.id}: ${node.threat.label}`] : []);
      expect(bad).toEqual([]);
      for (const node of tree.nodes) if (node.threat) expect(node.threat.minutes, node.id).toBeGreaterThan(0);
    });

    it('makes every adverse band change something', () => {
      const free = tree.nodes.flatMap(node => node.choices.filter(choice => !choice.outcomes.adverse.some(costs)).map(choice => `${node.id}.${choice.id}`));
      expect(free).toEqual([]);
    });
  });
});
