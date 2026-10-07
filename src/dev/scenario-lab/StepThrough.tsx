// Step-through: a live run of the call on the real engine. Each step is applied by the
// dispatcher through the gates' driver, aimed at a band (the driver picks dice that land there
// and refuses when the engine produces anything else) or with the run's own dice. The history
// stack holds every committed state, so Back and Restart never recompute a result.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import type { GameState, OutcomeBand } from '../../sim/types';
import { availableMoves } from '../../gen/incident/gates/engine-driver';
import { currentBuilt, lastDecisionView, pendingDebrief, spaceViews, stageContinuations, stageProgress } from '../../sim/operation-selectors';
import { isGenericResponseExit, responseFailurePlan } from '../../sim/response-failure';
import { civilianOutcomeViews } from '../../sim/incident-consequences';
import { externalSupportStatus } from '../../sim/external-support';
import { conditionHolds } from '../../sim/resolution';
import { Blueprint } from '../../ui/blueprint/Blueprint';
import { applyLabMove, BANDS, decodePath, encodePath, flatness, startLabRun, viewsOf } from './model';
import type { Kit, LabMove } from './model';
import { FlatBanner, OptionCard } from './parts';
import type { OptionStatus } from './parts';
import { actionTitle, factLabel, signed } from './describe';

interface Frame { state: GameState; move: LabMove | null }

export function moveLabel(s: ScenarioDefinition, move: LabMove): string {
  const title = actionTitle(s, move.actionId);
  if (move.kind === 'continue') return `continue (${title})`;
  if (move.kind === 'fail') return 'report failed response';
  if (move.kind === 'roll') return `${title} (own dice)`;
  return `${title} (${move.band})`;
}

function replay(id: string, kit: Kit, path: string): { frames: Frame[]; error: string | null } {
  const frames: Frame[] = [{ state: startLabRun(id, kit), move: null }];
  const moves = decodePath(path);
  for (let i = 0; i < moves.length; i++) {
    const after = applyLabMove(frames.at(-1)!.state, moves[i]);
    if (!after) return { frames, error: `Step ${i + 1} (${moves[i].actionId} ${moves[i].band ?? moves[i].kind}) was refused by the engine; the path stops before it.` };
    frames.push({ state: after, move: moves[i] });
  }
  return { frames, error: null };
}

export function StepThrough({ id, s, kit, path, onPath }: { id: string; s: ScenarioDefinition; kit: Kit; path: string; onPath: (path: string) => void }) {
  const emitted = useRef<string | null>(null);
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [openAll, setOpenAll] = useState(false);

  useEffect(() => {
    const key = `${id}|${kit}|${path}`;
    if (emitted.current === key && frames) return;
    try {
      const result = replay(id, kit, path);
      setFrames(result.frames);
      setError(result.error);
      if (result.error) { const kept = encodePath(result.frames.slice(1).map(f => f.move!)); emitted.current = `${id}|${kit}|${kept}`; onPath(kept); }
      else emitted.current = key;
    } catch (failure) {
      setFrames(null);
      setError(`Could not start a run: ${String(failure)}`);
    }
    // Replays only when the call, the kit or a path from outside (a link, an ending) changes.
  }, [id, kit, path]);

  const commit = (next: Frame[]) => {
    setFrames(next);
    setSelected(null);
    const encoded = encodePath(next.slice(1).map(frame => frame.move!));
    emitted.current = `${id}|${kit}|${encoded}`;
    onPath(encoded);
  };

  const state = frames?.at(-1)?.state ?? null;
  const views = useMemo(() => (state ? viewsOf(state) : []), [state]);
  const moves = useMemo(() => (state ? availableMoves(state, views) : []), [state, views]);
  if (!frames || !state) return <section className="sl-panel"><h2>Step-through</h2><p className="sl-err">{error ?? 'Starting…'}</p></section>;

  const run = state.activeRun!;
  const ended = run.status !== 'active' || run.stage === 'debrief';
  const progress = stageProgress(state);
  const flat = flatness(views);
  const title = (actionId: string) => views.find(view => view.id === actionId)?.title ?? actionId;
  const act = (move: LabMove) => {
    const after = applyLabMove(state, move, move.kind === 'decide' ? views : undefined);
    if (!after) { setError(`The engine refused ${moveLabel(s, move)}.`); return; }
    setError(null);
    commit([...frames, { state: after, move }]);
  };
  const bandsFor = (actionId: string) => new Set(moves.filter(m => m.kind === 'decide' && m.actionId === actionId).map(m => m.band as OutcomeBand));
  const continuations = ended ? [] : stageContinuations(state);
  const failure = !ended && moves.some(m => m.kind === 'fail') ? responseFailurePlan(state) : null;
  const stageActions = ended || run.stage === 'debrief' ? [] : s.stages[run.stage].actions;
  const listed = stageActions.filter(action => views.some(view => view.id === action.id) || showHidden);
  const hiddenCount = stageActions.length - views.length;
  const selectedView = views.find(view => view.id === selected) ?? null;
  const built = currentBuilt(state);
  const last = frames.length > 1 ? frames.at(-1)! : null;
  const prev = frames.length > 1 ? frames.at(-2)!.state.activeRun! : null;
  const decision = last && (last.move?.kind === 'decide' || last.move?.kind === 'roll') ? lastDecisionView(state) : null;
  const debrief = ended ? pendingDebrief(state) : null;
  const flagsAdded = prev ? run.flags.filter(flag => !prev.flags.includes(flag) && !flag.startsWith('used:')) : [];
  const flagsCleared = prev ? prev.flags.filter(flag => !run.flags.includes(flag)) : [];
  const supportChanged = prev ? (s.externalServices ?? []).filter(service => externalSupportStatus(prev, service) !== externalSupportStatus(run, service)) : [];

  return (
    <section className="sl-panel" id="run">
      <div className="sl-panel-head">
        <h2>Step-through</h2>
        <div className="sl-toolbar">
          <button type="button" disabled={frames.length < 2} onClick={() => commit(frames.slice(0, -1))}>Back</button>
          <button type="button" disabled={frames.length < 2} onClick={() => commit(frames.slice(0, 1))}>Restart</button>
          <label className="sl-check"><input type="checkbox" checked={showHidden} onChange={event => setShowHidden(event.target.checked)} /> hidden options</label>
          <label className="sl-check"><input type="checkbox" checked={openAll} onChange={event => setOpenAll(event.target.checked)} /> expand all</label>
        </div>
      </div>
      <ol className="sl-trail">
        <li><button type="button" className={frames.length === 1 ? 'sl-here' : ''} onClick={() => commit(frames.slice(0, 1))}>start</button></li>
        {frames.slice(1).map((frame, index) => (
          <li key={index}><button type="button" className={index === frames.length - 2 ? 'sl-here' : ''} onClick={() => commit(frames.slice(0, index + 2))}>
            <span className={frame.move?.band ? `sl-t-${frame.move.band}` : ''}>{moveLabel(s, frame.move!)}</span></button></li>
        ))}
      </ol>
      {error && <p className="sl-err">{error}</p>}
      <div className="sl-run-grid">
        <div className="sl-run-main">
          <div className="sl-status">
            <span><b>{ended || run.stage === 'debrief' ? 'Ended' : s.stages[run.stage].label}</b> <span className="sl-dim">({run.stage === 'debrief' ? 'debrief' : run.stage})</span></span>
            <span>clock {Math.round(run.clock * 10) / 10} min</span>
            <span>pressure {Math.round(run.pressure)}</span>
            <span>objective {Math.round(run.objective)}</span>
            <span>civilian safety {Math.round(run.civilianSafety)}</span>
            <span>revision {run.revision}</span>
          </div>
          {!ended && progress.prompt && <p className="sl-prompt">{progress.prompt}</p>}
          {last && (
            <div className="sl-record">
              <h3>Last step: {moveLabel(s, last.move!)}</h3>
              {decision && (
                <>
                  <p><b className={`sl-t-${decision.band}`}>{decision.band}</b>{decision.resultLabel ? ` · ${decision.resultLabel}` : ''} · {decision.timeCost} min · objective {signed(decision.objectiveDelta)} · civilian {signed(decision.civilianSafetyDelta)} · pressure {signed(decision.pressureDelta)}{decision.endingTitle ? ` · ending: ${decision.endingTitle}` : ''}</p>
                  <ul>{decision.explanation.map((line, index) => <li key={index}>{line}</li>)}</ul>
                  {decision.consequences.length > 0 && <p><span className="sl-dim">Consequences:</span> {decision.consequences.join(' ')}</p>}
                  {decision.knowledgeChanges.length > 0 && <p><span className="sl-dim">Knowledge:</span> {decision.knowledgeChanges.map(k => `${k.label} → ${k.status}`).join('; ')}</p>}
                </>
              )}
              {last.move?.kind === 'fail' && run.responseFailure && <p>{run.responseFailure.title}: {run.responseFailure.reason}</p>}
              <p className="sl-dim">
                {prev && prev.stage !== run.stage ? `Stage ${prev.stage} → ${run.stage}. ` : ''}
                {flagsAdded.length ? `Flags set: ${flagsAdded.join(', ')}. ` : ''}
                {flagsCleared.length ? `Flags cleared: ${flagsCleared.join(', ')}. ` : ''}
                {supportChanged.length ? `Services: ${supportChanged.map(service => `${service.label} ${externalSupportStatus(run, service)}`).join(', ')}. ` : ''}
                {prev ? `Clock +${Math.round((run.clock - prev.clock) * 10) / 10} min.` : ''}
              </p>
            </div>
          )}
          {debrief && (
            <div className="sl-record sl-debrief">
              <h3>Debrief: {debrief.endingTitle} <span className="sl-dim">({debrief.endingId}{debrief.disposition ? `, ${debrief.disposition}` : ''}{debrief.completionAchieved !== undefined ? `, completion ${debrief.completionAchieved ? 'met' : 'not met'}` : ''})</span></h3>
              {debrief.endingSummary && <p>{debrief.endingSummary}</p>}
              <p>Objective {debrief.objective.score} ({debrief.objective.label}) · civilian safety {debrief.civilianSafety.score} ({debrief.civilianSafety.label}) · trust {signed(debrief.trustDelta)} · funding {debrief.fundingReward} · dev points {debrief.devPointReward}</p>
              {debrief.remainingTasks?.length ? <p><span className="sl-dim">Remaining:</span> {debrief.remainingTasks.join('; ')}</p> : null}
              {debrief.civilianOutcomes?.length ? <p><span className="sl-dim">People:</span> {debrief.civilianOutcomes.map(c => `${c.label}: ${c.status}`).join('; ')}</p> : null}
              {debrief.causes.length > 0 && <ul>{debrief.causes.map((cause, index) => <li key={index}>{cause}</li>)}</ul>}
            </div>
          )}
          {!ended && (
            <>
              <h3>Options now <span className="sl-dim">({views.filter(v => v.eligible).length} available of {views.length} shown{hiddenCount > 0 ? `, ${hiddenCount} authored option${hiddenCount === 1 ? '' : 's'} hidden at this state` : ''})</span></h3>
              <FlatBanner eligible={flat.eligible} pairs={flat.pairs} allHigh={flat.allHigh} title={title} />
              <div className="sl-options">
                {listed.map(action => {
                  const view = views.find(entry => entry.id === action.id);
                  const status: OptionStatus = view ? (view.eligible ? 'eligible' : 'blocked') : isGenericResponseExit(s, action) || conditionHolds(action.visibleWhen, run) ? 'not-offered' : 'hidden';
                  const bands = bandsFor(action.id);
                  const near = flat.pairs.filter(pair => pair.a === action.id || pair.b === action.id).map(pair => title(pair.a === action.id ? pair.b : pair.a));
                  return (
                    <OptionCard key={action.id} action={action} view={view} s={s} status={status} flatWith={near} open={openAll}
                      selected={selected === action.id} onSelect={() => setSelected(selected === action.id ? null : action.id)}
                      buttons={view?.eligible ? (
                        <>
                          {BANDS.map(band => (
                            <button key={band} type="button" className={`sl-btn-${band}`} disabled={!bands.has(band)} title={bands.has(band) ? `Commit with dice that land ${band}` : `${band} cannot occur at these odds`}
                              onClick={() => act({ kind: 'decide', actionId: action.id, band })}>{band}</button>
                          ))}
                          <button type="button" onClick={() => act({ kind: 'roll', actionId: action.id })} title="Commit with the run's own dice">roll</button>
                        </>
                      ) : undefined} />
                  );
                })}
              </div>
              {continuations.map(entry => (
                <p key={entry.actionId} className="sl-continue">
                  <button type="button" onClick={() => act({ kind: 'continue', actionId: entry.actionId })}>{entry.label}</button> {entry.description}
                </p>
              ))}
              {failure && (
                <p className="sl-continue">
                  <button type="button" className="sl-btn-adverse" onClick={() => act({ kind: 'fail', actionId: 'response_failure' })}>{failure.title}</button> {failure.reason} <span className="sl-dim">{failure.consequence}</span>
                </p>
              )}
            </>
          )}
        </div>
        <aside className="sl-run-side">
          {built && (
            <div className="sl-map">
              <Blueprint built={built} spaces={spaceViews(state)} squadTasks={run.squadTasks} selectedSpaceId={null} focusSquadId="A"
                highlightSpaceIds={selectedView?.targetId ? [selectedView.targetId] : undefined} overlays={selectedView?.overlays} environment={s.environment} />
            </div>
          )}
          <p className="sl-dim">{selectedView ? `Map shows ${selectedView.title}: target and spatial overlays.` : 'Click an option to draw its target and overlays.'}</p>
          <h3>Knowledge</h3>
          <ul className="sl-kv">
            {s.facts.map(fact => (
              <li key={fact.id}><span>{factLabel(s, fact.id)}</span> <b className={`sl-k-${run.knowledge[fact.id] ?? 'unknown'}`}>{run.knowledge[fact.id] ?? 'unknown'}</b> <span className="sl-dim">truth {fact.truth ? 'true' : 'false'}</span></li>
            ))}
          </ul>
          {(s.externalServices?.length ?? 0) > 0 && (
            <>
              <h3>Services</h3>
              <ul className="sl-kv">{s.externalServices!.map(service => <li key={service.id}><span>{service.label}</span> <b>{externalSupportStatus(run, service)}</b></li>)}</ul>
            </>
          )}
          {(s.civilianOutcomes?.length ?? 0) > 0 && (
            <>
              <h3>People</h3>
              <ul className="sl-kv">{civilianOutcomeViews(s, run).map(person => <li key={person.id}><span>{person.label}</span> <b>{person.status}</b></li>)}</ul>
            </>
          )}
          <h3>Flags</h3>
          <p className="sl-flags">{run.flags.filter(flag => !flag.startsWith('used:')).map(flag => <span key={flag} className="sl-chip">{flag}</span>)}{run.flags.some(flag => flag.startsWith('used:')) ? <span className="sl-dim"> + {run.flags.filter(flag => flag.startsWith('used:')).length} used: markers</span> : null}</p>
        </aside>
      </div>
    </section>
  );
}
