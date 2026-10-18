// Outcomes (spec 3.4): how the call ends. Every written ending as a card, grouped by how the runs
// that ended there scored, with its words, its reach in this surface's population and in this type,
// the mix of run classes and the shortest way there; endings this call can't reach as ghosts with the
// reason and a way to find a draw that has them. Beside them: the four play styles side by side, and
// the CI gate with its 24 checks and, under an unsaved tuning patch, paired before and after deltas.
import { useCallback, useMemo, useState } from 'react';
import { POLICIES } from '../../../../gen/incident/trees-v13/balance';
import type { Policy, Weight } from '../../../../gen/incident/trees-v13/balance';
import { clockMarksOf } from '../../../../gen/incident/instance';
import { situationClockNexts, treeClockNexts } from '../../model/clocks';
import { plainTokens } from '../../../../gen/incident/trees-v13/dependencies';
import { callGraph, truthReach } from '../../../../gen/incident/trees-v13/graph';
import type { IncidentType } from '../../../../sim/scenario-types';
import type { GameState } from '../../../../sim/types';
import { PeopleProvider, PeopleText } from '../../../../ui/people/PeopleText';
import { lexiconFor } from '../../../../ui/people/lexicon';
import { DRAW_NOTICE, useLab } from '../../context';
import { GATE_SECONDS } from '../../jobs/budgets';
import type { ExploreResult, LabJob } from '../../jobs/protocol';
import type { ReachTally } from '../../jobs/tally';
import { contentKey } from '../../model/call';
import { endingListTitle } from '../../model/describe';
import { authoredEndingClass } from '../../model/flow-layout';
import { deltaText, gateVerdicts } from '../../model/gate-view';
import { percent, STYLE_HELP, styleLabel, weightLabel } from '../../model/label';
import { seekCallSeed } from '../../model/seek';
import { currentFrame, playPath, sessionBinder } from '../../model/session';
import type { Session } from '../../model/session';
import { baselineRows, loadSnapshot, pinLabel, saveSnapshot, SNAPSHOT_PREFIX, takeSnapshot } from '../../model/snapshots';
import type { CallSnapshot } from '../../model/snapshots';
import type { DrawWant } from '../../model/seek';
import { CALL_TEMPLATES } from '../../shell/CallSwitcher';
import { useNarrow } from '../../shell/media';
import { cx, Glyph, ProbValue, ProgressLine, Skeleton, StackBar, StyleSpread, Tag, WeightGlyph } from '../../viz';
import { ageText, gateHeadline, readIds, WEIGHTS_BEST_FIRST } from '../calls/calls-model';
import { useGate } from '../calls/gate-store';
import { GateRows } from '../calls/GateRows';
import { PopulationBar } from '../flow/population';
import { populationKey, startOf, TYPE_CALLS } from '../flow/reach';
import { useReach } from '../flow/use-reach';
import type { ReachState } from '../flow/use-reach';
import { GameFrame } from '../play/GameFrame';
import { baselineDeltas, drawFor, endingCards, groupCards, shareTotal } from './endings';
import type { EndingCard } from './endings';
import { useJob } from './use-job';
import type { JobState } from './use-job';
import '../calls/calls.css';
import '../flow/flow.css';
import './outcomes.css';

const DISPOSITION: Record<string, string> = { resolved: 'resolved', relief_partial: 'partly resolved', unresolved: 'unresolved', care_accepted: 'care accepted', followup_agreed: 'follow-up agreed' };
const GROUP_WORDS: Record<Weight | 'ghost', string> = {
  clean: 'Clean', costly: 'Costly: resolved at a price', unresolved: 'Unresolved', hurt: 'Someone hurt', death: 'Someone killed', ghost: 'Not in this call',
};

export default function OutcomesSurface() {
  const { call } = useLab();
  if (call.status === 'ready') return <OutcomesReady session={call.session} />;
  return (
    <section className="lab-out lab-flow-waiting" aria-busy={call.status === 'loading'}>
      {call.status === 'loading' && <><Skeleton height={28} width="40%" /><p className="lab-muted">Building the call…</p></>}
      {call.status === 'error' && <p className="lab-muted">The call didn't open; the notice above says why.</p>}
    </section>
  );
}

function OutcomesReady({ session }: { session: Session }) {
  const lab = useLab();
  const { url, navigate, notify } = lab;
  const tree = session.tree;
  const reach = useReach(session);
  const scope = reach.pop.scope;
  const tier = url.call?.tier ?? 2;

  // ------------------------------------------------ this type, every style; the explorer's paths
  const typeKey = contentKey(tree.type);
  const styleJobs = useMemo(() => POLICIES.map((style): LabJob => ({ kind: 'reach-type', type: tree.type, tier, style, calls: TYPE_CALLS })), [tree.type, tier]);
  const styles = [useJob(styleJobs[0], typeKey), useJob(styleJobs[1], typeKey), useJob(styleJobs[2], typeKey), useJob(styleJobs[3], typeKey)];
  const tallyOf = (i: number): ReachTally | null => { const r = styles[i].result; return r && r.kind === 'reach' ? r.tally : null; };
  const typeTally = tallyOf(POLICIES.indexOf(reach.pop.style));
  const exploreJob = useMemo((): LabJob | null => (scope === 'type' ? null : { kind: 'explore', start: startOf(session, url, ''), goal: null, cap: 6000 }),
    [scope, session.frames[0], url.call?.kit, url.squad, url.certs.join(',')]);
  const explored = useJob(exploreJob, session.contentKey);
  const shortest = explored.result?.kind === 'explore' ? (explored.result.result as ExploreResult & { endings?: Record<string, string> }).endings ?? null : null;

  // ------------------------------------------------ cards
  const authored = useMemo(() => callGraph(tree, { clockNexts: treeClockNexts(tree, session.template) }), [tree, session.template]);
  const graph = scope === 'type' ? authored : lab.graph ?? authored;
  const endingClass = useMemo(() => authoredEndingClass(tree), [tree]);
  const bySituation = useMemo(() => {
    if (scope === 'type') return null;
    try {
      const clockMarks = clockMarksOf(session.instance.clocks);
      return [0, 1, 2].map(s => new Set<string>(truthReach(callGraph(tree, { counts: session.counts, seed: session.resolved.spec?.seed, situation: s as 0 | 1 | 2, clockMarks, clockNexts: situationClockNexts(session.template, s as 0 | 1 | 2) }), tree)));
    } catch { return null; }
  }, [scope, session.instance, tree]);
  const cards = useMemo(() => endingCards({ tree, graph, tally: reach.tally, typeTally, scope, endingClass, shortest, bySituation })
    .map(card => (card.reason ? { ...card, reason: readIds(card.reason, session.template, lab.deps) } : card)),
  [tree, graph, reach.tally, typeTally, scope, endingClass, shortest, bySituation, session.template, lab.deps]);
  const groups = groupCards(cards);
  const reachable = cards.filter(c => c.kind === 'card').length;
  const stuck = reach.tally?.endings.none?.n ?? 0;

  // ------------------------------------------------ text
  const bind = useMemo(() => {
    let binder: ((text: string) => string) | null = null;
    try { binder = sessionBinder(session); } catch { binder = null; }
    return (text: string) => { try { return binder ? binder(text) : plainTokens(text, tree); } catch { return plainTokens(text, tree); } };
  }, [session.instance, tree]);
  const lexicon = useMemo(() => (url.names ? lexiconFor(session.scenario, currentFrame(session).state.activeRun ?? null, []) : null), [session.scenario, url.names]);

  // ------------------------------------------------ baseline
  const [snapshot, setSnapshot] = useState<CallSnapshot | null>(() => loadSnapshot(tree.type));
  // Paired run by run only on the same starts and dice: the same call, squad, kit, step and
  // population. Content and tuning are what may differ.
  const population = populationKey(url, session, reach.pop);
  const samePopulation = !!snapshot?.reach && snapshot.population === population;
  const compare = snapshot?.reach && samePopulation && reach.status === 'done' && reach.tally ? baselineDeltas(snapshot.reach, reach.tally) : null;
  const baselineShare = (id: string): number | null => (compare && snapshot?.reach?.runs ? (snapshot.reach.endings[id]?.n ?? 0) / snapshot.reach.runs : null);
  const pin = () => {
    if (!reach.tally || reach.status !== 'done') { notify('Wait for the runs to finish, then pin them as the baseline.'); return; }
    try {
      const rows = baselineRows(session, sessionBinder(session));
      const stylesNow = Object.fromEntries(POLICIES.flatMap((style, i) => { const t = tallyOf(i); return t ? [[style, distributionShares(t)]] : []; }));
      const snap = takeSnapshot(session, rows, { reach: reach.tally, population, styles: stylesNow, label: pinLabel(Date.now(), reach.text.plain) });
      if (saveSnapshot(snap)) { setSnapshot(snap); notify(`Baseline pinned: ${reach.text.plain}. Strings, ending shares and run classes now compare against it.`); }
      else notify('This browser blocks storage, so the baseline could not be kept.');
    } catch (error) { notify(`Could not pin a baseline: ${error instanceof Error ? error.message : String(error)}`); }
  };

  // ------------------------------------------------ actions
  const fix = useCallback((card: EndingCard) => {
    const draw = url.call;
    if (!draw) return;
    try {
      const want: DrawWant | null = card.situations.length ? { variant: card.situations[0] as 0 | 1 | 2 }
        : drawFor(session.template, card.id, { counts: session.counts, turns: session.turnDrawn, situation: session.situation });
      if (!want) { notify('No draw of this call reaches that ending: no situation, turn or group size keeps a route to it.'); return; }
      const found = seekCallSeed(tree.type, { family: draw.family, seed: draw.seed, tier: draw.tier, call: session.resolved.spec?.seed }, want);
      if (!found) { notify('No call seed in range draws that. Try another building seed.'); return; }
      navigate({ call: { ...draw, call: found.call, id: null }, path: '', tab: 'play', sel: { kind: 'ending', ending: card.id } });
      if (found.changed.length) notify(`Also changed: ${found.changed.join('; ')}.`, undefined, DRAW_NOTICE);
    } catch (error) { notify(`Could not find a draw: ${error instanceof Error ? error.message : String(error)}`); }
  }, [url.call, session, navigate, notify]);

  return (
    <PeopleProvider lexicon={lexicon}>
      <section className="lab-out" aria-label="Outcomes">
        <PopulationBar reach={reach} tail={<BaselineControl snapshot={snapshot} compare={!!compare} samePopulation={samePopulation} onPin={pin} onClear={() => { try { localStorage.removeItem(`${SNAPSHOT_PREFIX}${tree.type}`); } catch { /* blocked */ } setSnapshot(null); }} />} />
        <div className="lab-out-body">
          <div className="lab-out-main">
            <header className="lab-out-head">
              <h1 className="lab-out-title">Endings</h1>
              <span className="lab-out-count">{cards.length} written · {scope === 'type' ? 'every draw of this type' : `${reachable} reachable in this call`}</span>
              {reach.status === 'done' && reach.tally && <span className="lab-out-total" data-total={shareTotal(cards, reach.tally).toFixed(3)}>shares add up to {percent(shareTotal(cards, reach.tally))}</span>}
            </header>
            {compare && <BaselineStrip deltas={compare} />}
            {groups.map(group => (
              <section key={group.key} className="lab-out-group" aria-label={GROUP_WORDS[group.key]}>
                <h2 className="lab-out-group-head">
                  {group.key === 'ghost' ? <Glyph name="ending" size={14} /> : <WeightGlyph weight={group.key} size={14} />}
                  {GROUP_WORDS[group.key]}
                  {group.key === 'ghost' && <span className="lab-out-group-note">this call’s draw can’t reach them; each says what draw would</span>}
                </h2>
                <div className="lab-out-cards">
                  {group.cards.map(card => (
                    <EndingCardView key={card.id} card={card} reach={reach} bind={bind} tree={tree} baseline={baselineShare(card.id)} explore={explored.status}
                      preview={scope !== 'type' && shortest?.[card.id] ? { start: session.frames[0].state, path: shortest[card.id], names: url.names } : null}
                      onPlay={() => lab.playHere({ ending: card.id })} onFlow={() => navigate({ tab: 'flow', sel: { kind: 'ending', ending: card.id } })}
                      onNote={() => navigate({ sel: { kind: 'ending', ending: card.id }, notes: true })} onFix={() => fix(card)} />
                  ))}
                </div>
              </section>
            ))}
            {stuck > 0 && reach.tally && (
              <p className="lab-out-stuck" data-ending="none" data-share={(stuck / reach.tally.runs).toFixed(3)}>
                <Glyph name="warn" size={13} />{stuck} of {reach.tally.runs.toLocaleString('en-US')} runs stopped without an ending; they count as unresolved.
              </p>
            )}
          </div>
          <aside className="lab-out-side">
            <StylesPanel tier={tier} states={styles} current={reach.pop.style} onPick={style => navigate({ scope: 'type', style, runs: null }, 'replace')} />
            <GatePanel type={tree.type} scope={scope} />
          </aside>
        </div>
      </section>
    </PeopleProvider>
  );
}

/** A tally's run classes as shares, the way `measure` reports them (for a baseline's styles). */
function distributionShares(t: ReachTally) {
  const share = (n: number) => (t.runs ? Math.round((1000 * n) / t.runs) / 1000 : 0);
  return { calls: t.runs, weights: Object.fromEntries(WEIGHTS_BEST_FIRST.map(w => [w, share(t.weights[w] ?? 0)])) as Record<Weight, number>,
    endings: Object.fromEntries(Object.entries(t.endings).map(([id, e]) => [id, share(e.n)])), officerHurtRate: share(t.officerHurt), meanMinutes: t.runs ? Math.round(t.minutes / t.runs) : 0 };
}

function EndingCardView({ card, reach, bind, tree, baseline, explore, preview, onPlay, onFlow, onNote, onFix }: {
  card: EndingCard; reach: ReachState; bind(text: string): string; tree: Session['tree']; baseline: number | null;
  /** The explorer's job status: "no path" is only said once it has walked the whole call. */
  explore: JobState['status'];
  /** The shortest path here from the call's start, for the debrief the player would read. */
  preview: { start: GameState; path: string; names: boolean } | null;
  onPlay(): void; onFlow(): void; onNote(): void; onFix(): void;
}) {
  const [open, setOpen] = useState(false);
  const ending = tree.endings[card.id];
  const title = endingListTitle(tree, card.id, bind);
  const first = /^.*?[.?!][’”'")\]]*(?=\s|$)/s.exec(bind(ending.summary))?.[0] ?? bind(ending.summary);
  const ran = reach.tally !== null && card.runs > 0;
  const zero = card.kind === 'card' && ran && card.n === 0 && reach.status === 'done';
  const prov = { ...reach.text.prov, pending: reach.pending };
  return (
    <article className={cx('lab-out-card', card.kind === 'ghost' && 'lab-out-ghost', zero && 'lab-out-zero', card.mix && `lab-out-w-${card.group}`, open && preview && 'lab-out-card-open')}
      data-ending={card.id} data-share={ran && card.kind === 'card' ? card.p.toFixed(3) : undefined} data-n={ran && card.kind === 'card' ? card.n : undefined}>
      <span className="lab-out-stripe" aria-hidden="true" />
      <header className="lab-out-card-head">
        {card.mix ? <WeightGlyph weight={card.group} size={14} /> : <Glyph name="ending" size={13} />}
        <h3 className="lab-out-card-title"><PeopleText text={title} /></h3>
      </header>
      <p className="lab-out-card-summary"><PeopleText text={first} /></p>
      {card.kind === 'ghost' ? <>
        <p className="lab-out-why"><Tag variant="xray">not here</Tag>{card.reason}</p>
        <div className="lab-out-actions">
          <button type="button" className="lab-button" onClick={onFix} title="Find the nearest call seed whose draw reaches this ending, and open it in Play"><Glyph name="search" size={12} />Find a draw with it</button>
          <button type="button" className="lab-button lab-button-quiet" onClick={onFlow}>Flow</button>
        </div>
      </> : <>
        <div className="lab-out-reach">
          {ran ? <ProbValue p={card.p} prov={prov} ci={card.ci} k={card.n} /> : reach.status === 'running' ? <span className="lab-muted">≈ counting…</span> : <span className="lab-muted">not run</span>}
          {zero && <span className="lab-out-zero-note">0 of {card.runs.toLocaleString('en-US')} runs</span>}
        </div>
        {card.typeShare && reach.pop.scope !== 'type' && (
          <p className="lab-out-type" title={`≈ ${percent(card.typeShare.n / card.typeShare.runs)} · this type · ${styleLabel(reach.pop.style)} · ${card.typeShare.runs} calls`}>
            ≈ {percent(card.typeShare.n / card.typeShare.runs)} of this type <span className="lab-muted">({card.typeShare.n} of {card.typeShare.runs} calls)</span>
          </p>
        )}
        {baseline !== null && <p className="lab-out-type">was ≈ {percent(baseline)} at the baseline</p>}
        {card.mix && (
          <div className="lab-out-mix">
            <StackBar label={`How the ${card.n} runs that ended here scored`} height={8}
              parts={WEIGHTS_BEST_FIRST.map(w => ({ key: w, value: card.mix![w], tone: w, label: weightLabel(w) }))} />
            <span className="lab-out-mix-words">{mixWords(card.mix)} of {card.n.toLocaleString('en-US')} runs</span>
          </div>
        )}
        {card.scored && <p className="lab-out-scored">{card.scored}</p>}
        <p className="lab-out-meta">
          {card.shortest !== null ? <span>Shortest: {card.shortest} {card.shortest === 1 ? 'pick' : 'picks'}</span>
            : reach.pop.scope === 'type' ? null
            : explore === 'done' ? <span className="lab-muted">no path the explorer can force</span>
            : explore === 'error' ? <span className="lab-muted">shortest path unknown: the explorer stopped</span>
            : <span className="lab-muted">finding the shortest path…</span>}
          <span className="lab-muted">authored {DISPOSITION[card.disposition] ?? card.disposition}</span>
        </p>
        <div className="lab-out-actions">
          <button type="button" className="lab-button lab-button-primary" onClick={onPlay} title="Find the shortest path here and open it in Play"><Glyph name="play" size={11} />Play here</button>
          <button type="button" className="lab-button" onClick={onFlow}>Flow</button>
          {preview && <button type="button" className="lab-button" aria-expanded={open} onClick={() => setOpen(value => !value)}
            title="The debrief the player reads at this ending, on the shortest path here"><Glyph name="caret" size={11} />Debrief</button>}
          <button type="button" className="lab-button lab-button-quiet" onClick={onNote}><Glyph name="note" size={12} />Note</button>
        </div>
        {open && preview && <DebriefPreview {...preview} />}
      </>}
    </article>
  );
}

const NO_TABS = new Map<string, number>();
const noop = () => {};

/** The game's own debrief at this ending, in the phone frame Play uses (390 wide, fit): the last
 * frame of the shortest path, played on the engine from the call's start. */
function DebriefPreview({ start, path, names }: { start: GameState; path: string; names: boolean }) {
  const end = useMemo(() => { try { return playPath(start, path).frames.at(-1)!.state; } catch { return null; } }, [start, path]);
  if (!end || end.activeRun?.status !== 'debrief') return <p className="lab-muted">The shortest path no longer ends here; play it again from Play here.</p>;
  return (
    <div className="lab-out-debrief">
      <GameFrame state={end} screen="debrief" width={390} zoom="fit" names={names} truth={false} tabs={NO_TABS} selectedId={null} hoverId={null} playing={false} reveal={null}
        onReview={noop} onConfirm={noop} onFail={noop} toast={null} onToastDone={noop} force={null} onForce={noop} onForceCancel={noop} />
    </div>
  );
}

function mixWords(mix: Record<Weight, number>): string {
  const total = WEIGHTS_BEST_FIRST.reduce((n, w) => n + mix[w], 0);
  return WEIGHTS_BEST_FIRST.filter(w => mix[w] > 0).map(w => (mix[w] === total ? `all ${weightLabel(w)}` : `${weightLabel(w)} ${mix[w]}`)).join(', ');
}

function BaselineControl({ snapshot, compare, samePopulation, onPin, onClear }: { snapshot: CallSnapshot | null; compare: boolean; samePopulation: boolean; onPin(): void; onClear(): void }) {
  return (
    <span className="lab-pop-field lab-out-baseline">
      <span className="lab-pop-label">Baseline</span>
      {snapshot ? <>
        <span className={cx('lab-out-baseline-name', !compare && 'lab-muted')}
          title={compare ? 'Shares and run classes compare against this'
            : !snapshot.reach ? 'Strings only: pin here to compare shares and run classes'
              : samePopulation ? 'Compares once these runs finish'
                : `Pinned on another call, squad, kit, step or population (${snapshot.label.split(' · ').slice(1).join(' · ') || 'unknown'}); open that one to compare`}>
          {snapshot.label.split(' · ')[0]}{snapshot.reach ? '' : ' (strings only)'}
        </span>
        <button type="button" className="lab-button lab-button-quiet" onClick={onPin}>Pin again</button>
        <button type="button" className="lab-icon-button" onClick={onClear} aria-label="Remove the baseline" title="Remove the baseline"><Glyph name="close" size={12} /></button>
      </> : <button type="button" className="lab-button lab-button-quiet" onClick={onPin} title="Keep these strings, ending shares and run classes to compare an edit against">Pin as baseline</button>}
    </span>
  );
}

function BaselineStrip({ deltas }: { deltas: NonNullable<ReturnType<typeof baselineDeltas>> }) {
  return (
    <div className="lab-out-baseline-strip" role="group" aria-label="Change since the baseline">
      <span className="lab-pop-label">Since the baseline, paired run by run</span>
      {WEIGHTS_BEST_FIRST.map(w => (
        <span key={w} className={cx('lab-out-delta', deltas[w].withinNoise && 'lab-out-noise')} title={deltaText(deltas[w], 'runs')}>
          <WeightGlyph weight={w} size={12} />{weightLabel(w)} {deltas[w].withinNoise ? 'within noise' : `${deltas[w].mean > 0 ? '+' : '−'}${Math.abs(deltas[w].mean * 100).toFixed(1)} pts`}
        </span>
      ))}
    </div>
  );
}

function StylesPanel({ tier, states, current, onPick }: { tier: number; states: ReturnType<typeof useJob>[]; current: Policy; onPick(style: Policy): void }) {
  const tallies = states.map(s => (s.result && s.result.kind === 'reach' ? s.result.tally : null));
  const clean = Object.fromEntries(POLICIES.flatMap((style, i) => { const t = tallies[i]; return t && t.runs ? [[style, (t.weights.clean ?? 0) / t.runs]] : []; })) as Partial<Record<Policy, number>>;
  const narrow = useNarrow();
  return (
    <details key={narrow ? 'narrow' : 'wide'} open={!narrow} className="lab-out-panel" aria-label="Styles">
      <summary className="lab-out-panel-head">
        <h2 className="lab-out-panel-title"><Glyph name="caret" size={14} className="lab-out-caret" />Styles</h2>
        <span className="lab-out-panel-pop">this type · tier {tier} · {TYPE_CALLS} calls · day-one squads vary per call</span>
      </summary>
      <ul className="lab-out-styles">
        {POLICIES.map((style, i) => {
          const t = tallies[i], s = states[i];
          return (
            <li key={style} className={cx('lab-out-style', style === current && 'lab-out-style-on')} data-style={style}>
              <button type="button" className="lab-out-style-name" onClick={() => onPick(style)} title={`${STYLE_HELP[style]}. Show this style's numbers for this type.`}>{styleLabel(style)}</button>
              {t && t.runs ? <>
                <StackBar label={`${styleLabel(style)}, ${t.runs} calls`} height={10} parts={WEIGHTS_BEST_FIRST.map(w => ({ key: w, value: t.weights[w] ?? 0, tone: w, label: weightLabel(w) }))} />
                <span className="lab-out-style-figures">
                  {WEIGHTS_BEST_FIRST.map(w => <span key={w} title={`${weightLabel(w)}: ${t.weights[w] ?? 0} of ${t.runs} calls`}><WeightGlyph weight={w} size={11} />{percent((t.weights[w] ?? 0) / t.runs)}</span>)}
                </span>
              </> : s.status === 'error' ? <span className="lab-error-text">{s.error}</span>
                : <span className="lab-out-style-wait">{s.status === 'running' && s.total ? `≈ ${s.done} of ${s.total} calls` : 'queued…'}</span>}
            </li>
          );
        })}
      </ul>
      {Object.keys(clean).length > 0 && (
        <div className="lab-out-spread">
          <span className="lab-pop-label">Clean endings by style</span>
          <StyleSpread label="Clean endings by style" values={clean} cap={0.75} />
          <span className="lab-out-spread-axis" aria-hidden="true"><span>0%</span><span style={{ left: '75%' }}>75% cap</span><span>100%</span></span>
        </div>
      )}
      <p className="lab-out-panel-note">The dashed line is the gate’s cap: no style may reach clean in more than 75% of calls.</p>
    </details>
  );
}

function GatePanel({ type, scope }: { type: IncidentType; scope: 'call' | 'step' | 'type' }) {
  const { tuning } = useLab();
  const { gate, run, cancel } = useGate();
  const pending = Object.keys(tuning.patch).length > 0;
  const verdicts = useMemo(() => gateVerdicts(gate.runs, undefined, pending), [gate.runs, pending]);
  const headline = gateHeadline(verdicts, pending, false);
  const own = verdicts.filter(v => v.check.type === type);
  const others = CALL_TEMPLATES.filter(t => t.type !== type);
  const narrow = useNarrow();
  return (
    <details key={narrow ? 'narrow' : 'wide'} open={!narrow} className={cx('lab-out-panel', 'lab-out-gate', pending && 'lab-pending-mark')} aria-label="CI gate">
      <summary className="lab-out-panel-head">
        <h2 className="lab-out-panel-title"><Glyph name="caret" size={14} className="lab-out-caret" />CI gate <span className="lab-out-panel-count">{gateHeadline(own, pending, false, 'for this call').text}</span></h2>
        <span className="lab-out-panel-pop">tier 2 · drawn calls from 1 · day-one squads · 60 calls (40 for best odds){pending ? ' · saved vs unsaved tuning' : ''}</span>
      </summary>
      {scope !== 'type' && <p className="lab-out-panel-note">Verdicts use the CI population only, never the numbers on the left.</p>}
      <p className="lab-out-gate-status" role="status">
        {gate.status === 'running'
          ? <ProgressLine done={gate.progress?.done ?? 0} total={gate.progress?.total || 1} label={`≈ ${(gate.progress?.done ?? 0).toLocaleString('en-US')} of ${(gate.progress?.total ?? 0).toLocaleString('en-US')} calls`} />
          : <><b className={cx(headline.tone === 'fail' && 'lab-calls-fail', headline.tone === 'pass' && 'lab-calls-pass')} data-gate-line>{headline.text}</b>
            {gate.at !== null && <span className="lab-calls-age">{ageText(gate.at, Date.now(), gate.fromCache)}</span>}</>}
        {gate.status === 'running'
          ? <button type="button" className="lab-button" onClick={cancel}>Cancel</button>
          : <button type="button" className="lab-button lab-button-primary" onClick={run}><Glyph name="play" size={11} />Run gate ≈ {gate.runs.length && pending ? GATE_SECONDS.patchSide : GATE_SECONDS.bothSides} s</button>}
      </p>
      {gate.status === 'error' && <p className="lab-error-text">The gate stopped: {gate.error}</p>}
      <h3 className="lab-out-gate-type">{CALL_TEMPLATES.find(t => t.type === type)?.label ?? type} · {own.length} checks</h3>
      <GateRows verdicts={own} progress={gate.progress} deltas />
      <details className="lab-out-gate-more">
        <summary>The other three calls · {verdicts.length - own.length} checks</summary>
        {others.map(t => {
          const list = verdicts.filter(v => v.check.type === t.type);
          return (
            <div key={t.type} className="lab-out-gate-other">
              <h4 className="lab-out-gate-type">{t.label} · {gateHeadline(list, pending, false).text}</h4>
              <GateRows verdicts={list} progress={gate.progress} deltas />
            </div>
          );
        })}
      </details>
    </details>
  );
}
