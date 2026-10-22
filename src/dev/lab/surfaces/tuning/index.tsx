// The Tuning studio (spec 3.7, section 7, J9): the whole game's numbers grouped by what the player
// feels, a few plain dials that write raw fields, every raw field behind "Advanced fields", the
// band curve with this moment's choices on it, three impact tiers (instant, quick, gate), the diff,
// and Save to src/sim/tuning.json through the dev server. The patch lives in the shell (useLab), so
// every surface's odds and runs use it while it is unsaved. Logic lives in studio.ts and
// model/macros.ts; this file wires.
import '../../../../sim/tuning-tables';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { humanizeNode } from '../../../../gen/incident/trees-v13/graph';
import { tuningLayers } from '../../../../sim/tuning';
import type { TuningPatch, TuningPath } from '../../../../sim/tuning';
import { useLab } from '../../context';
import { NOW } from '../../model/call';
import { getTuningFile, saveTuningFile } from '../../model/endpoints';
import { getPath, MACRO_DIALS, mergePatches, setPath, unsetPath } from '../../model/macros';
import type { GateVerdict } from '../../model/gate-view';
import { currentFrame, nodeAt, sessionBinder } from '../../model/session';
import type { Session } from '../../model/session';
import { referenceSquadName, squadLine } from '../../model/squads';
import { isTyping } from '../../shell/keys';
import { callKey, parseLabUrl } from '../../url';
import { ConfirmSheet, cx, Glyph, modalOpen, Toast } from '../../viz';
import { GroupDials } from './Dials';
import { DiffFooter } from './Diff';
import { AdvancedFields, fieldDomId, FixedPanel, RawPath } from './Fields';
import { GateTier, InstantTier, QuickTier } from './Impact';
import { GroupPreview } from './Previews';
import type { Moment } from './Previews';
import {
  CALL_GROUPS, changedByGroup, clearSavedNotice, diffOf, formatValue, groupFields, groupOf, GROUPS, instantTier, isEditable, normalizePatch, overridesFor,
  readSavedNotice, resetToDefaults, savedNoticeFor, studioLayers, tuningFileText, writeSavedNotice,
} from './studio';
import type { FieldState, SavedNotice, StudioGroup } from './studio';
import './tuning.css';

const REFERENCE_CALL = '?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
/** Dial drags and typing within this long of the last edit to the same control are one undo step. */
const UNDO_MERGE_MS = 800;
const session = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

type FileState = { status: 'unknown' } | { status: 'ok'; hash: string; stale: boolean } | { status: 'unavailable' } | { status: 'error'; message: string };
type SaveState = { phase: 'closed' } | { phase: 'confirm' } | { phase: 'saving' } | { phase: 'saved' } | { phase: 'conflict'; why: 'disk' | 'stale' }
  | { phase: 'error'; message: string } | { phase: 'copy'; text: string };

const sameJson = (a: unknown, b: unknown) => tuningFileText(a as TuningPatch) === tuningFileText(b as TuningPatch);

/** Scrolls the nearest scrolling ancestor so `el` sits mid-view. (scrollIntoView would also scroll the
 * shell's overflow-hidden frame and shift the whole lab.) */
function revealInside(el: HTMLElement) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight) {
      const box = node.getBoundingClientRect(), r = el.getBoundingClientRect();
      node.scrollTop += r.top - box.top - Math.max(0, (node.clientHeight - r.height) / 2);
      return;
    }
  }
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch { return false; }
}

export default function TuningSurface() {
  const { url, navigate, call, tuning, dev } = useLab();
  const group = groupOf(url.tuning.group).id;
  const layers = useMemo(() => {
    const registry = tuningLayers();
    return studioLayers({ defaults: registry.defaults, saved: registry.saved, patch: tuning.patch });
  }, [tuning.patch, tuning.savedHash]);
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const diff = useMemo(() => diffOf(layers), [layers]);
  const empty = diff.unsaved.length === 0;

  // ------------------------------------------------ edits and undo
  const undo = useRef<TuningPatch[]>([]);
  const last = useRef<{ source: string; at: number }>({ source: '', at: 0 });
  const [undoDepth, setUndoDepth] = useState(0);
  const commit = useCallback((next: TuningPatch, source: string) => {
    const normalized = normalizePatch(next, layersRef.current.saved);
    if (sameJson(normalized, layersRef.current.patch)) return;
    const now = Date.now();
    if (!(source && source === last.current.source && now - last.current.at < UNDO_MERGE_MS)) {
      undo.current.push(layersRef.current.patch);
      setUndoDepth(undo.current.length);
    }
    last.current = { source, at: now };
    tuning.setPatch(normalized);
  }, [tuning.setPatch]);
  const stepBack = useCallback(() => {
    const previous = undo.current.pop();
    setUndoDepth(undo.current.length);
    last.current = { source: '', at: 0 };
    if (previous) tuning.setPatch(normalizePatch(previous, layersRef.current.saved));
  }, [tuning.setPatch]);

  // A stored patch that equals the saved values (a save that reloaded the page before the shell
  // cleared it) holds nothing unsaved: drop it.
  useEffect(() => {
    const normalized = normalizePatch(tuning.patch, layers.saved);
    if (!sameJson(normalized, tuning.patch)) tuning.setPatch(normalized);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && !isTyping(event.target) && !modalOpen()) {
        event.preventDefault();
        stepBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepBack]);

  const writePatch = useCallback((patch: TuningPatch, source: string) => commit(mergePatches(layersRef.current.patch, patch), source), [commit]);
  const revertPaths = useCallback((paths: readonly TuningPath[]) => commit(paths.reduce((patch, path) => unsetPath(patch, path), layersRef.current.patch), ''), [commit]);
  const setField = useCallback((path: TuningPath, value: unknown) => commit(setPath(layersRef.current.patch, path, value), `field:${path}`), [commit]);
  const stageDefault = useCallback((path: TuningPath) => commit(setPath(layersRef.current.patch, path, getPath(layersRef.current.defaults, path)), ''), [commit]);

  // ------------------------------------------------ the Play moment
  const ready = call.status === 'ready' ? call.session : null;
  const lastSession = useRef<Session | null>(null);
  if (ready) lastSession.current = ready;
  const key = url.call ? callKey(url) : null;
  const openSession = ready ?? (key && lastSession.current?.key.startsWith(`${key}|`) ? lastSession.current : null);
  const frame = openSession ? currentFrame(openSession) : null;
  const rows = useMemo(() => {
    if (!openSession || !frame) return [];
    try { return instantTier(frame.state, openSession.focus, NOW, tuning.patch); } catch { return []; }
  }, [frame?.state, tuning.hash]);
  const moment: Moment = useMemo(() => {
    if (!url.call) return { status: 'none', rows: [], where: '', who: referenceSquadName() };
    if (!openSession || !frame) return { status: call.status === 'loading' ? 'loading' : 'none', rows: [], where: '', who: referenceSquadName() };
    const node = nodeAt(frame.state, openSession.tree);
    const treeNode = node ? openSession.tree.nodes.find(entry => entry.id === node) : null;
    let title = node ?? 'the end of the call';
    try { if (treeNode) title = humanizeNode(treeNode, sessionBinder(openSession)).title; } catch { /* keep the id */ }
    const who = squadLine(frame.state, openSession.squad).label;
    return { status: rows.length ? 'ready' : 'ended', rows, where: `${title}, step ${openSession.frames.length}`, who };
  }, [rows, openSession, frame, call.status, url.call]);
  const pickReference = () => navigate({ call: parseLabUrl(REFERENCE_CALL).url.call, path: '', node: null, sel: null, handoff: null, hist: '' });

  // ------------------------------------------------ the file on disk, save, copy
  const [file, setFile] = useState<FileState>({ status: 'unknown' });
  useEffect(() => {
    if (dev.staticBuild || dev.available !== true) { setFile({ status: dev.staticBuild || dev.available === false ? 'unavailable' : 'unknown' }); return; }
    let live = true;
    getTuningFile().then(answer => {
      if (!live) return;
      if ('unavailable' in answer) setFile({ status: 'unavailable' });
      // The page loaded tuning.json at module load; if the file differs now, saving would drop that edit.
      else setFile({ status: 'ok', hash: answer.hash, stale: !sameJson(answer.json, layersRef.current.savedSparse) });
    }, error => { if (live) setFile({ status: 'error', message: error instanceof Error ? error.message : String(error) }); });
    return () => { live = false; };
  }, [dev.staticBuild, dev.available, tuning.savedHash]);

  const [save, setSave] = useState<SaveState>({ phase: 'closed' });
  const [toast, setToast] = useState<string | null>(null);
  const [gate, setGate] = useState<{ verdicts: GateVerdict[]; hash: string } | null>(null);
  const overrides = useMemo(() => overridesFor(layers), [layers]);
  const canSave = !dev.staticBuild && dev.available === true && file.status === 'ok' && !empty && tuning.problems.length === 0;
  const saveBlock = dev.staticBuild ? 'Saving needs the dev server (npm run lab).'
    : dev.available === false ? 'The dev server isn\'t answering, so saving is off. Start it with npm run lab.'
      : dev.available === null || file.status === 'unknown' ? 'Checking the dev server…'
        : file.status === 'error' ? `tuning.json can't be read: ${file.message}`
          : tuning.problems.length ? 'Some unsaved values break a rule (see above), so they can\'t be saved.'
            : empty ? 'Nothing unsaved to write.' : null;

  const confirmSave = async () => {
    if (file.status !== 'ok') return;
    if (file.stale) { setSave({ phase: 'conflict', why: 'stale' }); return; }
    setSave({ phase: 'saving' });
    // Read the file again first: an edit since this page loaded is a conflict found without a write
    // attempt. The server still refuses (409) a write whose base hash moved in between.
    try {
      const now = await getTuningFile();
      if ('hash' in now && now.hash !== file.hash) { setSave({ phase: 'conflict', why: 'disk' }); return; }
    } catch { /* an unreadable file: let the write report it */ }
    const store = session();
    writeSavedNotice(savedNoticeFor(layers, Date.now()), store);
    const answer = await saveTuningFile(overrides, file.hash);
    if ('ok' in answer) {
      tuning.setPatch({});
      setSave({ phase: 'saved' });
      // Vite reloads the page because tuning.json is in the module graph; reload anyway so the
      // workers start again on the new file.
      window.setTimeout(() => window.location.reload(), 400);
      return;
    }
    clearSavedNotice(store);
    if ('conflict' in answer) setSave({ phase: 'conflict', why: 'disk' });
    else if ('unavailable' in answer) setSave({ phase: 'error', message: 'The dev server isn\'t answering, so nothing was written. Start it with npm run lab.' });
    else setSave({ phase: 'error', message: answer.error });
  };

  const copyPatch = async () => {
    const text = tuningFileText(overrides);
    const n = countLeaves(overrides);
    if (await copyText(text)) setToast(`Copied the tuning.json this would save: ${n ? `${n} ${n === 1 ? 'value' : 'values'}` : 'empty, every default'}.`);
    else setSave({ phase: 'copy', text });
  };

  // ------------------------------------------------ the saved checklist (after the reload)
  const [notice, setNotice] = useState<SavedNotice | null>(() => readSavedNotice(session()));
  const dismissNotice = () => { clearSavedNotice(session()); setNotice(null); };

  // ------------------------------------------------ selection and groups
  const selected = url.sel?.kind === 'field' ? url.sel.path : null;
  useEffect(() => {
    if (!selected) return;
    // After the shell's own first URL rewrite, which runs after this effect on the first render.
    if (!url.tuning.advanced && group !== 'fixed') { const t = window.setTimeout(() => navigate({ tuning: { ...url.tuning, advanced: true } }, 'replace'), 0); return () => window.clearTimeout(t); }
    const frameId = window.requestAnimationFrame(() => { const row = document.getElementById(fieldDomId(selected)); if (row) revealInside(row); });
    return () => window.cancelAnimationFrame(frameId);
  }, [selected, group, url.tuning.advanced]);
  const showField = (state: FieldState) => navigate({ sel: { kind: 'field', path: state.meta.path }, tuning: { group: isEditable(state.meta) || state.meta.mode === 'dead' ? state.meta.group : 'fixed', advanced: true } });
  const changed = useMemo(() => changedByGroup(layers), [layers]);
  // In the narrow layout the groups scroll sideways: keep the open one in view.
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const strip = nav.current, item = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !item || strip.scrollWidth <= strip.clientWidth) return;
    const left = item.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft, right = left + item.offsetWidth;
    if (left < strip.scrollLeft || right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = Math.max(0, left - 24);
  }, [group]);
  // A group with no dials (Department, Call flow) has nothing above its fields to hide them behind.
  const dialless = !MACRO_DIALS.some(dial => dial.group === group);
  const fieldsShown = group === 'fixed' || dialless || url.tuning.advanced;
  const info = groupOf(group);

  return (
    <div className="lab-tuning" data-group={group}>
      <header className="lab-thead">
        <div className="lab-thead-title">
          <h1 className="lab-thead-h">Tuning</h1>
          <p className="lab-thead-q">The whole game's numbers. Changes stay unsaved, and every odds figure and run in the lab uses them, until you save.</p>
        </div>
        <div className="lab-thead-status">
          <span className="lab-tchip" title="src/sim/tuning.json against the source defaults">tuning.json: <b>{diff.overrides.length}</b> saved {diff.overrides.length === 1 ? 'change' : 'changes'}</span>
          <span className={cx('lab-tchip', !empty && 'lab-tchip-pending')}>{empty ? 'Nothing unsaved' : <><b>{diff.unsaved.length}</b> unsaved</>}</span>
        </div>
        <div className="lab-thead-actions">
          <button type="button" className="lab-button lab-button-quiet" onClick={stepBack} disabled={!undoDepth} title="Undo the last edit (⌘Z)"><Glyph name="undo" size={13} />Undo</button>
          <button type="button" className="lab-button lab-button-quiet" onClick={() => commit({}, '')} disabled={empty}>Discard</button>
          <button type="button" className="lab-button lab-button-quiet" onClick={() => commit(resetToDefaults(layers), '')} disabled={diff.overrides.length === 0}
            title="Stage every source default over tuning.json. It still needs Save.">Reset to defaults</button>
          <button type="button" className="lab-button" onClick={() => void copyPatch()} title="Copy the tuning.json this would save">Copy patch JSON</button>
          <button type="button" className="lab-button lab-button-primary" disabled={!canSave} title={saveBlock ?? 'Write the unsaved values to src/sim/tuning.json'}
            onClick={() => setSave({ phase: 'confirm' })}>Save…</button>
        </div>
        {(saveBlock && (dev.staticBuild || dev.available === false)) && <p className="lab-thead-note"><Glyph name="info" size={13} />{saveBlock} Copy patch JSON still works.</p>}
        {file.status === 'ok' && file.stale && <p className="lab-thead-note lab-thead-warn"><Glyph name="warn" size={13} />tuning.json changed on disk since this page loaded. Reload to merge before saving.</p>}
        {tuning.problems.length > 0 && (
          <p className="lab-thead-note lab-thead-error"><Glyph name="error" size={13} />Not applied: {tuning.problems.map(problem => `${problem.path}: ${problem.reason}`).join(' ')}</p>
        )}
      </header>

      <nav ref={nav} className="lab-tnav" aria-label="Tuning groups">
        {GROUPS.map(entry => (
          <button key={entry.id} type="button" className="lab-tnav-item" aria-current={entry.id === group ? 'page' : undefined}
            onClick={() => navigate({ tuning: { ...url.tuning, group: entry.id }, sel: null })}>
            <span className="lab-tnav-label">{entry.label}{changed[entry.id as StudioGroup] ? <span className="lab-tnav-badge" title={`${changed[entry.id as StudioGroup]} unsaved`}>{changed[entry.id as StudioGroup]}</span> : null}</span>
            <span className="lab-tnav-feel">{entry.feel}</span>
          </button>
        ))}
      </nav>

      <div className="lab-tcenter">
        {notice && <SavedChecklist notice={notice} onDone={dismissNotice} />}
        <div className="lab-tgroup-head">
          <h2 className="lab-tgroup-title">{info.label}</h2>
          <p className="lab-tgroup-feel">{info.feel}{!CALL_GROUPS.has(group) && group !== 'fixed' ? ' These reach the department, not a single call.' : ''}</p>
        </div>
        <GroupPreview group={group} layers={layers} patch={tuning.patch} hash={tuning.hash} savedHash={tuning.savedHash} moment={moment} />
        <GroupDials group={group} layers={layers} actions={{ write: writePatch, revert: revertPaths }} />
        {group !== 'fixed' && dialless && <h3 className="lab-tfields-title">Fields <span className="lab-muted">({groupFields(group).shown.length}), each with its default, saved and current value</span></h3>}
        {group !== 'fixed' && !dialless && (
          <div className="lab-tadv-bar">
            <button type="button" className="lab-button" aria-expanded={url.tuning.advanced} onClick={() => navigate({ tuning: { ...url.tuning, advanced: !url.tuning.advanced } }, 'replace')}>
              <Glyph name="caret" size={12} />{url.tuning.advanced ? 'Hide advanced fields' : `Advanced fields (${groupFields(group).shown.length})`}
            </button>
            <span className="lab-muted">Every raw field in this group, with its default, saved and current value.</span>
          </div>
        )}
        {fieldsShown && (group === 'fixed'
          ? <FixedPanel layers={layers} selected={selected} />
          : <AdvancedFields group={group} layers={layers} problems={tuning.problems} selected={selected} actions={{ set: setField, revert: path => revertPaths([path]) }} />)}
      </div>

      <aside className="lab-timpact" aria-label="Impact">
        <InstantTier moment={moment} pending={!empty} onPickCall={pickReference} />
        <QuickTier session={openSession} hash={tuning.hash} patch={tuning.patch} empty={empty} />
        <GateTier patch={tuning.patch} hash={tuning.hash} empty={empty} onVerdicts={setGate} />
      </aside>

      <DiffFooter unsaved={diff.unsaved} overrides={diff.overrides} onRevert={path => revertPaths([path])} onDefault={stageDefault} onShow={showField} />

      <ConfirmSheet open={save.phase !== 'closed'} title={sheetTitle(save, diff.unsaved.length)}
        confirmLabel={save.phase === 'conflict' ? 'Reload to merge' : save.phase === 'confirm' ? `Write ${diff.unsaved.length} ${diff.unsaved.length === 1 ? 'value' : 'values'}` : save.phase === 'saving' ? 'Writing…' : 'Close'}
        cancelLabel={save.phase === 'conflict' ? 'Keep editing' : save.phase === 'confirm' ? 'Cancel' : 'Close'}
        busy={save.phase === 'saving' || save.phase === 'saved'}
        onConfirm={() => {
          if (save.phase === 'confirm') void confirmSave();
          else if (save.phase === 'conflict') window.location.reload();
          else setSave({ phase: 'closed' });
        }}
        onCancel={() => { if (save.phase !== 'saving' && save.phase !== 'saved') setSave({ phase: 'closed' }); }}>
        <SaveSheetBody save={save} unsaved={diff.unsaved} gate={gate && gate.hash === tuning.hash ? gate.verdicts : null} />
      </ConfirmSheet>
      {toast && <Toast onClose={() => setToast(null)}>{toast}</Toast>}
    </div>
  );
}

const countLeaves = (patch: TuningPatch): number => {
  const count = (value: unknown): number => value && typeof value === 'object' && !Array.isArray(value) ? Object.values(value).reduce((sum: number, child) => sum + count(child), 0) : 1;
  return Object.values(patch).reduce((sum, table) => sum + count(table), 0);
};

function sheetTitle(save: SaveState, n: number): string {
  switch (save.phase) {
    case 'conflict': return 'tuning.json changed on disk';
    case 'error': return 'Nothing was saved';
    case 'saving': return 'Writing tuning.json…';
    case 'saved': return 'Saved. Reloading…';
    case 'copy': return 'Copy the patch by hand';
    default: return `Save ${n} ${n === 1 ? 'value' : 'values'} to tuning.json`;
  }
}

function SaveSheetBody({ save, unsaved, gate }: { save: SaveState; unsaved: readonly FieldState[]; gate: GateVerdict[] | null }) {
  if (save.phase === 'conflict') {
    return save.why === 'disk'
      ? <p>tuning.json changed on disk since this page loaded. Reload to merge: your unsaved values stay and are laid over the file as it is now. Nothing was written.</p>
      : <p>tuning.json on disk no longer matches what this page loaded, so saving now would drop that edit. Reload to merge: your unsaved values stay and are laid over the file as it is now. Nothing was written.</p>;
  }
  if (save.phase === 'error') return <p className="lab-error-text">{save.message}</p>;
  if (save.phase === 'copy') return <><p>This browser blocked the clipboard. Select the text and copy it.</p><textarea className="lab-tcopy" readOnly value={save.text} rows={8} onFocus={event => event.currentTarget.select()} /></>;
  if (save.phase === 'saved') return <p>Wrote src/sim/tuning.json. The page reloads with the new values and lists the tests to run.</p>;
  const pass = gate?.filter(v => v.pass).length ?? 0;
  const pinned = [...new Set(unsaved.flatMap(state => state.meta.pinnedBy))].sort();
  return (
    <div className="lab-tsave">
      <table className="lab-tdiff-table">
        <thead><tr><th scope="col" className="lab-tdiff-first">Field</th><th scope="col">tuning.json now</th><th scope="col">after saving</th></tr></thead>
        <tbody>
          {unsaved.map(state => (
            <tr key={state.meta.path}>
              <th scope="row"><span className="lab-twrites-label">{state.meta.label}</span><RawPath path={state.meta.path} /></th>
              <td>{fmt(state, 'saved')}</td>
              <td className="lab-twrites-now">{fmt(state, 'now')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lab-tsave-gate">
        <Glyph name={gate ? (pass === gate.length ? 'clean' : 'warn') : 'info'} size={13} />
        {gate ? `CI gate for this change: ${pass} of ${gate.length} checks pass.` : 'Not run for this change; CI will run the gate.'}
      </p>
      <p className="lab-tsave-pinned">{pinned.length + (pinned.includes('src/sim/tuning-tables.test.ts') ? 0 : 1)} test files pin values in these tables. npm run verify runs them:</p>
      <ul className="lab-tsave-list">{['src/sim/tuning-tables.test.ts', ...pinned.filter(file => file !== 'src/sim/tuning-tables.test.ts')].map(file => <li key={file}><code className="lab-raw">{file}</code></li>)}</ul>
    </div>
  );
}

const fmt = (state: FieldState, side: 'saved' | 'now') => formatValue(side === 'saved' ? state.saved : state.now, state.meta);

function SavedChecklist({ notice, onDone }: { notice: SavedNotice; onDone: () => void }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  return (
    <section className="lab-tsaved" aria-label="Saved">
      <header className="lab-tsaved-head">
        <Glyph name="clean" size={16} />
        <h2 className="lab-tsaved-title">Saved {notice.fields.length} {notice.fields.length === 1 ? 'value' : 'values'} to src/sim/tuning.json</h2>
        <button type="button" className="lab-button lab-button-quiet" onClick={onDone}>Done</button>
      </header>
      <ul className="lab-tsaved-fields">
        {notice.fields.map(field => <li key={field.path}><span className="lab-twrites-label">{field.label}</span> {field.before} → <b>{field.after}</b> <RawPath path={field.path} /></li>)}
      </ul>
      <p className="lab-tsaved-run">Run <code className="lab-raw">npm run verify</code>. These tests pin values in the changed tables, so a failure there is the change, not a bug:</p>
      <ul className="lab-tsaved-tests">
        {notice.pinned.map(file => (
          <li key={file}>
            <label><input type="checkbox" checked={done.has(file)} onChange={event => setDone(set => { const next = new Set(set); if (event.target.checked) next.add(file); else next.delete(file); return next; })} />
              <code className="lab-raw">{file}</code></label>
          </li>
        ))}
      </ul>
    </section>
  );
}
