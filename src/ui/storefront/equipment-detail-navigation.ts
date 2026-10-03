import type { Id } from '../../sim/types';

export const EQUIPMENT_DETAIL_HISTORY_KEY = 'tacticallyIdleEquipmentDetail';
type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;
interface NavigationCallbacks {
  owner: string;
  isActive: () => boolean;
  select: (itemId: Id | null) => void;
  returnFocus: () => void;
}

/** Local history ownership prevents a sheet from dismissing unrelated navigation. */
export function createEquipmentDetailNavigation(history: HistoryPort, callbacks: NavigationCallbacks) {
  let closing = false;
  let focusAfterPop = true;
  const ownedDetail = () => {
    const value = history.state?.[EQUIPMENT_DETAIL_HISTORY_KEY];
    return value?.owner === callbacks.owner && typeof value.itemId === 'string' ? value as { owner: string; itemId: Id } : null;
  };
  return {
    open(itemId: Id) {
      // Repeated taps cannot stack duplicate entries or race a pending Back.
      if (closing || ownedDetail()) return false;
      history.pushState({ ...history.state, [EQUIPMENT_DETAIL_HISTORY_KEY]: { owner: callbacks.owner, itemId } }, '');
      callbacks.select(itemId);
      return true;
    },
    close(returnFocus = true) {
      if (closing) return;
      callbacks.select(null);
      if (ownedDetail()) {
        closing = true;
        focusAfterPop = returnFocus;
        history.back();
      } else if (returnFocus && callbacks.isActive()) callbacks.returnFocus();
    },
    onPop() {
      closing = false;
      const detail = ownedDetail();
      if (detail && callbacks.isActive()) callbacks.select(detail.itemId);
      else {
        callbacks.select(null);
        if (focusAfterPop && callbacks.isActive()) callbacks.returnFocus();
      }
      focusAfterPop = true;
    },
    dispose() {
      if (ownedDetail()) {
        const next = { ...history.state };
        delete next[EQUIPMENT_DETAIL_HISTORY_KEY];
        history.replaceState(next, '');
      }
    },
  };
}
