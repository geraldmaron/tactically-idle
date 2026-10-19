// The live call's view model, shared by the game (OpsLive) and the Scenario Lab's frame so both
// show the same choices from the same chain. Pure: no store, no React.
import { actionViews, currentBuilt, previewAction, spaceViews, stageProgress } from '../../sim/operation-selectors';
import { planActionResupply } from '../../sim/equipment-resupply';
import type { ActionResupplyPlan } from '../../sim/equipment-resupply';
import { incidentOfficerUnavailable } from '../../sim/incident-consequences';
import { getScenario } from '../../sim/scenario-registry';
import { runRoster } from '../../sim/squads';
import type { ActionDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import type { ActionView, GameState, Id, OperationRun, SpaceView, Squad, SquadId, StageId } from '../../sim/types';
import { floorCount } from '../blueprint/floors';
import { cardFor } from './helpers';
import type { LiveViewProps } from './LiveView';

/** The player's choice list: OpsLive.tsx:76-77, one copy for the game and the lab. Each choice is
 * forecast for the focused squad alone, with no supporting squads. */
export function liveDecisions(g: GameState, now: number, focus: SquadId | null): ActionView[] {
  return actionViews(g, now, focus).map((action) => previewAction(g, now, action.id, focus ? [focus] : [], []) ?? action);
}

export interface ActionSelection { runId: Id; stage: StageId; actionId: Id }
export interface Override { actionId: Id; acting: SquadId[]; support: SquadId[] }
/** The live screen's own state. The four spec fields drive the choices; the optional rest only
 * restyle the screen and default to how it first opens. */
export interface LiveUiState {
  focusId: SquadId | null;
  selection: ActionSelection | null;
  override: Override | null;
  floor: number;
  /** The officer card the player tapped; null shows the officer the reviewed choice leans on. */
  activeOfficer?: Id | null;
  selectedSpaceId?: Id | null;
  lastChange?: { revision: number; spaceIds: Id[] } | null;
  showRooms?: boolean;
  detailsOpen?: boolean;
}

type LiveCallbacks = 'onFocusSquad' | 'onSelectAction' | 'onContinueStage' | 'onSelectOfficer' | 'onSelectSpace' | 'onFloorChange' | 'onToggleRooms' | 'onCancel' | 'onOpenDetails';
type LiveSlots = 'feedback' | 'supportContext' | 'situation' | 'lastDecision' | 'failedResponse' | 'children' | 'people';
/** Every LiveView prop that is data: everything but the callbacks, the slots and the people lexicon. */
export type LiveViewModel = Omit<LiveViewProps, LiveCallbacks | LiveSlots>;

/** What the review sheet and the screen's handlers read beside the props. */
export interface LiveReview {
  run: OperationRun;
  scenario: ScenarioDefinition | null;
  deployed: Squad[];
  focus: Squad | null;
  /** The reviewed choice for its chosen squads, or null. */
  view: ActionView | null;
  acting: SquadId[];
  support: SquadId[];
  actionRule: ActionDefinition | undefined;
  maxActing: number;
  resupply: ActionResupplyPlan | null;
  alternatives: ActionView[];
  targetLabel: string | null;
  /** The floor the reviewed choice's target is on, or null. */
  targetFloor: number | null;
  floors: number;
  spaceById: Map<Id, SpaceView>;
  availableMembers(id: SquadId): Id[];
  actorUnavailable(id: SquadId): boolean;
  floorOf(id: Id | null): number | null;
}

/** The selector block of OpsLive, computed once: the LiveView props and the review beside them.
 * Null when the state has no live call on a known building. */
export function liveScreen(g: GameState, now: number, ui: LiveUiState): { model: LiveViewModel; review: LiveReview } | null {
  const run = g.activeRun;
  const built = currentBuilt(g);
  if (!run || !built) return null;
  const deployed = g.squads.filter((s) => run.squadIds.includes(s.id));
  const focus = deployed.find((s) => s.id === ui.focusId) ?? deployed[0] ?? null;
  const spaces = spaceViews(g);
  const progress = stageProgress(g);
  // Forecast the visibly focused squad without assigning supporting squads.
  // A decision remains unselected until the player opens it for review.
  const actions = liveDecisions(g, now, focus?.id ?? null);
  const selectedId = ui.selection?.runId === run.id && ui.selection.stage === run.stage ? ui.selection.actionId : null;
  const base = actions.find((a) => a.id === selectedId) ?? null;
  const ov = ui.override && base && ui.override.actionId === base.id ? ui.override : null;
  const view = base && ov ? (previewAction(g, now, base.id, ov.acting, ov.support) ?? base) : base;
  const acting = ov?.acting ?? view?.actingSquadIds ?? [];
  const support = ov?.support ?? view?.supportSquadIds ?? [];
  const resupply = view && !view.eligible ? planActionResupply(g, now, view.id, acting, support) : null;
  const alternatives = view && !view.eligible ? deployed
    .filter((s) => !acting.includes(s.id))
    .map((s) => previewAction(g, now, view.id, [s.id], support.filter((id) => id !== s.id)))
    .filter((a): a is NonNullable<typeof a> => !!a?.eligible) : [];

  // Who went, not who is in the squad now: officers can join a deployed squad mid-call (run-roster).
  const officers = focus ? runRoster(g, run, focus.id).map((id) => g.officers[id]).filter((o) => !!o) : [];
  // No officer is highlighted by default: no decision asks the player to pick one. Tapping an
  // officer while reviewing a decision shows what they add to it.
  const activeOfficerId = view && ui.activeOfficer && officers.some((o) => o.id === ui.activeOfficer) ? ui.activeOfficer : null;

  const card = cardFor(g, run.scenarioId, now);
  const scenario = getScenario(run.scenarioId);
  const actionRule = run.stage === 'debrief' ? undefined : scenario?.stages[run.stage].actions.find(action => action.id === view?.id);
  const maxActing = actionRule?.maxActing ?? 1;
  const availableMembers = (id: SquadId) => deployed.some(squad => squad.id === id) ? runRoster(g, run, id).filter(officerId => !!g.officers[officerId] && !incidentOfficerUnavailable(g, run, officerId)) : [];
  const actorUnavailable = (id: SquadId) => !actionRule?.commandOnly && availableMembers(id).length === 0;
  const floors = floorCount(built.location);
  /** Floor a room or zone sits on (exterior zones are ground). */
  const floorOf = (id: Id | null): number | null => {
    if (!id) return null;
    return built.derived.spaces[id]?.floor ?? built.location.rooms.find((r) => r.id === id)?.floor ?? 0;
  };
  const title = (card?.title ?? built.location.name ?? run.scenarioId.replace(/_/g, ' ')).toUpperCase();
  const subtitle = `${(card?.setting ?? built.location.setting ?? '').toUpperCase()} / ${card?.code ?? 'OP'}`;
  const spaceById = new Map(spaces.map((s) => [s.id, s]));
  const targetLabel = view?.targetId ? (spaceById.get(view.targetId)?.label ?? built.location.rooms.find((r) => r.id === view.targetId)?.label ?? null) : null;

  const model: LiveViewModel = {
    g, now, title, subtitle, progress, built, spaces, squadTasks: run.squadTasks, deployedSquads: deployed,
    focusSquadId: focus?.id ?? null,
    unavailableSquadIds: view ? deployed.filter(squad => actorUnavailable(squad.id)).map(squad => squad.id) : [],
    officers, actions, selectedAction: view, activeOfficerId,
    selectedSpaceId: ui.selectedSpaceId ?? null,
    highlightSpaceIds: view?.targetId ? [view.targetId] : [],
    floor: Math.min(ui.floor, Math.max(0, floors - 1)),
    environment: scenario?.environment ?? null,
    lastChange: ui.lastChange ?? null,
    showRooms: ui.showRooms ?? false,
    clock: run.clock, pressure: run.pressure,
    canCancel: run.history.length === 0 && !run.resupplies?.length,
    detailsOpen: ui.detailsOpen ?? false,
  };
  const review: LiveReview = {
    run, scenario, deployed, focus, view, acting, support, actionRule, maxActing, resupply, alternatives, targetLabel,
    targetFloor: floorOf(view?.targetId ?? null), floors, spaceById, availableMembers, actorUnavailable, floorOf,
  };
  return { model, review };
}

/** The LiveView props for a state with a live call (OpsLive.tsx's selector block as one pure
 * function). Throws when the state has no live call. */
export function liveViewModel(g: GameState, now: number, ui: LiveUiState): LiveViewModel {
  const screen = liveScreen(g, now, ui);
  if (!screen) throw new Error('No live call in this state.');
  return screen.model;
}
