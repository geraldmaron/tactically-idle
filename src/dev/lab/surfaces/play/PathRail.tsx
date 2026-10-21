// The path rail above the frame (spec 3.2): one chip per step with where it was taken, the choice,
// how it came out and what was drawn. Click a chip to show the call at that step (rewind, no
// recompute); steps a rewind stepped over stay as ghosts you can step forward into. Under it, the
// exact chance of these picks' results, and "Compare situations": the same picks replayed under the
// other two situations, with where they first part ways.
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { OutcomeBand } from '../../../../sim/types';
import { oneIn, percent, probText } from '../../model/label';
import type { SituationRun } from '../../model/next-step';
import type { PathStep, priorSteps } from '../../model/xray';
import { BandGlyph, cx, Glyph, Kbd, ProgressLine, RouteChip } from '../../viz';

const BAND_WORD: Record<OutcomeBand, string> = { favorable: 'went well', mixed: 'had complications', adverse: 'went badly' };
const drawnText = (drawn: readonly string[]) => drawn.map(entry => entry.slice(entry.indexOf(':') + 1).replace(/[:+]/g, ' ')).join(', ');

export function PathRail(p: {
  steps: PathStep[]; prior: ReturnType<typeof priorSteps>; shown: number; revealed: number; fresh: number | null; flash: boolean;
  chance: { p: number; steps: { pBand: number; pDrawn: number; forced: boolean }[] } | null; who: string;
  onGo(index: number): void; compare: SituationRun[] | 'running' | null; onCompare(): void; onOpenSituation(run: SituationRun): void;
  canCompare: boolean; directorButton?: ReactNode;
}) {
  const last = p.steps.filter(step => !step.ahead).length;
  const track = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const on = track.current?.querySelector<HTMLElement>('.lab-path-on');
    const box = track.current;
    if (!on || !box) return;
    const left = on.offsetLeft - box.offsetLeft, right = left + on.offsetWidth;
    if (left < box.scrollLeft || right > box.scrollLeft + box.clientWidth) box.scrollTo({ left: Math.max(0, right - box.clientWidth + 24) });
  }, [p.shown, p.steps.length, p.revealed]);
  const chanceText = p.chance ? probText(p.chance.p, { face: 'exact', scope: 'this path', who: 'your picks' }) : null;
  const factors = p.chance?.steps.map((step, i) => `Step ${i + 1}: ${percent(step.pBand)}${step.forced ? ' (natural chance of the forced band)' : ''}${step.pDrawn < 1 ? ` × drawn ${percent(step.pDrawn)}` : ''}`).join('\n');
  return (
    <div className="lab-path" aria-label="Path">
      <div className="lab-path-line">
        {p.directorButton}
        <ol className="lab-path-track" aria-label="Steps played" ref={track}>
          {p.prior.map((step, i) => (
            <li key={`prior-${i}`} className="lab-path-item">
              {i > 0 && <span className="lab-path-link" aria-hidden="true" />}
              <span className="lab-path-chip lab-path-prior" title={`Played in your game: ${step.choiceTitle}${step.band ? `, ${BAND_WORD[step.band]}` : ', the time ran out'}`}>
                <span className="lab-path-node">{step.nodeTitle}</span><span className="lab-path-choice">{step.choiceTitle}</span>{step.band && <BandGlyph band={step.band} size={12} />}
              </span>
            </li>
          ))}
          <li className="lab-path-item">
            <button type="button" className={cx('lab-path-chip', 'lab-path-start', p.shown === 0 && 'lab-path-on')} onClick={() => p.onGo(0)} aria-current={p.shown === 0 ? 'step' : undefined}
              title="The call as it opens">
              <Glyph name="play" size={11} /><span className="lab-path-node">Start</span>
            </button>
          </li>
          {p.steps.length === 0 && (
            <li className="lab-path-hint lab-muted" title="Tap a card to take a step, or press R to roll the selected row.">
              <span className="lab-path-hint-long">Tap a card to take a step, or press <Kbd>R</Kbd> to roll the selected row.</span>
              <span className="lab-path-hint-short">Tap a card to step</span>
            </li>
          )}
          {p.steps.map(step => {
            const hidden = !step.ahead && step.index > p.revealed;
            if (hidden) return null;
            return (
              <li key={step.index} className="lab-path-item">
                <span className="lab-path-link" aria-hidden="true" />
                <button type="button" className={cx('lab-path-chip', step.ahead && 'lab-path-ahead', p.shown === step.index && 'lab-path-on', p.fresh === step.index && 'lab-path-fresh', p.flash && step.index > p.shown - 1 && 'lab-path-flash')}
                  onClick={() => p.onGo(step.index)} aria-current={p.shown === step.index ? 'step' : undefined}
                  title={`${step.nodeTitle}: ${step.prompt}\n\n${step.choiceTitle}${step.band ? `, ${BAND_WORD[step.band]}${step.forced ? ' (forced)' : ' (rolled)'}` : ''}${step.drawn.length ? `\nDrawn: ${drawnText(step.drawn)}` : ''}${step.ahead ? '\n(Ahead: click to step forward)' : ''}`}>
                  <span className="lab-path-node">{step.nodeTitle}</span>
                  <span className="lab-path-choice">{step.choiceTitle}</span>
                  {step.band ? <BandGlyph band={step.band} size={12} /> : <Glyph name="mixed" size={12} />}
                  {step.drawn.length > 0 && <span className="lab-path-drawn" title={`Drawn: ${drawnText(step.drawn)}`}><Glyph name="drawn" size={12} /></span>}
                  {step.band && !step.forced && <span className="lab-path-rolled" title="Rolled with the run's own dice">roll</span>}
                </button>
              </li>
            );
          })}
        </ol>
        <span className="lab-path-controls">
          <button type="button" className="lab-icon-button" aria-label="Step back ([)" title="Step back ([)" disabled={p.shown === 0} onClick={() => p.onGo(p.shown - 1)}><Glyph name="caret" className="lab-rot-90" /></button>
          <button type="button" className="lab-icon-button" aria-label="Step forward (])" title="Step forward (])" disabled={p.shown >= p.steps.length} onClick={() => p.onGo(p.shown + 1)}><Glyph name="caret" className="lab-rot-270" /></button>
          <button type="button" className="lab-icon-button" aria-label="Back to the start" title="Back to the start" disabled={p.shown === 0 && !p.steps.length} onClick={() => p.onGo(0)}><Glyph name="undo" /></button>
        </span>
      </div>
      {chanceText && last > 0 && (
        <div className="lab-path-meta">
          <span className="lab-path-chance" title={`${chanceText.plain}\n${factors}`}>
            <span className="lab-path-k">This path</span>
            <span className="lab-prob-value">= {oneIn(p.chance!.p)}</span>
            <span className="lab-path-pct">({percent(p.chance!.p)})</span>
            <span className="lab-pill">{chanceText.pill.map((segment, i) => <span key={i} className="lab-pill-seg">{segment}</span>)}</span>
          </span>
          <button type="button" className="lab-button lab-button-quiet lab-path-compare-button" disabled={!p.canCompare || p.compare === 'running'} onClick={p.onCompare}
            title={p.canCompare ? `Replay these ${last} picks under the other two situations, same turns and group sizes (${p.who})` : 'Compare runs on reference calls; this one came from your game'}>
            <Glyph name="situation" />Compare situations
          </button>
        </div>
      )}
      {p.compare === 'running' && <ProgressLine done={0} total={1} label="Replaying under the other situations…" />}
      {Array.isArray(p.compare) && (
        <ul className="lab-path-compare" aria-label="Same picks in the other situations">
          {p.compare.map(run => (
            <li key={run.situation} className="lab-path-compare-row">
              <span className="lab-path-compare-sit">Situation {run.situation + 1}</span>
              {run.error ? <span className="lab-muted">{run.error}</span> : <>
                <span className="lab-path-compare-text" title={run.stopped?.why}>
                  {run.stopped ? `${run.sameUntil ? `same until step ${run.sameUntil}; ` : ''}step ${run.stopped.step} stops there: ${run.stopped.why}` : run.sameUntil >= run.steps ? 'same all the way, ends at' : run.sameUntil === 0 ? 'parts from step 1, ends at' : `same until step ${run.sameUntil}, then ends at`}
                </span>
                {!run.stopped && run.end && <RouteChip to={run.end} />}
                <button type="button" className="lab-button lab-button-quiet" onClick={() => p.onOpenSituation(run)}>Open</button>
              </>}
            </li>
          ))}
          <li className="lab-path-compare-note lab-muted">Nearest call seeds with the same turns and group sizes; names can differ, and rolled steps roll again on that call.</li>
        </ul>
      )}
    </div>
  );
}
