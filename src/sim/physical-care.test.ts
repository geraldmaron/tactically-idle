import { decisionsOf } from './types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../content/scenarios';


import { apply, makeState, NOW, startRun } from './test-fixtures';
import { builtFor, evaluateAction, openingFlag } from './resolution';
import { storyPoint } from '../gen/incident/story-bindings';
import { storyPeoplePublic } from './story-people';
import { physicalCare, officerCarePosition } from './physical-care';
import { standingOf } from './spatial-factors';
import { routeBetween } from './routes';
import { CURRENT_SAVE_VERSION, deserialize, serialize } from './save';
import { syncCasualtyFlags } from './incident-consequences';
import type { ActionDefinition, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState, SquadId } from './types';

const ID = 'test_physical_care_v7';
function action(id: string, effect: OutcomeEffect, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return { id, stage: 'assess', title: id, icon: 'radio', summary: id, targetId: 'front_yard', task: id, requires: {},
    check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 1 }], difficulty: 20 },
    approach: 'none', workload: { base: 1, perSqFt: 0 }, stressBase: 0,
    outcomes: { favorable: [effect], mixed: [effect], adverse: [effect] }, ...extra };
}
const medical = { requires: { certs: ['advanced_first_aid' as const], allTags: ['medkit'] }, consumes: [{ tag: 'medkit', qty: 1 }],
  check: { kind: 'medical' as const, ratings: [{ key: 'medical' as const, weight: 1 }], difficulty: 20 } };
function definition(): ScenarioDefinition {
  const base = structuredClone(SCENARIOS.ms_occupancy);
  const built = builtFor(base.locationFamilyId, base.locationSeed, []);
  const inside = { spaceId: 'kitchen', at: storyPoint(built, 'kitchen', 7)! };
  const outside = { spaceId: 'front_yard', at: storyPoint(built, 'front_yard', 4)! };
  return { ...base, id: ID, version: 7, people: [], pressure: { start: 0, perMinute: 0, threshold: 100, civilianPerMinute: 0 },
    facts: [{ ...base.facts[0], id: 'where_patient', spaceId: inside.spaceId, initial: 'confirmed', truth: true, person: { label: 'Patient', at: inside.at } }],
    civilianOutcomes: [{ id: 'patient', label: 'Patient', factId: 'where_patient', safeFlag: 'safe', injuredFlag: 'injured', careFlag: 'care' }],
    story: { archetypeId: 'care', episodeId: 'care', seed: 1, version: 7, bindings: { rooms: {}, exterior: {}, props: {}, routes: {},
      people: { patient: { id: 'patient', label: 'Patient', locationFactId: 'where_patient', initial: inside, transitions: [
        { when: { flags: ['patient_moved'] }, to: outside, observed: true },
        { when: { flags: ['hidden_move'] }, to: { spaceId: 'bedroom_e', at: storyPoint(built, 'bedroom_e', 1)! }, observed: false },
      ] } } } },
    externalServices: [{ id: 'ambulance', label: 'Medical crew', kind: 'medical', description: 'Receives patients', arrivalMinutes: 2, available: true }],
    stages: {
      adapt: { id: 'adapt', label: 'Adapt', prompt: 'Adapt', actions: [action('adapt_end', { ending: 'handed_over' }, { stage: 'adapt', commandOnly: true })] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: 'Resolve', actions: [action('resolve_end', { ending: 'handed_over' }, { stage: 'resolve', commandOnly: true })] },
      assess: { id: 'assess', label: 'Care', prompt: 'Care follows the patient.', actions: [
      action('aid', { stage: 'assess', setFlags: ['aid_given'] }, { ...medical, storyTargetPersonId: 'patient' }),
      action('move_patient', { stage: 'assess', setFlags: ['patient_moved'] }, { commandOnly: true }),
      action('hidden_event', { stage: 'assess', setFlags: ['hidden_move'] }, { commandOnly: true }),
      action('injure', { stage: 'assess', officerHarm: { severity: 'serious', label: 'Recorded injury' } }, { targetId: 'bedroom_e', approach: 'path' }),
      action('injure_remote', { stage: 'assess', officerHarm: { severity: 'wounded', label: 'Recorded injury' } }, { targetId: 'bedroom_e' }),
      action('move_a', { stage: 'assess' }, { approach: 'path' }),
      action('officer_aid', { stage: 'assess', officerCare: 'stabilize' }, medical),
      action('request', { stage: 'assess', requestSupport: ['ambulance'] }, { commandOnly: true }),
      action('wait', { stage: 'assess' }, { commandOnly: true, awaitSupport: 'ambulance' }),
      action('evacuate', { stage: 'assess', acceptSupport: ['ambulance'], officerCare: 'evacuate' }, { commandOnly: true,
        requires: { externalSupport: [{ serviceId: 'ambulance', status: 'available', reason: 'Wait for the crew' }] } }),
      action('receive_patient', { stage: 'assess', acceptSupport: ['ambulance'], setFlags: ['care'] }, { commandOnly: true, storyTargetPersonId: 'patient',
        requires: { externalSupport: [{ serviceId: 'ambulance', status: 'available', reason: 'Wait for the crew' }] } }),
      action('escort_patient', { stage: 'assess', acceptSupport: ['ambulance'], setFlags: ['care'] }, { approach: 'path', storyTargetPersonId: 'patient',
        requires: { externalSupport: [{ serviceId: 'ambulance', status: 'available', reason: 'Wait for the crew' }] } }),
    ] } },
    endings: { handed_over: { id: 'handed_over', title: 'Unfinished care', summary: 'Care remains open.', trustAdjust: 0, strain: 0,
      disposition: 'unresolved', remainingTasks: ['Arrange care'] } },
  };
}
function started(loadouts: Partial<Record<SquadId, Record<string, number>>> = { A: { trauma_kit: 2 }, B: { trauma_kit: 2 } }): GameState {
  const state = makeState(); state.saveVersion = CURRENT_SAVE_VERSION; state.contentVersion = 13; return startRun(state, ID, ['A', 'B'], { loadouts });
}
function evaluation(state: GameState, id: string, acting: SquadId[] = ['B'], support: SquadId[] = []) {
  const run = state.activeRun!, scenario = SCENARIOS[ID];
  return evaluateAction({ state, run, scenario, action: scenario.stages.assess.actions.find(action => action.id === id)!,
    built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting, support });
}
function choose(state: GameState, id: string, acting: SquadId[] = ['A']): GameState {
  const next = apply(state, { type: 'decide', actionId: id, actingSquadIds: acting, supportSquadIds: [] });
  expect(next.result).toEqual({ ok: true }); return next.state;
}
beforeEach(() => { SCENARIOS[ID] = definition(); });
afterEach(() => { delete SCENARIOS[ID]; });

describe('physical care follows public patients and actual acting squads', () => {


  it('moves the selected medic to the current patient once, then spends only that squad’s kit', () => {
    let state = choose(started(), 'move_patient');
    const aBefore = structuredClone(state.activeRun!.squadTasks.find(task => task.squadId === 'A'));
    const ev = evaluation(state, 'aid'); const run = state.activeRun!;
    const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
    const patient = storyPeoplePublic(SCENARIOS[ID], built, run)[0].position!;
    if ('kind' in patient) throw Error('Patient must be at the scene');
    const start = standingOf(built, run.squadTasks.find(task => task.squadId === 'B')!);
    expect(ev.travelMinutes).toBe(routeBetween(built, start.spaceId, start.at, patient.spaceId, patient.at, null).minutes);
    state = choose(state, 'aid', ['B']);
    expect(state.activeRun!.squadTasks.find(task => task.squadId === 'B')).toMatchObject({ positionId: patient.spaceId, at: patient.at });
    expect(state.activeRun!.squadTasks.find(task => task.squadId === 'A')).toEqual(aBefore);
    expect(decisionsOf(state.activeRun!.history).at(-1)!.itemsConsumed.filter(use => use.itemId === 'trauma_kit')).toEqual([{ itemId: 'trauma_kit', qty: 1 }]);
    expect(deserialize(serialize(state, NOW))?.activeRun).toEqual(state.activeRun);
  });

  it('gates blocked movement atomically, even when the other squad already reached the patient', () => {
    const state = started(), run = state.activeRun!, scenario = SCENARIOS[ID];
    const built = builtFor(run.locationFamilyId, run.locationSeed, []), patient = scenario.story!.bindings.people.patient.initial;
    const a = run.squadTasks.find(task => task.squadId === 'A')!; a.positionId = patient.spaceId; a.at = patient.at; a.stagingId = null;
    run.flags.push(...built.location.openings.filter(opening => opening.a === patient.spaceId || opening.b === patient.spaceId).map(opening => openingFlag(opening.id, 'blocked')));
    const before = structuredClone(state);
    expect(evaluation(state, 'aid')).toMatchObject({ eligible: false });
    const refused = apply(state, { type: 'decide', actionId: 'aid', actingSquadIds: ['B'], supportSquadIds: [] });
    expect(refused.result.ok).toBe(false); expect(refused.state).toEqual(before);
  });

  it('does not get a medic or a kit from a separate remote supporting squad', () => {
    const state = started();
    const aid = SCENARIOS[ID].stages.assess.actions.find(action => action.id === 'aid')!;
    aid.support = { maxSquads: 1, coverSpaceId: 'front_yard', max: 1, reachMinutes: 20, label: 'Support', task: 'Support' };
    state.officers.off_park.injury = { label: 'Injured medic', until: NOW + 10000 };
    expect(evaluation(state, 'aid', ['B'], ['A'])).toMatchObject({ eligible: false });
    state.officers.off_park.injury = null;
    state.reservations = state.reservations.filter(reservation => reservation.squadId !== 'B' || reservation.itemId !== 'trauma_kit');
    expect(evaluation(state, 'aid', ['B'], ['A'])).toMatchObject({ eligible: false });
  });

  it('keeps hidden moves invisible and refuses an unknown patient location', () => {
    const state = started(), before = evaluation(state, 'aid');
    state.activeRun!.flags.push('hidden_move');
    expect(evaluation(state, 'aid')).toEqual(before);
    state.activeRun!.knowledge.where_patient = 'unknown';
    expect(evaluation(state, 'aid')).toMatchObject({ eligible: false, arrivals: [], overlays: [] });
  });



  it('lets a healthy squad open access while escorting the crew inside without requiring first aid or a kit', () => {
    let state = started({ A: {}, B: {} });
    const run = state.activeRun!, built = builtFor(run.locationFamilyId, run.locationSeed, []);
    run.flags.push(...built.location.openings.filter(opening => opening.a === 'kitchen' || opening.b === 'kitchen').map(opening => openingFlag(opening.id, 'locked')));
    state = choose(state, 'request', ['B']); state = choose(state, 'wait', ['B']);
    const ev = evaluation(state, 'escort_patient');
    expect(ev.eligible).toBe(true); expect(ev.storySquadOpenedIds!.length).toBeGreaterThan(0);
    expect(new Set(ev.storySquadOpenedIds).size).toBe(ev.storySquadOpenedIds!.length);
    expect(ev.uses.some(use => use.itemId === 'trauma_kit')).toBe(false);
    state = choose(state, 'escort_patient', ['B']);
    expect(state.activeRun!.squadTasks.find(task => task.squadId === 'B')!.positionId).toBe('kitchen');
    for (const id of ev.storySquadOpenedIds!) expect(state.activeRun!.flags).toContain(openingFlag(id, 'open'));
    expect(decisionsOf(state.activeRun!.history).at(-1)!.committed!.openingChanges).toHaveLength(ev.storySquadOpenedIds!.length);
    expect(state.activeRun!.externalSupport!.ambulance.acceptedAt).not.toBeNull();
  });

  it('uses the moved patient’s exterior location for reception even if their old room is sealed', () => {
    let state = choose(started(), 'move_patient');
    const run = state.activeRun!, built = builtFor(run.locationFamilyId, run.locationSeed, []);
    run.flags.push(...built.location.openings.filter(opening => opening.a === 'kitchen' || opening.b === 'kitchen').map(opening => openingFlag(opening.id, 'blocked')));
    state = choose(state, 'request'); state = choose(state, 'wait');
    expect(evaluation(state, 'receive_patient')).toMatchObject({ eligible: true, action: { targetId: 'front_yard', approach: 'none' } });
    state = choose(state, 'receive_patient');
    expect(state.activeRun!.externalSupport!.ambulance.acceptedAt).not.toBeNull();
  });
});

describe('officer field care and medical transport', () => {
  it('freezes injury position, follows the casualty after their squad leaves, and reloads without replay', () => {
    let state = choose(started(), 'injure');
    const casualty = Object.values(state.activeRun!.officerCasualties!)[0];
    expect(casualty.position?.spaceId).toBe('bedroom_e');
    state = choose(state, 'move_a');
    expect(evaluation(state, 'officer_aid')).toMatchObject({ eligible: true, action: { targetId: 'bedroom_e', approach: 'path' } });
    for (const id of ['officer_aid', 'request', 'wait', 'evacuate']) {
      state = choose(state, id, ['B']);
      const reloaded = deserialize(serialize(state, NOW));
      expect(reloaded?.activeRun, id).toEqual(state.activeRun); state = reloaded!;
    }
    expect(state.activeRun!.officerCasualties![casualty.officerId]).toMatchObject({ care: 'evacuated', position: casualty.position });
  });

  it('records the injured participant’s actual staging position for remote actions', () => {
    const before = started(), start = before.activeRun!.squadTasks.find(task => task.squadId === 'A')!;
    const state = choose(before, 'injure_remote');
    expect(Object.values(state.activeRun!.officerCasualties!)[0].position).toEqual({ spaceId: start.positionId, at: start.at });
    expect(evaluation(state, 'officer_aid').action.targetId).toBe(start.positionId);
  });

  it('keeps the committed injury position independent and rejects a relocated casualty on reload', () => {
    const state = choose(started(), 'injure');
    const casualty = Object.values(state.activeRun!.officerCasualties!)[0];
    const committed = decisionsOf(state.activeRun!.history)[0].committed!.officerCasualties![0];
    const position = structuredClone(committed.position);
    casualty.position!.at.x += 1;
    expect(committed.position).toEqual(position);
    expect(deserialize(serialize(state, NOW))).toBeNull();
  });

  it('routes the receiving crew to casualties and back without moving an all-injured command squad', () => {
    let state = choose(started(), 'injure'), run = state.activeRun!;
    const recorded = Object.values(run.officerCasualties!)[0];
    for (const officer of Object.values(state.officers)) run.officerCasualties![officer.id] = { ...recorded, officerId: officer.id };
    syncCasualtyFlags(run);
    expect(evaluation(state, 'officer_aid')).toMatchObject({ eligible: false });
    state = choose(state, 'request', ['B']); state = choose(state, 'wait', ['B']); run = state.activeRun!;
    const before = structuredClone(run.squadTasks), ev = evaluation(state, 'evacuate');
    expect(ev.eligible).toBe(true); expect(ev.travelMinutes).toBeGreaterThan(0);
    expect(ev.arrivals[0]).toMatchObject({ spaceId: before.find(task => task.squadId === 'B')!.positionId });
    const care = physicalCare(SCENARIOS[ID], builtFor(run.locationFamilyId, run.locationSeed, run.flags), run, SCENARIOS[ID].stages.assess.actions.find(action => action.id === 'evacuate')!);
    expect(care.crewRoutes).toHaveLength(2);
    expect(ev.travelMinutes).toBe(Math.round(care.crewRoutes.reduce((sum, route) => sum + route.minutes, 0) * 10) / 10);
    state = choose(state, 'evacuate', ['B']);
    expect(state.activeRun!.squadTasks.map(({ task: _task, ...position }) => position)).toEqual(before.map(({ task: _task, ...position }) => position));
    expect(Object.values(state.activeRun!.officerCasualties!).every(person => person.care === 'evacuated')).toBe(true);
  });

  it('blocks evacuation through sealed doors while preserving command request and wait', () => {
    let state = choose(started(), 'injure');
    const run = state.activeRun!, built = builtFor(run.locationFamilyId, run.locationSeed, []);
    run.flags.push(...built.location.openings.filter(opening => opening.a === 'bedroom_e' || opening.b === 'bedroom_e').map(opening => openingFlag(opening.id, 'blocked')));
    expect(evaluation(state, 'request').eligible).toBe(true);
    state = choose(state, 'request'); state = choose(state, 'wait');
    expect(evaluation(state, 'evacuate')).toMatchObject({ eligible: false, arrivals: [], uses: [] });
  });

  it('refuses care when an injury has no recorded position and never reconstructs one from old history', () => {
    const state = choose(started(), 'injure');
    const casualty = Object.values(state.activeRun!.officerCasualties!)[0]; delete casualty.position;
    expect(officerCarePosition(casualty)).toBeNull();
    const before = structuredClone(state);
    expect(evaluation(state, 'officer_aid').eligible).toBe(false);
    expect(state).toEqual(before);
  });

});
