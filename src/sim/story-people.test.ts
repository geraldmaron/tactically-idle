import { afterEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';
import { buildLocation, pointInPolygon } from './location';
import { actionViews, spaceViews } from './operation-selectors';
import { builtFor, evaluateAction, openingFlag } from './resolution';
import { currentStoryRoute } from './story-bindings';
import { centroidOf, routeAlongOpenings, routeBetween, standingOf } from './spatial-factors';
import type { ActionDefinition, FactDefinition, ScenarioDefinition, StoryAnchor } from './scenario-types';
import { deserialize, serialize } from './save';
import { initializePersonnel } from './personnel';
import { storyPeopleActual, storyPeoplePublic, storyPropsActual, storyPropsPublic, storyPropsKnown } from './story-people';
import { apply, makeState, NOW, startRun } from './test-fixtures';
import type { GameState, KnowledgeStatus } from './types';

const fixtureId = 'test_bound_story_people';
const built = buildLocation('maple_street', 0);
function anchor(spaceId: string, offset = 0): StoryAnchor {
  const space = [...built.location.rooms, ...built.location.zones].find(space => space.id === spaceId)!;
  const points = built.derived.stagingPoints.filter(point => point.spaceId === spaceId).map(point => point.at);
  for (let y = 0.75; y < built.location.bounds.h; y += 1) for (let x = 0.75; x < built.location.bounds.w; x += 1) points.push({ x, y });
  const free = points.filter(at => pointInPolygon(at, space.polygon) && !built.location.objects.some(object => object.in === spaceId && object.tags.includes('blocks_space') && at.x >= object.x - 0.4 && at.x <= object.x + object.w + 0.4 && at.y >= object.y - 0.4 && at.y <= object.y + object.h + 0.4));
  return { spaceId, at: free[offset] };
}
const inside = anchor('bedroom_e');
const secondRoom = anchor('kitchen');
const outside = anchor('front_yard');
const secondOutside = anchor('front_yard', 1);
const otherOutside = anchor('side_yard_e');
function fact(id: string, label: string, position: StoryAnchor, status: KnowledgeStatus): FactDefinition {
  return { id, label, spaceId: position.spaceId, truth: true, initial: status, showWhenUnknown: false, person: { label, at: position.at }, markers: { reported: `${label.toUpperCase()}?`, confirmed: label.toUpperCase() }, claim: `${label} is in ${position.spaceId}.`, source: 'Caller', note: null, uncertainty: 'The location needs checking.' };
}
function fixture(status: KnowledgeStatus = 'confirmed'): { scenario: ScenarioDefinition; state: GameState; care: ActionDefinition } {
  const scenario = structuredClone(SCENARIOS.ms_occupancy);
  scenario.id = fixtureId;
  scenario.version = 5;
  scenario.facts = [fact('where_alex', 'Alex', inside, status), fact('where_ben', 'Ben', secondRoom, 'confirmed')];
  scenario.story = {
    archetypeId: 'two_people', version: 1, episodeId: 'test', seed: 0,
    bindings: {
      rooms: { room: { spaceId: inside.spaceId } }, exterior: { safe: { spaceId: outside.spaceId } }, routes: {},
      people: {
        alex: { id: 'alex', label: 'Alex', locationFactId: 'where_alex', initial: inside, reported: otherOutside, transitions: [
          { when: { flags: ['alex_released'] }, to: outside, observed: true, label: 'Alex is outside with the team.' },
          { when: { flags: ['secret_move'] }, to: otherOutside, observed: false },
          { when: { flags: ['alex_picked_up'] }, to: { kind: 'offscene', label: 'With the pickup service' }, observed: true },
        ] },
        ben: { id: 'ben', label: 'Ben', locationFactId: 'where_ben', initial: secondRoom, transitions: [
          { when: { flags: ['ben_released'] }, to: secondOutside, observed: true },
        ] },
      },
      props: { phone: { id: 'phone', label: 'Phone', kind: 'carried', holderPersonId: 'alex', transitions: [{ when: { flags: ['phone_returned'] }, holderPersonId: 'ben' }] } },
    },
  };
  const care: ActionDefinition = {
    id: 'test_care', stage: 'assess', title: 'Care for Alex', summary: 'Check Alex', task: 'Care', icon: 'medic', targetId: inside.spaceId,
    storyTargetPersonId: 'alex', requires: {}, check: { kind: 'medical', ratings: [{ key: 'medical', weight: 1 }], difficulty: 20 },
    workload: { base: 1, perSqFt: 0 }, approach: 'path', spatial: { channel: 'visual', subjectFactId: 'where_alex', weight: 1, noun: 'Sightline' }, stressBase: 0,
    outcomes: { favorable: [], mixed: [], adverse: [] },
  };
  scenario.stages.assess.actions = [care];
  let state = startRun(makeState(), 'ms_occupancy', ['A']);
  state.saveVersion = 5; state.contentVersion = 5; initializePersonnel(state);
  state = structuredClone(state);
  state.activeRun!.scenarioId = fixtureId;
  state.activeRun!.scenarioVersion = 5;
  state.activeRun!.externalSupport = {};
  state.activeRun!.knowledge = Object.fromEntries(scenario.facts.map(fact => [fact.id, fact.initial]));
  SCENARIOS[fixtureId] = scenario;
  return { scenario, state, care };
}
afterEach(() => { delete SCENARIOS[fixtureId]; });
const markers = (state: GameState) => spaceViews(state).flatMap(space => space.people.map(person => ({ spaceId: space.id, ...person })));
const evaluate = (scenario: ScenarioDefinition, state: GameState, action: ActionDefinition) => evaluateAction({ scenario, state, action, run: state.activeRun!, built: builtFor(scenario.locationFamilyId, scenario.locationSeed, state.activeRun!.flags), acting: ['A'], support: [] });

describe('bound story people project existing committed state', () => {
  it('uses reported anchors until confirmed and keeps two separate releases independent', () => {
    const { scenario, state } = fixture('reported');
    const run = state.activeRun!;
    expect(storyPeopleActual(scenario, run)[0].position).toEqual(inside);
    expect(markers(state).find(marker => marker.id === 'person_where_alex')).toMatchObject({ spaceId: otherOutside.spaceId, at: otherOutside.at, label: 'Alex', status: 'reported' });
    run.knowledge.where_alex = 'confirmed';
    expect(markers(state).find(marker => marker.id === 'person_where_alex')).toMatchObject({ spaceId: inside.spaceId, at: inside.at, label: 'Alex' });
    run.flags.push('alex_released');
    expect(markers(state)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'person_where_alex', spaceId: outside.spaceId, at: outside.at }),
      expect.objectContaining({ id: 'person_where_ben', spaceId: secondRoom.spaceId }),
    ]));
    const oldRoom = spaceViews(state).find(space => space.id === inside.spaceId)!;
    expect(oldRoom).toMatchObject({ people: [], facts: [], marker: null, status: 'none' });
    const currentFact = spaceViews(state).find(space => space.id === outside.spaceId)!.facts.find(fact => fact.id === 'where_alex')!;
    expect(currentFact.claim).toBe('Alex is in Front.');
    expect(currentFact.note).toBe('Alex is outside with the team.');
    expect(currentFact.source).toBe('Observed during this operation');
    run.flags.push('ben_released');
    expect(markers(state)).toHaveLength(2);
    expect(new Set(markers(state).map(marker => marker.id)).size).toBe(2);
    expect(markers(state).map(marker => marker.spaceId)).toEqual([outside.spaceId, outside.spaceId]);
  });

  it('does not leak an unobserved transition through map, inspection, target, eligibility or overlays', () => {
    const { scenario, state, care } = fixture();
    const before = { people: storyPeoplePublic(scenario, built, state.activeRun!), spaces: spaceViews(state), action: actionViews(state, NOW, 'A'), evaluation: evaluate(scenario, state, care) };
    state.activeRun!.flags.push('secret_move');
    expect(storyPeopleActual(scenario, state.activeRun!)[0].position).toEqual(otherOutside);
    expect({ people: storyPeoplePublic(scenario, built, state.activeRun!), spaces: spaceViews(state), action: actionViews(state, NOW, 'A'), evaluation: evaluate(scenario, state, care) }).toEqual(before);
  });

  it('relocates subject care facts with public position, preserving their status without duplicating markers', () => {
    const { scenario, state } = fixture();
    scenario.facts.push({ ...fact('alex_care', 'Alex needs assessment', inside, 'reported'), storyPersonId: 'alex', markers: { reported: 'ASSESSMENT?' }, person: undefined });
    state.activeRun!.knowledge.alex_care = 'reported';
    const before = spaceViews(state);
    state.activeRun!.flags.push('secret_move');
    expect(spaceViews(state)).toEqual(before);
    state.activeRun!.flags.push('alex_released');
    const spaces = spaceViews(state);
    expect(spaces.find(space => space.id === inside.spaceId)!.facts.some(fact => fact.id === 'alex_care')).toBe(false);
    expect(spaces.find(space => space.id === outside.spaceId)!.facts.find(fact => fact.id === 'alex_care')).toMatchObject({ status: 'reported', label: 'Alex needs assessment' });
    expect(markers(state).filter(marker => marker.id === 'person_where_alex')).toHaveLength(1);
    expect(markers(state).some(marker => marker.id === 'person_alex_care')).toBe(false);
    state.activeRun!.flags.push('alex_picked_up');
    expect(spaceViews(state).flatMap(space => space.facts).some(fact => fact.id === 'alex_care')).toBe(false);
    expect(state.activeRun!.knowledge.alex_care).toBe('reported');
  });

  it.each(['unknown', 'disproved'] as const)('does not invent a location for an %s person', status => {
    const { scenario, state, care } = fixture(status);
    expect(storyPeoplePublic(scenario, built, state.activeRun!)[0].position).toBeNull();
    expect(markers(state).map(marker => marker.id)).not.toContain('person_where_alex');
    expect(evaluate(scenario, state, care)).toMatchObject({ eligible: false, publicTargetId: null, arrivals: [], overlays: [] });
    expect(actionViews(state, NOW, 'A')[0].targetId).toBeNull();
    const refused = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toBe(state);
  });

  it('removes known off-scene people and their occupancy instead of assigning an invented room', () => {
    const { scenario, state, care } = fixture();
    state.activeRun!.flags.push('alex_released', 'alex_picked_up');
    expect(storyPeoplePublic(scenario, built, state.activeRun!)[0].position).toEqual({ kind: 'offscene', label: 'With the pickup service' });
    expect(markers(state).map(marker => marker.id)).not.toContain('person_where_alex');
    expect(spaceViews(state).flatMap(space => space.facts).map(fact => fact.id)).not.toContain('where_alex');
    expect(evaluate(scenario, state, care).eligible).toBe(false);
  });

  it('keeps carried props with their current holder and preserves public location uncertainty', () => {
    const { scenario, state } = fixture('reported');
    const run = state.activeRun!;
    expect(storyPropsActual(scenario, built, run)[0].position).toEqual(inside);
    expect(storyPropsPublic(scenario, built, run)[0].position).toEqual(otherOutside);
    run.flags.push('phone_returned', 'ben_released');
    expect(storyPropsPublic(scenario, built, run)[0]).toMatchObject({ holderPersonId: 'ben', position: secondOutside });
    expect(storyPropsActual(scenario, built, run)[0].position).toEqual(secondOutside);
  });

  it('gates a bound prop by its current holder and fails safely when the prop is missing', () => {
    const { scenario, state, care } = fixture();
    care.requires.storyProps = [{ propId: 'phone', holderPersonId: 'alex', reason: 'Alex needs the phone for this step.' }];
    expect(evaluate(scenario, state, care).eligible).toBe(true);
    state.activeRun!.flags.push('phone_returned');
    expect(evaluate(scenario, state, care)).toMatchObject({ eligible: false, reason: 'Alex needs the phone for this step.' });
    care.requires.storyProps[0].holderPersonId = 'ben';
    expect(evaluate(scenario, state, care).eligible).toBe(true);
    delete scenario.story!.bindings.props.phone;
    expect(evaluate(scenario, state, care).eligible).toBe(false);
  });

  it('hydrates the new target before evaluation and records that target on commit, without rewriting earlier history', () => {
    const { scenario, state, care } = fixture();
    state.activeRun!.flags.push('alex_released');
    const ev = evaluate(scenario, state, care);
    expect(ev.eligible, ev.reason ?? '').toBe(true);
    expect(ev.action.targetId).toBe(outside.spaceId);
    expect(ev.arrivals[0]).toMatchObject({ spaceId: outside.spaceId, at: outside.at });
    expect(ev.overlays.some(overlay => overlay.kind === 'line' && overlay.to.x === outside.at.x && overlay.to.y === outside.at.y)).toBe(true);
    expect(actionViews(state, NOW, 'A')[0].targetId).toBe(outside.spaceId);
    expect(spaceViews(state).find(space => space.id === inside.spaceId)!.actionIds).not.toContain(care.id);
    expect(spaceViews(state).find(space => space.id === outside.spaceId)!.actionIds).toContain(care.id);
    const priorHistory = structuredClone(state.activeRun!.history);
    const committed = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(committed.result).toEqual({ ok: true });
    expect(committed.state.activeRun!.history.at(-1)!.targetId).toBe(outside.spaceId);
    expect(committed.state.activeRun!.history.slice(0, priorHistory.length)).toEqual(priorHistory);
    expect(care.targetId).toBe(inside.spaceId);
  });

  it('recomputes identical views after save/reload without adding people state or drawing randomness', () => {
    const { scenario, state } = fixture();
    state.activeRun!.flags.push('alex_released', 'phone_returned');
    const before = structuredClone(state);
    const expected = { spaces: spaceViews(state), people: storyPeoplePublic(scenario, built, state.activeRun!), props: storyPropsPublic(scenario, built, state.activeRun!), actions: actionViews(state, NOW, 'A') };
    const loaded = deserialize(serialize(state, NOW))!;
    expect(loaded).not.toBeNull();
    expect({ spaces: spaceViews(loaded), people: storyPeoplePublic(scenario, built, loaded.activeRun!), props: storyPropsPublic(scenario, built, loaded.activeRun!), actions: actionViews(loaded, NOW, 'A') }).toEqual(expected);
    expect(state).toEqual(before);
    expect(loaded.activeRun!.history).toEqual(before.activeRun!.history);
    expect(loaded.activeRun!.rngState).toBe(before.activeRun!.rngState);
  });

  it('does not activate story projections or targeting for v1–v4 content', () => {
    const { scenario, state, care } = fixture();
    for (const version of [1, 2, 3, 4]) {
      scenario.version = version; state.activeRun!.scenarioVersion = version;
      const withMetadata = { spaces: spaceViews(state), evaluation: evaluate(scenario, state, care) };
      const legacy = { ...scenario, story: undefined };
      const oldAction = { ...care, storyTargetPersonId: undefined };
      SCENARIOS[fixtureId] = legacy;
      expect(spaceViews(state)).toEqual(withMetadata.spaces);
      // Compare calculation and projections; the authored action object itself preserves metadata.
      const { action: _with, ...evWith } = withMetadata.evaluation;
      const { action: _without, ...evWithout } = evaluate(legacy, state, oldAction);
      expect(evWithout).toEqual(evWith);
      SCENARIOS[fixtureId] = scenario;
    }
  });

  it('prices a locked person route with ordinary material costs and opens only traversed locks on commit', () => {
    const { scenario, state, care } = fixture();
    care.approach = 'none'; care.spatial = undefined; care.storyRoute = 'exit';
    scenario.story!.bindings.routes.exit = { fromSpaceId: inside.spaceId, toSpaceId: outside.spaceId, openingIds: [], profile: 'walking' };
    const run = state.activeRun!;
    run.flags.push(...built.location.openings.map(opening => openingFlag(opening.id, 'open')));
    const openBuilt = builtFor(scenario.locationFamilyId, scenario.locationSeed, run.flags);
    const route = currentStoryRoute(scenario, openBuilt, 'exit')!;
    expect(route.length).toBeGreaterThan(0);
    const lockedId = route.find(id => openBuilt.location.openings.find(opening => opening.id === id)!.type === 'door')!;
    const open = evaluate(scenario, state, care);
    run.flags.push(openingFlag(lockedId, 'locked'));
    const locked = evaluate(scenario, state, care);
    const lockedBuilt = builtFor(scenario.locationFamilyId, scenario.locationSeed, run.flags);
    const expectedRoute = routeAlongOpenings(lockedBuilt, centroidOf(lockedBuilt, inside.spaceId), centroidOf(lockedBuilt, outside.spaceId), route, null);
    expect(locked.timeBase - open.timeBase).toBeCloseTo(expectedRoute.forceMinutes, 1);
    expect(locked.storyOpenedIds).toContain(lockedId);
    expect(run.flags.at(-1)).toBe(openingFlag(lockedId, 'locked'));
    const declined = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(declined.result).toEqual({ ok: true });
    expect(builtFor(scenario.locationFamilyId, scenario.locationSeed, declined.state.activeRun!.flags).location.openings.find(opening => opening.id === lockedId)!.state).toBe('locked');
    const decline = declined.state.activeRun!.history.at(-1)!;
    expect(decline.timeCost).toBe(Math.round((locked.timeBase - locked.storyMovementMinutes!) * ({ favorable: 1, mixed: 1.2, adverse: 1.5 })[decline.band] * 10) / 10);
    for (const band of ['favorable', 'mixed', 'adverse'] as const) care.outcomes[band] = [{ setFlags: ['alex_released'] }];
    const moved = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(moved.result).toEqual({ ok: true });
    expect(builtFor(scenario.locationFamilyId, scenario.locationSeed, moved.state.activeRun!.flags).location.openings.find(opening => opening.id === lockedId)!.state).toBe('open');
    expect(storyPeopleActual(scenario, moved.state.activeRun!)[0].position).toEqual(outside);
    expect(deserialize(serialize(moved.state, NOW))).not.toBeNull();
  });

  it('uses a complete alternative route and refuses a fully blocked route without mutation', () => {
    const { scenario, state, care } = fixture();
    care.approach = 'none'; care.storyRoute = 'exit';
    scenario.story!.bindings.routes.exit = { fromSpaceId: inside.spaceId, toSpaceId: outside.spaceId, openingIds: [], profile: 'walking' };
    const run = state.activeRun!;
    run.flags.push(...built.location.openings.map(opening => openingFlag(opening.id, 'open')));
    const route = currentStoryRoute(scenario, builtFor(scenario.locationFamilyId, scenario.locationSeed, run.flags), 'exit')!;
    const alternateBlockedId = route.find(id => currentStoryRoute(scenario, builtFor(scenario.locationFamilyId, scenario.locationSeed, [...run.flags, openingFlag(id, 'blocked')]), 'exit') !== null)!;
    expect(alternateBlockedId).toBeDefined();
    run.flags.push(openingFlag(alternateBlockedId, 'blocked'));
    const alternate = evaluate(scenario, state, care);
    expect(alternate.eligible, alternate.reason ?? '').toBe(true);
    expect(alternate.action.requires.openings!.map(opening => opening.openingId)).not.toContain(alternateBlockedId);
    run.flags.push(...built.location.openings.filter(opening => opening.a === inside.spaceId || opening.b === inside.spaceId).map(opening => openingFlag(opening.id, 'blocked')));
    expect(evaluate(scenario, state, care)).toMatchObject({ eligible: false, reason: 'There is no usable route for this move' });
    const refused = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toBe(state);
  });

  it('charges a shared lock once when the acting squad and released person both use it', () => {
    const { scenario, state, care } = fixture();
    care.spatial = undefined; care.storyRoute = 'exit';
    scenario.story!.bindings.routes.exit = { fromSpaceId: inside.spaceId, toSpaceId: outside.spaceId, openingIds: [], profile: 'walking' };
    state.activeRun!.flags.push(...built.location.openings.map(opening => openingFlag(opening.id, 'open')));
    const openBuilt = builtFor(scenario.locationFamilyId, scenario.locationSeed, state.activeRun!.flags);
    const ids = currentStoryRoute(scenario, openBuilt, 'exit')!;
    // This bedroom door is shared by every squad ingress and person egress.
    const shared = ids.find(id => {
      const opening = openBuilt.location.openings.find(opening => opening.id === id)!;
      return opening.type === 'door' && [opening.a, opening.b].includes(inside.spaceId);
    })!;
    expect(shared).toBeDefined();
    state.activeRun!.flags.push(openingFlag(shared, 'locked'));
    const current = builtFor(scenario.locationFamilyId, scenario.locationSeed, state.activeRun!.flags);
    const ev = evaluate(scenario, state, care);
    expect(ev.eligible, ev.reason ?? '').toBe(true);
    expect(ev.storySquadOpenedIds).toContain(shared);
    const task = state.activeRun!.squadTasks[0];
    const squad = routeBetween(current, task.positionId, standingOf(current, task).at, ev.arrivals[0].spaceId, ev.arrivals[0].at, null);
    const person = routeAlongOpenings(current, centroidOf(current, inside.spaceId), centroidOf(current, outside.spaceId), ids, null);
    const uniqueLocks = new Map([...squad.forced, ...person.forced].map(door => [door.openingId, door.minutes]));
    expect(ev.travelMinutes).toBeCloseTo(Math.round((Math.max(squad.minutes - squad.forceMinutes, person.minutes - person.forceMinutes) + [...uniqueLocks.values()].reduce((sum, value) => sum + value, 0)) * 10) / 10, 1);
    expect(ev.storyOpenedIds!.filter(id => id === shared)).toHaveLength(1);
  });

  it('applies route exit state only after an actual person move and preserves explicit outcome changes', () => {
    const { scenario, state, care } = fixture();
    care.approach = 'none'; care.spatial = undefined; care.storyRoute = 'exit';
    scenario.story!.bindings.routes.exit = { fromSpaceId: inside.spaceId, toSpaceId: outside.spaceId, openingIds: [], profile: 'walking' };
    state.activeRun!.flags.push(...built.location.openings.map(opening => openingFlag(opening.id, 'open')));
    const current = builtFor(scenario.locationFamilyId, scenario.locationSeed, state.activeRun!.flags);
    const route = currentStoryRoute(scenario, current, 'exit')!;
    const exit = [...route].reverse().map(id => current.location.openings.find(opening => opening.id === id)!).find(opening =>
      current.location.rooms.some(room => [opening.a, opening.b].includes(room.id)) && current.location.zones.some(zone => [opening.a, opening.b].includes(zone.id)))!;
    for (const band of ['favorable', 'mixed', 'adverse'] as const) care.outcomes[band] = [{ storyExitState: 'locked' }];
    const declined = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(declined.result).toEqual({ ok: true });
    expect(builtFor(scenario.locationFamilyId, scenario.locationSeed, declined.state.activeRun!.flags).location.openings.find(opening => opening.id === exit.id)!.state).toBe('open');
    expect(declined.state.activeRun!.history.at(-1)!.committed!.openingChanges).toBeUndefined();
    for (const band of ['favorable', 'mixed', 'adverse'] as const) care.outcomes[band] = [{ setFlags: ['alex_released'], storyExitState: 'locked', openings: [{ openingId: exit.id, state: 'closed' }] }];
    const moved = apply(state, { type: 'decide', actionId: care.id, actingSquadIds: ['A'], supportSquadIds: [] });
    expect(moved.result).toEqual({ ok: true });
    expect(builtFor(scenario.locationFamilyId, scenario.locationSeed, moved.state.activeRun!.flags).location.openings.find(opening => opening.id === exit.id)!.state).toBe('closed');
    expect(moved.state.activeRun!.history.at(-1)!.committed!.openingChanges).toEqual([{ openingId: exit.id, state: 'closed' }]);
  });
});

describe('carried-item public evidence', () => {
  it('hides possessions until an explicit report and never follows a hidden handoff', () => {
    const { scenario, state } = fixture(); const run = state.activeRun!;
    scenario.version = 7;
    const prop = scenario.story!.bindings.props.phone;
    prop.knownWhen = { flags: ['phone_reported'] };
    prop.confirmedWhen = { flags: ['phone_seen'] };
    prop.reportedHolderPersonId = 'alex'; prop.glyph = 'phone';
    prop.transitions = [{ when: { flags: ['secret_handoff'] }, holderPersonId: 'ben', observed: false }, { when: { flags: ['phone_returned'] }, holderPersonId: 'ben', observed: true }];
    expect(storyPropsKnown(scenario, built, run)).toEqual([]);
    run.flags.push('phone_reported');
    const report = storyPropsKnown(scenario, built, run);
    expect(report).toHaveLength(1); expect(report[0]).toMatchObject({ holderPersonId: 'alex', status: 'reported' });
    prop.holderPersonId = 'ben'; run.flags.push('secret_handoff');
    expect(storyPropsActual(scenario, built, run)[0].holderPersonId).toBe('ben');
    expect(storyPropsKnown(scenario, built, run)).toEqual(report);
    run.flags.push('phone_returned');
    expect(storyPropsKnown(scenario, built, run)).toEqual([expect.objectContaining({ holderPersonId: 'ben', status: 'confirmed', position: secondRoom })]);
    run.flags.push('ben_released');
    expect(storyPropsKnown(scenario, built, run)[0].position).toEqual(secondOutside);
  });
  it('does not infer items or unarmed status from a confirmed person', () => {
    const { scenario, state } = fixture();
    expect(storyPropsKnown(scenario, built, state.activeRun!)).toEqual([]);
    const views = markers(state);
    expect(views.every(person => person.carried === undefined && person.armament === undefined)).toBe(true);
  });
});
