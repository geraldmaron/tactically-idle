import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Command, HandlerResult } from '../../sim/types';
import { send } from '../store';
import { ToastView } from './ToastView';
import type { ToastItem, ToastTone } from './ToastView';

export type { ToastTone };

interface ToastApi {
  notify: (title: string, opts?: { tone?: ToastTone; lines?: string[]; onSelect?: () => void }) => void;
  /** Send a command; a refusal shows its reason in a toast. */
  act: (cmd: Command, okMessage?: string) => HandlerResult;
}

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const notify = useCallback<ToastApi['notify']>((title, opts) => {
    const id = idRef.current++;
    // Latest only, above the bottom navigation: stacked or top toasts bury the mission header and blueprint.
    setItems([{ id, tone: opts?.tone ?? 'info', title, lines: opts?.lines ?? [], onSelect: opts?.onSelect }]);
  }, []);

  const act = useCallback<ToastApi['act']>(
    (cmd, okMessage) => {
      const res = send(cmd);
      if (!res.ok) notify(res.reason, { tone: 'error' });
      else if (okMessage) notify(okMessage, { tone: 'ok' });
      return res;
    },
    [notify],
  );

  const api = useMemo(() => ({ notify, act }), [notify, act]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDone={dismiss} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
