// Small marks shared by every surface: a probability with its provenance pill, the three tag
// materials, and the chips that link X-ray routes, writes and state keys to where they live.
import type { ReactNode } from 'react';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import type { OutcomeBand } from '../../../sim/types';
import { probText } from '../model/label';
import type { Provenance } from '../model/label';
import { BandGlyph, Glyph, LintGlyph, WeightGlyph } from './glyphs';
import type { LintSeverity } from './glyphs';

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');

/** A number that says what it is (spec section 5): the value, then a pill whose segments are the same
 * facts as the plain form, separated by hairlines. Muted when the interval is wide; pending when it
 * was computed under an unsaved tuning patch. */
export function ProbValue({ p, prov, ci, k, pill = true }: { p: number; prov: Provenance; ci?: [number, number]; k?: number; pill?: boolean }) {
  const t = probText(p, prov, ci, k);
  return (
    <span className={cx('lab-prob', t.muted && 'lab-prob-muted', prov.pending && 'lab-pending-mark')} title={t.plain}>
      <span className="lab-prob-value">{t.value}</span>
      {pill && <span className="lab-pill">{t.pill.map((segment, i) => <span key={i} className="lab-pill-seg">{segment}</span>)}</span>}
    </span>
  );
}

/** Blueprint (`xray`, what the engine computes), masking tape (`tape`, hidden truth) or plain. Xray and
 * tape tags are short handwritten notes: three words at most. */
export function Tag({ variant = 'plain', children, title }: { variant?: 'xray' | 'tape' | 'plain'; children: ReactNode; title?: string }) {
  return <span className={`lab-tag lab-tag-${variant}`} title={title}>{children}</span>;
}

/** Shared chip shell: a button when it links somewhere, a span when it doesn't. */
function Chip({ className, onClick, title, children }: { className: string; onClick?: () => void; title?: string; children: ReactNode }) {
  return onClick
    ? <button type="button" className={cx('lab-chip', className)} onClick={onClick} title={title}>{children}</button>
    : <span className={cx('lab-chip', className)} title={title}>{children}</span>;
}

export interface RouteTo { kind: 'node' | 'ending'; title: string; weight?: Weight }

/** Where a band goes: band glyph, the target's short title, the run class when it ends the call, a die
 * with "n ways" when a drawn result decides, a plus when the band harms someone. */
export function RouteChip({ band, to, drawnWays, harm, onClick, title }: { band?: OutcomeBand; to: RouteTo | null; drawnWays?: number; harm?: boolean; onClick?: () => void; title?: string }) {
  return (
    <Chip className="lab-chip-route" onClick={onClick} title={title}>
      {band && <BandGlyph band={band} size={12} />}
      {drawnWays && drawnWays > 1
        ? <span className="lab-chip-drawn"><Glyph name="drawn" size={12} />{drawnWays} ways</span>
        : <span className="lab-chip-text">{to ? to.title : 'stays here'}</span>}
      {to?.kind === 'ending' && to.weight && <WeightGlyph weight={to.weight} size={12} />}
      {harm && <span className="lab-tone-hurt"><Glyph name="hurt" size={11} title="Someone is harmed" /></span>}
    </Chip>
  );
}

/** A state write or read, in paper blue: pen nib or eye, then the humanized key. */
export function EffectChip({ label, kind, count, onClick, title }: { label: string; kind: 'writes' | 'reads'; count?: number; onClick?: () => void; title?: string }) {
  return (
    <Chip className="lab-chip-effect" onClick={onClick} title={title}>
      <Glyph name={kind} size={12} />
      <span className="lab-chip-text">{label}</span>
      {count !== undefined && <span className="lab-chip-count">{count}</span>}
    </Chip>
  );
}

/** A state key: humanized label first, the raw key after it, small and muted. */
export function KeyChip({ label, raw, set, lint, onClick }: { label: string; raw?: string; set?: boolean; lint?: LintSeverity; onClick?: () => void }) {
  return (
    <Chip className={cx('lab-chip-key', set && 'lab-chip-set')} onClick={onClick} title={raw}>
      {set && <Glyph name="clean" size={11} title="Set at this state" />}
      <span className="lab-chip-text">{label}</span>
      {raw && <code className="lab-raw">{raw}</code>}
      {lint && <LintGlyph severity={lint} size={12} />}
    </Chip>
  );
}
