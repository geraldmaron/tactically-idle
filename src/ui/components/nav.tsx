import { createContext, useContext, useEffect, useId, useReducer, useRef, useState } from 'react';
import type { CertId, Id } from '../../sim/types';
import { DEFAULT_EQUIPMENT_QUERY, type EquipmentQuery } from '../storefront/store-query';
import { INITIAL_SQUAD_VIEW, updateSquadView, type SquadView, type SquadViewAction } from './squad-view';

/** Five player destinations: City, Operations, Team, HQ and the Store. The HQ tab's route id is
 * `headquarters`. Older ids stay valid and resolve to the new tabs: `hq` (the old home screen) is the
 * City, `develop` is HQ on Build, and `gear` is HQ on Gear. */
export type Tab = 'city' | 'ops' | 'squad' | 'headquarters' | 'store' | 'hq' | 'develop' | 'gear';
export type TopTab = 'city' | 'ops' | 'squad' | 'headquarters' | 'store';
export const topTab = (tab: Tab): TopTab => tab === 'hq' ? 'city' : tab === 'develop' || tab === 'gear' ? 'headquarters' : tab;
/** HQ's section rail: Build (the station), Gear (the armory) and Training. */
export type HqSection = 'build' | 'gear' | 'training';
export type TeamSection = 'swat' | 'patrol' | 'command';
/** `equipment` moved to HQ (Gear); it stays a value so a stored route still parses. */
export type StoreSection = 'equipment' | 'boosts';
export type PatrolFocus = { kind: 'hire' } | { kind: 'training'; employeeId: Id } | null;
/** The SWAT sections within Team. */
export type SquadSection = 'squads' | 'roster' | 'hire' | 'training';
export interface TrainingFocus { officerId?: Id; certId?: CertId; courseId?: Id }
export interface PlayerRoute {
  tab: Tab;
  teamSection: TeamSection;
  storeSection: StoreSection;
  hqSection: HqSection;
  squadSection: SquadSection;
  patrolFocus: PatrolFocus;
  patrolRequest: number;
  equipmentItemId: Id | null;
  /** The officer whose profile is open (officer-profile), over whatever tab is showing. */
  officerId: Id | null;
  trainingFocus: TrainingFocus;
  trainingRequest: number;
  developmentNode?: Id;
  developmentRequest: number;
  returnToItem: Id | null;
}
export const INITIAL_PLAYER_ROUTE: PlayerRoute = {
  tab: 'city', teamSection: 'swat', storeSection: 'boosts', hqSection: 'build', squadSection: 'squads', patrolFocus: null, patrolRequest: 0, equipmentItemId: null, officerId: null,
  trainingFocus: {}, trainingRequest: 0, developmentRequest: 0, returnToItem: null,
};
export const PLAYER_NAV_HISTORY_KEY = 'tacticallyIdlePlayerRoute';
type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;

/** A route with its tab as one of the five and any older id turned into the section it meant. */
function settleRoute(route: PlayerRoute): PlayerRoute {
  const tab = topTab(route.tab);
  const hqSection: HqSection = route.tab === 'gear' ? 'gear' : route.tab === 'develop' ? 'build' : route.hqSection;
  return tab === route.tab && hqSection === route.hqSection ? route : { ...route, tab, hqSection };
}

/** History stores destinations; live form drafts stay outside history so Back never rolls them back. */
export function createPlayerNavigation(history: HistoryPort, owner: string, onRoute: (route: PlayerRoute) => void) {
  let route = { ...INITIAL_PLAYER_ROUTE };
  let closing = false;
  let pendingRoute: PlayerRoute | null = null;
  const owned = () => {
    const value = history.state?.[PLAYER_NAV_HISTORY_KEY];
    return value?.owner === owner ? value as { owner: string; route: PlayerRoute; detailBack?: boolean; officerBack?: boolean } : null;
  };
  const commit = (next: PlayerRoute, replace = false) => {
    if (closing) { pendingRoute = next; return; }
    next = settleRoute(next);
    if (JSON.stringify(next) === JSON.stringify(route)) return;
    const detailBack = !!next.equipmentItemId && !route.equipmentItemId && route.tab === 'headquarters' && route.hqSection === 'gear';
    const officerBack = !!next.officerId && next.officerId !== route.officerId && !replace;
    const value = { ...history.state, [PLAYER_NAV_HISTORY_KEY]: { owner, route: next, detailBack, officerBack } };
    if (replace) history.replaceState(value, ''); else history.pushState(value, '');
    route = next;
    onRoute(route);
  };
  return {
    initialize() {
      history.replaceState({ ...history.state, [PLAYER_NAV_HISTORY_KEY]: { owner, route } }, '');
    },
    getRoute: () => route,
    go(tab: Tab) { commit({ ...route, tab, patrolFocus: null, equipmentItemId: null, officerId: null, developmentNode: undefined, returnToItem: null }); },
    setTeamSection(teamSection: TeamSection) { commit({ ...route, tab: 'squad', teamSection, patrolFocus: null, equipmentItemId: null, officerId: null, returnToItem: null }); },
    setStoreSection(storeSection: StoreSection) { commit({ ...route, tab: 'store', storeSection, equipmentItemId: null, officerId: null, returnToItem: null }); },
    setHqSection(hqSection: HqSection) { commit({ ...route, tab: 'headquarters', hqSection, equipmentItemId: null, officerId: null, returnToItem: null }); },
    setSquadSection(squadSection: SquadSection) { commit({ ...route, tab: 'squad', teamSection: 'swat', squadSection, patrolFocus: null, equipmentItemId: null, officerId: null, returnToItem: null }); },
    openPatrol(patrolFocus: Exclude<PatrolFocus, null> = { kind: 'hire' }) {
      commit({ ...route, tab: 'squad', teamSection: 'patrol', patrolFocus, patrolRequest: route.patrolRequest + 1, equipmentItemId: null, officerId: null, returnToItem: null });
    },
    openEquipment(request?: { itemId?: Id }) {
      commit({ ...route, tab: 'headquarters', hqSection: 'gear', equipmentItemId: request?.itemId ?? null, officerId: null, returnToItem: null });
    },
    openOfficer(officerId: Id) { commit({ ...route, officerId }); },
    closeOfficer() {
      if (closing || !route.officerId) return;
      if (owned()?.officerBack) { closing = true; history.back(); }
      else commit({ ...route, officerId: null }, true);
    },
    closeEquipment() {
      if (closing || !route.equipmentItemId) return;
      if (owned()?.detailBack) { closing = true; history.back(); }
      else commit({ ...route, equipmentItemId: null }, true);
    },
    openTraining(focus: TrainingFocus = {}) {
      commit({ ...route, tab: 'headquarters', hqSection: 'training', officerId: null, trainingFocus: focus, trainingRequest: route.trainingRequest + 1,
        returnToItem: route.equipmentItemId ?? route.returnToItem, equipmentItemId: null });
    },
    openDevelopment(nodeId?: Id) {
      commit({ ...route, tab: 'headquarters', hqSection: 'build', developmentNode: nodeId, developmentRequest: route.developmentRequest + 1,
        returnToItem: route.equipmentItemId ?? route.returnToItem, equipmentItemId: null });
    },
    returnToEquipment() {
      if (!route.returnToItem) return;
      commit({ ...route, tab: 'headquarters', hqSection: 'gear', equipmentItemId: route.returnToItem, returnToItem: null });
    },
    onPop() {
      closing = false;
      const value = owned();
      if (!value) return;
      route = settleRoute({ ...INITIAL_PLAYER_ROUTE, ...value.route });
      onRoute(route);
      if (pendingRoute) { const next = pendingRoute; pendingRoute = null; commit(next); }
    },
    dispose() {
      if (!owned()) return;
      const next = { ...history.state };
      delete next[PLAYER_NAV_HISTORY_KEY];
      history.replaceState(next, '');
    },
  };
}

export interface TrainingDraft { officerId: Id; search: string; request?: number }
export interface NavApi extends PlayerRoute {
  go: (tab: Tab) => void;
  setTeamSection: (section: TeamSection) => void;
  setStoreSection: (section: StoreSection) => void;
  setHqSection: (section: HqSection) => void;
  setSquadSection: (section: SquadSection) => void;
  openPatrol: (focus?: Exclude<PatrolFocus, null>) => void;
  openEquipment: (request?: { itemId?: Id }) => void;
  closeEquipment: () => void;
  openOfficer: (officerId: Id) => void;
  closeOfficer: () => void;
  openTraining: (focus?: TrainingFocus) => void;
  openDevelopment: (nodeId?: Id) => void;
  returnToEquipment: () => void;
  equipmentQuery: EquipmentQuery;
  setEquipmentQuery: (query: EquipmentQuery) => void;
  equipmentQuantities: Record<Id, string>;
  setEquipmentQuantity: (itemId: Id, quantity: string) => void;
  trainingDraft: TrainingDraft;
  setTrainingDraft: (draft: TrainingDraft) => void;
  squadView: SquadView;
  updateSquadView: (action: SquadViewAction) => void;
}
const noop = () => {};
export const DEFAULT_NAV: NavApi = {
  ...INITIAL_PLAYER_ROUTE, go: noop, setTeamSection: noop, setStoreSection: noop, setHqSection: noop, setSquadSection: noop, openPatrol: noop, openEquipment: noop,
  closeEquipment: noop, openOfficer: noop, closeOfficer: noop, openTraining: noop, openDevelopment: noop, returnToEquipment: noop,
  equipmentQuery: DEFAULT_EQUIPMENT_QUERY, setEquipmentQuery: noop, equipmentQuantities: {}, setEquipmentQuantity: noop,
  trainingDraft: { officerId: '', search: '' }, setTrainingDraft: noop,
  squadView: INITIAL_SQUAD_VIEW, updateSquadView: noop,
};
export const NavContext = createContext<NavApi>(DEFAULT_NAV);
export const useNav = () => useContext(NavContext);

export function usePlayerNavigation(): NavApi {
  const owner = useId();
  const [route, setRoute] = useState<PlayerRoute>(INITIAL_PLAYER_ROUTE);
  const [equipmentQuery, setEquipmentQuery] = useState<EquipmentQuery>(DEFAULT_EQUIPMENT_QUERY);
  const [equipmentQuantities, setEquipmentQuantities] = useState<Record<Id, string>>({});
  const [trainingDraft, setTrainingDraft] = useState<TrainingDraft>({ officerId: '', search: '' });
  const [squadView, dispatchSquadView] = useReducer(updateSquadView, INITIAL_SQUAD_VIEW);
  const controller = useRef<ReturnType<typeof createPlayerNavigation> | null>(null);
  if (!controller.current && typeof window !== 'undefined') controller.current = createPlayerNavigation(window.history, owner, setRoute);
  useEffect(() => {
    const current = controller.current!;
    current.initialize();
    window.addEventListener('popstate', current.onPop);
    return () => { window.removeEventListener('popstate', current.onPop); current.dispose(); };
  }, []);
  return {
    ...DEFAULT_NAV, ...route, ...controller.current,
    equipmentQuery, setEquipmentQuery, equipmentQuantities,
    setEquipmentQuantity: (id, quantity) => setEquipmentQuantities((previous) => ({ ...previous, [id]: quantity })),
    trainingDraft, setTrainingDraft, squadView, updateSquadView: dispatchSquadView,
  };
}
