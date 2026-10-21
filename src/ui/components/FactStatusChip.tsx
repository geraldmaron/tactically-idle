// A fact's standing as one pill with an icon (owner 2026-10-21: pills and icons, never a bare "?"):
// the same pill on the briefing, the live call, the result card and the debrief.
import type { KnowledgeStatus } from '../../sim/types';
import { Chip } from './ui';

const STATUS = {
  unknown: { tone: 'amber', icon: 'question', word: 'Unknown' },
  reported: { tone: 'amber', icon: 'question', word: 'Unverified' },
  confirmed: { tone: 'mint', icon: 'check', word: 'Confirmed' },
  disproved: { tone: 'danger', icon: 'x', word: 'Ruled out' },
} as const;

/** `label`: what the fact is about ("Patrol’s handgun report"), shown with the status word. */
export function FactStatusChip({ status, label }: { status: KnowledgeStatus | 'none' | undefined; label?: string }) {
  const entry = status && status !== 'none' ? STATUS[status] : null;
  if (!entry) return <Chip>{label ? `${label}, not tracked` : 'Not tracked'}</Chip>;
  return <Chip tone={entry.tone} icon={entry.icon}>{label ? <>{label} <span className="chip-status">{entry.word.toLowerCase()}</span></> : entry.word}</Chip>;
}
