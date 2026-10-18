// One toast as the game draws it: an icon for its tone, the title and any lines; it dismisses
// itself after a few seconds (longer with more lines) or when tapped. Store-free, so the Scenario
// Lab's frame draws the game's own toast (toast.tsx owns the queue and needs the store).
import { useEffect } from 'react';
import { Icon } from '../icons';

export type ToastTone = 'info' | 'ok' | 'error' | 'amber';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  lines: string[];
  /** Tapping the toast runs this before dismissing it, e.g. to reveal the result it announces. */
  onSelect?: () => void;
}

export function ToastView({ item, onDone }: { item: ToastItem; onDone: (id: number) => void }) {
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
