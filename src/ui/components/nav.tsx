import { createContext, useContext, useEffect, useId, useReducer, useRef, useState } from 'react';
import type { CertId, Id } from '../../sim/types';
import { DEFAULT_EQUIPMENT_QUERY, type EquipmentQuery } from '../storefront/store-query';
import { INITIAL_SQUAD_VIEW, updateSquadView, type SquadView, type SquadViewAction } from './squad-view';

/** Route ids. Four tabs show them (docs/ui-ux-audit.md, "Four destinations"): HQ, Calls (`ops`),
 * Officers (`squad`) and Build, whose two segments keep their own ids (`develop` is Upgrades,
 * `gear` the Armory), so `go('gear')` opens Build on the Armory. */
export type Tab = 'hq' | 'squad' | 'ops' | 'develop' | 'gear';
export type TopTab = 'hq' | 'ops' | 'squad' | 'build';
export const topTab = (tab: Tab): TopTab => tab === 'develop' || tab === 'gear' ? 'build' : tab;
/** The Officers segments. */
export type SquadSection = 'squads' | 'roster' | 'hire' | 'training';
export interface TrainingFocus { officerId?: Id; certId?: CertId; courseId?: Id }
export interface PlayerRoute {
  tab: Tab;
  squadSection: SquadSection;
  equipmentItemId: Id | null;
  /** The officer whose profile is open (officer-profile), over whatever tab is showing. */
  officerId: Id | null;
  trainingFocus: TrainingFocus;
  trainingRequest: number;
  developmentNode?: Id;
  developmentRequest: number;
  returnToItem: Id | null;
  /** The Build segment the Build tab returns to. */
  buildSegment: 'develop' | 'gear';
}
export const INITIAL_PLAYER_ROUTE: PlayerRoute = {
  tab: 'hq', squadSection: 'squads', buildSegment: 'develop', equipmentItemId: null, officerId: null,
  trainingFocus: {}, trainingRequest: 0, developmentRequest: 0, returnToItem: null,
};
export const PLAYER_NAV_HISTORY_KEY = 'tacticallyIdlePlayerRoute';
type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;

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
    if (next.tab === 'develop' || next.tab === 'gear') next = { ...next, buildSegment: next.tab };
    if (JSON.stringify(next) === JSON.stringify(route)) return;
    const detailBack = !!next.equipmentItemId && !route.equipmentItemId && route.tab === 'gear';
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
    go(tab: Tab) { commit({ ...route, tab, equipmentItemId: null, officerId: null, returnToItem: null }); },
    setSquadSection(squadSection: SquadSection) { commit({ ...route, tab: 'squad', squadSection, equipmentItemId: null, officerId: null, returnToItem: null }); },
    openEquipment(request?: { itemId?: Id }) {
      commit({ ...route, tab: 'gear', equipmentItemId: request?.itemId ?? null, officerId: null, returnToItem: null });
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
      commit({ ...route, tab: 'squad', squadSection: 'training', officerId: null, trainingFocus: focus, trainingRequest: route.trainingRequest + 1,
        returnToItem: route.equipmentItemId ?? route.returnToItem, equipmentItemId: null });
    },
    openDevelopment(nodeId?: Id) {
      commit({ ...route, tab: 'develop', developmentNode: nodeId, developmentRequest: route.developmentRequest + 1,
        returnToItem: route.equipmentItemId ?? route.returnToItem, equipmentItemId: null });
    },
    returnToEquipment() {
      if (!route.returnToItem) return;
      commit({ ...route, tab: 'gear', equipmentItemId: route.returnToItem, returnToItem: null });
    },
    onPop() {
      closing = false;
      const value = owned();
      if (!value) return;
      route = value.route;
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
  setSquadSection: (section: SquadSection) => void;
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
  ...INITIAL_PLAYER_ROUTE, go: noop, setSquadSection: noop, openEquipment: noop,
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
