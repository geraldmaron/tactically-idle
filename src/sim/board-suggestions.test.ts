import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { scenarioRecipe } from '../content/scenario-recipes';
import { INCIDENT_CONTENT_VERSION, incidentId } from '../gen/incident';
import { boardShortages, callNeeds, callNeedsOf } from './board-suggestions';
import { createInitialState } from './department';
import { createUnit } from './equipment';
import { getScenario } from './scenario-registry';
import type { IncidentSpec, IncidentType } from './scenario-types';
import type { GameState } from './types';

const NOW = 1_800_000_000_000;
const TYPES = Object.keys(CALL_TREES) as IncidentType[];

/** A department whose officers hold no qualifications and which owns no gear, so every need is short. */
function bare(): GameState {
  const state = createInitialState(NOW, 7);
  for (const o of Object.values(state.officers)) o.certs = [];
  state.units = {};
  return state;
}
const spec = (type: IncidentType, familyId: string, buildingSeed: number, seed: number): IncidentSpec => ({ type, familyId, buildingSeed, seed, tier: 2, contentVersion: INCIDENT_CONTENT_VERSION });

describe('board shortages read nothing hidden', () => {
  it.each(TYPES)('%s: identical across every situation, cast weapon and fact truth on one building', (type) => {
    const tree = CALL_TREES[type]!;
    const state = bare();
    const situations = new Set<number>();
    const hidden = new Set<string>();
    const weapons = new Set<string>();
    const lists = new Set<string>();
    for (let seed = 1; seed <= 90; seed++) {
      const s = spec(type, tree.families[0], 4242, seed);
      const scenario = getScenario(incidentId(s));
      if (!scenario) continue;
      situations.add(scenarioRecipe(s).variant);
      hidden.add(JSON.stringify([scenario.facts.map((f) => f.truth), (scenario.incidentPeople ?? []).map((p) => p.threat ?? null)]));
      weapons.add(JSON.stringify((scenario.incidentPeople ?? []).map((p) => p.threat ?? null)));
      lists.add(JSON.stringify(boardShortages(state, incidentId(s), NOW)));
    }
    // The sample really varied the hidden truth: all three situations and more than one truth pattern.
    expect(situations.size).toBe(3);
    expect(hidden.size).toBeGreaterThan(1);
    // Calls whose tree reads a weapon must have drawn both armed and unarmed casts here.
    if (JSON.stringify(tree).includes('"armed"')) expect(weapons.size).toBeGreaterThan(1);
    expect(lists.size).toBe(1);
    expect(JSON.parse([...lists][0]).length).toBeGreaterThan(0);
  });

  it('is the same on every building: no required need in the v13 trees depends on the building yet', () => {
    // A locked door makes an entry tool save time, never a need, so it is not a shortage. When
    // building-gated choices land (R-B1 upper floors, R-B2 window exits), prune callNeeds by the
    // drawn building and turn this into a test that the building can change the list.
    const type: IncidentType = 'barricaded';
    const state = bare();
    const lists = new Set(CALL_TREES[type]!.families.flatMap((familyId) => [11, 12, 13].map((buildingSeed) => {
      const id = incidentId(spec(type, familyId, buildingSeed, 5));
      return getScenario(id) ? JSON.stringify(boardShortages(state, id, NOW)) : null;
    })).filter((x): x is string => x !== null));
    expect(lists.size).toBe(1);
  });
});

describe('needs come from the whole authored tree', () => {
  it('include a choice no call can reach: behind an armed-group condition, in an unreachable turn node', () => {
    const tree = structuredClone(CALL_TREES.hostage_crisis!);
    const base = tree.nodes[0].choices[0];
    tree.nodes.push({ ...structuredClone(tree.nodes[0]), id: 'zz_unreachable', choices: [{ ...structuredClone(base), id: 'zz_only_if_armed', onlyIf: { armed: { role: Object.keys(tree.groups ?? { taker: 0 })[0] ?? 'taker' } }, requires: { certs: ['drone_operator'] } }] });
    tree.turns = { ...(tree.turns ?? {}), zz_turn: ['zz_unreachable'] };
    expect(callNeedsOf(tree).certs).toContain('drone_operator');
    expect(callNeedsOf(CALL_TREES.hostage_crisis!).certs).not.toContain('drone_operator');
  });
});

describe('what counts as short', () => {
  const callOf = (type: IncidentType) => incidentId(spec(type, CALL_TREES[type]!.families[0], 4242, 3));

  it('lists the call kind’s required qualifications and gear', () => {
    expect(callNeeds('active_armed_incident')).toEqual({ certs: ['entry_team'], gear: [{ itemIds: ['loud_hailer'], label: 'Loud hailer', need: 1 }] });
    expect(callNeeds('protected_rescue').certs).toEqual(['vehicle_operations']);
  });

  it('counts a qualification only for officers who could deploy now', () => {
    const state = bare();
    const id = callOf('barricaded');
    const holder = Object.values(state.officers).find((o) => o.squadId)!;
    holder.certs = ['entry_team'];
    expect(boardShortages(state, id, NOW)).toEqual([]);
    holder.injury = { label: 'Sprained wrist', until: NOW + 3_600_000 };
    expect(boardShortages(state, id, NOW)).toEqual([{ kind: 'cert', id: 'entry_team', have: 0 }]);
    holder.injury = null;
    holder.assignment = { kind: 'training', courseId: 'composure_workshop', startedAt: NOW, endsAt: NOW + 3_600_000 };
    expect(boardShortages(state, id, NOW)).toEqual([{ kind: 'cert', id: 'entry_team', have: 0 }]);
    holder.assignment = null;
    holder.squadId = null;
    expect(boardShortages(state, id, NOW)).toEqual([{ kind: 'cert', id: 'entry_team', have: 0 }]);
  });

  it('shows gear only while fewer units are ready than one squad needs, qualifications first', () => {
    const state = bare();
    const id = callOf('active_armed_incident');
    expect(boardShortages(state, id, NOW).map((x) => x.kind === 'cert' ? x.id : x.label)).toEqual(['entry_team', 'Loud hailer']);
    createUnit(state, 'loud_hailer', NOW, { condition: 100, ageDays: 0 });
    expect(boardShortages(state, id, NOW).map((x) => x.kind === 'cert' ? x.id : x.label)).toEqual(['entry_team']);
  });
});
