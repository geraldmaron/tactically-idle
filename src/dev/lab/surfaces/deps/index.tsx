// Dependencies (spec 3.5): who sets a piece of the call's state and who reads it, drawn as a bow-tie
// on blueprint paper (writers → the key → readers, every site a link with Play here), the static lint
// in plain words with Mute with reason, and the Why tracer for any choice, prompt variant, line or
// ending. The index and lint come from trees-v13/dependencies.ts; clauses are checked by the engine
// through model/why.ts; this file only wires them.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { INCIDENT_TEMPLATES } from '../../../../content/incidents';
import type { CallTree } from '../../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../../content/incidents/types';
import { choiceActionId, treeFactId } from '../../../../gen/incident/trees-v13/compile';
import { dependencyIndex, lintTree, requirementTree } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex, KeyEntry, LintFinding, ReqTarget, Site, StateKey } from '../../../../gen/incident/trees-v13/dependencies';
import { choiceIndex } from '../../../../gen/incident/trees-v13/graph';
import { DRAW_NOTICE, useLab } from '../../context';
import { RUN_DEFAULTS } from '../../jobs/budgets';
import type { Goal, StartRef } from '../../jobs/protocol';
import type { ReachTally } from '../../jobs/tally';
import { noPathText } from '../../model/explore';
import { muteNote, mutedFindings, withNote } from '../../model/notes';
import { seekCallSeed } from '../../model/seek';
import { currentFrame, nodeAt, sessionBinder } from '../../model/session';
import type { Frame, Session } from '../../model/session';
import { certWords } from '../../model/squads';
import { evaluateReq, leafKey } from '../../model/why';
import type { EvaluatedReq, Fix, Verdict } from '../../model/why';
import { cx, Glyph, LintGlyph, SegmentedControl } from '../../viz';
import { probText } from '../../model/label';
import { wilson } from '../../model/stats';
import type { Policy } from '../../../../gen/incident/trees-v13/balance';
import { callNames } from '../review/labels';
import type { CallNames } from '../review/labels';
import {
  engineReaders, groupKeys, humanizeCondition, humanizeFinding, KIND_INFO, kindOf, LINT_LABEL, LINT_MEANING, selectionTarget, siteGoal, siteWords, sortFindings, targetSelection, targetValue,
  treeReaders, whyOptions,
} from './model';
import type { SiteWords } from './model';
import './deps.css';

const BAND_GLYPH = { favorable: 'well', mixed: 'mixed', adverse: 'badly' } as const;
/** The reference squad as every number names it (spec 5, rule 10). */
const squadName = (seed: number, certs: readonly string[]) => `squad A (${seed})${certs.length ? ` + ${certs.map(certWords).join(', ')} (lab grant)` : ''}`;
/** Site cards shown on each side before "Show all". */
const SIDE_CAP = 8;

export default function DependenciesSurface() {
  const { url } = useLab();
  const template = url.call ? INCIDENT_TEMPLATES[url.call.type] : undefined;
  if (!template) return <p className="lab-deps-empty">This call type has no call tree, so it has no state to trace.</p>;
  return <Dependencies template={template} />;
}

function Dependencies({ template }: { template: IncidentTemplate }) {
  const { url, navigate, call, deps: shared, notes } = useLab();
  const tree = template.tree;
  const session = call.status === 'ready' ? call.session : null;
  const deps = useMemo(() => shared ?? dependencyIndex(template), [shared, template]);
  const lint = useMemo(() => { try { return lintTree(template, deps); } catch { return []; } }, [template, deps]);
  const names = useMemo(() => callNames(template, session ? sessionBinder(session) : null), [template, session]);
  const muted = useMemo(() => mutedFindings(notes.file), [notes.file]);
  const [at, setAt] = useState<'now' | 'entry'>('now');
  const frame = session ? (at === 'now' ? currentFrame(session) : session.frames[0]) : null;

  // The key in the bow-tie: the selection when it is a key, else the last key picked here.
  const [keyHeld, setKeyHeld] = useState<StateKey | null>(null);
  const firstKey = useMemo(() => [...deps.keys.values()].find(entry => kindOf(entry.key) === 'mark' && entry.writers.length && treeReaders(entry).length)?.key ?? [...deps.keys.keys()][0], [deps]);
  const fromUrl = url.sel?.kind === 'key' && deps.keys.has(url.sel.key as StateKey) ? url.sel.key as StateKey : null;
  const keyId = fromUrl ?? (keyHeld && deps.keys.has(keyHeld) ? keyHeld : firstKey);
  useEffect(() => { if (fromUrl) setKeyHeld(fromUrl); }, [fromUrl]);
  const selectKey = (key: StateKey) => { setKeyHeld(key); navigate({ sel: { kind: 'key', key } }); };

  // The Why target: the selection when it names one, else the last picked, else a locked choice here.
  const [targetHeld, setTargetHeld] = useState<ReqTarget | null>(null);
  const fromSel = selectionTarget(url.sel, tree);
  useEffect(() => { if (fromSel) setTargetHeld(fromSel); }, [fromSel && targetValue(fromSel)]);
  const target = fromSel ?? targetHeld ?? defaultTarget(session, frame, tree);
  const pickTarget = (next: ReqTarget) => { setTargetHeld(next); navigate({ sel: targetSelection(next) }); };

  const entry = keyId ? deps.keys.get(keyId) ?? null : null;
  // What the selection is about comes first: a key's bow-tie, or the Why of a choice, line or ending.
  const whyFirst = !!fromSel;
  const why = <WhyTracer target={target} onPick={pickTarget} names={names} tree={tree} session={session} frame={frame} deps={deps} onSelectKey={selectKey} />;
  return (
    <div className="lab-deps">
      <LintPanel lint={lint} muted={muted} names={names} tree={tree} deps={deps} onKey={selectKey} onTarget={pickTarget} />
      <div className="lab-deps-body">
        <KeyRail deps={deps} lint={lint} muted={muted} selected={keyId} onSelect={selectKey} session={session} frame={frame} />
        <div className="lab-deps-main">
          <div className="lab-deps-toolbar">
            <span className="lab-field-label">Check state at</span>
            <SegmentedControl label="Check state at" size="small" value={at} onChange={setAt}
              options={[{ value: 'now', label: session && session.frames.length > 1 ? `Play, step ${session.frames.length - 1}` : 'Play, the start' }, { value: 'entry', label: 'Call start' }]} />
          </div>
          {whyFirst && why}
          {entry ? <BowTie entry={entry} names={names} tree={tree} session={session} frame={frame} lint={lint} onSelectKey={selectKey} />
            : <p className="lab-deps-empty">Pick a key on the left.</p>}
          {!whyFirst && why}
        </div>
      </div>
    </div>
  );
}

/** A choice locked at this moment, else the first choice here, else the tree's first choice. */
function defaultTarget(session: Session | null, frame: Frame | null, tree: CallTree): ReqTarget {
  if (session && frame) {
    const index = choiceIndex(tree);
    const locked = frame.views.find(view => !view.eligible && index.has(view.id));
    if (locked) { const parts = index.get(locked.id)!; return { choice: [parts.node, parts.choice] }; }
    const node = nodeAt(frame.state, tree);
    const here = tree.nodes.find(entry => entry.id === node)?.choices[0];
    if (node && here) return { choice: [node, here.id] };
  }
  return { choice: [tree.root, tree.nodes.find(node => node.id === tree.root)!.choices[0].id] };
}

// ---------------------------------------------------------------- lint

function LintPanel({ lint, muted, names, tree, deps, onKey, onTarget }: { lint: LintFinding[]; muted: ReadonlyMap<string, { text: string }>; names: CallNames; tree: CallTree;
  deps: DependencyIndex; onKey: (key: StateKey) => void; onTarget: (target: ReqTarget) => void }) {
  const { url, call, notes, notify } = useLab();
  const sorted = sortFindings(lint, new Set(muted.keys()));
  const [showMuted, setShowMuted] = useState(false);
  const [open, setOpen] = useState(true);
  const [muting, setMuting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of sorted.open) counts[f.severity]++;
  const session = call.status === 'ready' ? call.session : null;

  const mute = async (f: LintFinding) => {
    if (!url.call || !reason.trim()) return;
    const note = muteNote(f, reason, { type: url.call.type, url: window.location.href, draw: { situation: session?.situation ?? 0, call: session?.resolved.spec?.seed ?? 0 } });
    const result = await notes.save(withNote(notes.file, note));
    if (result === 'ok') { setMuting(null); setReason(''); }
    else if (result === 'conflict') notify('The notes file changed on disk since this page loaded. Reload the page, then mute again.');
  };
  const goTo = (f: LintFinding) => {
    if (f.key) { onKey(f.key); return; }
    const site = f.sites[0];
    if (site?.node && site.choice) { onTarget({ choice: [site.node, site.choice] }); return; }
    if (f.ending) { onTarget({ ending: f.ending }); return; }
    if (f.node) onTarget({ node: f.node });
  };
  const subject = (f: LintFinding) => f.key ? null : f.sites[0]?.node && f.sites[0]?.choice ? `${names.node(f.sites[0].node)} › ${names.choice(f.sites[0].node, f.sites[0].choice!)}`
    : f.ending ? names.ending(f.ending) : f.node ? names.node(f.node) : null;

  const rows = showMuted ? [...sorted.open, ...sorted.muted] : sorted.open;
  return (
    <section className="lab-deps-lint" aria-label="Wiring check">
      <div className="lab-deps-lint-head">
        <button type="button" className="lab-deps-lint-toggle" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <Glyph name="caret" size={12} className={cx(!open && 'lab-deps-rot')} />
          <span className="lab-deps-h">Wiring check</span>
        </button>
        <span className="lab-deps-lint-counts" aria-label="Lint counts">
          <span className={cx(counts.error > 0 && 'lab-lint-error')}><LintGlyph severity="error" size={13} />{counts.error} {counts.error === 1 ? 'error' : 'errors'}</span>
          <span className={cx(counts.warn > 0 && 'lab-lint-warn')}><LintGlyph severity="warn" size={13} />{counts.warn} {counts.warn === 1 ? 'warning' : 'warnings'}</span>
          <span><LintGlyph severity="info" size={13} />{counts.info} {counts.info === 1 ? 'note' : 'notes'}</span>
        </span>
        <span className="lab-deps-lint-what">Static lint over every turn and group size of {tree.title}</span>
        {sorted.muted.length > 0 && (
          <label className="lab-deps-check"><input type="checkbox" checked={showMuted} onChange={event => setShowMuted(event.target.checked)} />Show muted ({sorted.muted.length})</label>
        )}
      </div>
      {open && (rows.length === 0
        ? <p className="lab-deps-lint-clear"><Glyph name="clean" size={14} />Every mark and safe flag is set somewhere and read somewhere; every node and ending can be reached.</p>
        : (
          <ul className="lab-deps-findings">
            {rows.map(f => {
              const isMuted = muted.has(f.id);
              const what = subject(f);
              const key = f.key ? f.key : null;
              return (
                <li key={f.id} className={cx('lab-finding', isMuted && 'lab-finding-muted')}>
                  <LintGlyph severity={f.severity} size={14} />
                  <div className="lab-finding-body">
                    <p className="lab-finding-line">
                      <b className="lab-finding-code">{LINT_LABEL[f.code]}</b>
                      <span className="lab-finding-msg" title={f.message}>{humanizeFinding(f, names, deps)}</span>
                      <code className="lab-raw">{f.code}</code>
                    </p>
                    <p className="lab-finding-meaning">{isMuted ? <>Muted: {muted.get(f.id)!.text}</> : LINT_MEANING[f.code]}</p>
                    {muting === f.id && (
                      <form className="lab-finding-mute" onSubmit={event => { event.preventDefault(); void mute(f); }}>
                        <input className="lab-input" autoFocus value={reason} onChange={event => setReason(event.target.value)} placeholder="Why this stays as it is" aria-label="Reason to keep it" />
                        <button type="submit" className="lab-button" disabled={!reason.trim()}>Mute</button>
                        <button type="button" className="lab-button lab-button-quiet" onClick={() => { setMuting(null); setReason(''); }}>Cancel</button>
                      </form>
                    )}
                  </div>
                  <div className="lab-finding-actions">
                    <button type="button" className="lab-chip lab-chip-key" onClick={() => goTo(f)} title={key ? `${deps.keys.get(key)?.label ?? key} (${key})` : what ?? f.id}>
                      <Glyph name={key ? KIND_INFO[kindOf(key)].glyph : 'choice'} size={12} /><span className="lab-chip-text">{key ? 'Show the key' : what ?? 'Show it'}</span>
                    </button>
                    {!isMuted && muting !== f.id && <button type="button" className="lab-button lab-button-quiet lab-finding-mute-btn" onClick={() => { setMuting(f.id); setReason(''); }}>Mute with reason</button>}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

// ---------------------------------------------------------------- keys

function keyStatus(key: StateKey, session: Session | null, frame: Frame | null): { set: boolean; text: string } | null {
  if (!session || !frame?.state.activeRun) return null;
  const kind = kindOf(key);
  if (kind === 'mark' || kind === 'safe' || kind === 'out') {
    const has = (f: Frame) => !!f.state.activeRun?.flags.includes(key);
    if (!has(frame)) return { set: false, text: 'Not set at this state' };
    const upTo = session.frames.indexOf(frame);
    const first = session.frames.slice(0, upTo < 0 ? undefined : upTo + 1).findIndex(has);
    return { set: true, text: first <= 0 ? 'Set from the start' : `Set at step ${first}` };
  }
  if (kind === 'fact') {
    const status = frame.state.activeRun.knowledge[treeFactId(key.slice(5))];
    return status ? { set: status === 'confirmed' || status === 'reported', text: `The team: ${status}` } : null;
  }
  return null;
}

function KeyRail({ deps, lint, muted, selected, onSelect, session, frame }: { deps: DependencyIndex; lint: LintFinding[]; muted: ReadonlyMap<string, unknown>; selected: StateKey | null;
  onSelect: (key: StateKey) => void; session: Session | null; frame: Frame | null }) {
  const { url, navigate, notes } = useLab();
  const groups = groupKeys(deps, url.filter);
  const noted = useMemo(() => new Set(notes.file.notes.filter(note => note.anchor.startsWith('key:')).map(note => note.anchor.slice(4))), [notes.file]);
  const worst = useMemo(() => {
    const out = new Map<string, LintFinding['severity']>();
    const rank = { error: 0, warn: 1, info: 2 };
    for (const f of lint) if (f.key && !muted.has(f.id) && (!out.has(f.key) || rank[f.severity] < rank[out.get(f.key)!])) out.set(f.key, f.severity);
    return out;
  }, [lint, muted]);
  const [closed, setClosed] = useState<Record<string, boolean>>({ meter: true, promise: true, harm: true, scalar: true, clock: false });
  const selectedRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  return (
    <nav className="lab-dkeys" aria-label="State keys">
      <div className="lab-dkeys-head">
        <span className="lab-deps-h">State</span>
        <span className="lab-dkeys-total">{deps.keys.size} keys</span>
      </div>
      <label className="lab-dkeys-filter">
        <Glyph name="search" size={13} />
        <input className="lab-dkeys-input" value={url.filter} placeholder="Filter keys" aria-label="Filter keys" onChange={event => navigate({ filter: event.target.value }, 'replace')} />
      </label>
      <select className="lab-input lab-dkeys-select" aria-label="State key" value={selected ?? ''} onChange={event => onSelect(event.target.value as StateKey)}>
        {groups.map(group => (
          <optgroup key={group.kind} label={group.label}>
            {group.keys.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
          </optgroup>
        ))}
      </select>
      <div className="lab-dkeys-list">
        {groups.length === 0 && <p className="lab-dkeys-none">No key matches “{url.filter}”.</p>}
        {groups.map(group => {
          const isClosed = closed[group.kind] && !group.keys.some(entry => entry.key === selected) && !url.filter;
          return (
            <section key={group.kind} className="lab-dkeys-group">
              <button type="button" className="lab-dkeys-group-head" aria-expanded={!isClosed} onClick={() => setClosed(state => ({ ...state, [group.kind]: !isClosed }))} title={KIND_INFO[group.kind].help}>
                <Glyph name={group.glyph} size={13} />
                <span className="lab-dkeys-group-label">{group.label}</span>
                <span className="lab-dkeys-group-n">{group.keys.length}</span>
                <Glyph name="caret" size={11} className={cx(isClosed && 'lab-deps-rot')} />
              </button>
              {!isClosed && group.keys.map(entry => {
                const status = keyStatus(entry.key, session, frame);
                const severity = worst.get(entry.key);
                const on = entry.key === selected;
                return (
                  <button key={entry.key} ref={on ? selectedRef : undefined} type="button" className={cx('lab-dkey', on && 'lab-dkey-on')} aria-current={on ? 'true' : undefined} onClick={() => onSelect(entry.key)} title={entry.key}>
                    <span className={cx('lab-dkey-dot', status?.set && 'lab-dkey-dot-set')} title={status?.text} />
                    <span className="lab-dkey-label">{entry.label}</span>
                    {severity && <LintGlyph severity={severity} size={12} />}
                    {noted.has(entry.key) && <span className="lab-dkey-pin"><Glyph name="note" size={11} title="Has a review note" /></span>}
                    <span className="lab-dkey-counts" title={`${entry.writers.length} writers, ${treeReaders(entry).length} readers`}>{entry.writers.length}<Glyph name="caret" size={9} className="lab-dkey-arrow" />{treeReaders(entry).length}</span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------- bow-tie

/** This call's reach tally if one has already run (Flow, Outcomes): how often each key gets set. */
function useCachedReach(session: Session | null): { tally: ReachTally; style: Policy; pending: boolean } | null {
  const { jobs, url, tuning } = useLab();
  if (!session || !url.call || !jobs.cached || session.squad.kind !== 'reference') return null;
  for (const style of [...new Set([url.style, 'random'] as const)]) for (const path of [undefined, ''] as const) {
    const start: StartRef = { kind: 'fresh', scenarioId: session.scenario.id, kit: url.call.kit, squad: { seed: url.squad, certs: url.certs }, ...(path !== undefined ? { path } : {}) };
    const hit = jobs.cached({ kind: 'reach-call', start, style, runs: [0, RUN_DEFAULTS.call] }, { patch: tuning.patch, contentKey: session.contentKey });
    if (hit?.result.kind === 'reach') return { tally: hit.result.tally, style, pending: tuning.hash !== tuning.savedHash };
  }
  return null;
}

interface Wire { d: string; id: string; dashed: boolean }

function BowTie({ entry, names, tree, session, frame, lint, onSelectKey }: { entry: KeyEntry; names: CallNames; tree: CallTree; session: Session | null; frame: Frame | null;
  lint: LintFinding[]; onSelectKey: (key: StateKey) => void }) {
  const { navigate, playHere, url, deps, notify } = useLab();
  const [all, setAll] = useState<{ key: string; side: Record<'writers' | 'readers', boolean> }>({ key: '', side: { writers: false, readers: false } });
  const showAll = all.key === entry.key ? all.side : { writers: false, readers: false };
  const nameSet = { ...names, cond: (text: string) => humanizeCondition(text, tree, deps, names.bind, names.clock) };
  const words = (site: Site, side: 'writers' | 'readers') => siteWords(site, tree, side, nameSet);
  // Sites no choice controls (clocks, the draw, command approval) lead: they are the ones lint is about.
  const special = (site: Site) => (site.node ? 1 : 0);
  const writers = [...entry.writers].sort((a, b) => special(a) - special(b)).map(site => ({ site, words: words(site, 'writers') }));
  const readers = [...treeReaders(entry)].sort((a, b) => special(a) - special(b)).map(site => ({ site, words: words(site, 'readers') }));
  const engine = engineReaders(entry);
  const shownW = showAll.writers ? writers : writers.slice(0, SIDE_CAP);
  const shownR = showAll.readers ? readers : readers.slice(0, SIDE_CAP);
  const status = keyStatus(entry.key, session, frame);
  const reach = useCachedReach(session);
  const setRuns = reach ? reach.tally.keysSet[entry.key] ?? 0 : 0;
  const share = reach ? setRuns / Math.max(1, reach.tally.runs) : null;
  const findings = lint.filter(f => f.key === entry.key);
  const kind = kindOf(entry.key);

  // Wires: from each writer card to the knot, and from the knot to each reader card.
  const board = useRef<HTMLDivElement>(null);
  const knot = useRef<HTMLDivElement>(null);
  const [wires, setWires] = useState<{ w: number; h: number; paths: Wire[] }>({ w: 0, h: 0, paths: [] });
  useLayoutEffect(() => {
    const el = board.current;
    if (!el) return;
    const draw = () => {
      const box = el.getBoundingClientRect();
      const k = knot.current?.getBoundingClientRect();
      if (!k) return;
      const stacked = getComputedStyle(el).getPropertyValue('--lab-bowtie-stacked').trim() === '1';
      const paths: Wire[] = [];
      for (const card of el.querySelectorAll<HTMLElement>('[data-wire]')) {
        const r = card.getBoundingClientRect();
        const side = card.dataset.wire;
        const dashed = card.dataset.dashed === '1';
        if (stacked) {
          // One column: a short drop from each card's left edge into a spine beside the stack.
          const x = 12, y = r.top + r.height / 2 - box.top;
          const ky = k.top + k.height / 2 - box.top;
          paths.push({ id: card.dataset.id!, dashed, d: `M ${r.left - box.left} ${y} H ${x} V ${ky} H ${k.left - box.left}` });
          continue;
        }
        const y = r.top + r.height / 2 - box.top;
        const ky = Math.min(Math.max(y, k.top - box.top + 14), k.bottom - box.top - 14);
        if (side === 'writers') {
          const x1 = r.right - box.left, x2 = k.left - box.left, mid = (x1 + x2) / 2;
          paths.push({ id: card.dataset.id!, dashed, d: `M ${x1} ${y} C ${mid} ${y}, ${mid} ${ky}, ${x2} ${ky}` });
        } else {
          const x1 = k.right - box.left, x2 = r.left - box.left, mid = (x1 + x2) / 2;
          paths.push({ id: card.dataset.id!, dashed, d: `M ${x1} ${ky} C ${mid} ${ky}, ${mid} ${y}, ${x2} ${y}` });
        }
      }
      setWires({ w: box.width, h: box.height, paths });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [entry.key, shownW.length, shownR.length, url.call?.type]);

  const play = (site: Site) => { const goal: Goal | null = siteGoal(site, tree); if (goal) playHere(goal); };
  const flow = () => navigate({ tab: 'flow', flow: { ...url.flow, mode: 'state' }, sel: { kind: 'key', key: entry.key } });

  // A line whose hidden-truth condition fails in this call's situation can't happen here: say so on
  // tape, and offer a draw where it can instead of a path that doesn't exist.
  const situations = useMemo(() => {
    const out = new Map<Site, [Verdict, Verdict, Verdict]>();
    if (!session || !frame) return out;
    for (const site of [...entry.writers, ...entry.readers]) {
      if (!site.node || !site.choice || !site.band || site.outcome === undefined) continue;
      const target: ReqTarget = { outcome: [site.node, site.choice, site.band, site.outcome] };
      try {
        // Only the hidden-truth clauses decide the situation: AND their per-situation verdicts.
        const facts: [Verdict, Verdict, Verdict][] = [];
        const walk = (e: EvaluatedReq) => { if ('leaf' in e.node && e.bySituation) facts.push(e.bySituation); e.children.forEach(walk); };
        walk(evaluateReq(requirementTree(tree, target), session, frame, deps, target).root);
        if (facts.length) out.set(site, [0, 1, 2].map(i => facts.some(v => v[i] === 'fail') ? 'fail' : facts.every(v => v[i] === 'pass') ? 'pass' : 'unknown') as [Verdict, Verdict, Verdict]);
      } catch { /* a site the tree no longer has */ }
    }
    return out;
  }, [entry, session?.key, frame, tree, deps]);
  const offSituation = (site: Site) => { const v = situations.get(site); return session && v && v[session.situation] === 'fail' ? v : null; };
  const seekSituation = (verdicts: [Verdict, Verdict, Verdict]) => {
    const at = verdicts.findIndex(v => v === 'pass');
    if (!url.call || !session || at < 0) return;
    const found = seekCallSeed(url.call.type, { family: url.call.family, seed: url.call.seed, tier: url.call.tier, call: session.resolved.spec?.seed }, { variant: at as 0 | 1 | 2 });
    if (!found) { notify('No call seed in range draws that situation. Try another building seed.'); return; }
    navigate({ call: { ...url.call, call: found.call, id: null } });
    if (found.changed.length) notify(`Also changed: ${found.changed.join('; ')}.`, undefined, DRAW_NOTICE);
  };

  const card = (item: { site: Site; words: SiteWords }, side: 'writers' | 'readers') => {
    const off = offSituation(item.site);
    return (
    <article key={`${side}:${item.words.id}:${item.site.conditional ?? ''}`} className={cx('lab-dsite', item.words.drawn && 'lab-dsite-drawn', item.words.negated && 'lab-dsite-not', off && 'lab-dsite-off')}
      data-wire={side} data-id={item.words.id} data-dashed={item.words.drawn || item.words.negated ? '1' : '0'}>
      <p className="lab-dsite-where">
        {item.words.band && <span className={`lab-mark lab-tone-${BAND_GLYPH[item.words.band]}`}><Glyph name={BAND_GLYPH[item.words.band]} size={12} title={item.words.band} /></span>}
        {item.words.drawn && <span className="lab-dsite-die"><Glyph name="drawn" size={12} title="A drawn result decides it" /></span>}
        <span>{item.words.where}</span>
      </p>
      <p className="lab-dsite-does"><span className="lab-dsite-tag">{item.words.does}</span>{item.words.note && <span className="lab-dsite-if">{item.words.note}</span>}</p>
      {off && <p className="lab-dsite-off-note"><span className="lab-tag lab-tag-tape">not in situation {session!.situation + 1}</span>
        <span className="lab-muted">holds in situation {off.flatMap((v, i) => v === 'pass' ? [i + 1] : []).join(' and ') || 'none'}</span></p>}
      {item.words.playable && (
        <div className="lab-dsite-actions">
          {off ? <button type="button" className="lab-dsite-btn" onClick={() => seekSituation(off)} title="Open a call of this type drawn in a situation where this line applies"><Glyph name="situation" size={10} />Find a draw</button>
            : <button type="button" className="lab-dsite-btn" onClick={() => play(item.site)} title="Open Play on a path where this can happen"><Glyph name="play" size={10} />Play here</button>}
          <button type="button" className="lab-dsite-btn" onClick={flow}>Flow</button>
        </div>
      )}
    </article>
    );
  };

  return (
    <section className="lab-bowtie-wrap" aria-label={`Who sets and reads ${entry.label}`}>
      <div className="lab-bowtie" ref={board}>
        <svg className="lab-bowtie-wires" width={wires.w} height={wires.h} aria-hidden="true">
          {wires.paths.map((wire, i) => <path key={`${wire.id}-${i}`} d={wire.d} className={cx('lab-wire', wire.dashed && 'lab-wire-dashed')} />)}
        </svg>
        <div className="lab-bowtie-side lab-bowtie-writers">
          <h3 className="lab-bowtie-h"><Glyph name="writes" size={13} />Set by <span className="lab-bowtie-n">{writers.length}</span></h3>
          {writers.length === 0 && <p className="lab-bowtie-none">Nothing sets it.</p>}
          {shownW.map(item => card(item, 'writers'))}
          {writers.length > SIDE_CAP && <button type="button" className="lab-bowtie-more" onClick={() => setAll({ key: entry.key, side: { ...showAll, writers: !showAll.writers } })}>{showAll.writers ? 'Show fewer' : `Show all ${writers.length}`}</button>}
        </div>
        <div className="lab-knot" ref={knot}>
          <span className="lab-knot-kind"><Glyph name={KIND_INFO[kind].glyph} size={13} />{KIND_INFO[kind].label}</span>
          <h2 className="lab-knot-title">{entry.label}</h2>
          <code className="lab-knot-raw">{entry.key}</code>
          {status && <p className={cx('lab-knot-status', status.set && 'lab-knot-set')}><Glyph name={status.set ? 'clean' : 'dot'} size={12} />{status.text}</p>}
          <p className="lab-knot-share">
            {share !== null && reach ? (() => {
              const t = probText(share, { face: 'sim', scope: 'this call', who: squadName(url.squad, url.certs), style: reach.style, runs: reach.tally.runs, pending: reach.pending }, wilson(setRuns, reach.tally.runs), setRuns);
              return <span className="lab-knot-share-in" title={t.plain}>
                <span><b className={cx(t.muted && 'lab-muted')}>{t.value}</b> of runs set it</span>
                <span className={cx('lab-pill', reach.pending && 'lab-pending-mark')}>{t.pill.map((seg, i) => <span key={i} className="lab-pill-seg">{seg}</span>)}</span>
              </span>;
            })() : <span className="lab-muted">Run Reach in Flow to see how often it gets set.</span>}
          </p>
          {findings.map(f => <p key={f.id} className="lab-knot-lint"><LintGlyph severity={f.severity} size={12} />{LINT_LABEL[f.code]}</p>)}
          {engine.length > 0 && <p className="lab-knot-engine"><span className="lab-muted">The engine also reads it:</span> {engine.map(site => site.conditional).join('; ')}</p>}
          <div className="lab-knot-actions">
            <button type="button" className="lab-button lab-button-quiet" onClick={flow}>See it in Flow</button>
            <button type="button" className="lab-button lab-button-quiet" onClick={() => { onSelectKey(entry.key); navigate({ notes: true }, 'replace'); }}><Glyph name="note" size={13} />Note</button>
          </div>
        </div>
        <div className="lab-bowtie-side lab-bowtie-readers">
          <h3 className="lab-bowtie-h"><Glyph name="reads" size={13} />Read by <span className="lab-bowtie-n">{readers.length}</span></h3>
          {readers.length === 0 && <p className="lab-bowtie-none">{engine.length ? 'Only the engine reads it.' : 'Nothing reads it.'}</p>}
          {shownR.map(item => card(item, 'readers'))}
          {readers.length > SIDE_CAP && <button type="button" className="lab-bowtie-more" onClick={() => setAll({ key: entry.key, side: { ...showAll, readers: !showAll.readers } })}>{showAll.readers ? 'Show fewer' : `Show all ${readers.length}`}</button>}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Why

const VERDICT_WORDS: Record<Verdict, string> = { pass: 'holds', fail: 'fails', unknown: 'the dice decide' };

function VerdictMark({ verdict, size = 14 }: { verdict: Verdict; size?: number }) {
  return <span className={`lab-dverdict lab-dverdict-${verdict}`}><Glyph name={verdict === 'pass' ? 'clean' : verdict === 'fail' ? 'close' : 'drawn'} size={size} title={VERDICT_WORDS[verdict]} /></span>;
}

function WhyTracer({ target, onPick, names, tree, session, frame, deps, onSelectKey }: { target: ReqTarget; onPick: (target: ReqTarget) => void; names: CallNames; tree: CallTree;
  session: Session | null; frame: Frame | null; deps: DependencyIndex; onSelectKey: (key: StateKey) => void }) {
  const { url, navigate, jobs, tuning, playHere, notify } = useLab();
  const options = useMemo(() => whyOptions(tree, names), [tree, names]);
  const value = targetValue(target);
  const req = useMemo(() => { try { return requirementTree(tree, target); } catch { return null; } }, [tree, value]);
  const evaluated = useMemo(() => (req && session && frame ? evaluateReq(req, session, frame, deps, target) : null), [req, session, frame, deps, value]);
  const [squadSeek, setSquadSeek] = useState<{ cert: string; text: string; seed: number | null; busy: boolean } | null>(null);
  const [pathSeek, setPathSeek] = useState<{ text: string; path: string | null; busy: boolean } | null>(null);
  useEffect(() => { setSquadSeek(null); setPathSeek(null); }, [value, session?.key]);

  // The engine's own word on a choice, shown last and verbatim.
  const actionId = 'choice' in target ? choiceActionId(tree.type, target.choice[0], target.choice[1]) : null;
  const view = actionId && frame ? frame.views.find(entry => entry.id === actionId) : undefined;
  const here = frame ? nodeAt(frame.state, tree) : null;
  const choiceNode = 'choice' in target ? target.choice[0] : null;
  const engineLine = !actionId || !frame || !choiceNode ? null
    : view ? (view.eligible ? 'Offered and eligible at this state.' : `Locked: ${view.reason ?? 'no reason given'}`)
      : here === choiceNode ? 'Not offered at this state.' : `Not offered here: the call is at ${here ? names.node(here) : 'an ending'}, not ${names.node(choiceNode)}.`;

  const runFix = (fix: Fix) => {
    if (!url.call || !session) return;
    if (fix.kind === 'grant-cert') { navigate({ certs: [...new Set([...url.certs, fix.cert])] }); return; }
    if (fix.kind === 'seek-squad') {
      setSquadSeek({ cert: fix.cert, text: 'Looking through squad seeds 1 to 500…', seed: null, busy: true });
      jobs.run({ kind: 'seek-squad', cert: fix.cert, from: 1, limit: 500 }, { patch: tuning.patch, contentKey: session.contentKey, cache: 'memory' }).promise.then(result => {
        if (result.kind !== 'seek-squad') return;
        setSquadSeek({ cert: fix.cert, seed: result.seed, busy: false,
          text: result.seed === null ? `None in seeds 1 to ${result.tried}: no squad A there holds ${certWords(fix.cert)}.` : `Squad seed ${result.seed} has ${certWords(fix.cert)} in squad A.` });
      }, error => setSquadSeek({ cert: fix.cert, seed: null, busy: false, text: `The search stopped: ${error instanceof Error ? error.message : String(error)}` }));
      return;
    }
    if (fix.kind === 'seek-draw') {
      try {
        const draw = url.call;
        const found = seekCallSeed(draw.type, { family: draw.family, seed: draw.seed, tier: draw.tier, call: session.resolved.spec?.seed }, fix.want);
        if (!found) { notify('No call seed in range draws that. Try another building seed.'); return; }
        navigate({ call: { ...draw, call: found.call, id: null } });
        if (found.changed.length) notify(`Also changed: ${found.changed.join('; ')}.`, undefined, DRAW_NOTICE);
      } catch (error) { notify(`Could not search call seeds: ${error instanceof Error ? error.message : String(error)}`); }
      return;
    }
    // A path: explore from the call's start; the result stays here until it is opened in Play.
    setPathSeek({ text: 'Looking for a path…', path: null, busy: true });
    const start: StartRef = session.squad.kind === 'game' || session.prior.length ? { kind: 'state', state: session.frames[0].state }
      : { kind: 'fresh', scenarioId: session.scenario.id, kit: url.call.kit, squad: { seed: url.squad, certs: url.certs } };
    jobs.run({ kind: 'explore', start, goal: fix.goal, cap: 6000 }, { patch: tuning.patch, contentKey: session.contentKey, cache: 'memory' }).promise.then(result => {
      if (result.kind !== 'explore') return;
      const { path, states } = result.result;
      const steps = path ? path.split(',').filter(Boolean).length : 0;
      setPathSeek({ busy: false, path, text: path !== null ? `Found a path of ${steps} ${steps === 1 ? 'step' : 'steps'} (${states.toLocaleString('en-US')} states looked at).`
        : noPathText(result.result, 6000, null) });
    }, error => setPathSeek({ busy: false, path: null, text: `The search stopped: ${error instanceof Error ? error.message : String(error)}` }));
  };

  const fixLabel = (fix: Fix): string => {
    switch (fix.kind) {
      case 'grant-cert': return `Grant ${certWords(fix.cert)} to squad A (lab)`;
      case 'seek-squad': return `Find a squad seed with ${certWords(fix.cert)}`;
      case 'seek-draw': {
        const want = fix.want;
        if (want.variant !== undefined) return `Find a draw in situation ${want.variant + 1}`;
        if (want.turns) return `Find a draw with turn ${Object.values(want.turns).map(node => names.node(node).toLowerCase()).join(', ')}`;
        if (want.counts) return `Find a draw with ${Object.entries(want.counts).map(([group, n]) => `${group} ${n}`).join(', ')}`;
        return 'Find a draw where this holds';
      }
      case 'find-path': return 'Find a path where this holds';
    }
  };

  const groups = [...new Set(options.map(option => option.group))];
  const root = evaluated?.root ?? null;
  const overall = root?.now ?? 'unknown';
  const headline = !root ? 'Open the call to check it' : overall === 'pass' ? 'Can happen at this state' : overall === 'fail' ? 'Can’t happen at this state' : 'Depends on the dice at this state';
  return (
    <section className="lab-dwhy" aria-label="Why can or can't this happen">
      <div className="lab-dwhy-head">
        <h3 className="lab-deps-h">Why can or can’t this happen</h3>
        <select className="lab-input lab-dwhy-pick" aria-label="What to explain" value={value} onChange={event => { const found = options.find(option => option.value === event.target.value); if (found) onPick(found.target); }}>
          {groups.map(group => (
            <optgroup key={group} label={group}>
              {options.filter(option => option.group === group).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
      <div className={cx('lab-dwhy-verdict', `lab-dwhy-${overall}`)}>
        <VerdictMark verdict={overall} size={16} />
        <span className="lab-dwhy-headline">{headline}</span>
        {root?.bySituation && <SituationTape verdicts={root.bySituation} current={session?.situation ?? null} />}
      </div>
      {root && <ul className="lab-dwhy-tree">{root.children.length ? root.children.map((child, i) => <Clause key={i} e={child} depth={0} names={names} tree={tree} onSelectKey={onSelectKey} situation={session?.situation ?? null} />)
        : <li className="lab-dclause"><span className="lab-dclause-label">{root.label}</span></li>}</ul>}
      {engineLine && <p className={cx('lab-dwhy-engine', view && !view.eligible && 'lab-dwhy-engine-locked')}><span className="lab-dwhy-engine-who">Engine</span>{engineLine}</p>}
      {evaluated && evaluated.fixes.length > 0 && (
        <div className="lab-dwhy-fixes">
          {evaluated.fixes.map(fix => (
            <button key={JSON.stringify(fix)} type="button" className={cx('lab-button', fix.kind === 'grant-cert' && 'lab-dwhy-grant')} onClick={() => runFix(fix)}
              disabled={(fix.kind === 'seek-squad' && squadSeek?.busy) || (fix.kind === 'find-path' && pathSeek?.busy)}>
              {fixLabel(fix)}
            </button>
          ))}
        </div>
      )}
      {squadSeek && (
        <p className="lab-dwhy-result" role="status">
          {squadSeek.text}
          {squadSeek.seed !== null && <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ squad: squadSeek.seed! })}>Use squad {squadSeek.seed}</button>}
        </p>
      )}
      {pathSeek && (
        <p className="lab-dwhy-result" role="status">
          {pathSeek.text}
          {pathSeek.path !== null && <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ tab: 'play', path: pathSeek.path!, node: null })}>Open it in Play</button>}
        </p>
      )}
      {'ending' in target || 'node' in target ? <p className="lab-dwhy-foot">
        <button type="button" className="lab-button lab-button-quiet" onClick={() => playHere('ending' in target ? { ending: target.ending } : { node: (target as { node: string }).node })}><Glyph name="play" size={10} />Play here</button>
      </p> : null}
    </section>
  );
}

function SituationTape({ verdicts, current }: { verdicts: [Verdict, Verdict, Verdict]; current: number | null }) {
  return (
    <span className="lab-dwhy-tape" title="Hidden truth: whether this holds in each of the three situations">
      {verdicts.map((verdict, i) => (
        <span key={i} className={cx('lab-tag', 'lab-tag-tape', 'lab-dwhy-sit', current === i && 'lab-dwhy-sit-now')}>
          {i + 1} {verdict === 'pass' ? '✓' : verdict === 'fail' ? '✕' : '?'}
        </span>
      ))}
    </span>
  );
}

function Clause({ e, depth, names, tree, onSelectKey, situation }: { e: EvaluatedReq; depth: number; names: CallNames; tree: CallTree; onSelectKey: (key: StateKey) => void; situation: number | null }) {
  const key = 'leaf' in e.node ? leafKey(e.node.leaf) : null;
  const writers = e.writers.slice(0, 3);
  return (
    <li className={cx('lab-dclause', `lab-dclause-${e.now}`)} style={{ '--lab-depth': depth } as CSSProperties}>
      <div className="lab-dclause-row">
        <VerdictMark verdict={e.now} />
        <span className="lab-dclause-label">{e.label}</span>
        {e.bySituation && <SituationTape verdicts={e.bySituation} current={situation} />}
        {e.draw && <span className="lab-dclause-draw">{e.draw}</span>}
      </div>
      {e.now !== 'pass' && writers.length > 0 && (
        <p className="lab-dclause-writers">
          <span className="lab-muted">Set by</span>{' '}
          {writers.map((site, i) => {
            const w = siteWords(site, tree, 'writers', names);
            return <span key={i}>{i > 0 && ', '}{w.where}</span>;
          })}
          {e.writers.length > writers.length && <span className="lab-muted"> and {e.writers.length - writers.length} more</span>}
          {key && <button type="button" className="lab-deps-link" onClick={() => onSelectKey(key)}>Show the key</button>}
        </p>
      )}
      {e.children.length > 0 && <ul className="lab-dwhy-tree">{e.children.map((child, i) => <Clause key={i} e={child} depth={depth + 1} names={names} tree={tree} onSelectKey={onSelectKey} situation={situation} />)}</ul>}
    </li>
  );
}
