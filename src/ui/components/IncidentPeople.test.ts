import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebriefResult, OfficerCasualtyRecord } from '../../sim/types';
import { getScenario } from '../../sim/scenario-registry';
import { actionViews, briefing, currentBuilt, spaceViews, stageProgress } from '../../sim/operation-selectors';
import { highRiskAllowed } from '../../sim/officer';
import { makeState, NOW, startRun, testCallId, withCallOnBoard } from '../../sim/test-fixtures';
import { DebriefSummary, OfficerResults } from './DebriefResults';
import { CivilianOutcomeList, IncidentPeopleStatus, OfficerInjuryResult, PersonCasualtyList } from './IncidentPeople';
import { LiveView } from '../screens/LiveView';

let state = makeState();
vi.mock('../store', () => ({ useGame: () => state }));
const noop = () => {};
const WELFARE = testCallId('welfareV4');
const casualty = (officerId = 'off_chen'): OfficerCasualtyRecord => ({ officerId, severity: 'wounded', label: 'Shoulder wound', at: 9, care: 'needed', recoveryUntil: NOW + 2 * 60 * 60 * 1000 });
const result = (): DebriefResult => ({
  runId: 'saved_injury', scenarioId: 'ms_occupancy', endingId: 'partial', endingTitle: 'Partial protection',
  disposition: 'relief_partial', completionAchieved: false, remainingTasks: ['Finish the medical transfer.'],
  objective: { score: 100, label: 'Resolved' }, civilianSafety: { score: 100, label: 'Everyone safe' },
  officerCondition: [{ officerId: 'off_chen', stressBefore: 12, stressAfter: 12, xpGained: 0 }],
  informationPreserved: [], resources: [], unitWear: [], trustDelta: 0, fundingReward: 0, devPointReward: 0, causes: [],
});
beforeEach(() => { state = makeState(); });

describe('individual civilian and officer outcomes', () => {
  it('renders each named civilian independently instead of deriving safety from the global score', () => {
    const debrief = { ...result(), civilianOutcomes: [{ id: 'resident', label: 'Resident', status: 'injured_needs_care' as const }, { id: 'worker', label: 'Staff member', status: 'safe' as const }] };
    const html = renderToStaticMarkup(createElement(DebriefSummary, { debrief }));
    expect(html).toContain('Resident');
    expect(html).toContain('Injured · needs care');
    expect(html).toContain('Staff member');
    expect(html).toContain('>Safe<');
    expect(html).not.toContain('Everyone safe');
    expect(html).not.toContain('100/100');
  });

  it('distinguishes unknown whereabouts and a verified absence from accepted care', () => {
    const html = renderToStaticMarkup(createElement(CivilianOutcomeList, { outcomes: [
      { id: 'one', label: 'First occupant', status: 'unaccounted' },
      { id: 'two', label: 'Second occupant', status: 'accounted_elsewhere' },
      { id: 'three', label: 'Third occupant', status: 'care_accepted' },
    ] }));
    expect(html).toContain('Not yet located');
    expect(html).toContain('Accounted for elsewhere');
    expect(html).toContain('Care accepted');
    expect(html).not.toContain('>Safe<');
  });

  it('tallies located people and draws one status segment per tracked person on the live panel', () => {
    state = startRun(makeState(), 'ms_occupancy', ['A']);
    const scenario = structuredClone(getScenario('ms_occupancy')!);
    const person = (id: string, label: string) => ({ id, label, factId: `f_${id}`, safeFlag: `${id}_safe`, injuredFlag: `${id}_hurt`, careFlag: `${id}_care` });
    scenario.civilianOutcomes = [person('sahan', 'Sahan Pham'), person('hana', 'Hana Kovač'), person('ivo', 'Ivo Ruiz')];
    const run = { ...state.activeRun!, flags: ['sahan_safe', 'hana_hurt'] };
    const html = renderToStaticMarkup(createElement(IncidentPeopleStatus, { scenario, run, state }));
    expect(html).toContain('<strong>2</strong> of 3 located');
    expect(html).toContain('1 needs help');
    expect(html.match(/<i data-tone="(\w+)"/g)).toEqual(['<i data-tone="ok"', '<i data-tone="warn"', '<i data-tone="pending"']);
    expect(html).toContain('>SP<');
    expect(html).toContain('>Not yet located<');
  });

  it('keeps a stabilized officer out of action on the live status', () => {
    state = startRun(withCallOnBoard(state, WELFARE), WELFARE, ['A']);
    const record = { ...casualty(), care: 'stabilized' as const };
    state.activeRun!.officerCasualties = { off_chen: record };
    const html = renderToStaticMarkup(createElement(IncidentPeopleStatus, { scenario: getScenario(state.activeRun!.scenarioId)!, run: state.activeRun!, state }));
    expect(html).toContain(`${state.officers.off_chen.firstName} Chen · out of action`);
    expect(html).toContain('Shoulder wound · Stabilized');
  });

  it('shows injury and the saved recovery schedule even if stress and XP did not change', () => {
    const debrief = { ...result(), officerCasualties: [casualty()] };
    const html = renderToStaticMarkup(createElement(OfficerResults, { debrief, officers: state.officers }));
    expect(html).toContain('Shoulder wound');
    expect(html).toContain('Needs care · out of action from 9 min');
    expect(html).toContain(`dateTime="${new Date(casualty().recoveryUntil).toISOString()}"`);
    expect(html).toContain('Recovery scheduled until');
    expect(html).toContain('Stress unchanged');
    expect(html).not.toContain('officer · unchanged');
  });

  it('keeps archived injury results independent of the officer’s current injury or recovery', () => {
    const debrief = { ...result(), officerCasualties: [casualty()] };
    const before = renderToStaticMarkup(createElement(OfficerResults, { debrief, officers: state.officers }));
    state.officers.off_chen.injury = { label: 'Later ankle injury', until: NOW + 20 * 60 * 60 * 1000 };
    expect(renderToStaticMarkup(createElement(OfficerResults, { debrief, officers: state.officers }))).toBe(before);
    const severe = renderToStaticMarkup(createElement(OfficerInjuryResult, { casualty: { ...casualty(), severity: 'serious', recoveryUntil: NOW + 8 * 60 * 60 * 1000 } }));
    expect(severe).toContain('Serious injury · Shoulder wound');
    expect(severe).toContain(new Date(NOW + 8 * 60 * 60 * 1000).toISOString());
  });

  it('does not describe an evacuated officer as fit or taking part on the live portrait strip', () => {
    const entry = briefing(WELFARE).entries[0].id;
    state = startRun(withCallOnBoard(state, WELFARE), WELFARE, ['A', 'B'], { positions: { A: entry, B: entry } });
    const record = { ...casualty(), care: 'evacuated' as const };
    state.activeRun!.officerCasualties = { off_chen: record };
    const focus = state.squads.find((squad) => squad.id === 'A')!;
    const actions = actionViews(state, NOW, 'A');
    const fit = focus.officerIds.filter((id) => id !== 'off_chen' && highRiskAllowed(state.officers[id])).length;
    const html = renderToStaticMarkup(createElement(LiveView, {
      g: state, now: NOW, title: 'Test rescue', subtitle: 'TEST',
      progress: stageProgress(state), built: currentBuilt(state)!, spaces: spaceViews(state), squadTasks: state.activeRun!.squadTasks,
      deployedSquads: state.squads.filter((squad) => ['A', 'B'].includes(squad.id)), focusSquadId: 'A', onFocusSquad: noop,
      officers: focus.officerIds.map((id) => state.officers[id]), actions, selectedAction: actions[0], onSelectAction: noop,
      activeOfficerId: 'off_chen', onSelectOfficer: noop, selectedSpaceId: null, onSelectSpace: noop, highlightSpaceIds: [],
      floor: 0, onFloorChange: noop, environment: null, lastChange: null, showRooms: true, onToggleRooms: noop,
      clock: 9, pressure: 20, canCancel: false, onCancel: noop, onOpenDetails: noop, detailsOpen: false,
    }));
    expect(html).toContain(`Squad A, ${focus.name}, ${fit} of ${focus.officerIds.length} fit`);
    expect(html).toContain('injured: Shoulder wound, out of action');
    expect(html).toContain('>Out of action<');
  });
});

it('renders death from its recorded status without interpreting it as accepted care', () => {
  const html = renderToStaticMarkup(createElement(CivilianOutcomeList, { outcomes: [{ id: 'resident', label: 'Resident', status: 'deceased' }] }));
  expect(html).toContain('Deceased');
  expect(html).not.toContain('Care accepted');
  expect(html).not.toContain('>Safe<');
});


it('keeps a recorded death terminal in the person casualty display even with a stale accepted-care field', () => {
  const html = renderToStaticMarkup(createElement(PersonCasualtyList, { casualties: [{ personId: 'mara', personRole: 'subject', label: 'Mara Bell', severity: 'fatal', at: 8, care: 'accepted', causeRevision: 2 }] }));
  expect(html).toContain('Mara Bell');
  expect(html).toContain('data-person-status="deceased"');
  expect(html).toContain('Deceased');
  expect(html).not.toContain('Care accepted');
});

it('records accepted care without presenting an injured person as uninjured', () => {
  const html = renderToStaticMarkup(createElement(PersonCasualtyList, { casualties: [{ personId: 'mara', personRole: 'subject', label: 'Mara Bell', severity: 'serious', at: 8, care: 'accepted', causeRevision: 2 }] }));
  expect(html).toContain('data-person-status="care_accepted"');
  expect(html).toContain('Serious injury · Care accepted');
  expect(html).not.toContain('>Safe<');
});

it('shows a casualty outside authored civilian outcomes regardless of the casualty role', () => {
  state = startRun(withCallOnBoard(state, WELFARE), WELFARE, ['A']);
  state.activeRun!.personCasualties = { visitor: { personId: 'visitor', personRole: 'civilian', label: 'Visitor', severity: 'wounded', at: 8, care: 'needed', causeRevision: 2 } };
  const html = renderToStaticMarkup(createElement(IncidentPeopleStatus, { scenario: getScenario(state.activeRun!.scenarioId)!, run: state.activeRun!, state }));
  expect(html).toContain('data-person-casualty="visitor"');
  expect(html).toContain('Wounded · Needs care');
});
