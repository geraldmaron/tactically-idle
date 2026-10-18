// The three impact tiers (spec 3.7 "Impact", section 5): instant (this moment's odds under the
// saved tuning and under the patch, engine, synchronous), quick (this call played 600 times on
// each side with the same dice, 600 ms after the last change) and the CI gate (on demand, saved
// side cached). Every number names its population; anything run under the patch is drawn pending.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { GateMetric } from '../../../../gen/incident/trees-v13/balance';
import { gatePasses } from '../../../../gen/incident/trees-v13/balance';
import type { TuningPatch } from '../../../../sim/tuning';
import { useLab } from '../../context';
import { RUN_DEFAULTS, GATE_SECONDS } from '../../jobs/budgets';
import { isJobCancelled, runPaired } from '../../jobs/pool';
import type { PairedHandle } from '../../jobs/pool';
import type { StartRef } from '../../jobs/protocol';
import { cachedGateRuns, gateVerdicts, runGateSuite } from '../../model/gate-view';
import type { GateRun, GateVerdict } from '../../model/gate-view';
import { percent, styleLabel, weightLabel } from '../../model/label';
import type { Session } from '../../model/session';
import { squadOf } from '../../model/squads';
import { Bullet, cx, Glyph, ProgressLine, StackBar, WeightGlyph } from '../../viz';
import type { StackPart } from '../../viz';
import { circled } from './Curve';
import type { Moment } from './Previews';
import { quickSummary } from './studio';
import type { InstantRow } from './studio';

function Pill({ parts, pending }: { parts: string[]; pending?: boolean }) {
  return (
    <span className={cx('lab-pill', pending && 'lab-tpill-pending')}>
      {[...parts, ...pending ? ['unsaved tuning'] : []].map(part => <span key={part} className="lab-pill-seg">{part}</span>)}
    </span>
  );
}

function TierHead({ title, pill, pending, children }: { title: string; pill: string[]; pending?: boolean; children?: ReactNode }) {
  return (
    <header className="lab-ttier-head">
      <div className="lab-ttier-titles">
        <h3 className="lab-ttier-title">{title}</h3>
        <Pill parts={pill} pending={pending} />
      </div>
      {children}
    </header>
  );
}

// ---------------------------------------------------------------- instant

const triplet = (likelihood: InstantRow['after']['likelihood']): StackPart[] => [
  { key: 'well', value: likelihood.favorable, tone: 'well', label: 'goes well' },
  { key: 'mixed', value: likelihood.mixed, tone: 'mixed', label: 'complications' },
  { key: 'badly', value: likelihood.adverse, tone: 'badly', label: 'goes badly' },
];

export function InstantTier({ moment, pending, onPickCall }: { moment: Moment; pending: boolean; onPickCall: () => void }) {
  const moved = moment.rows.filter(row => row.moved).length;
  return (
    <section className="lab-ttier" aria-label="Instant: this moment">
      <TierHead title="Instant" pill={['now', moment.who || 'squad A', 'engine']} pending={pending && moved > 0} />
      {moment.status === 'none' && (
        <div className="lab-ttier-empty">
          <p>Open a call to see how this change moves the odds of the choices in front of the player.</p>
          <button type="button" className="lab-button" onClick={onPickCall}><Glyph name="play" size={12} />Open the hostage reference call</button>
        </div>
      )}
      {moment.status === 'loading' && <p className="lab-ttier-status">Reading this moment…</p>}
      {moment.status === 'ended' && <p className="lab-ttier-status">The Play path ends the call at {moment.where}. Rewind in Play to a moment with choices.</p>}
      {moment.status === 'ready' && (
        <>
          <p className="lab-ttier-status">At <b>{moment.where}</b>: chance each choice goes well, saved{moved ? ' → with your change' : ''}.{moved ? '' : ' Nothing here moves yet.'}</p>
          <ol className="lab-tinst">
            {moment.rows.map((row, i) => (
              <li key={row.id} className={cx('lab-tinst-row', !row.eligible && 'lab-tinst-locked', row.moved && 'lab-tinst-moved')}>
                <span className="lab-tinst-n" aria-hidden="true">{circled(i + 1)}</span>
                <span className="lab-tinst-title" title={row.title}>{row.title}</span>
                {row.eligible ? (
                  <>
                    <span className="lab-tinst-odds">
                      {row.moved && <span className="lab-tinst-before">{percent(row.before.likelihood.favorable)} →</span>}
                      <b>{percent(row.after.likelihood.favorable)}</b>
                    </span>
                    <span className="lab-tinst-bar">
                      <StackBar parts={triplet(row.after.likelihood)} baseline={row.moved ? triplet(row.before.likelihood) : null} label={row.title} height={7} />
                    </span>
                  </>
                ) : (
                  <span className="lab-tinst-reason"><Glyph name="lock" size={12} />{row.reason ?? 'Locked'}</span>
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- quick

type QuickState = { status: 'idle' } | { status: 'waiting' } | { status: 'running'; done: number; total: number }
  | { status: 'done'; summary: ReturnType<typeof quickSummary>; at: number; compared: boolean } | { status: 'error'; message: string };

const signed = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v * 100).toFixed(1)}`;

export function QuickTier({ session, hash, patch, empty }: { session: Session | null; hash: string; patch: TuningPatch; empty: boolean }) {
  const { url, jobs, tuning } = useLab();
  const [state, setState] = useState<QuickState>({ status: 'idle' });
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const patchRef = useRef(patch);
  patchRef.current = patch;
  const kit = url.call?.kit ?? 'day1';
  const startKey = session ? `${session.scenario.id}|${kit}|${url.squad}|${url.certs.join(',')}|${session.squad.kind === 'game' ? `game:${session.squad.at}` : 'ref'}` : null;

  useEffect(() => {
    const s = sessionRef.current;
    if (!s || !startKey) { setState({ status: 'idle' }); return; }
    setState({ status: 'waiting' });
    let handle: PairedHandle | null = null;
    let live = true;
    const timer = window.setTimeout(() => {
      const start: StartRef = s.squad.kind === 'game' ? { kind: 'state', state: s.frames[0].state }
        : { kind: 'fresh', scenarioId: s.scenario.id, kit, squad: squadOf(url) };
      const progress = { saved: 0, patch: 0 };
      const total = RUN_DEFAULTS.quick * (empty ? 1 : 2);
      setState({ status: 'running', done: 0, total });
      handle = runPaired(jobs, { kind: 'reach-call', start, style: 'random', runs: [0, RUN_DEFAULTS.quick] }, {
        patch: patchRef.current, contentKey: s.contentKey,
        onProgress: (side, done) => { progress[side] = done; if (live) setState({ status: 'running', done: empty ? progress.saved : progress.saved + progress.patch, total }); },
      });
      handle.promise.then(({ saved, patch: patched }) => {
        if (!live || saved.kind !== 'reach' || patched.kind !== 'reach') return;
        setState({ status: 'done', summary: quickSummary(saved.tally, patched.tally), at: Date.now(), compared: !empty });
      }, error => {
        if (live && !isJobCancelled(error)) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      });
    }, 600);
    return () => { live = false; window.clearTimeout(timer); handle?.cancel(); };
  }, [startKey, hash]);

  const who = session ? (session.squad.kind === 'game' ? 'your squad (from game)' : `squad A (${url.squad})`) : 'squad A';
  const pill = ['this call', who, styleLabel('random'), `${RUN_DEFAULTS.quick} runs`, ...empty ? [] : ['paired']];
  return (
    <section className={cx('lab-ttier', !empty && state.status === 'done' && 'lab-ttier-pending')} aria-label="Quick check: this call">
      <TierHead title="Quick check" pill={pill} pending={!empty} />
      {!session && <p className="lab-ttier-status">Open a call and the quick check plays it {RUN_DEFAULTS.quick} times on each side with the same dice.</p>}
      {state.status === 'waiting' && <p className="lab-ttier-status">Starts 600 ms after your last change.</p>}
      {state.status === 'running' && <ProgressLine done={state.done} total={state.total} label={`Playing ${state.done.toLocaleString('en-US')} of ${state.total.toLocaleString('en-US')} runs`} />}
      {state.status === 'error' && <p className="lab-ttier-status lab-error-text">{state.message}</p>}
      {tuning.problems.length > 0 && <p className="lab-ttier-status lab-thead-warn">Some unsaved values break a rule, so these runs use only the parts that apply.</p>}
      {state.status === 'done' && <QuickTable summary={state.summary} compared={state.compared} />}
    </section>
  );
}

function QuickTable({ summary, compared }: { summary: ReturnType<typeof quickSummary>; compared: boolean }) {
  const parts = (side: 'saved' | 'patch'): StackPart[] => summary.rows.map(row => ({ key: row.weight, value: row[side].p, tone: row.weight, label: weightLabel(row.weight) }));
  const half = (row: (typeof summary.rows)[number]) => Math.max(1, Math.round(((row.patch.hi - row.patch.lo) / 2) * 100));
  return (
    <>
      <p className="lab-ttier-status">{compared ? 'How these runs end, saved → with your change. Runs pair one to one, so the change column is the change itself.' : 'No unsaved change: how this call ends on the saved tuning.'}</p>
      <StackBar parts={parts('patch')} baseline={compared ? parts('saved') : null} label={compared ? 'Run classes with your change (thin bar: saved)' : 'Run classes, saved'} height={10} />
      <table className="lab-tquick">
        <thead><tr><th scope="col"><span className="lab-tsr">How the run ends</span></th>{compared && <th scope="col">saved</th>}<th scope="col">{compared ? 'with change' : 'saved'}</th>{compared && <th scope="col">change</th>}</tr></thead>
        <tbody>
          {summary.rows.map(row => (
            <tr key={row.weight} className={cx(compared && row.delta.withinNoise && 'lab-tquick-noise')}>
              <th scope="row"><WeightGlyph weight={row.weight} words size={12} /></th>
              {compared && <td>≈ {percent(row.saved.p)}</td>}
              <td>≈ {percent(row.patch.p)} <span className="lab-tquick-ci">±{half(row)}</span></td>
              {compared && (
                <td className="lab-tquick-delta" title={`Paired over ${row.delta.n} runs, 95% interval`}>
                  <b>{signed(row.delta.mean)}</b>
                  {Number.isFinite(row.delta.lo) && <span>{signed(row.delta.lo)} to {signed(row.delta.hi)}</span>}
                  {row.delta.withinNoise && <span className="lab-tquick-tag">within noise</span>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lab-ttier-foot">Points of share over {summary.runs.toLocaleString('en-US')} runs; ± is the 95% interval. Grey rows: the change could be dice alone.</p>
    </>
  );
}

// ---------------------------------------------------------------- gate

type GateState = { status: 'idle' | 'cached' | 'done'; runs: GateRun[]; at: number | null } | { status: 'running'; runs: GateRun[]; at: number | null; done: number; total: number }
  | { status: 'error'; runs: GateRun[]; at: number | null; message: string };

const DOMAIN: Record<GateMetric, [number, number]> = { clean: [0, 1], bad: [0, 1], harm: [0, 0.6], officerHurt: [0, 0.6], death: [0, 0.2] };
const TYPE_ORDER = ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'] as const;
const minutesAgo = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : `${m} min ago`; };

export function GateTier({ patch, hash, empty, onVerdicts }: { patch: TuningPatch; hash: string; empty: boolean; onVerdicts(v: { verdicts: GateVerdict[]; hash: string } | null): void }) {
  const { jobs } = useLab();
  const [state, setState] = useState<GateState>(() => ({ status: 'idle', runs: [], at: null }));
  const cancel = useRef<(() => void) | null>(null);

  // Paint whatever the cache holds for the saved side and this patch.
  useEffect(() => {
    cancel.current?.();
    cancel.current = null;
    const cached = cachedGateRuns(jobs, { patch });
    setState({ status: cached.runs.length ? 'cached' : 'idle', runs: cached.runs, at: cached.at });
  }, [hash]);
  useEffect(() => () => cancel.current?.(), []);

  const verdicts = useMemo(() => gateVerdicts(state.runs), [state.runs]);
  const hasPatchSide = state.runs.some(run => run.side === 'patch');
  const complete = verdicts.every(v => v.saved !== null) && (empty || hasPatchSide);
  useEffect(() => { onVerdicts(complete ? { verdicts, hash } : null); }, [verdicts, complete, hash]);

  const savedCached = useMemo(() => cachedGateRuns(jobs, { patch: {} }).runs.length === 11, [state.status, hash]);
  const seconds = empty ? (savedCached ? 0 : GATE_SECONDS.bothSides / 2) : savedCached ? GATE_SECONDS.patchSide : GATE_SECONDS.bothSides;
  const run = () => {
    const handle = runGateSuite(jobs, { patch, onProgress: p => setState(s => ({ status: 'running', runs: s.runs, at: s.at, done: p.done, total: p.total })) });
    cancel.current = handle.cancel;
    setState(s => ({ status: 'running', runs: s.runs, at: s.at, done: 0, total: 1 }));
    handle.promise.then(runs => { cancel.current = null; setState({ status: 'done', runs, at: Date.now() }); },
      error => { cancel.current = null; if (!isJobCancelled(error)) setState(s => ({ status: 'error', runs: s.runs, at: s.at, message: error instanceof Error ? error.message : String(error) })); else setState(s => ({ status: s.runs.length ? 'cached' : 'idle', runs: s.runs, at: s.at })); });
  };
  const savedPass = verdicts.filter(v => v.saved !== null && gatePasses(v.check, v.saved)).length;
  const savedRun = verdicts.filter(v => v.saved !== null).length;
  const patchPass = verdicts.filter(v => v.patch !== null && gatePasses(v.check, v.patch)).length;
  const patchRun = verdicts.filter(v => v.patch !== null).length;
  return (
    <section className={cx('lab-ttier', hasPatchSide && 'lab-ttier-pending')} aria-label="CI gate">
      <TierHead title="CI gate" pill={['CI gate', 'tier 2', 'day-one squads', '60 calls (40 best odds)', ...empty ? [] : ['paired']]} pending={hasPatchSide}>
        {state.status === 'running'
          ? <button type="button" className="lab-button" onClick={() => cancel.current?.()}>Stop</button>
          : <button type="button" className="lab-button" onClick={run}>{complete ? 'Run again' : 'Run gate'}{seconds > 0 ? ` ≈ ${Math.ceil(seconds)} s` : ''}</button>}
      </TierHead>
      {state.status === 'running' && <ProgressLine done={state.done} total={state.total} label={`Playing ${state.done.toLocaleString('en-US')} of ${state.total.toLocaleString('en-US')} gate calls`} />}
      {state.status === 'error' && <p className="lab-ttier-status lab-error-text">{state.message}</p>}
      {savedRun === 0 && state.status !== 'running' && (
        <p className="lab-ttier-status">The same 24 checks CI runs, played in the workers on saved tuning{empty ? '' : ' and with your change, call for call'}. Pass or fail is only said here, for CI's own population.</p>
      )}
      {savedRun > 0 && (
        <p className="lab-ttier-status lab-tgate-summary">
          <span>Saved: <b className={savedPass === savedRun ? 'lab-pass' : 'lab-fail'}>{savedPass} of {savedRun}</b> pass</span>
          {patchRun > 0 && <span>With your change: <b className={patchPass === patchRun ? 'lab-pass' : 'lab-fail'}>{patchPass} of {patchRun}</b> pass</span>}
          {!empty && patchRun === 0 && <span className="lab-muted">Not run for this change yet.</span>}
          {state.at !== null && state.status !== 'running' && <span className="lab-muted">{state.status === 'cached' ? 'from cache, ' : ''}{minutesAgo(state.at)}</span>}
        </p>
      )}
      {savedRun > 0 && <p className="lab-ttier-foot">Each row plays the random style unless it names another. Shaded: what the gate allows; hollow tick: saved; amber: with your change.</p>}
      {savedRun > 0 && TYPE_ORDER.map(type => (
        <div key={type} className="lab-tgate-type">
          <h4 className="lab-tgate-head">{INCIDENT_TEMPLATES[type]?.label ?? type}</h4>
          {verdicts.filter(v => v.check.type === type).map(v => (
            <div key={v.check.id} className={cx('lab-tgate-row', v.pass === false && 'lab-tgate-fail')} title={[v.text, v.deltaText].filter(Boolean).join(' ')}>
              <span className="lab-tgate-label">{v.check.label}{v.check.style !== 'random' && <span className="lab-muted">, {styleLabel(v.check.style)}</span>}</span>
              <Bullet label={`${v.check.label}, ${styleLabel(v.check.style)}`} min={v.check.min} max={v.check.max} saved={v.saved} patch={v.patch} pass={v.pass} domain={DOMAIN[v.check.metric]} />
              {v.pass === false && <p className="lab-tgate-why">{v.text}</p>}
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
