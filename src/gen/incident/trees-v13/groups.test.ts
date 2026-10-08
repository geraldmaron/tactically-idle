// Groups (docs/incident-domain-model.md, M2 slice 5): a counted role whose size is fixed per call.
// The fixture call (group-fixture.ts) is compiled on a real building with 0 to 3 others beside the
// taker, and every count is held to the same rules as a key role: placed, story-bound, read by the
// engine, its text bound for whoever is drawn, and a surrender that cascades through the saves.
import { describe, expect, it } from 'vitest';
import { GROUP_TEMPLATE, GROUP_TREE } from './group-fixture';
import { generateIncident } from '../index';
import { aggregates, compileIncident, drawInstance, hostedSpec } from '../instance';
import type { IncidentInstance } from '../instance';
import { choiceActionId, memberCounts, textBinder } from './compile';
import { callStringRows } from './strings';
import { buildLocation } from '../../../sim/location';
import { validateScenario } from '../../../sim/operation';
import { cascadeResult, drawnKeys } from '../../../sim/drawn-effects';
import type { CascadeState } from '../../../sim/drawn-effects';
import { applyNaturalMove, startGateRun, withDraftScenario } from '../gates/engine-driver';
import { deserialize, serialize } from '../../../sim/save';
import { validExternalSupportState } from '../../../sim/external-support';
import { getScenario } from '../../../sim/scenario-registry';
import { NOW } from '../../../sim/test-fixtures';
import type { ActionDefinition, IncidentSpec, OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, GameState } from '../../../sim/types';

const COUNTS = [0, 1, 2, 3] as const;
const action = (s: ScenarioDefinition, node: string, choice: string): ActionDefinition | undefined =>
  Object.values(s.stages).flatMap(stage => stage.actions).find(entry => entry.id === choiceActionId('hostage_crisis', node, choice));
const unbound = (s: ScenarioDefinition) => JSON.stringify(s).match(/\{(?!lead\})[a-z0-9_.]+\}/g);

interface GroupCall { s: ScenarioDefinition; built: BuiltLocation; instance: IncidentInstance; spec: IncidentSpec }
/** The fixture with `members` others: the first call seed from `from` whose count draw gives that
 * many and whose building hosts them, compiled over a hosted hostage call for its frame. */
function groupCall(members: number, from = 1, family = 'market_row'): GroupCall {
  for (let seed = from; seed < from + 600; seed++) {
    // The hostage call's frame, without the people, clocks and threats its own template compiled.
    const { clocks: _clocks, incidentPeople: _people, threats: _threats, ...base } = generateIncident({ type: 'hostage_crisis', familyId: family, buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      const instance = drawInstance(GROUP_TEMPLATE, built, spec);
      if ((memberCounts(instance.placed).others ?? 0) !== members) continue;
      return { s: compileIncident({ ...base, id: `group-fixture-${members}-${seed}`, incident: spec }, built, GROUP_TEMPLATE), built, instance, spec };
    } catch { continue; }
  }
  throw new Error(`No seed from ${from} draws ${members} others`);
}
const CALLS = new Map<number, GroupCall>(COUNTS.map(n => [n, groupCall(n)]));

describe('groups: every member is a full engine person', () => {
  for (const n of COUNTS) it(`places, binds and validates ${n} other${n === 1 ? '' : 's'}`, () => {
    const { s, built, instance } = CALLS.get(n)!;
    expect(validateScenario(s, built)).toEqual([]);
    expect(unbound(s), 'unbound token').toBeNull();
    const members = instance.people.filter(person => person.countedRole === 'others');
    expect(members.map(person => person.id)).toEqual(Array.from({ length: n }, (_, i) => `others_${i + 1}`));
    for (const person of members) {
      const binding = s.story!.bindings.people[person.id];
      expect(binding, person.id).toBeDefined();
      expect(person.position.kind).toBe('inside');
      if (person.position.kind !== 'inside') continue;
      // Beside their leader, where the story puts them, with a location fact and a way out.
      expect(person.position.spaceId).toBe(s.story!.bindings.people.taker.initial.spaceId);
      expect(binding.initial).toEqual({ spaceId: person.position.spaceId, at: person.position.at });
      expect(binding.transitions[0].when.flags).toEqual([`out:${person.id}`]);
      const fact = s.facts.find(entry => entry.id === `p_${person.id}`)!;
      expect(fact.storyPersonId).toBe(person.id);
      expect(fact.markers).toEqual({ reported: 'SUBJECT', confirmed: 'SUBJECT' });
      expect(s.story!.cast![person.id].firstName).toBe(person.name!.first);
      const engine = s.incidentPeople!.find(entry => entry.id === person.id)!;
      expect(engine.kind).toBe('subject');
      expect(engine.threat?.armament).toBe('handgun');
      expect(engine.meters).toEqual({ agitation: 60, rapport: 10 });
      expect(['follower', 'lookout']).toContain(engine.group!.role);
      expect(engine.group!.id).toBe('subjects');
    }
    // Numbered nearest the door first, so {others.first} is the one nearest the team.
    const feet = members.map(person => s.incidentPeople!.find(entry => entry.id === person.id)!.doorFt!);
    expect([...feet].sort((a, b) => a - b)).toEqual(feet);
    expect(s.incidentPeople!.find(entry => entry.id === 'taker')!.group).toEqual({ id: 'subjects', role: n ? 'leader' : 'lone', influence: 1 });
    expect(s.incidentPeople!.find(entry => entry.id === 'courier')!.hold).toEqual({ by: 'taker', kind: 'incidental' });
    expect(aggregates(instance).subjects).toBe(n + 1);
    expect(aggregates(instance).leader).toBe('taker');
  });

  it('draws influence within the slot, and lets a situation hold the group loosely', () => {
    const loose = [...COUNTS].slice(1).flatMap(n => {
      for (let from = 1; from < 4000; from += 37) {
        const call = groupCall(n, from);
        if (call.instance.situation === 2) return call.instance.people.filter(person => person.countedRole);
      }
      return [];
    });
    expect(loose.length).toBeGreaterThan(0);
    for (const person of loose) expect(person.group!.influence).toBeLessThanOrEqual(0.15);
    for (const n of COUNTS) for (const person of CALLS.get(n)!.instance.people.filter(entry => entry.countedRole && CALLS.get(n)!.instance.situation !== 2))
      expect(person.group!.influence).toBeGreaterThanOrEqual(0.4);
  }, 120000);

  it('draws each member’s own weapon, or none, where the slot gives a choice', () => {
    const handgun = { kind: 'handgun', real: 'real', where: 'in_hand', visible: true } as const;
    const subjects = GROUP_TEMPLATE.cast[0];
    const mixed = { ...GROUP_TEMPLATE, cast: [{ ...subjects, person: { ...subjects.person, weapons: { pick: [[[handgun], 50], [[], 50]] } } }, GROUP_TEMPLATE.cast[1]],
      situations: GROUP_TEMPLATE.situations.map(situation => ({ ...situation, people: { ...situation.people, taker: { weapons: [handgun] } } })) } as typeof GROUP_TEMPLATE;
    const armament = new Set<string>();
    for (const n of [2, 3]) {
      const { built, spec } = CALLS.get(n)!;
      for (let seed = spec.seed; seed < spec.seed + 40; seed++) {
        let instance: IncidentInstance;
        try { instance = drawInstance(mixed, built, { ...spec, seed }); } catch { continue; }
        expect(instance.people.find(person => person.id === 'taker')!.threat!.armament).toBe('handgun');
        for (const person of instance.people.filter(entry => entry.countedRole)) {
          expect(person.threat!.armament).toBe(person.weapons.length ? 'handgun' : 'none');
          armament.add(person.threat!.armament);
        }
      }
    }
    expect([...armament].sort()).toEqual(['handgun', 'none']);
  });

  it('regenerates identically from the same seed', () => {
    const { s, spec } = CALLS.get(2)!;
    const again = groupCall(2, spec.seed);
    expect(again.s).toEqual(s);
    expect(JSON.stringify(drawInstance(GROUP_TEMPLATE, again.built, again.spec))).toBe(JSON.stringify(CALLS.get(2)!.instance));
  });
});

describe('groups: count conditions settle per call', () => {
  const prompts = (s: ScenarioDefinition) => s.stages.assess.contextPrompts!.map(entry => entry.prompt);

  it('leaves a lone call with no group text, choice, node or ending', () => {
    const { s } = CALLS.get(0)!;
    expect(JSON.stringify(s)).not.toContain('others');
    expect(action(s, 'talk', 'talk_others')).toBeUndefined();
    expect(action(s, 'last', 'call_back')).toBeUndefined();
    expect(s.endings.some_left).toBeUndefined();
    expect(prompts(s)).toHaveLength(1);
    // The surrender has nobody to cascade to: it routes straight to its `all` result.
    const out = action(s, 'talk', 'ask_out')!.outcomes.favorable;
    expect(out.some(effect => effect.drawn)).toBe(false);
    expect(out.some(effect => effect.ending === 'all_out')).toBe(true);
  });

  it('keeps each line where its count holds', () => {
    for (const n of [1, 2, 3]) {
      const { s } = CALLS.get(n)!;
      expect(action(s, 'talk', 'talk_others')?.talksTo).toBe('others_1');
      expect(action(s, 'last', 'call_back')).toBeDefined();
      expect(s.endings.some_left).toBeDefined();
      expect(prompts(s)).toHaveLength(2);
      const listens = action(s, 'open', 'call')!.outcomes.favorable.flatMap(effect => effect.moves ?? []);
      expect(listens.filter(move => move.personId.startsWith('others_')).map(move => move.personId).sort()).toEqual(Array.from({ length: n }, (_, i) => `others_${i + 1}`));
      // A shot from the group comes from the one nearest the door.
      expect(action(s, 'talk', 'hold')!.outcomes.adverse.find(effect => effect.drawn)?.drawn).toEqual({ model: 'incoming_fire', from: 'others_1' });
    }
    const one = CALLS.get(1)!, two = CALLS.get(2)!;
    const name = (call: GroupCall, id: string) => call.s.story!.cast![id].firstName;
    // A name agrees by number whoever it is; a pronoun by who was drawn.
    const pronoun = one.instance.people.find(person => person.id === 'others_1')!.pronouns;
    expect(prompts(one.s)[0]).toContain(`${name(one, 'others_1')} stands by the till, and ${pronoun} ${pronoun === 'they' ? 'keep' : 'keeps'} looking`);
    expect(prompts(two.s)[0]).toContain(`${name(two, 'others_1')} and ${name(two, 'others_2')} stand by the till.`);
  });
});

describe('groups: text binds at every count with every pronoun', () => {
  for (const n of COUNTS) it(`binds every string with ${n} other${n === 1 ? '' : 's'}`, () => {
    const { built, instance } = CALLS.get(n)!;
    const ids = Object.keys(instance.placed.cast);
    for (const who of ids) for (const pronouns of ['he', 'she', 'they'] as const) {
      const cast = Object.fromEntries(ids.map(id => [id, { ...instance.placed.cast[id], pronouns: id === who ? pronouns : 'he' as const }]));
      const rows = callStringRows(GROUP_TREE, textBinder(GROUP_TREE, built, { ...instance.placed, cast }), { others: n });
      for (const row of rows) expect(row.text.replace('{lead}', ''), `${row.where} with ${who} as ${pronouns}`).not.toMatch(/[{}]/);
      const last = rows.find(row => row.where === 'last.prompt');
      if (!n) { expect(last).toBeUndefined(); continue; }
      // After the names by how many; after the pronoun by who was drawn.
      expect(last!.text).toMatch(n === 1 ? / is still behind / : / are still behind /);
      const singular = n === 1 && (who !== 'others_1' || pronouns !== 'they');
      expect(last!.text).toMatch(singular ? /\. (He|She) has the / : /\. They have the /);
    }
  });
});

describe('groups: a surrender cascades', () => {
  const states = (key: string) => key.split('+') as CascadeState[];

  it('compiles a variant for every combination, each routed and each naming who followed', () => {
    for (const n of [1, 2, 3]) {
      const { s } = CALLS.get(n)!;
      const effect = action(s, 'talk', 'ask_out')!.outcomes.favorable.find(entry => entry.drawn)!;
      expect(effect.drawn).toEqual({ model: 'cascade', on: 'taker', members: Array.from({ length: n }, (_, i) => `others_${i + 1}`) });
      const keys = drawnKeys(effect, s);
      expect(keys).toHaveLength(3 ** n);
      for (const key of keys) {
        const [variant] = effect.variants![key] as OutcomeEffect[];
        const result = cascadeResult(states(key));
        expect(variant.ending ?? variant.stage, key).toBe(result === 'all' ? 'all_out' : 'resolve');
        const followers = states(key).flatMap((state, i) => state === 'follows' ? [`out:others_${i + 1}`] : []);
        expect(variant.setFlags!.filter(flag => flag.startsWith('out:')), key).toEqual(followers);
        for (const [i, state] of states(key).entries()) {
          const first = s.story!.cast![`others_${i + 1}`].firstName;
          if (state === 'out') expect(variant.text ?? '', key).not.toContain(first);
          else expect(variant.text, key).toContain(first);
        }
      }
    }
  });

  it('plays through the engine, and every save after it loads', () => {
    // A draft's id is not a board incident's, so the board entry is left out of the round trip;
    // the run itself, its drawn records and the saved-sample replay are all checked.
    const loads = (state: GameState) => {
      const copy = structuredClone(state);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      return validExternalSupportState(state.activeRun!, getScenario(state.activeRun!.scenarioId)!) && deserialize(serialize(copy, NOW)) !== null;
    };
    const results = new Set<string>();
    let cascades = 0;
    for (const n of [2, 3]) {
      const { s } = CALLS.get(n)!;
      withDraftScenario(s, id => {
        for (let seed = 1; seed <= 60; seed++) {
          let state: GameState | null = startGateRun(id, seed);
          state = applyNaturalMove(state, { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'open', 'call') });
          state = state && applyNaturalMove(state, { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'talk', 'ask_out') });
          if (!state?.activeRun) continue;
          const decision = state.activeRun.history[state.activeRun.history.length - 1];
          const record = decision.committed?.drawn?.find(entry => entry.model === 'cascade');
          expect(loads(state), `save after ${id} seed ${seed}`).toBe(true);
          if (!record) continue;
          cascades++;
          const result = cascadeResult(states(record.key));
          results.add(`${n}:${result}`);
          expect(record.personId).toBe('taker');
          const run = state.activeRun;
          for (const [i, state_] of states(record.key).entries()) expect(run.flags.includes(`out:others_${i + 1}`), record.key).toBe(state_ === 'follows');
          expect(result === 'all' ? run.endingId === 'all_out' || run.flags.includes('end:all_out') : run.flags.includes('at:last'), record.key).toBe(true);
          // The rest of the call still saves and loads.
          const after = result === 'all' ? null : applyNaturalMove(state, { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'last', 'call_back') });
          if (after) expect(loads(after)).toBe(true);
        }
      });
    }
    expect(cascades).toBeGreaterThan(10);
    expect([...results].some(key => key.endsWith(':all'))).toBe(true);
    expect([...results].some(key => !key.endsWith(':all'))).toBe(true);
  }, 300000);
});
