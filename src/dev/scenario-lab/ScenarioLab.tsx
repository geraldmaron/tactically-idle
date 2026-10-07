// Scenario lab: every incident type the game can draw now, one generated call at a time, with
// its briefing, people, options by stage (odds from the engine for a reference department),
// endings and a step-through run. Part of the dev story sheet (/story.html); see StorySheet.tsx.
import { useEffect, useMemo, useState } from 'react';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { builtForScenario, spaceViewsForScenario } from '../../sim/operation-selectors';
import { conditionHolds, RATING_LABEL } from '../../sim/resolution';
import { isGenericResponseExit } from '../../sim/response-failure';
import { ITEMS } from '../../content/items';
import { INCIDENT_CONTENT_VERSION } from '../../gen/incident';
import { Blueprint } from '../../ui/blueprint/Blueprint';
import { CATALOG, catalogEntry, createExplorer, FALLBACK_ENDING, encodePath, endingSources, familyGeneration, familyLabel, flatness, nextCallSeed, pacingLabel,
  paramsToQuery, readParams, resolveScenario, ruleText, situationKey, situationsOf, STAGE_WALK_CAP, stageEntries, STAGES } from './model';
import type { Exploration, LabParams, StageEntry, StageWalk } from './model';
import { actionTitle, conditionText, spaceLabel } from './describe';
import { FlatBanner, OptionCard } from './parts';
import type { OptionStatus } from './parts';
import { moveLabel, StepThrough } from './StepThrough';

export type Navigate = (next: Record<string, string>, mode?: 'push' | 'replace') => void;

export function ScenarioLab({ query, navigate }: { query: URLSearchParams; navigate: Navigate }) {
  const params = readParams(query);
  // Keyed on the fields that pick the call; the kit and the step-through path never change it.
  const resolved = useMemo(() => resolveScenario(params), [params.id, params.type, params.family, params.seed, params.variant, params.pacing, params.tier, params.call]);
  // Controls show the call actually loaded (from an ID too); editing one keeps the rest.
  const shown: LabParams = resolved.spec && params.id ? {
    ...params, id: null, type: resolved.spec.type, family: resolved.spec.familyId, seed: resolved.spec.buildingSeed, tier: resolved.spec.tier, call: resolved.spec.seed,
    variant: resolved.situation?.variant ?? 0, pacing: resolved.situation?.characteristic ?? 'ordinary',
  } : params;
  const set = (patch: Partial<LabParams>) => {
    // A kit change keeps an exact ID (and its content version); any other change edits the call.
    const kitOnly = Object.keys(patch).every(key => key === 'kit' || key === 'path');
    const next: LabParams = { ...(kitOnly ? params : shown), path: '', ...patch };
    const entry = catalogEntry(next.type)!;
    if (!entry.families.includes(next.family)) next.family = entry.families[0];
    navigate({ view: 'lab', ...paramsToQuery(next) });
  };
  const setPath = (path: string) => navigate({ view: 'lab', ...paramsToQuery({ ...params, path }) }, 'replace');
  const s = resolved.scenario;
  return (
    <div className="sl-lab">
      <Controls shown={shown} params={params} resolved={resolved} set={set} />
      <Catalog current={shown.type} onPick={type => set({ type, call: null })} />
      {resolved.error && <p className="sl-err sl-panel">Could not generate this call: {resolved.error}</p>}
      {s && resolved.id && (
        <>
          <Overview s={s} id={resolved.id} params={shown} recipeId={resolved.recipeId} contentVersion={resolved.spec?.contentVersion ?? INCIDENT_CONTENT_VERSION} />
          <StageOptions key={`${resolved.id}|${params.kit}`} s={s} id={resolved.id} params={params} openPath={path => setPath(path)} />
          <Endings key={`e${resolved.id}|${params.kit}`} s={s} id={resolved.id} params={params} openPath={path => setPath(path)} />
          <StepThrough id={resolved.id} s={s} kit={params.kit} path={params.path} onPath={setPath} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- controls and catalog

function Controls({ shown, params, resolved, set }: { shown: LabParams; params: LabParams; resolved: ReturnType<typeof resolveScenario>; set: (patch: Partial<LabParams>) => void }) {
  const entry = catalogEntry(shown.type)!;
  const situations = situationsOf(shown.type);
  const current = resolved.situation ? situationKey(resolved.situation) : situationKey({ variant: shown.variant, characteristic: shown.pacing });
  const [seedText, setSeedText] = useState(String(shown.seed));
  const [idText, setIdText] = useState(params.id ?? resolved.id ?? '');
  useEffect(() => setSeedText(String(shown.seed)), [shown.seed]);
  useEffect(() => setIdText(params.id ?? resolved.id ?? ''), [params.id, resolved.id]);
  const applySeed = () => { const n = Number(seedText); if (Number.isFinite(n) && n >= 0 && n !== shown.seed) set({ seed: Math.floor(n) }); };
  return (
    <div className="sl-controls sl-panel" id="controls">
      <label>Incident type
        <select value={shown.type} onChange={event => set({ type: event.target.value as LabParams['type'], call: null })}>
          {(['story', 'typed'] as const).map(source => (
            <optgroup key={source} label={source === 'story' ? 'Hand-authored stories (v5/v6)' : 'Typed framework packages'}>
              {CATALOG.filter(item => item.source === source).map(item => <option key={item.type} value={item.type}>{item.label} · {item.type}{item.retired ? ' (retired from dispatch)' : ''}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label>Building
        <select value={shown.family} onChange={event => set({ family: event.target.value })}>
          {entry.families.map(id => <option key={id} value={id}>{familyLabel(id)} · {id} ({familyGeneration(id)})</option>)}
        </select>
      </label>
      <label>Building seed
        <span className="sl-inline">
          <input inputMode="numeric" value={seedText} onChange={event => setSeedText(event.target.value)} onBlur={applySeed} onKeyDown={event => event.key === 'Enter' && applySeed()} />
          <button type="button" onClick={() => set({ seed: Math.floor(Math.random() * 100000) })}>random</button>
        </span>
      </label>
      <label>Situation
        <select value={current} onChange={event => { const [variant, pacing] = event.target.value.split('/'); set({ variant: Number(variant) as LabParams['variant'], pacing: pacing as LabParams['pacing'], call: null }); }}>
          {situations.map(item => <option key={situationKey(item)} value={situationKey(item)}>situation {item.variant + 1} · {pacingLabel(item.characteristic)}</option>)}
        </select>
      </label>
      <label>Call seed
        <span className="sl-inline">
          <input readOnly value={resolved.spec?.seed ?? ''} title={shown.call === null ? 'First call seed that draws this situation' : 'Fixed call seed'} />
          <button type="button" disabled={!resolved.spec || !resolved.situation} onClick={() => set({ call: nextCallSeed(resolved.spec!, resolved.situation!, resolved.spec!.seed) })} title="Next call seed with the same situation: another cast and room">next cast</button>
          {shown.call !== null && <button type="button" onClick={() => set({ call: null })}>reset</button>}
        </span>
      </label>
      <label>Tier
        <select value={shown.tier} onChange={event => set({ tier: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map(tier => <option key={tier} value={tier}>{tier}</option>)}</select>
      </label>
      <label>Reference kit
        <select value={shown.kit} onChange={event => set({ kit: event.target.value as LabParams['kit'], path: shown.path })}>
          <option value="day1">day-one department (startGateRun)</option>
          <option value="full">every item (unlocked gear too)</option>
        </select>
      </label>
      <label className="sl-wide">Incident ID
        <input value={idText} onChange={event => setIdText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && idText.trim() && idText.trim() !== resolved.id) set({ id: idText.trim() }); }} title="Paste any issued gen:… ID and press Enter" />
      </label>
    </div>
  );
}

function Catalog({ current, onPick }: { current: string; onPick: (type: LabParams['type']) => void }) {
  return (
    <details className="sl-panel" id="catalog">
      <summary><h2>Catalog <span className="sl-dim">· {CATALOG.length} types at content v{INCIDENT_CONTENT_VERSION}, {CATALOG.filter(e => !e.retired).length} dispatched</span></h2></summary>
      <div className="sl-scroll">
        <table className="sl-table">
          <thead><tr><th>Type</th><th>Source</th><th>Unlock rule</th><th>Dispatch</th><th>Squads</th><th>Buildings</th></tr></thead>
          <tbody>
            {CATALOG.map(entry => (
              <tr key={entry.type} className={entry.type === current ? 'sl-current' : ''} onClick={() => onPick(entry.type)}>
                <td><b>{entry.label}</b><br /><code>{entry.type}</code></td>
                <td>{entry.source === 'story' ? 'authored story' : 'typed framework'}<br /><span className="sl-dim">since v{entry.since}</span></td>
                <td>{ruleText(entry.rule)}</td>
                <td>{entry.retired ? <span className="sl-tag sl-tag-retired">retired</span> : 'live'}</td>
                <td>{entry.squads.join('–')}</td>
                <td className="sl-families">{entry.families.length}: {entry.families.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- the call

function Overview({ s, id, params, recipeId, contentVersion }: { s: ScenarioDefinition; id: string; params: LabParams; recipeId: string | null; contentVersion: number }) {
  const built = useMemo(() => builtForScenario(id), [id]);
  const spaces = useMemo(() => spaceViewsForScenario(id), [id]);
  const entry = catalogEntry(s.incident?.type ?? params.type);
  const moved = s.incident && (s.locationSeed !== s.incident.buildingSeed || !s.locationFamilyId.startsWith(s.incident.familyId));
  const people = Object.values(s.story?.bindings.people ?? {});
  return (
    <section className="sl-panel" id="scenario">
      <div className="sl-overview">
        <div>
          <h2>{s.title} <span className="sl-dim">· {s.code} · {s.variantLabel}</span></h2>
          <p className="sl-meta"><code>{id}</code>{recipeId ? <> · recipe <code>{recipeId}</code></> : null} · content v{contentVersion} · scenario v{s.version}
            {entry?.retired ? <> · <span className="sl-tag sl-tag-retired">retired from dispatch</span></> : null}</p>
          <p className="sl-meta">Building {s.locationFamilyId} seed {s.locationSeed}{moved ? ` (drawn ${s.incident!.familyId} seed ${s.incident!.buildingSeed}; that seed could not host the call)` : ''} · {s.setting} · squads {s.squadRange.min}–{s.squadRange.max} · {s.pressureLabel}</p>
          <p className="sl-summary">{s.summary}</p>
          <div className="sl-cards">
            <div className="sl-card">
              <h3>Briefing</h3>
              {s.briefing.dispatchReason && <p className="sl-dispatch">{s.briefing.dispatchReason}</p>}
              <h4>Known</h4><ul>{s.briefing.known.map((line, index) => <li key={index}>{line}</li>)}</ul>
              <h4>Unknown</h4><ul>{s.briefing.unknown.map((line, index) => <li key={index}>{line}</li>)}</ul>
              {s.briefing.teamResponsibilities?.length ? <><h4>Team responsibilities</h4><ul>{s.briefing.teamResponsibilities.map((line, index) => <li key={index}>{line}</li>)}</ul></> : null}
              {s.story?.episode?.publicContext.length ? <><h4>Episode context</h4><ul>{s.story.episode.publicContext.map((line, index) => <li key={index}>{line}</li>)}</ul></> : null}
            </div>
            <div className="sl-card">
              <h3>People</h3>
              {people.length > 0 && <ul>{people.map(person => <li key={person.id}><b>{person.label}</b> <span className="sl-dim">{person.publicKind ?? 'person'} · {person.id}</span> in {spaceLabel(built, person.initial.spaceId)}{person.reported ? `, reported in ${spaceLabel(built, person.reported.spaceId)}` : ''}</li>)}</ul>}
              {(s.people?.length ?? 0) > 0 && <ul>{s.people!.map(person => <li key={person.id}><b>{person.label}</b> <span className="sl-dim">{person.role}</span> in {spaceLabel(built, person.spaceId)}{person.threat ? ` · ${person.threat.armament}, ${person.threat.disposition}, ${person.threat.intent}` : ''}</li>)}</ul>}
              {(s.civilianOutcomes?.length ?? 0) > 0 && <><h4>Civilian outcomes tracked</h4><ul>{s.civilianOutcomes!.map(c => <li key={c.id}>{c.label} <span className="sl-dim">safe {c.safeFlag} · injured {c.injuredFlag} · care {c.careFlag}</span></li>)}</ul></>}
              {Object.keys(s.story?.cast ?? {}).length > 0 && <p className="sl-dim">Cast: {Object.entries(s.story!.cast!).map(([role, name]) => `${role} = ${name.firstName} ${name.surname} (${name.pronouns})`).join(' · ')}</p>}
              {s.story?.characteristics?.length ? <p className="sl-dim">Characteristics: {s.story.characteristics.map(c => c.label).join('; ')}</p> : null}
              {s.story?.episode && <p className="sl-dim">Episode {s.story.episode.variantId}: {s.story.episode.modules.join(', ')}</p>}
              {Object.keys(s.story?.bindings.props ?? {}).length > 0 && <p className="sl-dim">Props: {Object.values(s.story!.bindings.props).map(prop => prop.label).join(', ')}</p>}
              {!people.length && !s.people?.length && <p className="sl-dim">No bound people.</p>}
            </div>
            <div className="sl-card">
              <h3>Facts <span className="sl-dim">(engine truth shown)</span></h3>
              <ul>{s.facts.map(fact => <li key={fact.id}>{fact.label} <span className="sl-dim">starts {fact.initial} · claim is {fact.truth ? 'true' : 'false'}{fact.source ? ` · ${fact.source}` : ''}</span></li>)}</ul>
            </div>
            <div className="sl-card">
              <h3>Services, pressure, rewards</h3>
              {(s.externalServices ?? []).length > 0 ? <ul>{s.externalServices!.map(service => <li key={service.id}><b>{service.label}</b> <span className="sl-dim">{service.kind} · {service.available ? `${service.arrivalMinutes} min after request` : 'unavailable'}{service.acceptWhen ? ` · accepts when ${conditionText(service.acceptWhen, s).join('; ')}` : ''}</span><br />{service.description}</li>)}</ul> : <p className="sl-dim">No external services.</p>}
              <p>Pressure starts {s.pressure.start}, +{s.pressure.perMinute}/min; {s.pressure.civilianPerMinute ? `above ${s.pressure.threshold} civilian safety falls ${s.pressure.civilianPerMinute}/min` : 'civilian safety never falls with time'}.</p>
              <p>Rewards: funding {s.rewards.funding} · dev points {s.rewards.devPoints} · trust ±{s.rewards.trust} · xp {s.rewards.xp}</p>
              <h4>Objectives</h4><ul>{s.objectives.map(objective => <li key={objective.id}>{objective.label}</li>)}</ul>
              {s.environment && <p className="sl-dim">Environment: {s.environment.timeOfDay}, {s.environment.weather}, power {s.environment.power}{s.environment.hazards.length ? `, hazards ${s.environment.hazards.join('/')}` : ''}{s.environment.keyholder ? ', keyholder' : ''}{s.environment.cctv ? ', CCTV' : ''}</p>}
              {s.difficulty && <p className="sl-dim">Difficulty {s.difficulty.band} ({s.difficulty.score}): {s.difficulty.drivers.join('; ')}</p>}
            </div>
          </div>
        </div>
        <div className="sl-map sl-map-static">
          <Blueprint built={built} spaces={spaces} squadTasks={[]} selectedSpaceId={null} focusSquadId={null} environment={s.environment} />
          <p className="sl-dim">The plan as the briefing shows it ({built.location.rooms.length} rooms).</p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- options by stage

function statusAt(entry: StageEntry | undefined, s: ScenarioDefinition, actionId: string): OptionStatus {
  if (!entry) return 'unevaluated';
  const view = entry.views.find(item => item.id === actionId);
  if (view) return view.eligible ? 'eligible' : 'blocked';
  const action = STAGES.flatMap(stage => s.stages[stage].actions).find(item => item.id === actionId)!;
  return isGenericResponseExit(s, action) || conditionHolds(action.visibleWhen, entry.state.activeRun!) ? 'not-offered' : 'hidden';
}
const ORDER: Record<OptionStatus, number> = { eligible: 0, blocked: 1, hidden: 2, unevaluated: 3, 'not-offered': 4 };

function StageOptions({ s, id, params, openPath }: { s: ScenarioDefinition; id: string; params: LabParams; openPath: (path: string) => void }) {
  const [walk, setWalk] = useState<StageWalk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAll, setOpenAll] = useState(false);
  const [offeredOnly, setOfferedOnly] = useState(false);
  useEffect(() => {
    // Defer the engine walk so the briefing paints first.
    const timer = setTimeout(() => {
      try { setWalk(stageEntries(id, params.kit)); } catch (failure) { setError(String(failure)); }
    }, 30);
    return () => clearTimeout(timer);
  }, [id, params.kit]);
  const entries = walk?.entries ?? null;
  const start = entries?.assess?.state;
  const squad = start ? start.squads.find(item => item.id === 'A') : null;
  const kit = start ? Object.values(start.units).filter(unit => unit.id.startsWith('kit_A_')).map(unit => ITEMS[unit.itemId]?.name ?? unit.itemId) : [];
  return (
    <section className="sl-panel" id="options">
      <div className="sl-panel-head">
        <h2>Options by stage</h2>
        <div className="sl-toolbar">
          <label className="sl-check"><input type="checkbox" checked={offeredOnly} onChange={event => setOfferedOnly(event.target.checked)} /> offered only</label>
          <label className="sl-check"><input type="checkbox" checked={openAll} onChange={event => setOpenAll(event.target.checked)} /> expand all</label>
        </div>
      </div>
      <p className="sl-dim">
        Odds are the engine's (actionViews) for a reference department: a new campaign (seed 719) with Squad A at the first entry
        {params.kit === 'day1' ? ', carrying one unit of each item a new department can field (startGateRun)' : ', carrying one unit of every item, unlocked or not'}.
        Each stage is evaluated at the first state where it is current, found breadth first with favourable results. Options a later state reveals show no odds here; use the step-through.
        Flat odds: two offered options within 5 points, or every offered option at 90% or more.
      </p>
      {squad && start && (
        <details className="sl-dept">
          <summary>Reference squad A: {squad.officerIds.map(officerId => start.officers[officerId]?.surname).join(', ')} · {kit.length} items</summary>
          <div className="sl-scroll">
            <table className="sl-table">
              <thead><tr><th>Officer</th>{Object.values(RATING_LABEL).map(label => <th key={label}>{label}</th>)}<th>Certs</th><th>Traits</th></tr></thead>
              <tbody>{squad.officerIds.map(officerId => start.officers[officerId]).filter(Boolean).map(officer => (
                <tr key={officer.id}><td>{officer.firstName} {officer.surname} <span className="sl-dim">{officer.role}</span></td>
                  {(Object.keys(RATING_LABEL) as (keyof typeof RATING_LABEL)[]).map(key => <td key={key}>{officer.ratings[key]}</td>)}
                  <td>{officer.certs.join(', ')}</td><td>{officer.traits.join(', ')}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="sl-dim">Kit: {kit.join(', ')}</p>
        </details>
      )}
      {error && <p className="sl-err">Could not start a reference run: {error}</p>}
      {!entries && !error && <p className="sl-dim">Walking the engine to each stage…</p>}
      {STAGES.map(stage => {
        const def = s.stages[stage];
        const entry = entries?.[stage];
        const flat = entry ? flatness(entry.views) : null;
        const title = (actionId: string) => entry?.views.find(view => view.id === actionId)?.title ?? actionId;
        const actions = [...def.actions].map(action => ({ action, status: statusAt(entry, s, action.id) }))
          .filter(item => !offeredOnly || item.status === 'eligible' || item.status === 'blocked')
          .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
        return (
          <div key={stage} className={`sl-stage${flat && (flat.pairs.length || flat.allHigh || flat.eligible < 2) ? ' sl-stage-flat' : ''}`}>
            <h3>{def.label} <span className="sl-dim">{def.label.toLowerCase() !== stage ? `· ${stage} ` : ''}· {def.actions.length} authored options</span></h3>
            <p className="sl-prompt">{def.prompt}</p>
            {def.contextPrompts?.length ? (
              <details><summary>{def.contextPrompts.length} context prompts</summary>
                <ul className="sl-small">{def.contextPrompts.map((item, index) => <li key={index}><span className="sl-when">if {conditionText(item.when, s).join('; ') || 'always'}</span> {item.prompt}</li>)}</ul>
              </details>
            ) : null}
            {entries && !entry && <p className="sl-warn">{walk!.complete
              ? 'No path reaches this stage with this squad and kit: every run ends or fails before it. Its options are listed without odds.'
              : `The engine walk did not reach this stage within ${STAGE_WALK_CAP} states; odds are unavailable here. Try the step-through or the full kit.`}</p>}
            {entry && (
              <>
                <p className="sl-dim">Evaluated after: {entry.path.length ? entry.path.map(move => moveLabel(s, move)).join(' › ') : 'the start of the call'}
                  {' '}<button type="button" className="sl-link" onClick={() => openPath(encodePath(entry.path))}>open in step-through</button></p>
                <FlatBanner eligible={flat!.eligible} pairs={flat!.pairs} allHigh={flat!.allHigh} title={title} />
              </>
            )}
            <div className="sl-options">
              {actions.map(({ action, status }) => {
                const view = entry?.views.find(item => item.id === action.id);
                const near = flat?.pairs.filter(pair => pair.a === action.id || pair.b === action.id).map(pair => title(pair.a === action.id ? pair.b : pair.a));
                return <OptionCard key={action.id} action={action} view={view} s={s} status={status} flatWith={near} open={openAll} />;
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

// ---------------------------------------------------------------- endings

function Endings({ s, id, params, openPath }: { s: ScenarioDefinition; id: string; params: LabParams; openPath: (path: string) => void }) {
  const sources = useMemo(() => endingSources(s), [s]);
  const [explore, setExplore] = useState<Exploration | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!running) return;
    let explorer: ReturnType<typeof createExplorer>;
    try { explorer = createExplorer(id, params.kit); } catch (failure) { setError(String(failure)); setRunning(false); return; }
    let timer = 0;
    const tick = () => {
      const result = explorer.step(40);
      setExplore(result);
      if (result.done) setRunning(false);
      else timer = window.setTimeout(tick, 0);
    };
    timer = window.setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [running, id, params.kit]);
  return (
    <section className="sl-panel" id="endings">
      <div className="sl-panel-head">
        <h2>Endings <span className="sl-dim">· {Object.keys(s.endings).length}</span></h2>
        <div className="sl-toolbar">
          <button type="button" disabled={running} onClick={() => { setExplore(null); setError(null); setRunning(true); }}>{explore ? 'Explore again' : 'Explore every path'}</button>
          {running && <button type="button" onClick={() => setRunning(false)}>Stop</button>}
        </div>
      </div>
      <p className="sl-dim">"Set by" lists the authored outcome effects that name each ending. "Explore every path" walks every band of every offered option through the engine for the same reference squad (deduplicated by stage, flags and knowledge, up to 6,000 states) and keeps the shortest path to each ending.</p>
      {error && <p className="sl-err">{error}</p>}
      {explore && (
        <p className={explore.truncated ? 'sl-warn' : 'sl-dim'}>
          {running ? 'Exploring… ' : explore.truncated ? 'Stopped at the state cap; results are partial. ' : explore.done ? 'Explored every reachable state. ' : 'Stopped. '}
          {explore.states} states · {Object.keys(explore.endings).length} of {Object.keys(s.endings).length} endings reached · {explore.decisionPoints} decision points: {explore.single} with one option, {explore.flatPairs} with options within 5 points, {explore.allHigh} with every option ≥ 90%.
        </p>
      )}
      <div className="sl-scroll">
        <table className="sl-table sl-endings">
          <thead><tr><th>Ending</th><th>Disposition</th><th>Completion needs</th><th>Set by</th><th>Shortest engine path</th></tr></thead>
          <tbody>
            {Object.values(s.endings).map(ending => {
              const path = explore?.endings[ending.id];
              return (
                <tr key={ending.id} className={explore && !path && (explore.done || explore.truncated) ? 'sl-unreached' : ''}>
                  <td><b>{ending.title}</b> <code>{ending.id}</code><br /><span className="sl-small">{ending.summary}</span></td>
                  <td>{ending.disposition ?? '—'}<br /><span className="sl-dim">trust {ending.trustAdjust >= 0 ? '+' : ''}{ending.trustAdjust} · strain {ending.strain >= 0 ? '+' : ''}{ending.strain}</span></td>
                  <td className="sl-small">{ending.completion ? [...conditionText(ending.completion, s), ...(ending.completion.acceptedServiceId ? [`accepted ${ending.completion.acceptedServiceId}`] : [])].join('; ') : '—'}
                    {ending.remainingTasks?.length ? <><br /><span className="sl-dim">remaining: {ending.remainingTasks.join('; ')}</span></> : null}</td>
                  <td className="sl-small">{(sources[ending.id] ?? []).map((source, index) => <div key={index} className={source.retiredExit ? 'sl-dim' : ''}>{source.stage} › {source.title} ({source.bands.join('/')}){source.conditional ? ' if conditions hold' : ''}{source.retiredExit ? ' · retired generic exit, never offered' : ''}</div>)}
                    {ending.id === FALLBACK_ENDING && <div className="sl-dim">every failed-response report</div>}
                    {!sources[ending.id] && ending.id !== FALLBACK_ENDING && <span className="sl-warn">no option in this call names it</span>}</td>
                  <td className="sl-small">{path ? <>{path.map(move => moveLabel(s, move)).join(' › ')} <button type="button" className="sl-link" onClick={() => openPath(encodePath(path))}>open</button></>
                    : explore ? <span className={explore.done || explore.truncated ? 'sl-warn' : 'sl-dim'}>{explore.truncated ? 'not reached before the state cap' : explore.done ? 'not reached with this squad and kit' : '…'}</span> : <span className="sl-dim">explore to find</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {explore && explore.flat.length > 0 && (
        <details>
          <summary>Flat decision points found ({explore.flat.length}{explore.flat.length >= 40 ? '+' : ''} distinct)</summary>
          <ul className="sl-small">
            {explore.flat.map(point => (
              <li key={point.key}><b>{point.stage}</b> · {point.note}: {point.key.split('|')[1].split('+').map(actionId => actionTitle(s, actionId)).join(', ')}
                {' '}<button type="button" className="sl-link" onClick={() => openPath(encodePath(point.path))}>open</button></li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
