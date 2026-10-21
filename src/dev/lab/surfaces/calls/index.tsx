// Calls (spec 3.1): the landing. Every call's shape, how it usually ends, where it stands on the CI
// gate and what lint found, on one page, so it is clear where to spend time. Nothing simulates on
// load: gate and run figures come from the pool's cache, with their age, or say "Not run".
import { useEffect, useMemo, useState } from 'react';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import type { GateCheck, Weight } from '../../../../gen/incident/trees-v13/balance';
import { dependencyIndex, lintTree, plainTokens, sentenceCase } from '../../../../gen/incident/trees-v13/dependencies';
import type { LintFinding } from '../../../../gen/incident/trees-v13/dependencies';
import { callGraph } from '../../../../gen/incident/trees-v13/graph';
import type { IncidentType, ScenarioDefinition } from '../../../../sim/scenario-types';
import { PeopleProvider, PeopleText } from '../../../../ui/people/PeopleText';
import { lexiconFor } from '../../../../ui/people/lexicon';
import { useLab } from '../../context';
import type { ReachTally } from '../../jobs/tally';
import { GATE_SECONDS } from '../../jobs/budgets';
import { usePoolStored } from '../../jobs/use-pool';
import { contentKey, resolveScenario } from '../../model/call';
import { treeClockNexts } from '../../model/clocks';
import { loadNotesFile } from '../../model/endpoints';
import { authoredEndingClass, dominant, layoutFlow } from '../../model/flow-layout';
import { gateVerdicts } from '../../model/gate-view';
import { percent, weightLabel } from '../../model/label';
import { simLint } from '../../model/sim-lint';
import { CALL_TEMPLATES, treeCounts } from '../../shell/CallSwitcher';
import { chordKey, isTyping } from '../../shell/keys';
import { useNarrow } from '../../shell/media';
import type { LabUrl, NotesFile, Surface } from '../../types';
import { defaultCall } from '../../url';
import { cx, Glyph, LintGlyph, modalOpen, ProgressLine, StackBar, WeightGlyph } from '../../viz';
import { ageText, descriptorLabel, endingWeights, findingSite, findingsFeed, gateHeadline, humanizeFinding, randomResults, severityCounts, situationContent, usuallyOf, WEIGHTS_BEST_FIRST } from './calls-model';
import type { FeedRow, Usually } from './calls-model';
import { useGate } from './gate-store';
import { GateRows } from './GateRows';
import './calls.css';

const TYPE_TAG: Record<string, string> = { hostage_crisis: 'Hostage', barricaded: 'Barricade', active_armed_incident: 'Armed', protected_rescue: 'Rescue' };
const USUALLY_JOB = (type: IncidentType) => ({ kind: 'reach-type' as const, type, tier: 2, style: 'random' as const, calls: 60 });

export default function CallsSurface() {
  const { url, navigate, jobs, tuning } = useLab();
  const { gate, run, cancel } = useGate();
  const pending = Object.keys(tuning.patch).length > 0;
  const verdicts = useMemo(() => gateVerdicts(gate.runs, undefined, pending), [gate.runs, pending]);
  const headline = gateHeadline(verdicts, pending);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  // Cached this-type tallies (random style, 60 calls), read without running anything, and again
  // whenever the cache takes a result.
  const stored = usePoolStored(jobs);
  const usuallyTallies = useMemo(() => Object.fromEntries(CALL_TEMPLATES.map(t => {
    const hit = jobs.cached?.(USUALLY_JOB(t.type), { patch: {}, contentKey: contentKey(t.type) });
    return [t.type, hit && hit.result.kind === 'reach' ? hit.result.tally : null];
  })) as Record<IncidentType, ReachTally | null>, [jobs, gate.runs, stored]);

  const lint = useMemo(() => Object.fromEntries(CALL_TEMPLATES.map(t => {
    let findings: LintFinding[] = [];
    try { findings = lintTree(t); } catch { findings = []; }
    const cached = usuallyTallies[t.type];
    if (cached) try { findings = [...findings, ...simLint(cached, callGraph(t.tree, { clockNexts: treeClockNexts(t.tree, t) }), 'this type · random style · 60 calls', t.tree)]; } catch { /* sim lint is extra */ }
    return [t.type, findings];
  })) as Record<IncidentType, LintFinding[]>, [usuallyTallies]);

  const notes = useNotesByType();
  const feed = useMemo(() => findingsFeed(CALL_TEMPLATES.map(t => ({ type: t.type, findings: lint[t.type] ?? [], notes: notes[t.type] ?? null }))), [lint, notes]);

  // R runs the gate.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || modalOpen() || chordKey(event)) return;
      if ((event.key === 'r' || event.key === 'R') && gate.status !== 'running') { event.preventDefault(); run(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gate.status, run]);

  const open = (type: IncidentType, tab: Surface, extra: Partial<LabUrl> = {}) =>
    navigate({ call: defaultCall(type), path: '', node: null, sel: null, handoff: null, hist: '', tab, ...extra });
  const progress = gate.progress;
  const done = progress?.done ?? 0, total = progress?.total ?? 0;

  return (
    <section className="lab-calls" aria-label="Calls">
      <header className={cx('lab-calls-gate', pending && 'lab-pending-mark')}>
        <div className="lab-calls-gate-what">
          <h1 className="lab-calls-gate-title"><Glyph name="scan" size={16} />CI gate</h1>
          <span className="lab-calls-gate-pop">tier 2 · day-one squads, a different one each call · 60 calls each (40 for best odds){pending ? ' · unsaved tuning' : ''}</span>
        </div>
        <p className="lab-calls-gate-status" role="status" data-status={gate.status}>
          {gate.status === 'running' ? <ProgressLine done={done} total={total || 1} label={`≈ ${done.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} calls played`} />
            : <>
              <b className={cx(headline.tone === 'fail' && 'lab-calls-fail', headline.tone === 'pass' && 'lab-calls-pass')}>{headline.text}</b>
              {gate.at !== null && <span className="lab-calls-age" data-age>{ageText(gate.at, now, gate.fromCache)}</span>}
              {gate.status === 'error' && <span className="lab-error-text">The gate stopped: {gate.error}</span>}
            </>}
        </p>
        {gate.status === 'running'
          ? <button type="button" className="lab-button" onClick={cancel}>Cancel</button>
          : <button type="button" className="lab-button lab-button-primary lab-calls-run" onClick={run} title="Plays the 11 gate jobs in the background workers (R)">
            <Glyph name="play" size={12} />Run gate ≈ {gate.runs.length && pending ? GATE_SECONDS.patchSide : GATE_SECONDS.bothSides} s
          </button>}
      </header>
      <div className="lab-calls-body">
        <div className="lab-calls-cards">
          {CALL_TEMPLATES.map(template => (
            <CallCard key={template.type} template={template} verdicts={verdicts.filter(v => v.check.type === template.type)} progress={progress}
              usually={usuallyOf(template.type, usuallyTallies[template.type], gate.runs)}
              endings={endingWeights(usuallyTallies[template.type], randomResults(template.type, gate.runs))}
              lint={(lint[template.type] ?? []).filter(f => !feed.some(row => row.muted && row.finding.id === f.id && row.type === template.type))}
              notes={(notes[template.type]?.notes ?? []).filter(n => n.severity !== 'accepted').length}
              current={url.call?.type === template.type} onOpen={tab => open(template.type, tab)}
              onCheck={() => open(template.type, 'outcomes', { scope: 'type', runs: null, style: 'random' })} />
          ))}
        </div>
        <Findings rows={feed} onOpen={row => { const site = findingSite(row.finding); open(row.type, site.tab, { sel: site.sel }); }} />
      </div>
    </section>
  );
}

function useNotesByType(): Partial<Record<IncidentType, NotesFile>> {
  const [notes, setNotes] = useState<Partial<Record<IncidentType, NotesFile>>>({});
  useEffect(() => {
    let live = true;
    Promise.all(CALL_TEMPLATES.map(t => loadNotesFile(t.type).then(loaded => [t.type, loaded.file] as const, () => [t.type, null] as const)))
      .then(found => { if (live) setNotes(Object.fromEntries(found.filter(([, file]) => file)) as Partial<Record<IncidentType, NotesFile>>); });
    return () => { live = false; };
  }, []);
  return notes;
}

/** The call's card hook, bound with its default draw's cast and people-colored. Generating a call
 * takes a few tens of milliseconds, so it happens after first paint, one call at a time; until then
 * the hook reads with role nouns. */
function useBoundSummary(type: IncidentType, delay: number): { text: string; scenario: ScenarioDefinition | null } {
  const template = INCIDENT_TEMPLATES[type]!;
  const [bound, setBound] = useState<{ text: string; scenario: ScenarioDefinition | null } | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const resolved = resolveScenario({ ...defaultCall(type), path: '' });
        if (resolved.scenario) setBound({ text: resolved.scenario.summary, scenario: resolved.scenario });
      } catch { /* the plain hook stays */ }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [type]);
  return bound ?? { text: plainHook(template), scenario: null };
}
const plainHook = (template: IncidentTemplate) => plainTokens(template.tree.summary, template.tree);

function CallCard({ template, verdicts, progress, usually, endings, lint, notes, current, onOpen, onCheck }: {
  template: IncidentTemplate; verdicts: ReturnType<typeof gateVerdicts>; progress: ReturnType<typeof useGate>['gate']['progress']; usually: Usually | null;
  endings: Record<string, Record<Weight, number>>; lint: LintFinding[]; notes: number; current: boolean; onOpen(tab: Surface): void; onCheck(check: GateCheck): void;
}) {
  const counts = treeCounts(template);
  const summary = useBoundSummary(template.type, 60 + CALL_TEMPLATES.indexOf(template) * 90);
  const lexicon = useMemo(() => (summary.scenario ? lexiconFor(summary.scenario, null, []) : null), [summary.scenario]);
  const severities = { error: lint.filter(f => f.severity === 'error').length, warn: lint.filter(f => f.severity === 'warn').length, info: lint.filter(f => f.severity === 'info').length };
  const checks = verdicts.length ? verdicts : gateVerdicts([]).filter(v => v.check.type === template.type);
  return (
    <article className={cx('lab-calls-card', current && 'lab-calls-card-current')} data-type={template.type} aria-labelledby={`lab-card-${template.type}`}>
      <header className="lab-calls-card-head">
        <button type="button" className="lab-calls-card-title" id={`lab-card-${template.type}`} onClick={() => onOpen('play')} title="Play this call (default draw)">
          {template.tree.title}
        </button>
        <span className="lab-calls-card-type">{template.label}</span>
      </header>
      <p className="lab-calls-hook"><PeopleProvider lexicon={lexicon}><PeopleText text={summary.text} /></PeopleProvider></p>
      <p className="lab-calls-counts" data-counts={`${counts.nodes}/${counts.choices}/${counts.endings}`}>
        <span><b>{counts.nodes}</b> decision points</span><span><b>{counts.choices}</b> choices</span><span><b>{counts.endings}</b> endings</span>
      </p>
      <Shape template={template} endings={endings} />
      <div className="lab-calls-usually">
        <span className="lab-calls-row-label">Usually</span>
        {usually ? <>
          <StackBar label={`How ${TYPE_TAG[template.type] ?? template.label} calls ended, random style, ${usually.n} calls`} height={12}
            parts={WEIGHTS_BEST_FIRST.map(w => ({ key: w, value: usually.counts[w], tone: w, label: weightLabel(w) }))} />
          <span className="lab-calls-usually-figures">
            {WEIGHTS_BEST_FIRST.map(w => <span key={w} title={`${weightLabel(w)}: ${usually.counts[w]} of ${usually.n} calls`}><WeightGlyph weight={w} size={12} />{percent(usually.counts[w] / usually.n)}</span>)}
          </span>
          <span className="lab-calls-usually-pop">random style · {usually.n} calls · this type</span>
        </> : <span className="lab-muted">Not run. Run the gate, or open Outcomes for this call.</span>}
      </div>
      <Content template={template} />
      <div className="lab-calls-checks">
        <span className="lab-calls-row-label">CI gate</span>
        <GateRows verdicts={checks} progress={progress} compact onOpen={onCheck} />
      </div>
      <footer className="lab-calls-card-foot">
        <span className="lab-calls-lint" title={lint.map(f => f.message).join('\n') || 'No lint findings'}>
          {severities.error > 0 && <span><LintGlyph severity="error" size={13} />{severities.error}</span>}
          <span><LintGlyph severity="warn" size={13} />{severities.warn}</span>
          <span><LintGlyph severity="info" size={13} />{severities.info}</span>
          <span className="lab-calls-notes"><Glyph name="note" size={13} />{notes} {notes === 1 ? 'note' : 'notes'}</span>
        </span>
        <span className="lab-calls-actions">
          <button type="button" className="lab-button" onClick={() => onOpen('play')}><Glyph name="play" size={11} />Play</button>
          <button type="button" className="lab-button" onClick={() => onOpen('flow')}>Flow</button>
          <button type="button" className="lab-button" onClick={() => onOpen('outcomes')}>Outcomes</button>
        </span>
      </footer>
    </article>
  );
}

/** Each situation's content descriptors (docs/content-rating.md): what the board filter reads. A
 * derived one is set by the tree's own outcomes, a declared one by the designer's ethics screen. One
 * the tree derives but the list leaves out is shown as missing, as the content gate fails it. */
function Content({ template }: { template: IncidentTemplate }) {
  const rows = useMemo(() => situationContent(template), [template]);
  return (
    <div className="lab-calls-content">
      <span className="lab-calls-row-label">Content</span>
      <ul className="lab-calls-content-list" aria-label={`Content descriptors of ${template.tree.title}, by situation`}>
        {rows.map(row => (
          <li key={row.index} className="lab-calls-content-row" data-situation={row.index}>
            <span className="lab-calls-content-sit" title={row.note}>Situation {row.index + 1}</span>
            <span className="lab-calls-content-tags">
              {row.tags.map(tag => (
                <span key={tag.descriptor} data-descriptor={tag.descriptor} className="lab-calls-content-tag"
                  title={tag.derived ? 'Derived from the tree' : 'Declared by the designer'}>
                  {descriptorLabel(tag.descriptor)}{tag.derived ? '' : ' *'}
                </span>
              ))}
              {row.tags.length === 0 && <span className="lab-muted">None declared</span>}
              {row.missing.length > 0 && <span className="lab-calls-fail" data-missing>Missing: {row.missing.map(descriptorLabel).join(', ')}</span>}
              {row.screened && <span className="lab-calls-content-screened" title={row.screened}>E4 screened</span>}
            </span>
          </li>
        ))}
      </ul>
      <span className="lab-calls-content-key">* declared by the designer · bordered: a player can avoid it</span>
    </div>
  );
}

/** The call's shape: the Flow layout in structure mode, thumbnail size, endings colored by how runs
 * that ended there scored when runs are cached. */
function Shape({ template, endings }: { template: IncidentTemplate; endings: Record<string, Record<Weight, number>> }) {
  const layout = useMemo(() => layoutFlow({ graph: callGraph(template.tree, { clockNexts: treeClockNexts(template.tree, template) }), expanded: new Set(), tally: null, mode: 'structure', showPruned: false, size: 'thumb',
    endingClass: authoredEndingClass(template.tree) }), [template]);
  const boxes = Object.values(layout.boxes);
  const reached = Object.keys(endings).length > 0;
  return (
    <figure className="lab-calls-shape" aria-label={`Shape of ${template.tree.title}: ${boxes.filter(b => b.kind === 'node').length} decision points in three stages, then ${boxes.filter(b => b.kind === 'ending').length} endings`}>
      <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {layout.lanes.slice(1).map(lane => <line key={lane.lane} className="lab-calls-shape-lane" x1={lane.x} x2={lane.x} y1={0} y2={layout.height} />)}
        {layout.paths.map(p => <path key={p.id} className="lab-calls-shape-path" d={p.d} />)}
        {boxes.map(b => {
          const w = b.kind === 'ending' && endings[b.treeId] ? dominant(endings[b.treeId]) : null;
          return <rect key={b.id} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.kind === 'turn' ? b.w / 2 : 1.2}
            className={cx('lab-calls-shape-box', `lab-calls-shape-${b.kind}`, w && `lab-calls-shape-${w}`, b.kind === 'ending' && reached && !w && 'lab-calls-shape-unreached')} />;
        })}
      </svg>
      <figcaption className="lab-calls-shape-key">
        {['Assess', 'Adapt', 'Resolve', 'Endings'].map((lane, i) => <span key={lane} style={{ left: `${((layout.lanes[i]?.x ?? 0) + (layout.lanes[i]?.w ?? 0) / 2) / layout.width * 100}%` }}>{lane}</span>)}
      </figcaption>
    </figure>
  );
}

const DEPS = new Map<IncidentType, ReturnType<typeof dependencyIndex> | null>();
const depsOf = (type: IncidentType) => {
  if (!DEPS.has(type)) { try { DEPS.set(type, dependencyIndex(INCIDENT_TEMPLATES[type]!)); } catch { DEPS.set(type, null); } }
  return DEPS.get(type)!;
};
const words = (row: FeedRow) => humanizeFinding(row.finding, INCIDENT_TEMPLATES[row.type]!, depsOf(row.type));

function Findings({ rows, onOpen }: { rows: FeedRow[]; onOpen(row: FeedRow): void }) {
  const counts = severityCounts(rows);
  const narrow = useNarrow();
  return (
    <aside className="lab-calls-findings" aria-label="Findings">
      <details key={narrow ? 'narrow' : 'wide'} open={!narrow} className="lab-calls-findings-box">
        <summary className="lab-calls-findings-head">
          <span className="lab-calls-findings-title"><Glyph name="caret" size={13} className="lab-calls-caret" />Findings</span>
          <span className="lab-calls-findings-counts">
            <span title="Errors"><LintGlyph severity="error" size={12} />{counts.error}</span>
            <span title="Warnings"><LintGlyph severity="warn" size={12} />{counts.warn}</span>
            <span title="Notes"><LintGlyph severity="info" size={12} />{counts.info}</span>
          </span>
        </summary>
        <p className="lab-calls-findings-note">Static lint for all four calls, plus what cached runs found. Click one to open where it lives.</p>
        <ul className="lab-calls-feed">
          {rows.map(row => (
            <li key={`${row.type}:${row.finding.id}`} className={cx(row.muted && 'lab-calls-feed-muted')}>
              <button type="button" className="lab-calls-feed-row" onClick={() => onOpen(row)}>
                <LintGlyph severity={row.finding.severity} size={13} />
                <span className="lab-calls-feed-call">{TYPE_TAG[row.type] ?? sentenceCase(row.type)}{words(row).where && <span className="lab-calls-feed-where"> · {words(row).where}</span>}</span>
                <span className="lab-calls-feed-text">{words(row).message}</span>
                {row.muted && <span className="lab-calls-feed-why">Accepted: {row.muted}</span>}
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="lab-muted">No findings.</li>}
        </ul>
      </details>
    </aside>
  );
}

