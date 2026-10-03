import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import type { CertId, Id } from '../../sim/types';
import { DEFAULT_EQUIPMENT_QUERY, type EquipmentQuery } from '../storefront/store-query';

export type Tab = 'hq' | 'squad' | 'ops' | 'develop' | 'gear';
export type GearSection = 'inventory' | 'equipment';
export type SquadSection = 'roster' | 'training';
export interface TrainingFocus { officerId?: Id; certId?: CertId; courseId?: Id }
export interface PlayerRoute {
  tab: Tab;
  gearSection: GearSection;
  squadSection: SquadSection;
  equipmentItemId: Id | null;
  trainingFocus: TrainingFocus;
  trainingRequest: number;
  developmentNode?: Id;
  developmentRequest: number;
  returnToItem: Id | null;
}
export const INITIAL_PLAYER_ROUTE: PlayerRoute = {
  tab: 'hq', gearSection: 'inventory', squadSection: 'roster', equipmentItemId: null,
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
    return value?.owner === owner ? value as { owner: string; route: PlayerRoute; detailBack?: boolean } : null;
  };
  const commit = (next: PlayerRoute, replace = false) => {
    if (closing) { pendingRoute = next; return; }
    if (JSON.stringify(next) === JSON.stringify(route)) return;
    const detailBack = !!next.equipmentItemId && !route.equipmentItemId && route.tab === 'gear' && route.gearSection === 'equipment';
    const value = { ...history.state, [PLAYER_NAV_HISTORY_KEY]: { owner, route: next, detailBack } };
    if (replace) history.replaceState(value, ''); else history.pushState(value, '');
    route = next;
    onRoute(route);
  };
  return {
    initialize() {
      history.replaceState({ ...history.state, [PLAYER_NAV_HISTORY_KEY]: { owner, route } }, '');
    },
    getRoute: () => route,
    go(tab: Tab) { commit({ ...route, tab, equipmentItemId: null, returnToItem: null }); },
    setGearSection(gearSection: GearSection) { commit({ ...route, tab: 'gear', gearSection, equipmentItemId: null, returnToItem: null }); },
    setSquadSection(squadSection: SquadSection) { commit({ ...route, tab: 'squad', squadSection, equipmentItemId: null, returnToItem: null }); },
    openEquipment(request?: { itemId?: Id }) {
      commit({ ...route, tab: 'gear', gearSection: 'equipment', equipmentItemId: request?.itemId ?? null, returnToItem: null });
    },
    closeEquipment() {
      if (closing || !route.equipmentItemId) return;
      if (owned()?.detailBack) { closing = true; history.back(); }
      else commit({ ...route, equipmentItemId: null }, true);
    },
    openTraining(focus: TrainingFocus = {}) {
      commit({ ...route, tab: 'squad', squadSection: 'training', trainingFocus: focus, trainingRequest: route.trainingRequest + 1,
        returnToItem: route.equipmentItemId ?? route.returnToItem, equipmentItemId: null });
    },
    openDevelopment(nodeId?: Id) {
      commit({ ...route, tab: 'develop', developmentNode: nodeId, developmentRequest: route.developmentRequest + 1,
        returnToItem: route.equipmentItemId ?? route.returnToItem, equipmentItemId: null });
    },
    returnToEquipment() {
      if (!route.returnToItem) return;
      commit({ ...route, tab: 'gear', gearSection: 'equipment', equipmentItemId: route.returnToItem, returnToItem: null });
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
  setGearSection: (section: GearSection) => void;
  setSquadSection: (section: SquadSection) => void;
  openEquipment: (request?: { itemId?: Id }) => void;
  closeEquipment: () => void;
  openTraining: (focus?: TrainingFocus) => void;
  openDevelopment: (nodeId?: Id) => void;
  returnToEquipment: () => void;
  equipmentQuery: EquipmentQuery;
  setEquipmentQuery: (query: EquipmentQuery) => void;
  equipmentQuantities: Record<Id, string>;
  setEquipmentQuantity: (itemId: Id, quantity: string) => void;
  trainingDraft: TrainingDraft;
  setTrainingDraft: (draft: TrainingDraft) => void;
}
const noop = () => {};
export const DEFAULT_NAV: NavApi = {
  ...INITIAL_PLAYER_ROUTE, go: noop, setGearSection: noop, setSquadSection: noop, openEquipment: noop,
  closeEquipment: noop, openTraining: noop, openDevelopment: noop, returnToEquipment: noop,
  equipmentQuery: DEFAULT_EQUIPMENT_QUERY, setEquipmentQuery: noop, equipmentQuantities: {}, setEquipmentQuantity: noop,
  trainingDraft: { officerId: '', search: '' }, setTrainingDraft: noop,
};
export const NavContext = createContext<NavApi>(DEFAULT_NAV);
export const useNav = () => useContext(NavContext);

export function usePlayerNavigation(): NavApi {
  const owner = useId();
  const [route, setRoute] = useState<PlayerRoute>(INITIAL_PLAYER_ROUTE);
  const [equipmentQuery, setEquipmentQuery] = useState<EquipmentQuery>(DEFAULT_EQUIPMENT_QUERY);
  const [equipmentQuantities, setEquipmentQuantities] = useState<Record<Id, string>>({});
  const [trainingDraft, setTrainingDraft] = useState<TrainingDraft>({ officerId: '', search: '' });
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
    trainingDraft, setTrainingDraft,
  };
}
