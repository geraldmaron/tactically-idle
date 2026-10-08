// Scenario lab (/story.html): every dispatched call type as an incident template
// (docs/incident-domain-model.md), one drawn instance at a time. The catalog counts what each
// template can produce; the instance shows who is in the call and what the team knows; the map,
// story graph, real choice cards, a step-through on the engine, the string checks, balance and
// review notes all read the same instance. Part of the dev story sheet; see StorySheet.tsx.
import { useEffect, useMemo, useState } from 'react';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import type { IncidentTemplate } from '../../content/incidents/types';
import { INCIDENT_CONTENT_VERSION } from '../../gen/incident';
import { instanceOf } from '../../gen/incident/instance';
import { memberCounts, textBinder } from '../../gen/incident/trees-v13/compile';
import { buildLocation } from '../../sim/location';
import type { IncidentType } from '../../sim/scenario-types';
import { BalancePanel } from './BalancePanel';
import { coverageOf } from './coverage';
import { ChoicesPanel, InstancePanel, MapPanel } from './lab-panels';
import { familyLabel, nextCallSeed, paramsToQuery, readParams, resolveScenario } from './model';
import type { LabParams } from './model';
import { NotesPanel } from './NotesPanel';
import { StepThrough } from './StepThrough';
import { StoryGraph } from './StoryGraph';
import { WritingPanel } from './WritingPanel';
import type { ReadAs } from './WritingPanel';
import { callStringRows } from '../../gen/incident/trees-v13/strings';

export type Navigate = (next: Record<string, string>, mode?: 'push' | 'replace') => void;

const TEMPLATES = Object.values(INCIDENT_TEMPLATES) as IncidentTemplate[];
const TABS = [
  ['instance', 'Instance'], ['map', 'Map'], ['graph', 'Story graph'], ['choices', 'Choices'], ['run', 'Step-through'],
  ['writing', 'Writing'], ['balance', 'Balance'], ['notes', 'Notes'],
] as const;
type Tab = (typeof TABS)[number][0];

/** Lab params for a template type: the shared URL reader, with the type and building limited to
 * what the template can draw. */
function labParams(query: URLSearchParams): LabParams {
  const raw = readParams(query);
  const type = (INCIDENT_TEMPLATES[query.get('type') as IncidentType] ? query.get('type') : TEMPLATES[0].type) as IncidentType;
  const families = INCIDENT_TEMPLATES[type]!.tree.families;
  const family = families.includes(query.get('family') ?? '') ? query.get('family')! : families[0];
  return { ...raw, type, family };
}

export function ScenarioLab({ query, navigate }: { query: URLSearchParams; navigate: Navigate }) {
  const params = labParams(query);
  const template = INCIDENT_TEMPLATES[params.type]!;
  const tree = template.tree;
  const tab = (TABS.some(([id]) => id === query.get('tab')) ? query.get('tab') : 'instance') as Tab;
  const nodeId = tree.nodes.some(node => node.id === query.get('node')) ? query.get('node')! : tree.root;
  const extra = { tab, node: nodeId };
  const go = (next: LabParams, patch: Partial<typeof extra> = {}, mode: 'push' | 'replace' = 'push') =>
    navigate({ view: 'lab', ...paramsToQuery(next), ...extra, ...patch }, mode);
  const set = (patch: Partial<LabParams>) => {
    const next: LabParams = { ...params, path: '', id: null, ...patch };
    const families = INCIDENT_TEMPLATES[next.type]!.tree.families;
    if (!families.includes(next.family)) next.family = families[0];
    go(next, patch.type && patch.type !== params.type ? { node: INCIDENT_TEMPLATES[next.type]!.tree.root } : {});
  };

  const resolved = useMemo(() => resolveScenario(params), [params.id, params.type, params.family, params.seed, params.variant, params.pacing, params.tier, params.call]);
  const s = resolved.scenario;
  const built = useMemo(() => s ? buildLocation(s.locationFamilyId, s.locationSeed) : null, [s]);
  const instance = useMemo(() => { try { return s && built ? instanceOf(s, built) : null; } catch { return null; } }, [s, built]);
  const bind = useMemo(() => instance && built ? textBinder(tree, built, instance.placed) : (text: string) => text, [instance, built, tree]);
  const cast = instance ? instance.people.flatMap(person => person.name ? [person.name.first, person.name.surname] : []) : [];
  const binderFor = useMemo(() => (as: ReadAs) => {
    if (!instance || !built || as === 'drawn') return bind;
    const recast = Object.fromEntries(Object.entries(instance.placed.cast).map(([role, identity]) => [role, { ...identity, pronouns: as }]));
    return textBinder(tree, built, { ...instance.placed, cast: recast });
  }, [instance, built, tree, bind]);
  const [noteWhere, setNoteWhere] = useState('');
  const wheres = useMemo(() => [...new Set(callStringRows(tree, text => text).map(row => row.where))], [tree]);

  return (
    <div className="sl-lab">
      <Catalog current={params.type} onPick={type => set({ type, call: null, variant: 0 })} />
      <Controls params={params} template={template} bind={bind} resolvedSituation={instance?.situation ?? null} set={set} onNextCall={() => {
        if (!resolved.spec || !resolved.situation) return;
        set({ call: nextCallSeed(resolved.spec, resolved.situation, resolved.spec.seed) });
      }} />
      {resolved.error && <p className="sl-err sl-panel">Could not generate this call: {resolved.error}</p>}
      {s && built && instance && resolved.id && (
        <>
          <section className="sl-panel sl-card">
            <div className="sl-panel-head">
              <h2>{s.title}</h2>
              <span className="sl-dim"><code>{resolved.id}</code> · content v{resolved.spec?.contentVersion ?? INCIDENT_CONTENT_VERSION} · tier {resolved.spec?.tier}</span>
            </div>
            <p>{s.summary}</p>
            <p className="sl-dim">{s.briefing.dispatchReason}</p>
            <div className="sl-cols">
              <div><h4>Known</h4><ul>{s.briefing.known.map((line, i) => <li key={i}>{line}</li>)}</ul></div>
              <div><h4>Unknown</h4><ul>{s.briefing.unknown.map((line, i) => <li key={i}>{line}</li>)}</ul><h4>Situation (hidden)</h4><p className="sl-dim">s{instance.situation + 1}: {bind(tree.situations[instance.situation]?.note ?? '')}</p></div>
            </div>
          </section>
          <nav className="sl-labtabs" aria-label="Lab sections">
            {TABS.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => go(params, { tab: id }, 'replace')}>{label}</button>)}
          </nav>
          {tab === 'instance' && <InstancePanel instance={instance} built={built} bind={bind} s={s} />}
          {tab === 'map' && <MapPanel s={s} id={resolved.id} built={built} instance={instance} />}
          {tab === 'graph' && <StoryGraph tree={tree} seed={resolved.spec!.seed} bind={bind} selected={nodeId} onSelect={node => go(params, { node }, 'replace')} />}
          {tab === 'graph' && <p className="sl-dim">Open the real cards for <button className="sl-link" onClick={() => go(params, { tab: 'choices' }, 'replace')}>{nodeId}</button>.</p>}
          {tab === 'choices' && <NodePicker tree={tree} nodeId={nodeId} onPick={node => go(params, { node }, 'replace')} />}
          {tab === 'choices' && <ChoicesPanel key={`${resolved.id}|${params.kit}|${nodeId}`} s={s} id={resolved.id} kit={params.kit} tree={tree} nodeId={nodeId} />}
          {tab === 'run' && <StepThrough id={resolved.id} s={s} kit={params.kit} path={params.path} onPath={path => go({ ...params, path }, {}, 'replace')} />}
          {tab === 'writing' && <WritingPanel tree={tree} binderFor={binderFor} cast={cast} counts={instance ? memberCounts(instance.placed) : undefined} onNote={where => { setNoteWhere(where); go(params, { tab: 'notes' }, 'replace'); }} />}
          {tab === 'balance' && <BalancePanel type={params.type} tier={params.tier} />}
          {tab === 'notes' && <NotesPanel type={params.type} title={tree.title} draftWhere={noteWhere} wheres={wheres} />}
        </>
      )}
    </div>
  );
}

function Catalog({ current, onPick }: { current: IncidentType; onPick: (type: IncidentType) => void }) {
  const rows = TEMPLATES.map(template => ({ template, c: coverageOf(template) }));
  const sum = (key: 'setups' | 'signatures' | 'behaviourallyDistinct' | 'nodes' | 'choices' | 'endings' | 'playthroughs') => rows.reduce((total, row) => total + row.c[key], 0);
  return (
    <section className="sl-panel">
      <div className="sl-panel-head"><h2>Scenarios</h2><span className="sl-dim">What each template can produce, counted from its data (§12). Building seed and names add surface variety on top.</span></div>
      <div className="sl-scroll">
        <table className="sl-table">
          <thead><tr><th>Call</th><th title="Hidden-truth situation × mid-call turn">Setups</th><th title="Setups × pacing × cast shapes × complication sets">Signatures</th><th title="Signatures that change a decision or an outcome distribution">Distinct to play</th><th>Decision points</th><th>Choices</th><th>Endings</th><th title="Choice, band and hidden-truth sequences to an ending, over every setup">Playthroughs</th><th>Buildings</th></tr></thead>
          <tbody>
            {rows.map(({ template, c }) => (
              <tr key={template.type} className={template.type === current ? 'sl-current' : ''} onClick={() => onPick(template.type)} style={{ cursor: 'pointer' }}>
                <td><strong>{template.tree.title}</strong> <span className="sl-dim">{template.label} · {template.type}</span></td>
                <td>{c.setups}</td><td>{c.signatures}</td><td>{c.behaviourallyDistinct}</td><td>{c.nodes}</td><td>{c.choices}</td><td>{c.endings}</td><td>{c.playthroughs.toLocaleString()}</td>
                <td className="sl-dim">{template.tree.families.length} types · {template.tree.scene.rooms.join(', ')}</td>
              </tr>
            ))}
            <tr className="sl-total"><td>All dispatched calls</td><td>{sum('setups')}</td><td>{sum('signatures')}</td><td>{sum('behaviourallyDistinct')}</td><td>{sum('nodes')}</td><td>{sum('choices')}</td><td>{sum('endings')}</td><td>{sum('playthroughs').toLocaleString()}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Controls({ params, template, bind, resolvedSituation, set, onNextCall }: {
  params: LabParams; template: IncidentTemplate; bind: (text: string) => string; resolvedSituation: number | null; set: (patch: Partial<LabParams>) => void; onNextCall: () => void;
}) {
  const [seedText, setSeedText] = useState(String(params.seed));
  const [idText, setIdText] = useState(params.id ?? '');
  useEffect(() => setSeedText(String(params.seed)), [params.seed]);
  const situation = resolvedSituation ?? params.variant;
  return (
    <div className="sl-controls sl-panel">
      <label>Call
        <select value={params.type} onChange={event => set({ type: event.target.value as IncidentType, call: null, variant: 0 })}>
          {TEMPLATES.map(entry => <option key={entry.type} value={entry.type}>{entry.tree.title} · {entry.type}</option>)}
        </select>
      </label>
      <label>Building type
        <select value={params.family} onChange={event => set({ family: event.target.value })}>
          {template.tree.families.map(family => <option key={family} value={family}>{familyLabel(family)} · {family}</option>)}
        </select>
      </label>
      <label>Building seed
        <span className="sl-inline">
          <input value={seedText} onChange={event => setSeedText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && Number.isFinite(Number(seedText))) set({ seed: Math.floor(Number(seedText)) }); }} />
          <button onClick={() => set({ seed: Math.floor(Math.random() * 1e6) })}>new</button>
        </span>
      </label>
      <label>Situation (hidden truth)
        <select value={situation} onChange={event => set({ variant: Number(event.target.value) as LabParams['variant'], call: null })}>
          {template.tree.situations.map((entry, i) => <option key={i} value={i}>s{i + 1}: {bind(entry.note).slice(0, 80)}{bind(entry.note).length > 80 ? '…' : ''}</option>)}
        </select>
      </label>
      <label>Pacing
        <select value={params.pacing} onChange={event => set({ pacing: event.target.value as LabParams['pacing'], call: null })}>
          <option value="ordinary">ordinary</option><option value="deliberate_answers">slow to answer</option>
        </select>
      </label>
      <label>Tier
        <select value={params.tier} onChange={event => set({ tier: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map(tier => <option key={tier} value={tier}>{tier}</option>)}</select>
      </label>
      <label>Squad kit
        <select value={params.kit} onChange={event => set({ kit: event.target.value as LabParams['kit'] })}><option value="day1">day-one department</option><option value="full">every item</option></select>
      </label>
      <label>Cast and rooms
        <button onClick={onNextCall}>Next call, same situation</button>
      </label>
      <label className="sl-wide">Incident ID
        <input value={idText} placeholder="Paste a gen: ID and press Enter" onChange={event => setIdText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && idText.trim()) set({ id: idText.trim() }); }} />
      </label>
    </div>
  );
}

function NodePicker({ tree, nodeId, onPick }: { tree: IncidentTemplate['tree']; nodeId: string; onPick: (node: string) => void }) {
  return (
    <div className="sl-toolbar sl-panel">
      <span className="sl-dim">Decision point</span>
      {(['assess', 'adapt', 'resolve'] as const).map(stage => (
        <span key={stage} className="sl-toolbar">
          <b className="sl-dim">{tree.stageLabels[stage]}:</b>
          {tree.nodes.filter(node => node.stage === stage).map(node => <button key={node.id} aria-pressed={node.id === nodeId} onClick={() => onPick(node.id)}>{node.id}</button>)}
        </span>
      ))}
    </div>
  );
}
