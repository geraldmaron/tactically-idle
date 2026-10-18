// The compare view (backlog lab-compare), under "This moment": the same call and picks under a second
// instance, B, with the engine's odds for A and B side by side and B minus A. B changes draw fields
// only (building, tier, kit, squad, lab grants); the situation has its own compare on the path rail.
// The numbers come from model/compare.ts, which subtracts what the engine reports and computes none.
import { useMemo } from 'react';
import type { DependencyIndex } from '../../../../gen/incident/trees-v13/dependencies';
import { useLab } from '../../context';
import { catalogEntry, familyLabel } from '../../model/call';
import { compareInstances } from '../../model/compare';
import type { CompareRow, CompareSide } from '../../model/compare';
import { percent } from '../../model/label';
import type { Frame, Session } from '../../model/session';
import { certWords } from '../../model/squads';
import type { CompareDraw } from '../../types';
import { cx, Glyph, SegmentedControl, Tag } from '../../viz';
import { SeedInput } from './Director';

/** Signed percentage points, as the delta column writes them: "+12", "−3", "0". */
const points = (d: number): string => { const n = Math.round(d * 100); return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'; };
const signed = (d: number): string => { const n = Math.round(d * 10) / 10; return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0'; };
const tone = (d: number) => Math.round(d * 100) > 0 ? 'lab-tone-well' : Math.round(d * 100) < 0 ? 'lab-tone-badly' : 'lab-muted';

function Side({ side, other }: { side: CompareSide | null; other: 'A' | 'B' }) {
  if (!side) return <span className="lab-cmp-cell lab-muted">only in {other}</span>;
  if (!side.eligible) return <span className="lab-cmp-cell lab-cmp-locked" title={side.reason ?? 'Locked'}><Glyph name="lock" size={11} />locked</span>;
  return <span className="lab-cmp-cell lab-cmp-odds">{percent(side.likelihood.favorable)}</span>;
}

function Row({ row, n }: { row: CompareRow; n: number }) {
  const locked = [row.a, row.b].find(side => side && !side.eligible);
  return (
    <li className="lab-cmp-row" data-action={row.actionId}>
      <span className="lab-row-n">{n}</span>
      <span className="lab-cmp-title">{row.title}</span>
      <Side side={row.a} other="B" />
      <Side side={row.b} other="A" />
      {row.delta ? <span className={cx('lab-cmp-cell', 'lab-cmp-delta', tone(row.delta.likelihood.favorable))} title="Goes well, B minus A, in points">{points(row.delta.likelihood.favorable)}</span>
        : <span className="lab-cmp-cell lab-muted">·</span>}
      {row.delta ? <span className="lab-cmp-cell lab-cmp-margin" title="Margin (score minus difficulty), B minus A">{signed(row.delta.margin)}</span> : <span className="lab-cmp-cell" />}
      {(row.groups.length > 0 || locked) && (
        <span className="lab-cmp-why">
          {row.groups.map(group => <Tag key={group.id} title={`${group.label}: A ${group.a}, B ${group.b}`}>{group.label} {signed(group.delta)}</Tag>)}
          {locked?.reason && <span className="lab-muted">{locked.reason}</span>}
        </span>
      )}
    </li>
  );
}

export function CompareRail({ session, frame, deps, vs }: { session: Session; frame: Frame; deps: DependencyIndex | null; vs: CompareDraw }) {
  const { url, navigate } = useLab();
  const call = url.call!;
  const at = session.frames.indexOf(frame);
  const result = useMemo(() => compareInstances(session, url, vs, at, deps),
    // The comparison depends on A's draw, squad and path to `at`, and on B's fields; not on view toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, at, deps, JSON.stringify(vs), url.squad, url.certs.join()]);
  const set = (patch: CompareDraw) => navigate({ vs: { ...vs, ...patch } }, 'replace');
  const families = catalogEntry(call.type)?.families ?? [call.family];
  const b = { family: vs.family ?? call.family, seed: vs.seed ?? call.seed, tier: vs.tier ?? call.tier, kit: vs.kit ?? call.kit, squad: vs.squad ?? url.squad, certs: vs.certs ?? url.certs };
  const moved = result.rows.filter(row => row.delta && Math.round(row.delta.likelihood.favorable * 100) !== 0).length;
  const paired = result.rows.filter(row => row.delta).length;
  return (
    <section className="lab-cmp" aria-label="Compare instances">
      <header className="lab-moment-head">
        <span className="lab-xray-title">Compare</span>
        <span className="lab-muted">A is this call · B changes {result.changed.length ? result.changed.join(', ') : 'nothing yet'}</span>
        <button type="button" className="lab-icon-button lab-cmp-close" aria-label="Close compare" onClick={() => navigate({ vs: null }, 'replace')}><Glyph name="close" size={12} /></button>
      </header>
      <div className="lab-cmp-draw" aria-label="Instance B">
        <label className="lab-cmp-field"><span>Building</span>
          <select className="lab-input" aria-label="B building type" value={b.family} onChange={event => set({ family: event.target.value })}>
            {families.map(family => <option key={family} value={family}>{familyLabel(family)}</option>)}
          </select>
        </label>
        <label className="lab-cmp-field"><span>Building seed</span><SeedInput label="B building seed" value={b.seed} onCommit={seed => set({ seed })} /></label>
        <label className="lab-cmp-field"><span>Tier</span>
          <select className="lab-input" aria-label="B tier" value={b.tier} onChange={event => set({ tier: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5].map(tier => <option key={tier} value={tier}>{tier}</option>)}
          </select>
        </label>
        <span className="lab-cmp-field"><span>Kit</span>
          <SegmentedControl label="B kit" size="small" value={b.kit} options={[{ value: 'day1', label: 'Day one' }, { value: 'full', label: 'Every item' }] as const} onChange={kit => set({ kit })} />
        </span>
        <label className="lab-cmp-field"><span>Squad seed</span><SeedInput label="B squad seed" value={b.squad} onCommit={squad => set({ squad })} /></label>
        <span className="lab-cmp-field"><span>Grants</span>
          <span className="lab-cmp-grants">{b.certs.length ? b.certs.map(certWords).join(', ') : 'none'}
            {b.certs.length > 0 && <button type="button" className="lab-button lab-button-quiet" onClick={() => set({ certs: [] })}>Drop</button>}
            {vs.certs !== undefined && <button type="button" className="lab-button lab-button-quiet" onClick={() => { const { certs: _drop, ...rest } = vs; navigate({ vs: rest }, 'replace'); }}>As A</button>}
          </span>
        </span>
      </div>
      {result.error ? <p className="lab-cmp-note lab-muted">{result.error}</p> : <>
        {result.divergence?.kind === 'stopped' && (
          <p className="lab-cmp-note lab-cmp-diverge" role="status"><Glyph name="error" size={13} />B parts at step {result.divergence.step}: {result.divergence.why}{/[.!?]$/.test(result.divergence.why) ? '' : '.'} Nothing is paired past it.</p>
        )}
        {result.divergence?.kind === 'elsewhere' && (
          <p className="lab-cmp-note lab-cmp-diverge" role="status"><Glyph name="error" size={13} />At step {result.divergence.step} A is at {result.divergence.a?.title ?? 'no node'} and B at {result.divergence.b?.title ?? 'no node'}. Rows pair by choice, so most are one-sided.</p>
        )}
        {result.rows.length > 0 && <>
          <div className="lab-cmp-cols" aria-hidden="true"><span>#</span><span>Choice</span><span>A well</span><span>B well</span><span>Δ pts</span><span>Δ margin</span></div>
          <ol className="lab-cmp-list">{result.rows.map((row, i) => <Row key={row.actionId} row={row} n={i + 1} />)}</ol>
          <p className="lab-cmp-note lab-muted">{moved ? `${moved} of ${paired} paired choices move.` : `No paired choice's odds move between A and B here.`} Engine odds for each instance's focus squad, paired by choice.</p>
        </>}
        {!result.divergence && result.rows.length === 0 && <p className="lab-cmp-note lab-muted">No choice is offered here in either instance.</p>}
      </>}
    </section>
  );
}
