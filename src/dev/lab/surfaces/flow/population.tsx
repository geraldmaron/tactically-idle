// The one population bar on Flow and on Outcomes (spec 5 rule 11): which runs every simulated number
// on the surface counts (this call, from this step, this type), the play style and the run count,
// with the job's progress and what the numbers are, in words, underneath.
import type { ReactNode } from 'react';
import { POLICIES } from '../../../../gen/incident/trees-v13/balance';
import type { Policy } from '../../../../gen/incident/trees-v13/balance';
import { useLab } from '../../context';
import { STYLE_HELP, styleLabel } from '../../model/label';
import type { Scope } from '../../types';
import { cx, Glyph, ProgressLine, SegmentedControl } from '../../viz';
import { RUN_CHOICES } from './reach';
import type { ReachState } from './use-reach';

const SCOPE_OPTIONS: { value: Scope; label: string; title: string }[] = [
  { value: 'call', label: 'This call', title: 'This exact call and squad, played many times; dice and choices vary' },
  { value: 'step', label: 'From this step', title: 'The same, starting from the step Play is on' },
  { value: 'type', label: 'This type', title: 'Freshly drawn calls of this type, a different day-one squad each, as the CI gate plays them' },
];

const seconds = (ms: number) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

export function PopulationBar({ reach, lead, tail }: { reach: ReachState; lead?: ReactNode; tail?: ReactNode }) {
  const { navigate } = useLab();
  const { pop } = reach;
  const choices = pop.scope === 'type' ? RUN_CHOICES.type : RUN_CHOICES.call;
  const runOptions = choices.includes(pop.runs) ? choices : [...choices, pop.runs].sort((a, b) => a - b);
  const unit = pop.scope === 'type' ? 'calls' : 'runs';
  return (
    <div className="lab-pop" role="region" aria-label="Population for every number on this surface">
      <div className="lab-pop-controls">
        {lead}
        <span className="lab-pop-field">
          <span className="lab-pop-label">Population</span>
          <SegmentedControl label="Population" size="small" value={pop.scope} options={SCOPE_OPTIONS}
            onChange={scope => navigate({ scope, runs: null }, 'replace')} />
        </span>
        <label className="lab-pop-field">
          <span className="lab-pop-label">Style</span>
          <select className="lab-input lab-pop-select" value={pop.style} title={STYLE_HELP[pop.style]}
            onChange={event => navigate({ style: event.target.value as Policy }, 'replace')}>
            {POLICIES.map(style => <option key={style} value={style}>{styleLabel(style)}</option>)}
          </select>
        </label>
        <label className="lab-pop-field">
          <span className="lab-pop-label">{pop.scope === 'type' ? 'Calls' : 'Runs'}</span>
          <select className="lab-input lab-pop-select" value={pop.runs} onChange={event => navigate({ runs: Number(event.target.value) }, 'replace')}>
            {runOptions.map(n => <option key={n} value={n}>{n.toLocaleString('en-US')}</option>)}
          </select>
        </label>
        {tail}
      </div>
      <PopulationStatus reach={reach} unit={unit} />
    </div>
  );
}

function PopulationStatus({ reach, unit }: { reach: ReachState; unit: string }) {
  const { status, done, total, ms, fromCache, error, text, pending, reason } = reach;
  const what = <span className="lab-pop-what" title={`Every share on this surface: ≈ value · ${text.plain}`}>≈ {text.header}{pending && <span className="lab-pop-pending"> · unsaved tuning</span>}</span>;
  if (reason) return <p className="lab-pop-status"><Glyph name="info" size={13} /><span>{reason}</span></p>;
  return (
    <p className={cx('lab-pop-status', pending && 'lab-pending-mark')} role="status">
      {what}
      {status === 'running' && <>
        <ProgressLine done={done} total={total} label={`≈ computing ${done.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} ${unit}`} />
        <button type="button" className="lab-button lab-button-quiet lab-pop-action" onClick={reach.stop}>Stop</button>
      </>}
      {status === 'done' && <span className="lab-pop-meta">{fromCache ? 'from cache' : ms !== null ? seconds(ms) : ''}</span>}
      {status === 'done' && <button type="button" className="lab-icon-button lab-pop-action" onClick={reach.run} title="Run again" aria-label="Run again"><Glyph name="retry" size={13} /></button>}
      {status === 'stopped' && <>
        <span className="lab-pop-meta">Stopped at {done.toLocaleString('en-US')} of {total.toLocaleString('en-US')} {unit}; the numbers count those.</span>
        <button type="button" className="lab-button lab-button-quiet lab-pop-action" onClick={reach.run}>Run all</button>
      </>}
      {status === 'error' && <>
        <span className="lab-error-text">Runs failed: {error}</span>
        <button type="button" className="lab-button lab-button-quiet lab-pop-action" onClick={reach.run}>Retry</button>
      </>}
    </p>
  );
}
