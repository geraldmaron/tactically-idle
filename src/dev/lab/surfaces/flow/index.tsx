// Flow (spec 3.3): every route through the call on one canvas, which ones runs take and how often,
// what is dropped in this call and why, and the path Play is on. Three ways to look: Reach (ribbon
// widths from the runs), Structure (every authored route, uniform), State (who writes and who reads
// one state key). Selecting anything opens it in the inspector and keeps it in the URL.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CallTree } from '../../../../content/call-trees/types';
import { lintTree, plainTokens, sentenceCase } from '../../../../gen/incident/trees-v13/dependencies';
import type { LintFinding, StateKey } from '../../../../gen/incident/trees-v13/dependencies';
import { callGraph, humanizeNode } from '../../../../gen/incident/trees-v13/graph';
import type { OutcomeBand } from '../../../../sim/types';
import { actionIcon, Icon } from '../../../../ui/icons';
import { PeopleProvider, PeopleText } from '../../../../ui/people/PeopleText';
import { lexiconFor } from '../../../../ui/people/lexicon';
import { useLab } from '../../context';
import { authoredEndingClass, layoutFlow, neighbourBox } from '../../model/flow-layout';
import type { FlowLayout } from '../../model/flow-layout';
import { percent } from '../../model/label';
import { endingListTitle } from '../../model/describe';
import { currentFrame, nodeAt, sessionBinder } from '../../model/session';
import type { Session } from '../../model/session';
import { simLint } from '../../model/sim-lint';
import { chordKey, isTyping } from '../../shell/keys';
import type { Selection } from '../../types';
import { cx, Glyph, modalOpen, SegmentedControl, Skeleton, WeightGlyph } from '../../viz';
import { FlowCanvas } from './FlowCanvas';
import type { BoxLabel, StateMarks, View } from './FlowCanvas';
import { FlowInspector } from './FlowInspector';
import type { InspectorContext } from './FlowInspector';
import { pinsByBox } from './flow-text';
import { humanizeFinding, readIds } from '../calls/calls-model';
import { PopulationBar } from './population';
import { useReach } from './use-reach';
import './flow.css';

type Mode = 'reach' | 'structure' | 'state';
const MODES: Mode[] = ['reach', 'structure', 'state'];

export default function FlowSurface() {
  const { call } = useLab();
  if (call.status === 'ready') return <FlowReady session={call.session} />;
  return (
    <section className="lab-flow lab-flow-waiting" aria-busy={call.status === 'loading'}>
      {call.status === 'loading' && <><Skeleton height={28} width="40%" /><p className="lab-muted">Building the call…</p></>}
      {call.status === 'error' && <p className="lab-muted">The call didn't open; the notice above says why.</p>}
    </section>
  );
}

/** Box id for a URL selection. */
const boxOf = (sel: Selection | null): string | null =>
  !sel ? null : sel.kind === 'node' ? `node:${sel.node}` : sel.kind === 'ending' ? `ending:${sel.ending}` : sel.kind === 'choice' || sel.kind === 'band' ? `choice:${sel.node}/${sel.choice}` : null;

function shareText(n: number | null, runs: number): string | undefined {
  if (n === null || !runs) return undefined;
  if (n === 0) return `0 of ${runs.toLocaleString('en-US')}`;
  if (runs < 30) return `${n} of ${runs}`;
  return `≈${percent(n / runs)}`;
}

function FlowReady({ session }: { session: Session }) {
  const lab = useLab();
  const { url, navigate, deps, notes } = lab;
  const tree = session.tree, template = session.template;
  const mode = url.flow.mode, color = url.flow.color, showPruned = url.flow.pruned;
  const reach = useReach(session);
  const runs = reach.tally?.runs ?? 0;

  // ------------------------------------------------ graph and layout
  const authored = useMemo(() => callGraph(tree), [tree]);
  const graph = reach.pop.scope === 'type' ? authored : lab.graph ?? authored;
  const endingClass = useMemo(() => authoredEndingClass(tree), [tree]);
  const expandedKey = url.flow.expanded.join(',');
  const expanded = useMemo(() => new Set(url.flow.expanded), [expandedKey]);
  const layout: FlowLayout = useMemo(() => {
    const laid = layoutFlow({ graph, expanded, tally: reach.tally, mode, showPruned, size: 'full', endingClass });
    // The compiler's reasons name marks by id; read them as labels.
    return { ...laid, boxes: Object.fromEntries(Object.entries(laid.boxes).map(([id, box]) => [id, box.reason ? { ...box, reason: readIds(box.reason, template, deps) } : box])) };
  }, [graph, expanded, reach.tally, mode, showPruned, endingClass, template, deps]);

  // ------------------------------------------------ text
  const bind = useMemo(() => {
    let binder: ((text: string) => string) | null = null;
    try { binder = sessionBinder(session); } catch { binder = null; }
    // A node or line this call drops can name a group it has no members for: read roles as nouns.
    return (text: string) => { try { return binder ? binder(text) : plainTokens(text, tree); } catch { return plainTokens(text, tree); } };
  }, [session.instance, tree]);
  const lexicon = useMemo(() => (url.names ? lexiconFor(session.scenario, currentFrame(session).state.activeRun ?? null, []) : null), [session.scenario, url.names, session.frames.length]);
  const titleOf = useCallback((id: string) => labelTitle(id, tree, bind), [tree, bind]);
  const labels = useMemo(() => boxLabels(layout, tree, graph, bind, runs, session), [layout, tree, graph, bind, runs, session]);

  // ------------------------------------------------ lint and notes
  const staticLint = useMemo(() => { try { return lintTree(template, deps ?? undefined); } catch { return [] as LintFinding[]; } }, [template, deps]);
  const sim = useMemo(() => (reach.tally && reach.status === 'done' ? simLint(reach.tally, graph, reach.text.plain, tree) : []), [reach.tally, reach.status, graph, tree]);
  // Messages read with labels for raw ids (the finding itself stays as lint wrote it).
  const pins = useMemo(() => pinsByBox([...staticLint, ...sim].map(f => ({ ...f, message: humanizeFinding(f, template, deps).message })), notes.file), [staticLint, sim, notes.file, template, deps]);

  // ------------------------------------------------ selection
  const [pathSel, setPathSel] = useState<string | null>(null);
  const selectedBox = boxOf(url.sel);
  const selected = pathSel ?? (selectedBox && layout.boxes[selectedBox] ? selectedBox : null);
  const select = useCallback((id: string) => {
    const box = layout.boxes[id];
    if (!box) { setPathSel(id); return; }
    setPathSel(null);
    const sel: Selection | null = box.kind === 'node' ? { kind: 'node', node: box.treeId } : box.kind === 'ending' ? { kind: 'ending', ending: box.treeId }
      : box.kind === 'choice' && box.node && box.choice ? { kind: 'choice', node: box.node, choice: box.choice } : null;
    if (sel) navigate({ sel }, 'push'); else setPathSel(id);
  }, [layout, navigate]);
  const clear = () => { setPathSel(null); if (url.sel && url.sel.kind !== 'key') navigate({ sel: null }, 'replace'); };
  const toggleExpand = useCallback((node: string) => {
    const next = url.flow.expanded.includes(node) ? url.flow.expanded.filter(n => n !== node) : [...url.flow.expanded, node];
    navigate({ flow: { ...url.flow, expanded: next } }, 'replace');
  }, [url.flow, navigate]);

  // ------------------------------------------------ Play path track
  const track = useMemo(() => {
    const ids: string[] = [];
    for (const frame of session.frames) {
      const node = nodeAt(frame.state, tree);
      const ending = frame.state.activeRun?.endingId;
      const id = node ? `node:${node}` : ending ? `ending:${ending}` : null;
      if (id && ids[ids.length - 1] !== id) ids.push(id);
    }
    return ids;
  }, [session.frames, tree]);
  const playNode = nodeAt(currentFrame(session).state, tree);

  // ------------------------------------------------ state mode
  const keyList = useMemo(() => [...(deps?.keys.values() ?? [])].filter(entry => /^(mark|safe|fact|clock|meter|count|turn):/.test(entry.key)), [deps]);
  const stateKey = url.sel?.kind === 'key' ? url.sel.key : null;
  const stateMarks: StateMarks | null = useMemo(() => {
    if (mode !== 'state' || !stateKey || !deps) return null;
    const entry = deps.keys.get(stateKey as StateKey);
    if (!entry) return null;
    const count = (sites: typeof entry.writers) => {
      const m = new Map<string, number>();
      for (const site of sites) if (site.node) for (const id of [`node:${site.node}`, ...(site.choice ? [`choice:${site.node}/${site.choice}`] : [])]) m.set(id, (m.get(id) ?? 0) + 1);
      return m;
    };
    const writers = count(entry.writers), readers = count(entry.readers);
    const arcs: [string, string][] = [];
    for (const w of writers.keys()) for (const r of readers.keys()) if (w !== r && w.startsWith('node:') && r.startsWith('node:') && layout.boxes[w] && layout.boxes[r]) arcs.push([w, r]);
    return { writers, readers, arcs };
  }, [mode, stateKey, deps, layout]);

  // ------------------------------------------------ view and keys
  const [view, setView] = useState<View | null>(null);
  const viewportEvent = (name: string, detail?: number) => document.querySelector('.lab-flow-viewport')?.dispatchEvent(new CustomEvent(name, { detail }));
  const playHere = useCallback((id: string) => {
    const box = layout.boxes[id];
    if (!box) return;
    if (box.kind === 'node') lab.playHere({ node: box.treeId });
    else if (box.kind === 'ending') lab.playHere({ ending: box.treeId });
    else if (box.kind === 'choice') { const c = graph.choices.find(entry => entry.node === box.node && entry.choice === box.choice); if (c) lab.playHere({ offered: c.actionId }); }
  }, [layout, graph, lab.playHere]);
  const keys = useRef({ selected, layout, select, toggleExpand, playHere, mode, clear });
  keys.current = { selected, layout, select, toggleExpand, playHere, mode, clear };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || modalOpen()) return;
      // G then a letter belongs to the shell (surface switch).
      if (chordKey(event)) return;
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body && !target.closest('.lab-flow-viewport, .lab-flow-inspector')) return;
      const k = keys.current;
      const at = k.selected && k.layout.boxes[k.selected] ? k.selected : null;
      if (event.key.startsWith('Arrow')) {
        const from = at ?? `node:${tree.root}`;
        const next = at ? neighbourBox(k.layout, from, event.key as 'ArrowLeft') : from;
        if (next) { event.preventDefault(); k.select(next); }
        return;
      }
      if (event.key === 'Enter' && at && k.layout.boxes[at].kind === 'node') { event.preventDefault(); k.toggleExpand(k.layout.boxes[at].treeId); return; }
      if ((event.key === 'p' || event.key === 'P') && at) { event.preventDefault(); k.playHere(at); return; }
      if (event.key === 'm' || event.key === 'M') { event.preventDefault(); navigate({ flow: { ...url.flow, mode: MODES[(MODES.indexOf(k.mode) + 1) % MODES.length] } }, 'replace'); return; }
      if (event.key === '0') { event.preventDefault(); viewportEvent('lab-flow-fit'); return; }
      if (event.key === '.') { event.preventDefault(); viewportEvent('lab-flow-center'); return; }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); viewportEvent('lab-flow-zoom', 1.25); return; }
      if (event.key === '-') { event.preventDefault(); viewportEvent('lab-flow-zoom', 0.8); return; }
      if (event.key === 'Escape' && at) { event.preventDefault(); k.clear(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url.flow, tree.root, navigate]);

  // ------------------------------------------------ inspector
  const inspectorCtx: InspectorContext = {
    tree, template, deps, graph, layout, bind, tally: reach.tally, prov: { ...reach.text.prov, pending: reach.pending },
    playNode, playViews: currentFrame(session).views, titleOf,
    findings: id => pins.get(id)?.lint ?? [],
    onPlay: goal => lab.playHere(goal),
    onNote: sel => navigate({ sel, notes: true }, 'push'),
    onSelect: select,
    onForce: (actionId: string, band: OutcomeBand) => lab.step({ kind: 'decide', actionId, band }),
    onKey: key => navigate({ tab: 'deps', sel: { kind: 'key', key } }),
    words: text => readIds(text, template, deps),
  };
  const target = selected ? (layout.boxes[selected] ? { box: layout.boxes[selected] } : { path: layout.paths.find(p => p.id === selected) }) : null;
  const keyEntry = stateKey && deps ? deps.keys.get(stateKey as StateKey) : undefined;
  const keySet = keyEntry && reach.tally && runs ? reach.tally.keysSet[stateKey!] ?? 0 : null;

  return (
    <PeopleProvider lexicon={lexicon}>
      <section className={cx('lab-flow', target && 'lab-flow-has-inspector')} aria-label="Flow">
        <PopulationBar reach={reach}
          lead={(
            <span className="lab-pop-field">
              <span className="lab-pop-label">Show</span>
              <SegmentedControl label="Show" size="small" value={mode} onChange={next => navigate({ flow: { ...url.flow, mode: next } }, 'replace')}
                options={[{ value: 'reach', label: 'Reach', title: 'Ribbon widths from the runs (M cycles)' }, { value: 'structure', label: 'Structure', title: 'Every authored route, uniform' },
                  { value: 'state', label: 'State', title: 'Who writes and who reads one state key' }]} />
            </span>
          )}
          tail={<>
            {mode === 'reach' && (
              <span className="lab-pop-field">
                <span className="lab-pop-label">Color by</span>
                <SegmentedControl label="Color ribbons by" size="small" value={color} onChange={next => navigate({ flow: { ...url.flow, color: next } }, 'replace')}
                  options={[{ value: 'band', label: 'Result band' }, { value: 'fate', label: 'Fate', title: 'How the runs that took each route ended' }]} />
              </span>
            )}
            {mode === 'state' && (
              <label className="lab-pop-field">
                <span className="lab-pop-label">State key</span>
                <select className="lab-input lab-pop-select lab-flow-keypick" value={stateKey ?? ''} onChange={event => navigate({ sel: event.target.value ? { kind: 'key', key: event.target.value } : null }, 'push')}>
                  <option value="">Pick a key…</option>
                  {keyList.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
                </select>
              </label>
            )}
            <button type="button" className={cx('lab-toggle', showPruned && 'lab-toggle-on', 'lab-flow-pruned-toggle')} aria-pressed={showPruned}
              onClick={() => navigate({ flow: { ...url.flow, pruned: !showPruned } }, 'replace')} title="Show what the compiler drops for this call, with why">
              <span className="lab-toggle-dot" />Show dropped
            </button>
          </>} />
        {mode === 'state' && (
          <p className="lab-flow-statebar">
            {keyEntry ? <>
              <Glyph name="writes" size={13} /><b>{keyEntry.label}</b>
              <span>written in {keyEntry.writers.length} {keyEntry.writers.length === 1 ? 'place' : 'places'}, read in {keyEntry.readers.length}</span>
              {keySet !== null && <span className="lab-muted">set in ≈{percent(keySet / runs)} of runs ({reach.text.plain})</span>}
              {keyEntry.writers.some(site => !site.node) && <span className="lab-muted">plus writers outside any node (clocks, the draw)</span>}
            </> : <span className="lab-muted">Pick a state key above, or from the command palette, to see who writes it and who reads it.</span>}
          </p>
        )}
        <div className="lab-flow-body">
          <FlowCanvas layout={layout} labels={labels} pins={pins} color={mode === 'reach' ? color : 'band'} tally={reach.tally} selected={selected} track={track}
            state={stateMarks} fitKey={`${session.key}|${mode}|${showPruned}|${reach.pop.scope}`} expanded={expanded} onSelect={select} onExpand={toggleExpand}
            view={view} onView={setView} />
          <FlowInspector target={target} ctx={inspectorCtx} onClose={clear} />
        </div>
      </section>
    </PeopleProvider>
  );
}

function labelTitle(id: string, tree: CallTree, bind: (text: string) => string): string {
  if (id.startsWith('node:')) { const node = tree.nodes.find(n => n.id === id.slice(5)); return node ? humanizeNode(node).title : sentenceCase(id.slice(5)); }
  if (id.startsWith('ending:')) { const ending = tree.endings[id.slice(7)]; return ending ? endingListTitle(tree, id.slice(7), bind) : sentenceCase(id.slice(7)); }
  if (id.startsWith('turn:')) return `Turn: ${id.slice(5).replace(/_/g, ' ')}`;
  if (id.startsWith('choice:')) {
    const [node, choice] = id.slice(7).split('/');
    const c = tree.nodes.find(n => n.id === node)?.choices.find(entry => entry.id === choice);
    return c ? bind(c.title) : sentenceCase(choice ?? '');
  }
  if (id.startsWith('junction:')) return 'Drawn result';
  return id;
}

function boxLabels(layout: FlowLayout, tree: CallTree, graph: ReturnType<typeof callGraph>, bind: (text: string) => string, runs: number, session: Session): Map<string, BoxLabel> {
  const out = new Map<string, BoxLabel>();
  const frame = currentFrame(session);
  const here = nodeAt(frame.state, tree);
  for (const box of Object.values(layout.boxes)) {
    const share = box.ghost ? undefined : shareText(box.n, runs);
    const shareTitle = share ? `${share} of runs (${box.n?.toLocaleString('en-US')} of ${runs.toLocaleString('en-US')})` : undefined;
    if (box.kind === 'node') {
      const node = tree.nodes.find(n => n.id === box.treeId);
      if (!node) continue;
      const human = humanizeNode(node, bind);
      const count = graph.choices.filter(c => c.node === node.id && c.inCall).length;
      out.set(box.id, { title: human.title, lead: <PeopleText text={human.lead} />, share, shareTitle: shareTitle ? `${human.title}: reached in ${shareTitle}` : human.title,
        meta: <span className="lab-flow-node-count">{count} {count === 1 ? 'choice' : 'choices'}</span>, aria: `${human.title}, ${node.stage}, ${count} choices${share ? `, reached ${share} of runs` : ''}` });
    } else if (box.kind === 'ending') {
      const ending = tree.endings[box.treeId];
      const title = ending ? endingListTitle(tree, box.treeId, bind) : sentenceCase(box.treeId);
      out.set(box.id, { title, share, shareTitle: shareTitle ? `${title}: ended ${shareTitle}` : title, icon: box.weight ? <WeightGlyph weight={box.weight} size={13} /> : <Glyph name="ending" size={12} />,
        aria: `Ending: ${title}${share ? `, ${share} of runs` : ''}` });
    } else if (box.kind === 'choice') {
      const choice = tree.nodes.find(n => n.id === box.node)?.choices.find(c => c.id === box.choice);
      if (!choice) continue;
      const title = bind(choice.title);
      const actionId = graph.choices.find(c => c.node === box.node && c.choice === box.choice)?.actionId;
      const view = here === box.node ? frame.views.find(v => v.id === actionId) : undefined;
      const meta = view ? (view.eligible ? `${percent(view.likelihood.favorable)} well` : 'locked') : share;
      const said = view ? (view.eligible ? `${percent(view.likelihood.favorable)} goes well now (engine, the Play step)` : 'locked now') : share ? `taken in ${share} of runs` : '';
      out.set(box.id, { title, icon: <Icon name={actionIcon(choice.icon)} size={15} />, meta, shareTitle: said ? `${title}: ${said}` : title, aria: `Choice: ${title}${said ? `, ${said}` : ''}` });
    } else if (box.kind === 'turn') {
      const drawn = graph.turnDrawn[box.treeId];
      const members = tree.turns?.[box.treeId] ?? [];
      const title = sentenceCase(box.treeId);
      out.set(box.id, { title, sub: drawn ? `drew ${sentenceCase(drawn).toLowerCase()}` : `1 of ${members.length} per call`, aria: `Turn ${title}: one of ${members.length} drawn per call` });
    } else {
      out.set(box.id, { title: 'Drawn result', aria: `Drawn result after ${box.choice ?? ''}` });
    }
  }
  return out;
}
