// The live view model is OpsLive's selector block moved, not rewritten: on real calls and every
// kind of review state, liveDecisions equals the old inline chain and liveViewModel equals the props
// OpsLive computed before the extraction (a frozen copy below).
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { planActionResupply } from '../../sim/equipment-resupply';
import { incidentOfficerUnavailable } from '../../sim/incident-consequences';
import { actionViews, currentBuilt, previewAction, spaceViews, stageProgress } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { apply, makeState, NOW, setRun, startRun, startWithKit } from '../../sim/test-fixtures';
import type { GameState, Id, SquadId } from '../../sim/types';
import { floorCount } from '../blueprint/floors';
import { cardFor } from './helpers';
import { liveDecisions, liveScreen, liveViewModel, type LiveUiState } from './live-model';

// ---------------------------------------------------------------- frozen reference
// OpsLive.tsx:66-117 and the props it passed to LiveView, as they were before the extraction
// (2026-10-08). Do not edit: it is the baseline the model must reproduce.
function referenceProps(g: GameState, now: number, ui: LiveUiState) {
  const run = g.activeRun!;
  const { focusId, selection, override, floor } = ui;
  const activeOfficer = ui.activeOfficer ?? null;
  const built = currentBuilt(g);
  const deployed = g.squads.filter((s) => run.squadIds.includes(s.id));
  const focus = deployed.find((s) => s.id === focusId) ?? deployed[0] ?? null;
  const spaces = spaceViews(g);
  const progress = stageProgress(g);
  const actions = actionViews(g, now, focus?.id ?? null).map((action) =>
    previewAction(g, now, action.id, focus ? [focus.id] : [], []) ?? action);
  const selectedId = selection?.runId === run.id && selection.stage === run.stage ? selection.actionId : null;
  const base = actions.find((a) => a.id === selectedId) ?? null;
  const ov = override && base && override.actionId === base.id ? override : null;
  const view = base && ov ? (previewAction(g, now, base.id, ov.acting, ov.support) ?? base) : base;
  const acting = ov?.acting ?? view?.actingSquadIds ?? [];
  const support = ov?.support ?? view?.supportSquadIds ?? [];
  const resupply = view && !view.eligible ? planActionResupply(g, now, view.id, acting, support) : null;
  const alternatives = view && !view.eligible ? deployed
    .filter((s) => !acting.includes(s.id))
    .map((s) => previewAction(g, now, view.id, [s.id], support.filter((id) => id !== s.id)))
    .filter((a): a is NonNullable<typeof a> => !!a?.eligible) : [];
  const officers = focus ? focus.officerIds.map((id) => g.officers[id]).filter((o) => !!o) : [];
  const activeOfficerId = view && activeOfficer && officers.some((o) => o.id === activeOfficer) ? activeOfficer : null;
  const card = cardFor(g, run.scenarioId, now);
  const scenario = getScenario(run.scenarioId);
  const actionRule = run.stage === 'debrief' ? undefined : scenario?.stages[run.stage].actions.find(action => action.id === view?.id);
  const availableMembers = (id: SquadId) => deployed.find(squad => squad.id === id)?.officerIds.filter(officerId => !!g.officers[officerId] && !incidentOfficerUnavailable(g, run, officerId)) ?? [];
  const actorUnavailable = (id: SquadId) => !actionRule?.commandOnly && availableMembers(id).length === 0;
  const environment = scenario?.environment ?? null;
  const floors = built ? floorCount(built.location) : 1;
  const title = (card?.title ?? built?.location.name ?? run.scenarioId.replace(/_/g, ' ')).toUpperCase();
  const subtitle = `${(card?.setting ?? built?.location.setting ?? '').toUpperCase()} / ${card?.code ?? 'OP'}`;
  return {
    props: {
      g, now, title, subtitle, progress, built, spaces, squadTasks: run.squadTasks, deployedSquads: deployed, focusSquadId: focus?.id ?? null,
      unavailableSquadIds: view ? deployed.filter(squad => actorUnavailable(squad.id)).map(squad => squad.id) : [],
      officers, actions, selectedAction: view, activeOfficerId, selectedSpaceId: ui.selectedSpaceId ?? null,
      floor: Math.min(floor, Math.max(0, floors - 1)), environment, highlightSpaceIds: view?.targetId ? [view.targetId] : [],
      lastChange: ui.lastChange ?? null, showRooms: ui.showRooms ?? false, clock: run.clock, pressure: run.pressure,
      canCancel: run.history.length === 0 && !run.resupplies?.length, detailsOpen: ui.detailsOpen ?? false,
    },
    review: { acting, support, resupply, alternatives, maxActing: actionRule?.maxActing ?? 1 },
  };
}

const HOSTAGE = 'gen:hostage_crisis:market_row:3035903061:1492309763:1:13';
const idle = (): LiveUiState => ({ focusId: null, selection: null, override: null, floor: 0 });
const reviewing = (g: GameState, actionId: Id, acting: SquadId[], support: SquadId[] = []): LiveUiState => ({
  focusId: acting[0] ?? null, selection: { runId: g.activeRun!.id, stage: g.activeRun!.stage as never, actionId }, override: { actionId, acting, support }, floor: 3,
  activeOfficer: 'nobody', selectedSpaceId: 'front_yard', lastChange: { revision: 1, spaceIds: ['front_yard'] }, showRooms: true, detailsOpen: true,
});

function expectSame(g: GameState, ui: LiveUiState) {
  const reference = referenceProps(g, NOW, ui);
  expect(liveViewModel(g, NOW, ui)).toEqual(reference.props);
  const screen = liveScreen(g, NOW, ui)!;
  expect({ acting: screen.review.acting, support: screen.review.support, resupply: screen.review.resupply, alternatives: screen.review.alternatives, maxActing: screen.review.maxActing }).toEqual(reference.review);
}

describe('live view model', () => {
  const hostage = startGateRun(HOSTAGE);

  it('lists the choices the old inline chain did, for the focused squad and for none', () => {
    for (const focus of ['A', null] as const) {
      const old = actionViews(hostage, NOW, focus).map((action) => previewAction(hostage, NOW, action.id, focus ? [focus] : [], []) ?? action);
      expect(liveDecisions(hostage, NOW, focus)).toEqual(old);
    }
    expect(liveDecisions(hostage, NOW, 'A').length).toBeGreaterThan(0);
  });

  it('gives the props OpsLive computed: idle, reviewing each choice, and after a decision', () => {
    expectSame(hostage, idle());
    for (const action of liveDecisions(hostage, NOW, 'A')) expectSame(hostage, reviewing(hostage, action.id, ['A']));
    const first = liveDecisions(hostage, NOW, 'A').find(action => action.eligible)!;
    const next = apply(hostage, { type: 'decide', actionId: first.id, actingSquadIds: ['A'], supportSquadIds: [] }).state;
    expect(next.activeRun!.history).toHaveLength(1);
    expectSame(next, idle());
    for (const action of liveDecisions(next, NOW, 'A')) expectSame(next, reviewing(next, action.id, ['A']));
  });

  it('highlights no officer unless the player taps one while reviewing a decision', () => {
    const officerId = hostage.squads[0].officerIds[0];
    expect(liveViewModel(hostage, NOW, idle()).activeOfficerId).toBeNull();
    expect(liveViewModel(hostage, NOW, { ...idle(), activeOfficer: officerId }).activeOfficerId).toBeNull();
    const action = liveDecisions(hostage, NOW, 'A')[0];
    const review = { ...reviewing(hostage, action.id, ['A']), activeOfficer: null };
    expect(liveViewModel(hostage, NOW, review).activeOfficerId).toBeNull();
    expect(liveViewModel(hostage, NOW, { ...review, activeOfficer: officerId }).activeOfficerId).toBe(officerId);
  });

  it('matches with two squads, a switched actor, support and a locked choice', () => {
    const two = startWithKit(makeState({ squadC: true }), 'ms_occupancy', ['A', 'B']);
    expectSame(two, idle());
    for (const action of liveDecisions(two, NOW, 'A')) {
      expectSame(two, reviewing(two, action.id, ['B']));
      expectSame(two, reviewing(two, action.id, ['A'], ['B']));
    }
    // An unequipped squad leaves choices locked: resupply and alternatives are part of the review.
    const bare = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B'], { loadouts: { A: {}, B: {} } }), { stage: 'resolve' });
    const locked = liveDecisions(bare, NOW, 'A').filter(action => !action.eligible);
    expect(locked.length).toBeGreaterThan(0);
    for (const action of locked) expectSame(bare, reviewing(bare, action.id, ['A'], ['B']));
    expect(locked.some(action => liveScreen(bare, NOW, reviewing(bare, action.id, ['A'], ['B']))!.review.resupply)).toBe(true);
  });

  it('ignores a selection from another stage or run, and refuses a state with no live call', () => {
    const stale = { ...reviewing(hostage, liveDecisions(hostage, NOW, 'A')[0].id, ['A']), selection: { runId: 'old_run', stage: 'assess' as const, actionId: 'x' } };
    expect(liveViewModel(hostage, NOW, stale).selectedAction).toBeNull();
    expectSame(hostage, stale);
    expect(liveScreen(makeState(), NOW, idle())).toBeNull();
    expect(() => liveViewModel(makeState(), NOW, idle())).toThrow('No live call');
  });
});
