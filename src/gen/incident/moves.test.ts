// R-B3: people move on the building, and the team can enter or watch a place on someone's way out.
// A move compiles into the person's story transitions: hidden until the team sees them there (an
// observed twin keyed on a seen flag), or seen at once when the line says where they went. Truth and
// belief are read apart: sightings and incoming fire read where they are; the odds and the force
// rules read where the team believes they are. Exercised on the barricade template.
import { describe, expect, it } from 'vitest';
import type { CallTree, TreeMoveTo } from '../../content/call-trees/types';
import type { IncidentTemplate } from '../../content/incidents/types';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { readForceThreat } from '../../sim/authorization';
import { movedFlag, seenFlag } from '../../sim/conditions';
import { buildLocation } from '../../sim/location';
import { traceRun } from '../../sim/operation';
import { movedPersonAt, scenarioWithPeopleNow } from '../../sim/resolution';
import { deserialize, serialize } from '../../sim/save';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { getScenario } from '../../sim/scenario-registry';
import { sightings } from '../../sim/sightings';
import { LAST_SEEN_LINES, storyPeopleActual, storyPeoplePublic, storyPublicScenario } from '../../sim/story-people';
import { NOW } from '../../sim/test-fixtures';
import type { GameState } from '../../sim/types';
import { applyNaturalMove, startGateRun, withDraftScenario } from './gates/engine-driver';
import { generateIncident } from './index';
import { compileIncident, hostedSpec } from './instance';
import { choiceActionId } from './trees-v13/compile';

const BARRICADE = INCIDENT_TEMPLATES.barricaded!;
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
    try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: 1, seed, tier: 2, contentVersion: 13 }); } catch { continue; }
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
    expect(transitions[1]).toMatchObject({ when: { flags: [movedFlag('subject', 1), seenFlag('subject', 1)] }, observed: true, to: transitions[0].to });
    expect(transitions.at(-1)!.when.flags).toEqual(['out:subject']);
    expect(found.built.location.rooms.find(room => room.id === hall().spaceId)!.type).toBe('hall');
    const opening = Object.values(found.s.stages).flatMap(stage => stage.actions).find(action => action.id === choiceActionId('barricaded', 'window', 'call_him'))!;
    expect(opening.outcomes.favorable.some(effect => effect.setFlags?.includes(movedFlag('subject', 1)))).toBe(true);
  });

  it('seen: one observed transition, no twin', () => {
    const seen = call(variant({ move: { subject: { to: HALL, seen: true } } }), 'bungalow_g2')!;
    const transitions = seen.s.story!.bindings.people.subject.transitions;
    // One move per outcome that moves them (the opening call's three bands): each observed at once.
    expect(transitions.slice(0, -1)).toEqual([1, 2, 3].map(n => expect.objectContaining({ when: { flags: [movedFlag('subject', n)] }, observed: true })));
    expect(transitions.at(-1)!.when.flags).toEqual(['out:subject']);
  });
});

describe('truth and belief after a hidden move', () => {
  const moved = run([movedFlag('subject', 1)]);

  it('truth is the hall; the team still believes the room it saw them in, as last seen, with no reporter credited', () => {
    expect(storyPeopleActual(found.s, moved).find(person => person.id === 'subject')!.position).toEqual(hall());
    const believed = storyPeoplePublic(found.s, found.built, moved).find(person => person.id === 'subject')!;
    expect(believed).toMatchObject({ status: 'reported', stale: true, position: found.s.story!.bindings.people.subject.initial });
    const fact = storyPublicScenario(found.s, found.built, moved).scenario.facts.find(entry => entry.id === subject().locationFactId)!;
    expect(fact.markerSource).toBeUndefined();
    expect(fact.source).toBe(LAST_SEEN_LINES.source);
    expect(fact.claim).toMatch(/was last seen in/);
  });

  it('a look into the hall settles it: the sighting sets the twin’s seen flag, and the team then knows the new spot', () => {
    const look = { ...Object.values(found.s.stages).flatMap(stage => stage.actions)[0], observes: [hall().spaceId] };
    const seen = sightings(found.s, moved, look, 'favorable', []);
    expect(seen?.setFlags).toEqual([seenFlag('subject', 1)]);
    const after = run([movedFlag('subject', 1), seenFlag('subject', 1)]);
    expect(storyPeoplePublic(found.s, found.built, after).find(person => person.id === 'subject')).toMatchObject({ status: 'confirmed', position: hall() });
    // A look into the room they left sees nobody there now.
    expect(sightings(found.s, moved, { ...look, observes: [subject().spaceId] }, 'favorable', [])?.setFlags ?? []).toEqual([]);
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
        try { base = generateIncident({ type: 'barricaded', familyId: family, buildingSeed: seed, seed, tier: 2, contentVersion: 13 }); } catch { continue; }
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

describe('a clock cue can move someone, keyed by its mark', () => {
  it('compiles the cue’s move into a hidden transition on the cue’s mark, with its twin', () => {
    const clock = { id: 'boxes', label: 'The boxes', kind: 'deadline' as const, start: 60, ratePerMin: 1, rateKnown: false,
      cues: [{ at: 45, text: 'A box goes down outside the back bedroom.', mark: 'in_hall', moveTo: { subject: HALL } }] };
    const cue = { ...variant({ move: {} }), situations: BARRICADE.situations.map(situation => ({ ...situation, clocks: [clock] })) };
    const s = call(cue, 'bungalow_g2', 1, true)!.s;
    const transitions = s.story!.bindings.people.subject.transitions;
    expect(transitions[0]).toMatchObject({ when: { flags: ['mark:in_hall'] }, observed: false });
    expect(transitions[1]).toMatchObject({ when: { flags: ['mark:in_hall', seenFlag('subject', 1)] }, observed: true });
    expect(storyPeopleActual(s, { flags: ['mark:in_hall'], knowledge: {}, pressure: 0 }).find(person => person.id === 'subject')!.position).toEqual(transitions[0].to);
  });
});

describe('moves are checked when the call compiles', () => {
  it('rejects a start-room fact on someone who moves, a walker who moves, a group, someone outside, and a cue move with no mark', () => {
    const upstairs = variant({ edit: tree => { tree.nodes[0].promptIf = [{ when: { upstairs: ['subject'] }, prompt: 'x' }, ...tree.nodes[0].promptIf ?? []]; } });
    expect(() => call(upstairs, 'bungalow_g2', 1, true)).toThrow(/reads where subject started/);
    const walker = variant({ move: { child: HALL } });
    expect(() => call(walker, 'bungalow_g2', 1, true)).toThrow(/moves in this call and also walks out/);
    expect(() => call(variant({ move: { ex: 'scene' } }), 'bungalow_g2', 1, true)).toThrow(/starts outside the building/);
    const cue = { ...variant(), situations: BARRICADE.situations.map(situation => ({ ...situation, clocks: [{ id: 'x', label: 'x', kind: 'deadline' as const, start: 50, ratePerMin: 1, rateKnown: false, cues: [{ at: 25, text: 'x', moveTo: { subject: 'scene' as const } }] }] })) };
    expect(() => call(cue, 'bungalow_g2', 1, true)).toThrow(/needs a mark/);
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
