import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Id } from '../../sim/types';
import { createEquipmentDetailNavigation } from './equipment-detail-navigation';

/** A detail is a reversible local navigation step; browser Back preserves the query. */
export function useEquipmentDetail(active: boolean) {
  const [detailId, setDetailId] = useState<Id | null>(null);
  const owner = useId();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      if (!activeRef.current) return;
      if (trigger.current?.isConnected && trigger.current.getClientRects().length) trigger.current.focus();
      else document.querySelector<HTMLInputElement>('.store-search input')?.focus();
    });
  }, []);
  const navigation = useRef<ReturnType<typeof createEquipmentDetailNavigation> | null>(null);
  if (!navigation.current) navigation.current = createEquipmentDetailNavigation(window.history, {
    owner, isActive: () => activeRef.current, select: setDetailId, returnFocus: restoreFocus,
  });
  useEffect(() => {
    const current = navigation.current!;
    window.addEventListener('popstate', current.onPop);
    return () => {
      window.removeEventListener('popstate', current.onPop);
      current.dispose();
    };
  }, []);
  const open = (itemId: Id, button: HTMLButtonElement) => {
    if (navigation.current!.open(itemId)) trigger.current = button;
  };
  const close = (returnFocus = true) => navigation.current!.close(returnFocus);
  return { detailId, open, close };
}
