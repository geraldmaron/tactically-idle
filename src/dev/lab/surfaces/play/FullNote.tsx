// The selected choice's full note (spec 3.2 X-ray rail, item 3): its odds and the margin they come
// from (contributors grouped as the game's review sheet groups them, summing to score − difficulty),
// then each band as a lane: where it sends the call under this call's hidden truth and what decided
// that, what it writes and which later lines read it, the drawn results with their exact odds, and
// what the player reads after it (one forced step through the engine). Then the exact next step, and
// the forced-band, roll and "where this leads" actions. A locked choice shows Why instead.
import { useEffect, useMemo, useState } from 'react';
import type { DependencyIndex, StateKey } from '../../../../gen/incident/trees-v13/dependencies';
import type { OutcomeBand } from '../../../../sim/types';
import { useLab } from '../../context';
import { RUN_DEFAULTS } from '../../jobs/budgets';
import type { ReachTally } from '../../jobs/tally';
import type { DilemmaRow } from '../../model/dilemma';
import { percent, probText, styleLabel, weightLabel } from '../../model/label';
import { nextStep, previewBand } from '../../model/next-step';
import type { BandPreview } from '../../model/next-step';
import type { Frame, Session } from '../../model/session';
import { shareOf } from '../../model/stats';
import { bandCurve, BANDS, targetFor, whereIs } from '../../model/xray';
import type { BandRoute, Because, ChoiceXray, RouteTarget } from '../../model/xray';
import { BAND_WORDS, BandCurve, BandGlyph, cx, EffectChip, FlagGlyph, Glyph, Kbd, ProbValue, ProgressLine, RouteChip, Skeleton, StackBar, Tag, Waterfall, WeightGlyph } from '../../viz';
import type { CurvePoint } from '../../viz';
import { WhyPanel } from './WhyPanel';

const TONE: Record<OutcomeBand, 'well' | 'mixed' | 'badly'> = { favorable: 'well', mixed: 'mixed', adverse: 'badly' };
const KEY: Record<OutcomeBand, string> = { favorable: 'W', mixed: 'C', adverse: 'B' };
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10).toFixed(1)}`;
/** Why a band of an eligible choice has no Force: it can't come out at this margin, or it can (the
 * dice allow it) in a window too narrow for a forced step to aim at (sampleFor), so only a roll takes it. */
const cantForce = (band: OutcomeBand, p: number) => p > 1e-9
  ? `Can't be forced here: it comes out this way ${percent(p)} of the time at this margin, a window too narrow to aim at. Roll to take it with the dice.`
  : `Can't come out ${BAND_WORDS[band].toLowerCase()} at this margin.`;

/** Keys a reader can act on: marks, people out, facts settled, promises. */
const SHOWN = /^(mark|safe|out|fact|promise):/;

export interface Leads { status: 'running' | 'done' | 'error'; done: number; total: number; tally: ReachTally | null; message?: string }

function keyLabel(deps: DependencyIndex | null, key: StateKey): string {
  if (key.startsWith('promise:concession:')) return 'Concession agreed';
  return deps?.keys.get(key)?.label ?? key.slice(key.indexOf(':') + 1).replace(/_/g, ' ');
}
const readersOf = (deps: DependencyIndex | null, key: StateKey) => deps?.keys.get(key)?.readers.filter(site => site.field !== 'engine').length ?? 0;

function BecauseTag({ why }: { why: Because }) {
  return <Tag variant={why.kind === 'truth' ? 'tape' : why.kind === 'state' ? 'plain' : 'xray'} title={why.title}>{why.text}</Tag>;
}

function BandLane({ x, route, preview, pending, deps, aiming, onKey, onForce, onForceDrawn }: {
  x: ChoiceXray; route: BandRoute; preview: BandPreview | null; pending: boolean; deps: DependencyIndex | null; aiming: boolean;
  onKey(key: StateKey): void; onForce(band: OutcomeBand): void; onForceDrawn(band: OutcomeBand, drawn: string[]): void;
}) {
  const why = useMemo(() => {
    const seen = new Set<string>();
    return route.effects.flatMap(effect => effect.why).filter(entry => !seen.has(entry.text) && !!seen.add(entry.text));
  }, [route]);
  const writes = route.writes.filter(key => SHOWN.test(key) && !(key.startsWith('out:') && route.writes.includes(`safe:${key.slice(4)}` as StateKey)));
  // A band that draws ends where its forced draw settled, but its run class is its drawn results'
  // (route.to, from withWeights), never the one result that forced step happened to settle.
  const routeClass = route.to?.kind === 'ending' && preview?.to?.kind === 'ending' && route.to.ending === preview.to.ending ? route.to.weight : undefined;
  const ends = preview?.ended && preview.to?.kind === 'ending' ? { ...preview.to, weight: route.drawn.length ? routeClass : preview.weight ?? undefined } : null;
  const to: RouteTarget | null = ends ?? route.to;
  const drawnDecides = !route.to && route.drawn.length > 0;
  // A band that draws more than one result needs a key for each: the clicked one, and each other
  // effect's likeliest result.
  const likeliest = route.drawn.map(entry => [...entry.results].sort((a, b) => b.p - a.p)[0]);
  const keysFor = (effect: number, key: string) => route.drawn.map((_, i) => i === effect ? key : likeliest[i]?.key ?? '');
  const othersText = (effect: number) => route.drawn.flatMap((entry, i) => i === effect || !likeliest[i] ? [] : [`${likeliest[i].label.toLowerCase()} for the ${entry.model === 'incoming_fire' ? 'fire' : entry.model === 'team_force' ? 'force' : 'followers'} (its likeliest)`]).join(', ');
  return (
    <section className={cx('lab-lane', `lab-lane-${TONE[route.band]}`, !route.possible && 'lab-lane-off')} aria-label={BAND_WORDS[route.band]}>
      <header className="lab-lane-head">
        <BandGlyph band={route.band} words />
        <span className="lab-lane-p">{percent(route.p)}</span>
        <span className="lab-lane-arrow" aria-hidden="true">→</span>
        {drawnDecides ? <span className="lab-lane-drawn-decides"><Glyph name="drawn" size={13} />a drawn result decides</span>
          : <RouteChip to={to ? { kind: to.kind, title: to.title, weight: to.kind === 'ending' ? to.weight : undefined } : null} harm={route.mayHarm} />}
        {route.possible && (
          <button type="button" className="lab-button lab-lane-force" onClick={() => onForce(route.band)} title={`Force ${BAND_WORDS[route.band].toLowerCase()} and take the step (${KEY[route.band]})`}>
            Play this <Kbd>{KEY[route.band]}</Kbd>
          </button>
        )}
      </header>
      {!route.possible && <p className="lab-lane-note">{x.view.eligible ? cantForce(route.band, route.p) : 'Locked here: shown for what it would do.'}</p>}
      {why.length > 0 && <p className="lab-lane-because"><span className="lab-lane-k">because</span>{why.map(entry => <BecauseTag key={entry.text} why={entry} />)}</p>}
      {(writes.length > 0 || route.harm.length > 0) && (
        <p className="lab-lane-writes">
          <span className="lab-lane-k">writes</span>
          {writes.map(key => <EffectChip key={key} kind="writes" label={keyLabel(deps, key)} count={readersOf(deps, key) || undefined} onClick={() => onKey(key)}
            title={`${keyLabel(deps, key)}: read later by ${readersOf(deps, key)} ${readersOf(deps, key) === 1 ? 'line' : 'lines'}. Open in Dependencies.`} />)}
          {route.harm.map(harm => <span key={harm} className="lab-chip lab-chip-harm"><Glyph name="hurt" size={11} />{harm}</span>)}
        </p>
      )}
      {route.drawn.map((entry, effectIndex) => (
        <div key={entry.effect} className="lab-lane-drawn">
          <p className="lab-lane-drawn-head"><Glyph name="drawn" size={13} />{entry.model === 'incoming_fire' ? `Fire from ${entry.on ?? 'the subject'}` : entry.model === 'team_force' ? `Team force on ${entry.on ?? 'the subject'}` : `Who follows ${entry.on ?? 'the leader'}`}
            <span className="lab-muted"> · drawn when the band lands, no band decides it</span></p>
          <ul className="lab-lane-results">
            {entry.results.map(result => (
              <li key={result.key} className="lab-lane-result">
                <ProbValue p={result.p} prov={{ face: 'exact', scope: 'now', who: 'drawn result' }} pill={false} />
                <span className="lab-lane-result-label">{result.label}</span>
                {result.harms && <span className="lab-tone-hurt"><Glyph name="hurt" size={11} title="Someone is harmed" /></span>}
                {result.to && (!route.to || result.to.title !== route.to.title) && <RouteChip to={{ kind: result.to.kind, title: result.to.title }} />}
                {aiming && route.possible && <button type="button" className="lab-button lab-button-quiet lab-lane-aim" onClick={() => onForceDrawn(route.band, keysFor(effectIndex, result.key))}
                  title={`Force ${BAND_WORDS[route.band].toLowerCase()} with “${result.label}”${route.drawn.length > 1 ? `, and ${othersText(effectIndex)}` : ''}`}>Force this</button>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {pending && <div className="lab-lane-reads"><p className="lab-lane-k">Player reads after</p><Skeleton lines={2} /></div>}
      {preview && (
        <div className="lab-lane-reads">
          <p className="lab-lane-k">Player reads after{preview.weight && <WeightGlyph weight={preview.weight} words />}</p>
          <blockquote className="lab-reads">{preview.reads.map((line, i) => <p key={i} className={line.startsWith('Next: ') ? 'lab-reads-next' : undefined}>{line}</p>)}</blockquote>
          {preview.drawnFixed && (
            <p className="lab-lane-fixed">
              {route.drawn[0]?.model === 'team_force' ? 'Team force' : route.drawn[0]?.model === 'cascade' ? 'Who follows' : 'Fire'} came out “{preview.drawnFixed.label}” because the band was forced.
              {' '}Natural odds: {preview.drawnFixed.natural.map(result => `${result.label} ${percent(result.p)}`).join(' · ')}.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function LeadsView({ leads, session, prov }: { leads: Leads; session: Session; prov: { style: Parameters<typeof styleLabel>[0]; who: string; pending: boolean } }) {
  if (leads.status === 'error') return <p className="lab-error-text">{leads.message}</p>;
  const tally = leads.tally;
  if (!tally || !tally.runs) return <ProgressLine done={leads.done} total={leads.total} label={`Playing ${leads.total.toLocaleString('en-US')} runs from here…`} />;
  const endings = Object.entries(tally.endings).sort((a, b) => b[1].n - a[1].n).slice(0, 5);
  const partial = leads.status === 'running';
  return (
    <div className={cx('lab-leads', partial && 'lab-leads-partial')}>
      <p className="lab-note-h">Where this leads <span className="lab-muted">· runs from this state, this choice first</span></p>
      {partial && <ProgressLine done={leads.done} total={leads.total} label={`≈ partial, ${leads.done.toLocaleString('en-US')} of ${leads.total.toLocaleString('en-US')} runs`} />}
      <StackBar label="How the runs end" parts={(['clean', 'costly', 'unresolved', 'hurt', 'death'] as const).map(w => ({ key: w, value: tally.weights[w] ?? 0, tone: w, label: weightLabel(w) }))} height={8} />
      <ul className="lab-leads-list">
        {endings.map(([ending, entry]) => {
          const share = shareOf(entry.n, tally.runs);
          const to = ending === 'none' ? null : targetFor(session, { ending });
          return (
            <li key={ending}>
              <ProbValue p={share.p} ci={[share.lo, share.hi]} k={entry.n} prov={{ face: 'sim', scope: 'from this step', who: prov.who, style: prov.style, runs: tally.runs, pending: prov.pending }} pill={false} />
              <span>{to ? to.title : 'No ending (stuck)'}</span>
            </li>
          );
        })}
      </ul>
      <span className="lab-pill">{['from this step', prov.who, styleLabel(prov.style), `${tally.runs.toLocaleString('en-US')} runs`, ...prov.pending ? ['unsaved tuning'] : []].map((segment, i) => <span key={i} className="lab-pill-seg">{segment}</span>)}</span>
    </div>
  );
}

export function FullNote({ session, frame, x, d, rows, deps, who, aiming, leads, onForce, onForceDrawn, onRoll, onLeads, onNote }: {
  session: Session; frame: Frame; x: ChoiceXray; d: DilemmaRow | undefined; rows: ChoiceXray[]; deps: DependencyIndex | null; who: string; aiming: boolean;
  leads: Leads | undefined; onForce(band: OutcomeBand): void; onForceDrawn(band: OutcomeBand, drawn: string[]): void; onRoll(): void; onLeads(): void; onNote(): void;
}) {
  const { url, navigate, tuning } = useLab();
  // "Player reads after" is one forced step per band: computed just after the note paints (spec 9.6,
  // lazy on expand), so a step or a row change never waits for it. Cached per frame and move.
  const [previews, setPreviews] = useState<{ id: string; frame: Frame; bands: Record<OutcomeBand, BandPreview | null> } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviews({ id: x.actionId, frame,
      bands: Object.fromEntries(BANDS.map(band => [band, x.bands[band].possible ? previewBand(session, frame, x.actionId, band) : null])) as Record<OutcomeBand, BandPreview | null> }), 0);
    return () => window.clearTimeout(timer);
  }, [session, frame, x]);
  const shownPreviews = previews && previews.id === x.actionId && previews.frame === frame ? previews.bands : null;
  const mix = useMemo(() => nextStep(x, whereIs(session, frame.state)), [x, session, frame]);
  // The curve under the margin marker, from the same tables as the odds above it (patch included).
  const curve: CurvePoint[] = useMemo(() => bandCurve(), [tuning.hash]);
  const onKey = (key: StateKey) => navigate({ tab: 'deps', sel: { kind: 'key', key } });
  const prov = { face: 'engine' as const, scope: 'now' as const, who };
  const titleOf = (id: string) => rows.find(row => row.actionId === id)?.title ?? id;
  const sel = { kind: 'choice' as const, node: x.node, choice: x.choice };

  return (
    <div className="lab-note" aria-label={`Full note: ${x.title}`}>
      <div className="lab-note-odds">
        <div className="lab-note-triplet">
          <StackBar label="Odds" parts={BANDS.map(band => ({ key: band, value: x.view.likelihood[band], tone: TONE[band], label: BAND_WORDS[band] }))} height={10} />
          <span className="lab-note-nums">
            {BANDS.map(band => <span key={band} className={`lab-tone-${TONE[band]}`}>{percent(x.view.likelihood[band])}</span>)}
          </span>
          <span className="lab-pill">{probText(x.view.likelihood.favorable, prov).pill.map((segment, i) => <span key={i} className="lab-pill-seg">{segment}</span>)}</span>
        </div>
        <div className="lab-note-margin" title={`Score ${x.score.toFixed(1)} − difficulty ${x.difficulty.toFixed(1)}`}>
          <span className="lab-note-margin-k">Margin</span>
          <span className="lab-note-margin-v">{signed(x.margin)}</span>
          <span className="lab-muted">score − difficulty</span>
        </div>
      </div>

      {d && d.flags.length > 0 && (
        <ul className="lab-note-flags">
          {d.flags.map((flag, i) => (
            <li key={i} className={`lab-note-flag lab-note-flag-${flag.kind}`}>
              <FlagGlyph flag={flag.kind} />
              {flag.kind === 'beaten' ? <span>Beaten by <b>{titleOf(flag.by)}</b> on every column the engine measures (better on {flag.columns.join(', ')}). Its visible cost decides whether it stays.
                <span className="lab-note-costs"><span><b>This:</b> {d.costSeen.summary} <i>Badly:</i> {d.costSeen.adversePreview}</span>
                  <span><b>{titleOf(flag.by)}:</b> {rows.find(r => r.actionId === flag.by)?.view.summary} <i>Badly:</i> {rows.find(r => r.actionId === flag.by)?.view.outcomePreview.adverse}</span></span></span>
                : flag.kind === 'flat' ? <span>Odds within 5 points of {flag.with.map(titleOf).join(', ')}: the numbers don't separate them.</span>
                  : flag.kind === 'all-high' ? <span>Every choice here goes well 90% of the time or more.</span>
                    : <span>Saves more than half the minutes of <b>{titleOf(flag.restraint)}</b> ({Math.round(flag.ratio * 100)}% of its time). It must cost more on trust, strain and completion wherever it is reachable.</span>}
            </li>
          ))}
        </ul>
      )}

      {!x.view.eligible && x.req && <WhyPanel session={session} frame={frame} deps={deps} req={x.req} target={{ choice: [x.node, x.choice] }} reason={x.view.reason} />}

      <div className="lab-note-cols">
        <div className="lab-note-why">
          <p className="lab-note-h">What the odds are made of</p>
          <Waterfall items={x.groups.map(group => ({ id: group.id, label: group.label, value: group.total }))} />
          <BandCurve points={curve} markers={[{ id: x.actionId, label: signed(x.margin), margin: Math.max(-40, Math.min(40, x.margin)) }]} width={250} height={100} label={`Band chances by margin, this choice at ${signed(x.margin)}`} />
          <p className="lab-note-curve-key"><span><i className="lab-fill-well" />goes well</span><span><i className="lab-fill-mixed" />complications</span><span><i className="lab-fill-badly" />goes badly</span><span className="lab-muted">by margin</span></p>
        </div>
        <div className="lab-note-lanes">
          {BANDS.map(band => <BandLane key={band} x={x} route={x.bands[band]} preview={shownPreviews ? shownPreviews[band] : null} pending={!shownPreviews && x.bands[band].possible} deps={deps} aiming={aiming} onKey={onKey} onForce={onForce} onForceDrawn={onForceDrawn} />)}
        </div>
      </div>

      {x.view.eligible && <div className="lab-note-next">
        <span className="lab-note-h">Next step</span>
        <span className="lab-note-mix" title={`= ${mix.map(entry => `${entry.to.title} ${percent(entry.p)}`).join(' · ')} · now · ${who} · exact`}>
          <span className="lab-note-eq">=</span>
          {mix.map((entry, i) => <span key={i} className="lab-note-mix-item"><RouteChip to={{ kind: entry.to.kind, title: entry.to.title, weight: entry.to.kind === 'ending' ? entry.to.weight : undefined }} harm={entry.harm} /><b>{percent(entry.p)}</b></span>)}
        </span>
        <span className="lab-pill"><span className="lab-pill-seg">now</span><span className="lab-pill-seg">{who}</span><span className="lab-pill-seg">exact</span></span>
      </div>}

      <div className="lab-note-actions">
        {x.view.eligible && BANDS.map(band => (
          <button key={band} type="button" className={cx('lab-button', 'lab-note-band', `lab-note-band-${TONE[band]}`)} disabled={!x.bands[band].possible}
            title={x.bands[band].possible ? `Force ${BAND_WORDS[band].toLowerCase()} (${KEY[band]})` : x.view.eligible ? cantForce(band, x.bands[band].p) : 'Locked here'}
            onClick={() => onForce(band)}>
            <BandGlyph band={band} size={12} />{BAND_WORDS[band]} <span className="lab-note-band-p">{percent(x.bands[band].p)}</span>
          </button>
        ))}
        {x.view.eligible && <button type="button" className="lab-button" onClick={onRoll} title="Take the step with the run's own dice (R)"><Glyph name="drawn" />Roll</button>}
        <span className="lab-note-actions-gap" />
        {x.view.eligible && <button type="button" className="lab-button lab-button-quiet" disabled={leads?.status === 'running'} onClick={onLeads}
          title={`Play ${url.style === 'random' ? 'random-style' : styleLabel(url.style)} runs from this state, this choice first`}>
          <Glyph name="scan" />Where this leads ({RUN_DEFAULTS.fromHere.toLocaleString('en-US')} runs)
        </button>}
        <button type="button" className="lab-button lab-button-quiet" onClick={onNote} title="Note on this choice (N)"><Glyph name="note" />Note</button>
        <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ tab: 'flow', sel })} title="This choice in Flow"><Glyph name="choice" />Flow</button>
        <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ tab: 'deps', sel })} title="This choice in Dependencies"><Glyph name="key" />Deps</button>
      </div>
      {leads && <LeadsView leads={leads} session={session} prov={{ style: url.style, who, pending: Object.keys(tuning.patch).length > 0 }} />}
    </div>
  );
}
