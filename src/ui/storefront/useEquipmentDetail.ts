import { useEffect, useRef } from 'react';
import type { Id } from '../../sim/types';
import { useNav } from '../components/nav';

/** Equipment and its prerequisite destinations share one history and persistent drafts. */
export function useEquipmentDetail(active: boolean) {
  const nav = useNav();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const previous = useRef(nav.equipmentItemId);
  useEffect(() => {
    if (previous.current && !nav.equipmentItemId && active) {
      const frame = requestAnimationFrame(() => {
        if (trigger.current?.isConnected && trigger.current.getClientRects().length) trigger.current.focus();
        else document.querySelector<HTMLInputElement>('.store-search input')?.focus();
      });
      previous.current = nav.equipmentItemId;
      return () => cancelAnimationFrame(frame);
    }
    previous.current = nav.equipmentItemId;
  }, [nav.equipmentItemId, active]);
  return {
    detailId: nav.equipmentItemId,
    open(itemId: Id, button?: HTMLButtonElement) {
      trigger.current = button ?? null;
      nav.openEquipment({ itemId });
    },
    close: (_returnFocus = true) => nav.closeEquipment(),
  };
}
