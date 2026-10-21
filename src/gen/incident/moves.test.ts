// R-B3: people move on the building, and the team can enter or watch a place on someone's way out.
// A move compiles into the person's story transitions: hidden until the team sees them there (an
// observed twin keyed on a seen flag), or seen at once when the line says where they went. Truth and
// belief are read apart: sightings and incoming fire read where they are; the odds and the force
// rules read where the team believes they are. Exercised on the engine's house call (a frozen
// barricade, trees-v13/house-fixture.ts).
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeMoveTo } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { readForceThreat } from '../../sim/authorization';
import { cueMoveKey, lostFlag, movedFlag, seenFlag, withFlag } from '../../sim/conditions';
import { buildLocation } from '../../sim/location';
import { traceRun } from '../../sim/operation';
import { movedPersonAt, scenarioWithPeopleNow } from '../../sim/resolution';
import { deserialize, serialize } from '../../sim/save';
import { validExternalSupportState } from '../../sim/external-support';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { getScenario } from '../../sim/scenario-registry';
import { sightings } from '../../sim/sightings';
import { observingAction, sightingFlags, storyPeopleActual, storyPeoplePublic, storyPublicScenario } from '../../sim/story-people';
import { LAST_SEEN_LINES } from '../../content/incidents/lines';
import { spaceLabel } from '../../sim/spatial-factors';
import { NOW } from '../../sim/test-fixtures';
import { actionViews, spaceViews } from '../../sim/operation-selectors';
import type { GameState } from '../../sim/types';
import { applyMove, applyNaturalMove, startGateRun, withDraftScenario } from './gates/engine-driver';
import { generateIncident } from './index';
import { compileIncident, hostedSpec } from './instance';
import { choiceActionId } from './trees-v13/compile';
import { HOUSE_TEMPLATE } from './trees-v13/house-fixture';

// The engine's frozen house call (trees-v13/house-fixture.ts), not the shipping barricade.
const BARRICADE = HOUSE_TEMPLATE;
const HALL = { route: 'child', step: 1, is: 'hall' } as const;

/** The barricade with every band of its opening phone call moving the subject (to the hall on the
 * child's way out, hidden unless `seen`), and optional extra edits. */
function variant(opts: { move?: TreeMoveTo; edit?: (tree: CallTree) => void } = {}): IncidentTemplate {
  const tree: CallTree = structuredClone(BARRICADE.tree);
  const call = tree.nodes.find(node => node.id === tree.root)!.choices[0];
  for (const band of ['favorable', 'mixed', 'adverse'] as const) for (const outcome of call.outcomes[band]) if (outcome.next) outcome.moveTo = opts.move ?? { subject: HALL };
  opts.edit?.(tree);
  return { ...BARRICADE, tree };
}

/** `template` compiled on `family` at the first hosting seed from `from`, or null (`rethrow`: the error). */
function call(template: IncidentTemplate, family: string, from = 1, rethrow = false): { s: ScenarioDefinition; built: ReturnType<typeof buildLocation>; seed: number } | null {
  for (let seed = from; seed < from + 30; seed++) {
    let base;
    try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: 1, seed, tier: 2, contentVersion: 13 }, HOUSE_TEMPLATE); } catch { continue; }
    const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
    const spec = hostedSpec(frame), built = buildLocation(frame.locationFamilyId, frame.locationSeed);
    try { return { s: compileIncident({ ...frame, id: `moves-${family}-${seed}`, incident: spec }, built, template), built, seed }; } catch (error) { if (rethrow) throw error; continue; }
  }
  return null;
}

const found = call(variant(), 'bungalow_g2')!;
const run = (flags: string[]) => ({ flags, knowledge: { [found.s.incidentPeople!.find(person => person.id === 'subject')!.locationFactId!]: 'confirmed' as const }, pressure: 0 });
const subject = () => found.s.incidentPeople!.find(person => person.id === 'subject')!;
const hall = () => found.s.story!.bindings.people.subject.transitions[0].to as { spaceId: string; at: { x: number; y: number } };

describe('a move compiles into the person’s story (R-B3)', () => {
  it('hidden by default: a hidden transition and its observed twin, before leaving the building', () => {
    expect(found, 'a bungalow hosts the moving call').not.toBeNull();
    const transitions = found.s.story!.bindings.people.subject.transitions;
    expect(transitions[0]).toMatchObject({ when: { flags: [movedFlag('subject', 1)] }, observed: false });
    expect(transitions[1]).toMatchObject({ when: { flags: [seenFlag('subject', 1)] }, observed: true, to: transitions[0].to });
    expect(transitions.at(-1)!.when.flags).toEqual(['out:subject']);
    expect(found.built.location.rooms.find(room => room.id === hall().spaceId)!.type).toBe('hall');
    const opening = Object.values(found.s.stages).flatMap(stage => stage.actions).find(action => action.id === choiceActionId('barricaded', 'window', 'call_him'))!;
    expect(opening.outcomes.favorable.some(effect => effect.setFlags?.includes(movedFlag('subject', 1)))).toBe(true);
  });

  it('seen: the same pair, and the outcome sets the seen flag with the move', () => {
    const seen = call(variant({ move: { subject: { to: HALL, seen: true } } }), 'bungalow_g2')!;
    const transitions = seen.s.story!.bindings.people.subject.transitions;
    // One move per outcome that moves them (the opening call's three bands).
    expect(transitions.slice(0, -1).map(entry => entry.when.flags)).toEqual([1, 2, 3].flatMap(n => [[movedFlag('subject', n)], [seenFlag('subject', n)]]));
    expect(transitions.at(-1)!.when.flags).toEqual(['out:subject']);
    const opening = Object.values(seen.s.stages).flatMap(stage => stage.actions).find(action => action.id === choiceActionId('barricaded', 'window', 'call_him'))!;
    expect(opening.outcomes.favorable.some(effect => effect.setFlags?.includes(movedFlag('subject', 1)) && effect.setFlags.includes(seenFlag('subject', 1)))).toBe(true);
  });
});

describe('truth and belief after a hidden move', () => {
  const moved = run([movedFlag('subject', 1)]);

  it('truth is the hall; nothing public changes until the team looks, so an unseen move tells the player nothing', () => {
    expect(storyPeopleActual(found.s, moved).find(person => person.id === 'subject')!.position).toEqual(hall());
    expect(storyPeoplePublic(found.s, found.built, moved)).toEqual(storyPeoplePublic(found.s, found.built, run([])));
    expect(storyPublicScenario(found.s, found.built, moved, LAST_SEEN_LINES)).toEqual(storyPublicScenario(found.s, found.built, run([]), LAST_SEEN_LINES));
  });

  it('a look into the room the team last saw them in, now empty, shows it as where they were last seen, with no reporter credited', () => {
    const look = { ...Object.values(found.s.stages).flatMap(stage => stage.actions)[0], observes: [subject().spaceId] };
    const empty = sightings(found.s, moved, look, 'favorable', []);
    expect(empty?.setFlags).toEqual([lostFlag('subject')]);
    const lost = run([movedFlag('subject', 1), lostFlag('subject')]);
    const believed = storyPeoplePublic(found.s, found.built, lost).find(person => person.id === 'subject')!;
    expect(believed).toMatchObject({ status: 'reported', stale: true, position: found.s.story!.bindings.people.subject.initial });
    const fact = storyPublicScenario(found.s, found.built, lost, LAST_SEEN_LINES).scenario.facts.find(entry => entry.id === subject().locationFactId)!;
    expect(fact.markerSource).toBeUndefined();
    expect(fact.source).toBe(LAST_SEEN_LINES.source);
    // Bound as the calls lane's lines say: the first name, and the room as prose ("the kitchen").
    const room = spaceLabel(found.built, found.s.story!.bindings.people.subject.initial.spaceId);
    expect(fact.claim).toBe(`${subject().label} was last seen in the ${room.toLowerCase()}.`);
    expect(fact.claim).not.toContain(`in ${room}.`);
    expect(subject().label).not.toContain(' ');
    // The map marker and the room's fact panel show the same bound words.
    const views = withDraftScenario(found.s, id => {
      const state = startGateRun(id);
      state.activeRun!.flags = [...state.activeRun!.flags, ...lost.flags];
      state.activeRun!.knowledge = { ...state.activeRun!.knowledge, ...lost.knowledge };
      return spaceViews(state);
    });
    const space = views.find(view => view.id === found.s.story!.bindings.people.subject.initial.spaceId)!;
    expect(space.marker).toMatchObject({ text: LAST_SEEN_LINES.marker });
    expect(space.marker?.subtext).toBeUndefined();
    expect(space.facts.find(view => view.id === subject().locationFactId)).toMatchObject({ claim: fact.claim, source: LAST_SEEN_LINES.source, status: 'reported' });
    // Seeing them anywhere settles it.
    expect(withFlag(lost.flags, seenFlag('subject', 1))).not.toContain(lostFlag('subject'));
  });

  it('a look into the hall settles it: the sighting sets the twin’s seen flag, and the team then knows the new spot', () => {
    const look = { ...Object.values(found.s.stages).flatMap(stage => stage.actions)[0], observes: [hall().spaceId] };
    const seen = sightings(found.s, moved, look, 'favorable', []);
    expect(seen?.setFlags).toEqual([seenFlag('subject', 1)]);
    const after = run([movedFlag('subject', 1), seenFlag('subject', 1)]);
    expect(storyPeoplePublic(found.s, found.built, after).find(person => person.id === 'subject')).toMatchObject({ status: 'confirmed', position: hall() });
    // A look into the room they left finds it empty: the trail is lost, nobody is seen there.
    expect(sightings(found.s, moved, { ...look, observes: [subject().spaceId] }, 'favorable', [])?.setFlags ?? []).toEqual([lostFlag('subject')]);
  });

  it('the odds and force read belief, fire reads truth: cover and the door distance follow each', () => {
    expect(movedPersonAt(found.s, found.built, run([]), subject(), 'truth')).toBeNull();
    const truth = movedPersonAt(found.s, found.built, moved, subject(), 'truth')!;
    expect(truth.spaceId).toBe(hall().spaceId);
    expect(truth.doorFt).not.toBe(subject().doorFt);
    expect(movedPersonAt(found.s, found.built, moved, subject(), 'belief')).toBeNull();
    const fire = scenarioWithPeopleNow(found.s, found.built, moved, 'truth').incidentPeople!.find(person => person.id === 'subject')!;
    expect(fire.doorFt).toBe(truth.doorFt);
    const believed = scenarioWithPeopleNow(found.s, found.built, moved, 'belief');
    expect(believed).toBe(found.s);
    const known = scenarioWithPeopleNow(found.s, found.built, run([movedFlag('subject', 1), seenFlag('subject', 1)]), 'belief').incidentPeople!.find(person => person.id === 'subject')!;
    expect(known.spaceId).toBe(hall().spaceId);
    expect(readForceThreat(found.s, run([]), known).rule).toBeDefined();
  });
});

describe('an unseen move changes nothing belief reads', () => {
  // The review's reproduction: bungalow_g2, building and call seed 12, the subject only on report;
  // a hidden move must leave cover, the door distance and every belief-read difficulty as they were.
  it('the same odds and force reads with and without the unseen move flag, on every hosting seed tried', () => {
    for (let seed = 1; seed <= 14; seed++) {
      let base;
      try { base = generateIncident({ type: 'barricaded', familyId: 'bungalow_g2', buildingSeed: seed, seed, tier: 2, contentVersion: 13 }, HOUSE_TEMPLATE); } catch { continue; }
      const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
      const built = buildLocation(frame.locationFamilyId, frame.locationSeed);
      let s: ScenarioDefinition;
      try { s = compileIncident({ ...frame, id: `unseen-${seed}`, incident: hostedSpec(frame) }, built, variant()); } catch { continue; }
      const person = s.incidentPeople!.find(entry => entry.id === 'subject')!;
      for (const status of ['reported', 'confirmed'] as const) {
        const before = { flags: [] as string[], knowledge: { [person.locationFactId!]: status }, pressure: 0 };
        const after = { ...before, flags: [movedFlag('subject', 1)] };
        expect(scenarioWithPeopleNow(s, built, after, 'belief'), `seed ${seed} ${status}`).toBe(s);
        expect(movedPersonAt(s, built, after, person, 'belief'), `seed ${seed} ${status}`).toBeNull();
        expect(readForceThreat(scenarioWithPeopleNow(s, built, after, 'belief'), after, person)).toEqual(readForceThreat(s, before, person));
        expect(storyPublicScenario(s, built, after, LAST_SEEN_LINES)).toEqual(storyPublicScenario(s, built, before, LAST_SEEN_LINES));
      }
    }
  });
});

describe('an unseen move leaves every offered choice’s odds as they were', () => {
  it('actionViews with and without only the unseen move flag', () => {
    withDraftScenario(found.s, id => {
      const state = startGateRun(id);
      const views = (s: GameState) => actionViews(s, NOW, 'A').map(view => [view.id, view.eligible, view.reason, view.likelihood]);
      const moved = structuredClone(state);
      moved.activeRun!.flags = [...moved.activeRun!.flags, movedFlag('subject', 1)];
      expect(views(moved)).toEqual(views(state));
    });
  });
});

describe('the team can enter or watch a place on someone’s way out', () => {
  it('enters the hall and watches it from outside', () => {
    const t = variant({ edit: tree => {
      const node = tree.nodes.find(entry => entry.id === tree.root)!;
      node.choices[1].team = { to: HALL };
      node.choices[2].team = { to: { watch: HALL }, signal: { channel: 'visual', to: 'subject' } };
    } });
    const s = call(t, 'bungalow_g2')!.s;
    const actions = s.stages.assess.actions;
    const hallId = s.story!.bindings.people.subject.transitions[0].to as { spaceId: string };
    const enter = actions.find(action => action.id === choiceActionId('barricaded', 'window', t.tree.nodes[0].choices[1].id))!;
    expect(enter).toMatchObject({ approach: 'path', targetId: hallId.spaceId, observes: [hallId.spaceId] });
    const watch = actions.find(action => action.id === choiceActionId('barricaded', 'window', t.tree.nodes[0].choices[2].id))!;
    expect(watch.approach).toBe('window');
  });
});

describe('a route step names what it must be, and a building where it isn’t can’t host the call', () => {
  it('rejects a step whose room is another kind', () => {
    expect(() => call(variant({ move: { subject: { route: 'child', step: 1, is: 'kitchen' } } }), 'bungalow_g2', 1, true)).toThrow(/can't host the call/);
  });

  it('every family the barricade lists can still host it, and the rejection rate is reported', () => {
    const rates: string[] = [];
    for (const family of BARRICADE.tree.families) {
      let hosted = 0, tried = 0;
      for (let seed = 1; seed <= 12; seed++) {
        let base;
        try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: seed, seed, tier: 2, contentVersion: 13 }, HOUSE_TEMPLATE); } catch { continue; }
        const { clocks: _c, incidentPeople: _p, threats: _t, ...frame } = base;
        tried++;
        try { compileIncident({ ...frame, id: `host-${family}-${seed}`, incident: hostedSpec(frame) }, buildLocation(frame.locationFamilyId, frame.locationSeed), variant()); hosted++; } catch { /* rejected */ }
      }
      rates.push(`${family} ${hosted}/${tried}`);
      expect(hosted, `${family} hosts the call on at least one building`).toBeGreaterThan(0);
      expect(hosted * 2, `${family}: most buildings rejected (${hosted}/${tried})`).toBeGreaterThanOrEqual(tried);
    }
    expect(rates.length).toBe(BARRICADE.tree.families.length);
  }, 120000);
});

const CLOCK = { id: 'boxes', label: 'The boxes', kind: 'deadline' as const, start: 60, ratePerMin: 1, rateKnown: false,
  cues: [{ at: 45, text: 'A box goes down by the back bedroom.', mark: 'in_hall', moveTo: { subject: 'scene' as const } }] };
const withCue = (template: IncidentTemplate): IncidentTemplate => ({ ...template, situations: BARRICADE.situations.map(situation => ({ ...situation, clocks: [CLOCK] })) });

describe('a clock cue can move someone', () => {
  it('compiles the cue’s move into the same pair, and the compiled cue sets its move flag', () => {
    const { s } = call(withCue(variant({ move: {} })), 'bungalow_g2', 1, true)!;
    const key = cueMoveKey('boxes', 0);
    const transitions = s.story!.bindings.people.subject.transitions;
    expect(transitions[0]).toMatchObject({ when: { flags: [movedFlag('subject', key)] }, observed: false });
    expect(transitions[1]).toMatchObject({ when: { flags: [seenFlag('subject', key)] }, observed: true });
    expect(s.clocks![0].cues[0]).toMatchObject({ mark: 'in_hall', setFlags: [movedFlag('subject', key)] });
  });
});

describe('cue flags are the compiler’s alone', () => {
  it('an authored cue that sets flags directly is rejected', () => {
    const bad = { ...CLOCK, cues: [{ ...CLOCK.cues[0], setFlags: [movedFlag('subject', 1)] }] };
    const t = { ...variant({ move: {} }), situations: BARRICADE.situations.map(situation => ({ ...situation, clocks: [bad as unknown as typeof CLOCK] })) };
    expect(() => call(t, 'bungalow_g2', 1, true)).toThrow(/sets flags directly/);
  });
});

describe('the latest move wins, whatever order the call compiled them in', () => {
  // The review's reproduction: a cue moves the subject, then an action moves them on (and the reverse).
  const { s } = call(withCue(variant()), 'bungalow_g2', 1, true)!;
  const cue = movedFlag('subject', cueMoveKey('boxes', 0)), action = movedFlag('subject', 1);
  const where = (flags: string[]) => storyPeopleActual(s, { flags, knowledge: {}, pressure: 0 }).find(person => person.id === 'subject')!.position;
  const place = (flag: string) => s.story!.bindings.people.subject.transitions.find(entry => entry.when.flags?.[0] === flag)!.to;
  const after = (...flags: string[]) => flags.reduce<string[]>((set, flag) => withFlag(set, flag), []);

  it('a cue, then an action: they are where the action took them', () => {
    expect(where(after(cue, action))).toEqual(place(action));
  });
  it('an action, then a cue: they are where the cue took them', () => {
    expect(where(after(action, cue))).toEqual(place(cue));
  });
  it('one current move and one place last seen per person', () => {
    expect(after(action, cue, seenFlag('subject', 1), seenFlag('subject', 2))).toEqual([cue, seenFlag('subject', 2)]);
  });
  it('seen in the hall, moved out of sight, then the hall found empty: the team holds the hall as last seen', () => {
    const flags = after(action, seenFlag('subject', 1), cue, lostFlag('subject'));
    const believed = storyPeoplePublic(s, buildLocation(s.locationFamilyId, s.locationSeed), { flags, knowledge: { [s.incidentPeople!.find(person => person.id === 'subject')!.locationFactId!]: 'confirmed' }, pressure: 0 })
      .find(person => person.id === 'subject')!;
    expect(believed).toMatchObject({ status: 'reported', stale: true, position: place(action) });
    expect(sightingFlags(s, { flags, knowledge: {}, pressure: 0 }, 'subject')).toEqual([seenFlag('subject', cueMoveKey('boxes', 0))]);
  });
});

describe('within one decision, the commit’s order', () => {
  it('a look into where they went, then an outcome that moves them on seen: the observed move wins', () => {
    const t = variant({ edit: tree => {
      const line = tree.nodes.find(node => node.id === 'on_the_line')!.choices.find(choice => choice.id === 'honest_no')!;
      line.team = { to: { watch: HALL }, signal: { channel: 'visual', to: 'subject' } };
      for (const outcome of line.outcomes.favorable) if (outcome.next) outcome.moveTo = { subject: { to: 'scene', seen: true } };
    } });
    const s = call(t, 'bungalow_g2', 1, true)!.s;
    withDraftScenario(s, id => {
      let state: GameState | null = applyMove(startGateRun(id), { kind: 'decide', actionId: choiceActionId('barricaded', 'window', 'call_him'), band: 'favorable' });
      state = applyMove(state!, { kind: 'decide', actionId: choiceActionId('barricaded', 'on_the_line', 'honest_no'), band: 'favorable' });
      const run = state!.activeRun!;
      const moved = run.flags.find(flag => flag.startsWith('moved:subject:'))!, n = moved.split(':')[2];
      expect(run.flags).toContain(seenFlag('subject', n));
      const believed = storyPeoplePublic(getScenario(id)!, buildLocation(s.locationFamilyId, s.locationSeed), run).find(person => person.id === 'subject')!;
      expect(believed.stale).toBeUndefined();
      expect(believed.position).toEqual(storyPeopleActual(getScenario(id)!, run).find(person => person.id === 'subject')!.position);
      expect(traceRun(getScenario(id)!, run).end.flags.filter(flag => /^(moved|seen):subject:/.test(flag)).sort()).toEqual(run.flags.filter(flag => /^(moved|seen):subject:/.test(flag)).sort());
    });
  });

  it('an outcome move and a cue move in one decision: live, the replay, the waits validator and a reload agree', () => {
    const fast = { ...CLOCK, start: 50, ratePerMin: 9, cues: [{ ...CLOCK.cues[0], at: 46 }] };
    const t = { ...variant(), situations: BARRICADE.situations.map(situation => ({ ...situation, clocks: [fast] })) };
    const s = call(t, 'bungalow_g2', 1, true)!.s;
    withDraftScenario(s, id => {
      const state = applyNaturalMove(startGateRun(id), { kind: 'decide', actionId: choiceActionId('barricaded', 'window', 'call_him') })!;
      const run = state.activeRun!;
      // The cue lands after the outcome, as the commit applies it: the cue's move is current.
      expect(run.flags).toContain(movedFlag('subject', cueMoveKey('boxes', 0)));
      expect(traceRun(getScenario(id)!, run).end.flags.filter(flag => flag.startsWith('moved:subject:'))).toEqual([movedFlag('subject', cueMoveKey('boxes', 0))]);
      expect(validExternalSupportState(run, getScenario(id)!)).toBe(true);
      const copy = structuredClone(state);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      expect(deserialize(serialize(copy, NOW)), 'the save loads').not.toBeNull();
    });
  });
});

describe('a look that follows a person goes where the team believes they are', () => {
  it('seen in the hall, then back to the start unseen: a look authored for the start room looks in the hall, and reveals nothing about the start', () => {
    // The review's reproduction: the action is relocated by belief, so its look must be too.
    const { s } = call(withCue(variant()), 'bungalow_g2', 1, true)!;
    const built = buildLocation(s.locationFamilyId, s.locationSeed);
    const flags = [movedFlag('subject', 1), seenFlag('subject', 1)].reduce<string[]>((set, flag) => withFlag(set, flag), []);
    const back = withFlag(flags, movedFlag('subject', cueMoveKey('boxes', 0)));
    const state = { flags: back, knowledge: { [s.incidentPeople!.find(person => person.id === 'subject')!.locationFactId!]: 'confirmed' as const }, pressure: 0 };
    const start = s.story!.bindings.people.subject.initial.spaceId, hallRoom = (s.story!.bindings.people.subject.transitions[0].to as { spaceId: string }).spaceId;
    const authored = { ...Object.values(s.stages).flatMap(stage => stage.actions)[0], storyTargetPersonId: 'subject', targetId: start, observes: [start] };
    const look = observingAction(s, built, state, authored);
    expect(look.observes).toEqual([hallRoom]);
    expect(sightings(s, state, look, 'favorable', [])?.setFlags).toEqual([lostFlag('subject')]);
  });
});

describe('an interior vantage that watches a person follows them too', () => {
  it('watching from one room into the person’s room: the look goes where the team believes they are', () => {
    // The review's reproduction: the vantage's approach room and its observed room differ.
    const t = variant({ edit: tree => {
      const root = tree.nodes.find(node => node.id === tree.root)!;
      root.choices[1].team = { to: { vantage: 'subject' }, signal: { channel: 'visual', to: 'subject' } };
      root.choices[1].talksTo = 'subject';
    } });
    const found2 = call(withCue(t), 'cedar_close', 1, true)!;
    const s = found2.s;
    const watch = s.stages.assess.actions.find(action => action.id === choiceActionId('barricaded', 'window', t.tree.nodes[0].choices[1].id))!;
    const start = s.story!.bindings.people.subject.initial.spaceId, hallRoom = (s.story!.bindings.people.subject.transitions[0].to as { spaceId: string }).spaceId;
    expect(watch.observes).toEqual([start]);
    const back = [movedFlag('subject', 1), seenFlag('subject', 1), movedFlag('subject', cueMoveKey('boxes', 0))].reduce<string[]>((set, flag) => withFlag(set, flag), []);
    const state = { flags: back, knowledge: { [s.incidentPeople!.find(person => person.id === 'subject')!.locationFactId!]: 'confirmed' as const }, pressure: 0 };
    const look = observingAction(s, found2.built, state, watch);
    expect(look.observes).toEqual([hallRoom]);
    // The hall is empty now: the trail is lost; nothing about the start room is revealed.
    expect(sightings(s, state, look, 'favorable', [])?.setFlags).toEqual([lostFlag('subject')]);
  });
});

describe('what the team sees never depends on hidden state', () => {
  it('entering the child’s room while talking to the subject: the same rooms seen and the same knowledge, with or without an unseen move', () => {
    // The review's reproduction (bungalow_g2 seed 1): only the look at the followed person's own room follows them.
    const t = variant({ edit: tree => {
      const root = tree.nodes.find(node => node.id === tree.root)!;
      root.choices[1].team = { to: { room: 'child' } };
      root.choices[1].talksTo = 'subject';
    } });
    const found3 = call(t, 'bungalow_g2', 1, true)!;
    const s = found3.s;
    const enter = s.stages.assess.actions.find(action => action.id === choiceActionId('barricaded', 'window', t.tree.nodes[0].choices[1].id))!;
    const knowledge = { [s.incidentPeople!.find(person => person.id === 'subject')!.locationFactId!]: 'confirmed' as const };
    const before = { flags: [] as string[], knowledge, pressure: 0 }, after = { ...before, flags: [movedFlag('subject', 1)] };
    const seenBy = (state: typeof before) => {
      const look = observingAction(s, found3.built, state, enter);
      return { observes: look.observes, knowledge: sightings(s, state, look, 'favorable', [])?.knowledge ?? [] };
    };
    expect(seenBy(after)).toEqual(seenBy(before));
    expect(seenBy(before).observes).toEqual(enter.observes);
  });
});

describe('in real play, with a save and reload after every decision', () => {
  // Natural dice on the default seed: call_him (3.6 min), then honest_no (3.0 min). A clock from 100
  // at 2 a minute passes 95 in the first decision and 90 in the second.
  const CHILD = { room: 'child' } as const;
  const clockAt = (at: number) => ({ ...CLOCK, start: 100, ratePerMin: 2, cues: [{ ...CLOCK.cues[0], at, moveTo: { subject: CHILD } }] });
  const template = (opts: { first?: TreeMoveTo; second?: TreeMoveTo | { to: typeof HALL; seen?: true }; cueAt?: number; watch?: boolean }): IncidentTemplate => {
    const t = variant({ move: opts.first ?? {}, edit: tree => {
      const line = tree.nodes.find(node => node.id === 'on_the_line')!.choices.find(choice => choice.id === 'honest_no')!;
      if (opts.watch) line.team = { to: { watch: HALL }, signal: { channel: 'visual', to: 'subject' } };
      if (opts.second) for (const band of ['favorable', 'mixed', 'adverse'] as const) for (const outcome of line.outcomes[band]) if (outcome.next) outcome.moveTo = opts.second as TreeMoveTo;
    } });
    return opts.cueAt === undefined ? t : { ...t, situations: BARRICADE.situations.map(situation => ({ ...situation, clocks: [clockAt(opts.cueAt!)] })) };
  };
  /** Plays call_him then honest_no; after each, a save must reload to the same people, and the
   * decision replay and the waits validator must agree with the live run. */
  const play = (t: IncidentTemplate, seed?: number) => {
    const { s } = call(t, 'bungalow_g2', 1, true)!;
    return withDraftScenario(s, id => {
      const scenario = getScenario(id)!;
      const after: GameState[] = [];
      let state = seed === undefined ? startGateRun(id) : startGateRun(id, seed);
      for (const [node, choice] of [['window', 'call_him'], ['on_the_line', 'honest_no']] as const) {
        state = applyNaturalMove(state, { kind: 'decide', actionId: choiceActionId('barricaded', node, choice) })!;
        expect(state, `${node}.${choice}`).not.toBeNull();
        const run = state.activeRun!;
        const copy = structuredClone(state);
        copy.incidents = [];
        delete copy.activeRun!.sourceIncident;
        const back = deserialize(serialize(copy, NOW));
        expect(back, `the save after ${choice} loads`).not.toBeNull();
        expect(storyPeopleActual(scenario, back!.activeRun!)).toEqual(storyPeopleActual(scenario, run));
        const moves = (flags: string[]) => flags.filter(flag => /^(moved|seen|lost):subject/.test(flag)).sort();
        expect(moves(traceRun(scenario, run).end.flags), `replay after ${choice}`).toEqual(moves(run.flags));
        expect(validExternalSupportState(run, scenario), `waits replay after ${choice}`).toBe(true);
        after.push(state);
      }
      const where = (state: GameState) => storyPeopleActual(scenario, state.activeRun!).find(person => person.id === 'subject')!.position as { spaceId: string };
      const childRoom = scenario.story!.bindings.people.child.initial.spaceId;
      const hallRoom = (scenario.story!.bindings.people.subject.transitions.find(entry => !entry.observed)!.to as { spaceId: string }).spaceId;
      return { after, where, childRoom, hallRoom };
    });
  };

  it('a cue move, then an outcome move: they end where the outcome took them', () => {
    const { after, where, hallRoom, childRoom } = play(template({ cueAt: 95, second: { subject: HALL } }));
    expect(where(after[0]).spaceId, 'the cue fired in the first decision').toBe(childRoom);
    expect(where(after[1]).spaceId).toBe(hallRoom);
  });

  it('an outcome move, then a cue move: they end where the cue took them', () => {
    const { after, where, hallRoom, childRoom } = play(template({ first: { subject: HALL }, cueAt: 90 }));
    expect(where(after[0]).spaceId, 'the cue had not fired yet').toBe(hallRoom);
    expect(where(after[1]).spaceId).toBe(childRoom);
  });

  it('two outcome moves of one person: they end where the second took them', () => {
    const { after, where, hallRoom, childRoom } = play(template({ first: { subject: HALL }, second: { subject: CHILD } }));
    expect(where(after[0]).spaceId).toBe(hallRoom);
    expect(where(after[1]).spaceId).toBe(childRoom);
  });

  it('a hidden move, then a look that sees them there: the re-sighting survives a mid-call save', () => {
    // The dice decide whether the look sees, so take the first campaign seed where it goes well;
    // forcing the band would save a sample the run's rng never drew.
    const t = template({ first: { subject: HALL }, watch: true });
    // A seed whose dice block the second choice is skipped; the one that passes ran every check in play.
    const tryPlay = (seed: number) => { try { return play(t, seed).after[1]; } catch { return undefined; } };
    const seen = [719, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(tryPlay).find(state => state?.activeRun!.history.at(-1)!.band === 'favorable');
    expect(seen, 'a seed where the look goes well').toBeDefined();
    expect(seen!.activeRun!.flags.some(flag => flag.startsWith('seen:subject:'))).toBe(true);
  });
});

describe('the decision replay keeps a re-sighting and a later move', () => {
  it('move, look (seen), move again: traceRun ends where the live run does at every step', () => {
    const t = variant({ edit: tree => {
      const line = tree.nodes.find(node => node.id === 'on_the_line')!.choices.find(choice => choice.id === 'honest_no')!;
      line.team = { to: { watch: HALL }, signal: { channel: 'visual', to: 'subject' } };
      const walk = tree.nodes.find(node => node.id === 'son_inside')!.choices.find(choice => choice.id === 'past_dark')!;
      for (const outcome of walk.outcomes.favorable) if (outcome.next) outcome.moveTo = { subject: 'scene' };
    } });
    const s = call(t, 'bungalow_g2', 1, true)!.s;
    withDraftScenario(s, id => {
      const steps: [string, string][] = [['window', 'call_him'], ['on_the_line', 'honest_no'], ['son_inside', 'past_dark']];
      let state: GameState | null = startGateRun(id);
      for (const [index, [node, choice]] of steps.entries()) {
        state = applyMove(state!, { kind: 'decide', actionId: choiceActionId('barricaded', node, choice), band: 'favorable' });
        expect(state, `${node}.${choice}`).not.toBeNull();
        const live = state!.activeRun!, replayed = traceRun(getScenario(id)!, live).end;
        const moves = (flags: string[]) => flags.filter(flag => /^(moved|seen):subject:/.test(flag)).sort();
        expect(moves(replayed.flags), `after ${node}.${choice}`).toEqual(moves(live.flags));
        if (index === 1) expect(live.flags).toContain(seenFlag('subject', 1));
        // Moved again out of sight: the new move is current, and the hall stays where the team last saw them.
        if (index === 2) expect(moves(live.flags)).toEqual([movedFlag('subject', 4), seenFlag('subject', 1)].sort());
      }
    });
  });
});

describe('moves are checked when the call compiles', () => {
  it('rejects a start-room fact on someone who moves, a walker who moves, and someone outside', () => {
    const upstairs = variant({ edit: tree => { tree.nodes[0].promptIf = [{ when: { upstairs: ['subject'] }, prompt: 'x' }, ...tree.nodes[0].promptIf ?? []]; } });
    expect(() => call(upstairs, 'bungalow_g2', 1, true)).toThrow(/reads where subject started/);
    const walker = variant({ move: { child: HALL } });
    expect(() => call(walker, 'bungalow_g2', 1, true)).toThrow(/moves in this call and also walks out/);
    expect(() => call(variant({ move: { ex: 'scene' } }), 'bungalow_g2', 1, true)).toThrow(/starts outside the building/);

  });
});

describe('in play, a save, the decision replay and the waits replay agree on where they went', () => {
  it('the opening call moves the subject; reload and replay keep it', () => {
    withDraftScenario(found.s, id => {
      const state: GameState | null = applyNaturalMove(startGateRun(id), { kind: 'decide', actionId: choiceActionId('barricaded', 'window', 'call_him') });
      expect(state, 'the call commits').not.toBeNull();
      // Whichever band it rolled, that band's outcome moved them (moves 1 to 3, one per band).
      const flag = state!.activeRun!.flags.find(entry => entry.startsWith('moved:subject:'));
      expect(flag, 'a move flag').toBeDefined();
      expect(traceRun(getScenario(id)!, state!.activeRun!).end.flags).toContain(flag);
      const copy = structuredClone(state!);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      const back = deserialize(serialize(copy, NOW))!;
      expect(storyPeopleActual(getScenario(id)!, back.activeRun!)).toEqual(storyPeopleActual(getScenario(id)!, state!.activeRun!));
    });
  });
});
