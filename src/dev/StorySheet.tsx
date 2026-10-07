// Dev story sheet: /story.html. Not linked from the game and not part of the app entry.
// Two views of the incident content the game can draw now (docs/content-pipeline.md, "Human review"):
//
// Scenario lab (default, ?view=lab): every type in the current catalog, hand-authored stories
// and typed framework packages alike. One generated call at a time: briefing, people, services,
// pressure, rewards and the plan; every option by stage with the engine's odds for a reference
// squad (flat odds flagged); endings with the paths that reach them; and a step-through run where
// each option is committed through the real dispatcher with a chosen or natural result.
//
//   /story.html?type=hostage_crisis&family=market_row&seed=7&variant=1&tier=2
//   optional: &pacing=deliberate_answers   the other pacing of the situation
//             &call=123                    exact call seed (cast and room); the situation follows it
//             &id=gen:…                    any issued incident ID, at its own content version
//             &kit=full                    squad A carries every item, not only day-one gear
//             &path=a~favorable,b~adverse  step-through moves (~mixed, ~roll, ~continue, ~fail)
//
// Gate review (?view=gates): human review of the typed framework packages only. For one
// framework, every situation's briefing, choices and endings bound to six sampled buildings,
// next to the automated gate results.
//
//   /story.html?view=gates&type=water_leak   one framework (default: the newest drop)
//   optional: &pacing=deliberate_answers     the other pacing; &seed=40 shifts the sampled buildings
//             &journeys=1                    also play real dispatch journeys (slower; implies view=gates)
import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../ui/theme.css';
import './story-sheet.css';
import './scenario-lab/scenario-lab.css';
import { ScenarioLab } from './scenario-lab/ScenarioLab';
import type { Navigate } from './scenario-lab/ScenarioLab';
import type { ScenarioCharacteristic } from '../content/scenario-recipes';
import type { ScenarioDefinition } from '../sim/scenario-types';
import { hashSeed } from '../sim/rng';
import { generateIncident, incidentId } from '../gen/incident';
import { gateFrameworks, specForSituation, VARIANTS } from '../gen/incident/gates/catalog';
import type { GateFramework, Variant } from '../gen/incident/gates/catalog';
import { lintFrameworkData, lintScenario } from '../gen/incident/gates/prose-lint';
import type { ProseIssue } from '../gen/incident/gates/prose-lint';
import { collisions, fingerprintById } from '../gen/incident/gates/distinctness';
import type { RecipeFingerprint } from '../gen/incident/gates/distinctness';
import { bindingProblems, frameworkJourneys } from '../gen/incident/gates/playability';
import type { JourneyResult } from '../gen/incident/gates/playability';

const SAMPLES = 6;
const FRAMEWORKS = gateFrameworks();

interface Sample { familyId: string; buildingSeed: number; id: string; scenario: ScenarioDefinition | null; error?: string; lint: ProseIssue[]; binding: string[] }

/** Six buildings spread over the framework's building types, authored and generated. */
function samples(entry: GateFramework, variant: Variant, pacing: ScenarioCharacteristic, offset: number): Sample[] {
  return Array.from({ length: SAMPLES }, (_, index) => {
    const familyId = entry.families[(index + offset) % entry.families.length];
    const buildingSeed = hashSeed(`${familyId}:${index + offset}:story-sheet`) % 100000;
    const spec = specForSituation(entry.framework.type, familyId, variant, buildingSeed, pacing);
    const id = incidentId(spec);
    try {
      const scenario = generateIncident(spec);
      return { familyId, buildingSeed, id, scenario, lint: lintScenario(scenario, entry.framework), binding: bindingProblems(scenario) };
    } catch (error) {
      return { familyId, buildingSeed, id, scenario: null, error: String(error), lint: [], binding: [] };
    }
  });
}

function Issues({ issues, empty }: { issues: { rule?: string; where?: string; detail: string; text?: string }[]; empty: string }) {
  if (!issues.length) return <p className="ss-ok">{empty}</p>;
  return (
    <ul className="ss-issues">
      {issues.map((issue, index) => (
        <li key={index}>
          {issue.rule && <b>{issue.rule}</b>} {issue.where && <code>{issue.where}</code>} {issue.detail}
          {issue.text && <q>{issue.text}</q>}
        </li>
      ))}
    </ul>
  );
}

function Call({ sample }: { sample: Sample }) {
  const s = sample.scenario;
  if (!s) return <article className="ss-call ss-bad"><h4>{sample.familyId} · seed {sample.buildingSeed}</h4><p className="ss-err">{sample.error}</p></article>;
  const moved = s.locationSeed !== sample.buildingSeed || !s.locationFamilyId.startsWith(sample.familyId);
  const evidence = s.facts[1];
  const bad = sample.lint.length > 0 || sample.binding.length > 0;
  return (
    <article className={`ss-call${bad ? ' ss-bad' : ''}`}>
      <h4>{sample.familyId} · seed {sample.buildingSeed}{moved ? ` → hosted on ${s.locationFamilyId.replace('__furnished_v7', '')} ${s.locationSeed}` : ''}</h4>
      <p className="ss-meta"><code>{sample.id}</code></p>
      <section>
        <h5>Card and briefing</h5>
        <p><b>{s.title}</b> · {s.variantLabel}</p>
        <p className="ss-dispatch">{s.briefing.dispatchReason}</p>
        <ul>{s.briefing.known.map((line, index) => <li key={index}>{line}</li>)}</ul>
        <p className="ss-q">{s.briefing.unknown.join(' ')}</p>
      </section>
      <section>
        <h5>Choices</h5>
        {(['assess', 'adapt', 'resolve'] as const).map(stage => (
          <div key={stage} className="ss-stage">
            <span className="ss-stage-label">{stage}</span> <i>{s.stages[stage].prompt}</i>
            <ol>
              {s.stages[stage].actions.map(action => (
                <li key={action.id}>
                  <b>{action.title}</b> <span className="ss-dim">({action.check.kind}{action.visibleWhen ? ', shown when it applies' : ''})</span>
                  <br />{action.summary}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
      <section>
        <h5>What the check finds</h5>
        <p><span className="ss-tag">{evidence.truth ? 'claim holds' : 'claim is wrong'}</span> {evidence.truth ? evidence.resolved?.confirmed : evidence.resolved?.disproved}</p>
        <h5>Endings</h5>
        <ul>{Object.values(s.endings).map(ending => <li key={ending.id}><b>{ending.title}</b>: {ending.summary}</li>)}</ul>
      </section>
      <section>
        <h5>Gates on this call</h5>
        <Issues issues={sample.lint} empty="Prose lint: no issues" />
        <Issues issues={sample.binding.map(detail => ({ rule: 'binding', detail }))} empty="Binding and squad reach: no issues" />
      </section>
    </article>
  );
}

function Distinctness({ entry }: { entry: GateFramework }) {
  const [state, setState] = useState<{ prints: RecipeFingerprint[]; clashes: string[] } | null>(null);
  useEffect(() => {
    // Defer the exploration so the sheet paints first.
    const timer = setTimeout(() => {
      const prints = FRAMEWORKS.flatMap(({ framework, families }) => VARIANTS.map(variant =>
        fingerprintById(incidentId(specForSituation(framework.type, families[0], variant)), `${framework.type}/${variant}`)));
      const mine = new Set(VARIANTS.map(variant => `${entry.framework.type}/${variant}`));
      const clashes = collisions(prints).filter(pair => mine.has(pair.a) || mine.has(pair.b)).map(pair => `${pair.a} plays exactly like ${pair.b}`);
      setState({ prints: prints.filter(print => mine.has(print.key)), clashes });
    }, 50);
    return () => clearTimeout(timer);
  }, [entry]);
  if (!state) return <p className="ss-dim">Exploring every decision path…</p>;
  return (
    <>
      <p>{state.prints.map(print => `${print.key}: ${print.paths.length} paths, fingerprint ${print.hash}`).join(' · ')}</p>
      <Issues issues={state.clashes.map(detail => ({ rule: 'distinctness', detail }))} empty="Distinct from every other typed framework recipe (the test suite also compares the six authored stories)" />
    </>
  );
}

function Journeys({ entry }: { entry: GateFramework }) {
  const [results, setResults] = useState<JourneyResult[] | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setResults(frameworkJourneys(entry.framework.type, entry.families[0])), 50);
    return () => clearTimeout(timer);
  }, [entry]);
  if (!results) return <p className="ss-dim">Playing journeys through the dispatcher…</p>;
  return (
    <ul className="ss-issues">
      {results.map((result, index) => (
        <li key={index} className={result.problems.length ? 'ss-err' : ''}>
          <code>{result.id}</code> {index % 2 ? 'failed response' : 'complete'}: {result.endingId} after {result.steps.length} steps, {result.saveRoundTrips} save round trips
          {result.problems.length ? ` · ${result.problems.join('; ')}` : ''}
        </li>
      ))}
    </ul>
  );
}

function GateReview() {
  const query = new URLSearchParams(window.location.search);
  const type = query.get('type') ?? FRAMEWORKS.filter(entry => entry.since >= 11).at(-1)?.framework.type ?? FRAMEWORKS[0].framework.type;
  const entry = FRAMEWORKS.find(candidate => candidate.framework.type === type) ?? FRAMEWORKS[0];
  const pacing: ScenarioCharacteristic = query.get('pacing') === 'deliberate_answers' ? 'deliberate_answers' : 'ordinary';
  const offset = Math.max(0, Number(query.get('seed')) || 0);
  const situations = useMemo(() => VARIANTS.map(variant => ({ variant, calls: samples(entry, variant, pacing, offset) })), [entry, pacing, offset]);
  const data = useMemo(() => lintFrameworkData(entry.framework), [entry]);
  useEffect(() => { requestAnimationFrame(() => { document.body.dataset.ready = '1'; }); }, []);
  const go = (next: Record<string, string>) => { const q = new URLSearchParams(query); for (const [k, v] of Object.entries(next)) q.set(k, v); window.location.search = q.toString(); };
  const f = entry.framework;
  const failing = situations.flatMap(({ calls }) => calls).filter(call => !call.scenario || call.lint.length || call.binding.length).length;
  return (
    <div className="ss-page">
      <header>
        <h1>Gate review · {f.title}</h1>
        <div className="ss-controls">
          <label>Framework
            <select value={f.type} onChange={event => go({ type: event.target.value })}>
              {FRAMEWORKS.map(candidate => <option key={candidate.framework.type} value={candidate.framework.type}>{candidate.label} · {candidate.framework.type}{candidate.since >= 11 ? ' (new in v11)' : ''}</option>)}
            </select>
          </label>
          <label>Pacing
            <select value={pacing} onChange={event => go({ pacing: event.target.value })}>
              <option value="ordinary">Ordinary</option>
              <option value="deliberate_answers">Thinks before answering</option>
            </select>
          </label>
          <label>Building offset
            <input defaultValue={String(offset)} onKeyDown={event => event.key === 'Enter' && go({ seed: event.currentTarget.value })} />
          </label>
        </div>
        <p className="ss-dim">Buildings: {entry.families.join(', ')} · squads {entry.squads.join('–')} · listed since v{entry.since}. Review each call as a player would read it, then record approve, edit or reject in the pull request (docs/content-pipeline.md).</p>
      </header>
      <section className="ss-gates">
        <h2>Gates for the package</h2>
        <h3>Prose lint on the package data (longest drawable names)</h3>
        <Issues issues={data} empty="No issues" />
        <h3>Sampled calls</h3>
        <p className={failing ? 'ss-err' : 'ss-ok'}>{failing ? `${failing} of ${SAMPLES * 3} sampled calls have gate issues (outlined in red)` : `All ${SAMPLES * 3} sampled calls pass the prose, binding and reach gates`}</p>
        <h3>Distinctness</h3>
        <Distinctness entry={entry} />
        <h3>Dispatch journeys</h3>
        {query.get('journeys') === '1' ? <Journeys entry={entry} /> : <p className="ss-dim">Add <code>&amp;journeys=1</code> to play them here; the test suite always does.</p>}
      </section>
      {situations.map(({ variant, calls }) => (
        <section key={variant} className="ss-situation">
          <h2>Situation {variant + 1}: <span className="ss-note">{f.variants[variant]}</span></h2>
          <p className="ss-dim">Authoring note, never shown before the check. The claim {f.truth[variant] ? 'holds' : 'is wrong'}{variant === 2 ? '; the first report is incomplete, so the independent source is required before the check' : ''}.</p>
          <div className="ss-grid">{calls.map(call => <Call key={call.id} sample={call} />)}</div>
        </section>
      ))}
    </div>
  );
}

/** The URL is the page state: controls push a new entry, the step-through replaces it. */
function useQuery(): [URLSearchParams, Navigate] {
  const [search, setSearch] = useState(window.location.search);
  useEffect(() => {
    const onPop = () => setSearch(window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate: Navigate = (next, mode = 'push') => {
    // Keep IDs and step paths readable in a shared link (':', ',' and '~' need no escaping in a query).
    const url = `${window.location.pathname}?${new URLSearchParams(next).toString().replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%7E/g, '~')}`;
    if (mode === 'replace') window.history.replaceState(null, '', url); else window.history.pushState(null, '', url);
    setSearch(window.location.search);
  };
  return [new URLSearchParams(search), navigate];
}

function StorySheet() {
  const [query, navigate] = useQuery();
  // Links from before the lab (…&journeys=1) still open the gate review.
  const view = query.get('view') === 'gates' || (!query.get('view') && query.has('journeys')) ? 'gates' : 'lab';
  useEffect(() => { requestAnimationFrame(() => { document.body.dataset.ready = '1'; }); }, []);
  const type = query.get('type');
  const toGates = () => navigate({ view: 'gates', ...(type && FRAMEWORKS.some(entry => entry.framework.type === type) ? { type } : {}) });
  const toLab = () => navigate({ view: 'lab', ...(type ? { type } : {}) });
  return (
    <>
      <nav className="sl-tabs" aria-label="Story sheet views">
        <span className="sl-brand">Story sheet</span>
        <button type="button" aria-pressed={view === 'lab'} onClick={toLab}>Scenario lab</button>
        <button type="button" aria-pressed={view === 'gates'} onClick={toGates}>Gate review · typed packages</button>
        {view === 'lab' && <span className="sl-jump"><a href="#controls">call</a><a href="#scenario">briefing</a><a href="#options">options</a><a href="#endings">endings</a><a href="#run">step-through</a></span>}
      </nav>
      {view === 'gates' ? <GateReview key={query.toString()} /> : <div className="sl-page"><ScenarioLab query={query} navigate={navigate} /></div>}
    </>
  );
}

const host = document.getElementById('root')! as HTMLElement & { __root?: ReturnType<typeof createRoot> };
host.__root ??= createRoot(host);
host.__root.render(
  <StrictMode>
    <StorySheet />
  </StrictMode>,
);
