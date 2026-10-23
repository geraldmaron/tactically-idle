import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Command, HandlerResult } from '../../sim/types';
import { send } from '../store';
import { ToastView } from './ToastView';
import type { ToastItem, ToastTone } from './ToastView';
import { FundingFeedbackProvider } from './Finance';

export type { ToastTone };

interface ToastApi {
  notify: (title: string, opts?: { tone?: ToastTone; lines?: string[]; onSelect?: () => void }) => void;
  /** Send a command; a refusal shows its reason in a toast. */
  act: (cmd: Command, okMessage?: string) => HandlerResult;
}

const Ctx = createContext<ToastApi | null>(null);

/** Messages that may wait behind the one on screen. */
const MAX_QUEUED = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const notify = useCallback<ToastApi['notify']>((title, opts) => {
    const id = idRef.current++;
    // One shows at a time, above the foot (stacked or top toasts bury the mission header and
    // blueprint); the rest wait their turn, so a second message never erases the first. A repeat of
    // the newest waiting message is dropped, and a long backlog keeps the shown one and the latest.
    const item: ToastItem = { id, tone: opts?.tone ?? 'info', title, lines: opts?.lines ?? [], onSelect: opts?.onSelect };
    setItems((xs) => {
      const last = xs[xs.length - 1];
      if (last && last.title === item.title && last.tone === item.tone && last.lines.join('\n') === item.lines.join('\n')) return xs;
      const all = [...xs, item];
      return all.length > MAX_QUEUED + 1 ? [all[0], ...all.slice(all.length - MAX_QUEUED)] : all;
    });
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
    <FundingFeedbackProvider><Ctx.Provider value={api}>
      {children}
      {/* The layer spans the space between the shell's head and foot (the chrome contract), so a
          toast never covers the resource bar, a flow head, the tabs or an action bar. */}
      <div className="toast-layer">
        <div className="toasts" role="status" aria-live="polite">
          {items.slice(0, 1).map((t) => (
            <ToastView key={t.id} item={t} onDone={dismiss} />
          ))}
        </div>
      </div>
    </Ctx.Provider></FundingFeedbackProvider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast outside ToastProvider');
  return v;
}
