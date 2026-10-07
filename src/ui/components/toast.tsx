import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Command, HandlerResult } from '../../sim/types';
import { send } from '../store';
import { Icon } from '../icons';

export type ToastTone = 'info' | 'ok' | 'error' | 'amber';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  lines: string[];
  /** Tapping the toast runs this before dismissing it, e.g. to reveal the result it announces. */
  onSelect?: () => void;
}

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

function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
  useEffect(() => {
    const ms = 3800 + item.lines.length * 1200;
    const t = window.setTimeout(() => onDone(item.id), ms);
    return () => window.clearTimeout(t);
  }, [item, onDone]);
  const icon = item.tone === 'ok' ? 'check' : item.tone === 'error' ? 'warning' : 'info';
  return (
    <button type="button" className={`toast toast-${item.tone}`} onClick={() => { item.onSelect?.(); onDone(item.id); }}>
      <Icon name={icon} size={18} />
      <span className="toast-body">
        <strong>{item.title}</strong>
        {item.lines.map((l, i) => (
          <span key={i} className="toast-line">
            {l}
          </span>
        ))}
      </span>
    </button>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
