// The Scenario Lab (spec section 9.4): the shell around every surface. LabApp owns the URL focus
// (history API, popstate), the open call (opened when the call key or the tuning patch changes, then
// the URL path replayed), the undo stack for draw changes, the unsaved tuning patch, the worker pool,
// the notes for the call type, dev-server status, the call's dependency index and graph, and one
// error boundary per surface. main.tsx loads it in dev at /lab (or with `?lab` in a static lab
// build); it never imports the game's store.
// Every tuning table registers before the stored patch is applied, so the first paint already has
// them all (an unregistered table's patch would wait for its module).
import '../../sim/tuning-tables';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { INCIDENT_TEMPLATES } from '../../content/incidents';
import { clockMarksOf } from '../../gen/incident/instance';
import { sessionClockNexts } from './model/clocks';
import { dependencyIndex } from '../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex } from '../../gen/incident/trees-v13/dependencies';
import { callGraph, choiceIndex } from '../../gen/incident/trees-v13/graph';
import type { IncidentType } from '../../sim/scenario-types';
import { applyTuningPatch, tuningHash } from '../../sim/tuning';
import type { TuningPatch } from '../../sim/tuning';
import { readLabHandoff } from '../../ui/lab-handoff';
import { DRAW_NOTICE, LabContext, useLab } from './context';
import type { LabContextValue, NoticeAction } from './context';
import { createLabDebug } from './debug';
import type { DebugSource } from './debug';
import { createPool, isJobCancelled } from './jobs/pool';
import type { JobPool } from './jobs/pool';
import type { Goal, StartRef } from './jobs/protocol';
import type { LabMove } from './model/call';
import { emptyNotes, loadNotesFile, saveNotesFile, useDevServer } from './model/endpoints';
import { EXPLORE_CAP, noPathText } from './model/explore';
import { currentFrame, nodeAt, openSession, replayTokens, rewindSession, sessionTokens, stepSession } from './model/session';
import type { OpenError, Session } from './model/session';
import { squadLine } from './model/squads';
import { blockedBecause } from './model/why';
import { CALL_TEMPLATES, CallCard, callTitle } from './shell/CallSwitcher';
import { CallStrip } from './shell/CallStrip';
import { CommandPalette } from './shell/CommandPalette';
import { useShellKeys } from './shell/keys';
import { useNarrow } from './shell/media';
import { NoticeBar } from './shell/NoticeBar';
import { addNotice, dropNoticeKey } from './shell/notices';
import type { Notice } from './shell/NoticeBar';
import { PendingBanner } from './shell/PendingBanner';
import { ShortcutSheet } from './shell/ShortcutSheet';
import { SurfaceBoundary } from './shell/SurfaceBoundary';
import { TopBar } from './shell/TopBar';
import { REVIEW, SURFACE_REGISTRY } from './surfaces';
import { PlayerPage } from './surfaces/play/PlayerPage';
import type { LabCall, LabUrl, NotesFile, Selection } from './types';
import { callKey, defaultCall, labUrlToSearch, parseLabUrl } from './url';
import { Drawer, Glyph } from './viz';
import './lab.css';

const PATCH_KEY = 'ti-lab-tuning-patch';
/** How many draw changes Undo can walk back. */
const UNDO_DEPTH = 20;

type CallState = LabContextValue['call'];

// ---------------------------------------------------------------- tuning patch

function readStoredPatch(): TuningPatch {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PATCH_KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as TuningPatch : {};
  } catch { return {}; }
}
function storePatch(patch: TuningPatch) {
  try {
    if (Object.keys(patch).length) localStorage.setItem(PATCH_KEY, JSON.stringify(patch)); else localStorage.removeItem(PATCH_KEY);
  } catch { /* blocked storage: the patch lasts for this page only */ }
}
/** Applies the patch to this page's tables (saved values first, so it is idempotent) and reads the hashes. */
function tuningState(patch: TuningPatch): Omit<LabContextValue['tuning'], 'setPatch'> {
  const problems = applyTuningPatch(patch);
  return { patch, problems, hash: tuningHash('current'), savedHash: tuningHash('saved') };
}

// ---------------------------------------------------------------- worker pool

/** One pool for the page. createPool never throws (it runs jobs on the page without workers); should
 * it ever, an inert pool answers every job with the reason and runs nothing. */
let sharedPool: JobPool | null = null;
function pool(): JobPool {
  if (sharedPool) return sharedPool;
  try { sharedPool = createPool(); } catch (error) {
    console.error('Scenario Lab: the worker pool could not start', error);
    const reason = error instanceof Error ? error.message : String(error);
    sharedPool = {
      size: 0, active: () => 0, dispose: () => {},
      run: () => { const promise = Promise.reject(new Error(reason)); promise.catch(() => {}); return { id: 'unavailable', promise, cancel: () => {} }; },
    };
  }
  return sharedPool;
}
if (import.meta.hot) import.meta.hot.dispose(() => { sharedPool?.dispose(); sharedPool = null; });

// ---------------------------------------------------------------- the call

const errorOf = (error: unknown): OpenError => ({ kind: 'generate', message: error instanceof Error ? error.message : String(error) });

/** Opens the call in focus on the engine and replays the URL path on it. */
function openCall(u: LabUrl): CallState {
  if (!u.call) return { status: 'none' };
  try {
    let handoff = null;
    if (u.handoff) { try { handoff = readLabHandoff(u.handoff); } catch { handoff = null; } }
    const opened = openSession(u, handoff);
    if (!('frames' in opened)) return { status: 'error', error: opened };
    return { status: 'ready', session: u.path ? replayTokens(opened, u.path) : opened };
  } catch (error) {
    return { status: 'error', error: errorOf(error) };
  }
}

/** The notice for a refused path token: the kept prefix, then the session's own reason (not
 * offered, locked and why, a band too narrow to force, the call already over). */
function stoppedNotice(s: Session): string {
  const stopped = s.stopped!;
  return `Path kept to step ${stopped.step - 1}. Step ${stopped.step}: ${stopped.why}`;
}

const selectionFor = (goal: Goal): Selection | null =>
  'node' in goal ? { kind: 'node', node: goal.node } : 'ending' in goal ? { kind: 'ending', ending: goal.ending } : null;

const failText = (what: string, error: unknown) => `${what} failed: ${error instanceof Error ? error.message : String(error)}`;

// ---------------------------------------------------------------- the shell

let noticeSeq = 0;
const noticeId = () => `n${++noticeSeq}`;

export function LabApp() {
  const initial = useMemo(() => ({ ...parseLabUrl(window.location.search), search: window.location.search }), []);
  // `frame=player`: the game alone, full window, for Play's true-device iframe.
  if (initial.url.frame === 'player') return <PlayerPage url={initial.url} />;
  return <Lab initial={initial} />;
}

function Lab({ initial }: { initial: ReturnType<typeof parseLabUrl> & { search: string } }) {
  // ------------------------------------------------ URL focus
  const [url, setUrl] = useState<LabUrl>(initial.url);
  const urlRef = useRef(url);
  const drawStack = useRef<LabUrl[]>([]);
  const [notices, setNotices] = useState<Notice[]>(() => initial.notices.map(text => ({ id: noticeId(), text, tone: 'info' })));

  const write = (next: LabUrl, mode: 'push' | 'replace') => {
    const search = labUrlToSearch(next);
    const href = `${window.location.pathname}${search}${window.location.hash}`;
    if (search !== window.location.search) {
      if (mode === 'replace') window.history.replaceState(null, '', href); else window.history.pushState(null, '', href);
    }
    urlRef.current = next;
    setUrl(next);
  };

  const navigate = useCallback((next: Partial<LabUrl>, mode: 'push' | 'replace' = 'push') => {
    const prev = urlRef.current;
    const merged: LabUrl = { ...prev, ...next };
    if (prev.call && merged.call && callKey(merged) !== callKey(prev)) {
      drawStack.current.push(prev);
      if (drawStack.current.length > UNDO_DEPTH) drawStack.current.shift();
    }
    write(merged, mode);
  }, []);

  const notify = useCallback((text: string, actions?: NoticeAction[], key?: string) => {
    setNotices(list => addNotice(list, { id: noticeId(), text, tone: 'info', actions, ...key ? { key } : {} }));
  }, []);
  /** Back and Undo draw change undo the draw change a draw notice describes. */
  const clearDrawNotice = () => setNotices(list => dropNoticeKey(list, DRAW_NOTICE));
  const dismiss = useCallback((id: string) => setNotices(list => list.filter(notice => notice.id !== id)), []);

  const undoDraw = useCallback(() => {
    const prev = drawStack.current.pop();
    if (!prev) return;
    clearDrawNotice();
    const now = urlRef.current;
    write({ ...now, call: prev.call, squad: prev.squad, certs: prev.certs, handoff: prev.handoff, hist: prev.hist, path: prev.path }, 'push');
  }, []);

  // The link as typed, rewritten to its canonical form before any surface's mount effect can navigate
  // (layout effects run before every passive one), and never over a URL something already wrote.
  useLayoutEffect(() => {
    if (initial.rewritten && window.location.search === initial.search) window.history.replaceState(null, '', `${window.location.pathname}${labUrlToSearch(initial.url)}${window.location.hash}`);
  }, []);
  useEffect(() => {
    const onPop = () => {
      const parsed = parseLabUrl(window.location.search);
      urlRef.current = parsed.url;
      setUrl(parsed.url);
      clearDrawNotice();
      for (const text of parsed.notices) notify(text);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ------------------------------------------------ tuning patch
  const [tuning, setTuning] = useState(() => tuningState(readStoredPatch()));
  const setPatch = useCallback((patch: TuningPatch) => { storePatch(patch); setTuning(tuningState(patch)); }, []);

  // ------------------------------------------------ the call
  const key = callKey(url);
  const [opened, setCall] = useState<CallState>(() => (url.call ? { status: 'loading' } : { status: 'none' }));
  // A session opened for another draw or tuning is the old call: surfaces see the new one loading,
  // never the old one under the new URL (a selection would resolve against the wrong call).
  const call: CallState = opened.status === 'ready' && opened.session.key !== `${key}|${tuning.hash}` ? { status: 'loading' } : opened;
  const session = call.status === 'ready' ? call.session : null;
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;
  const template = url.call ? INCIDENT_TEMPLATES[url.call.type] : undefined;

  useEffect(() => {
    if (!urlRef.current.call) { setCall({ status: 'none' }); return; }
    setCall({ status: 'loading' });
    // A frame first, so "Building the call…" paints before the engine works.
    const timer = window.setTimeout(() => {
      const opened = openCall(urlRef.current);
      setCall(opened);
      if (opened.status !== 'ready') return;
      // The URL follows what was played: the valid prefix of a refused path, and a link typed
      // another way (a trailing comma, `+` in a drawn key) in canonical form.
      const kept = sessionTokens(opened.session);
      if (kept !== urlRef.current.path) write({ ...urlRef.current, path: kept }, 'replace');
      const stepped = opened.session.stopped;
      if (!stepped) return;
      const actions: NoticeAction[] = [{ label: 'Why', run: () => whyRefused(opened.session) }];
      if (drawStack.current.length) actions.push({ label: 'Undo draw change', run: undoDraw });
      notify(stoppedNotice(opened.session), actions);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key, tuning.hash]);

  // A path change that didn't come from a step here (Back, Play here, a pasted link) replays on the open call.
  useEffect(() => {
    if (!session) return;
    try {
      if (sessionTokens(session) === url.path) return;
      const next = replayTokens(session, url.path);
      if (next !== session) setCall({ status: 'ready', session: next });
      // The URL follows what was played (a refused step's valid prefix, or the canonical form of a
      // link typed another way), so this effect settles instead of replaying again.
      const kept = sessionTokens(next);
      if (kept !== url.path) write({ ...urlRef.current, path: kept }, 'replace');
      if (next.stopped) {
        notify(stoppedNotice(next), [{ label: 'Why', run: () => whyRefused(next) }]);
      }
    } catch (error) {
      notify(failText('Replaying the path', error));
    }
  }, [url.path, session]);

  const whyRefused = (s: Session) => {
    const token = s.stopped?.token ?? '';
    const actionId = token.slice(0, Math.max(0, token.lastIndexOf('~')));
    let sel: Selection | null = null;
    try { const parts = choiceIndex(s.tree).get(actionId); if (parts) sel = { kind: 'choice', node: parts.node, choice: parts.choice }; } catch { sel = null; }
    navigate({ tab: 'deps', ...(sel ? { sel } : {}) });
  };

  const step = useCallback((move: LabMove) => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const next = stepSession(s, move);
      if ('refused' in next) { notify(next.refused); return; }
      sessionRef.current = next;
      setCall({ status: 'ready', session: next });
      navigate({ path: sessionTokens(next) }, 'replace');
    } catch (error) { notify(failText('Taking a step', error)); }
  }, []);

  const rewind = useCallback((to: number) => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const next = rewindSession(s, to);
      sessionRef.current = next;
      setCall({ status: 'ready', session: next });
      navigate({ path: sessionTokens(next) }, 'replace');
    } catch (error) { notify(failText('Rewinding', error)); }
  }, []);

  /** Shortest path to the goal (explore job), then Play with that path. `mode` replace when it only
   * resolves the URL's own `node`. */
  const explore = (goal: Goal, mode: 'push' | 'replace') => {
    const s = sessionRef.current, u = urlRef.current;
    if (!s || !u.call) { notify('Open a call first.'); return; }
    // From the game's own state on a handoff, and from after the game's moves on the `hist` fallback
    // (they are replayed into the first frame); a fresh start otherwise.
    const start: StartRef = s.squad.kind === 'game' || s.prior.length > 0 ? { kind: 'state', state: s.frames[0].state }
      : { kind: 'fresh', scenarioId: s.scenario.id, kit: u.call.kit, squad: { seed: u.squad, certs: u.certs } };
    try {
      pool().run({ kind: 'explore', start, goal, cap: EXPLORE_CAP }, { patch: tuning.patch, contentKey: s.contentKey, cache: 'memory' }).promise.then(result => {
        // The call changed while the walk ran: its answer is for a call that's gone.
        if (result.kind !== 'explore' || sessionRef.current?.key !== s.key) return;
        if (result.result.path === null) {
          let blocker: string | null = null;
          try { blocker = blockedBecause(s, goal, depsRef.current, squadLine(s.frames[0].state, s.squad).label); } catch { blocker = null; }
          notify(noPathText(result.result, EXPLORE_CAP, blocker));
          return;
        }
        const sel = selectionFor(goal);
        navigate({ tab: 'play', path: result.result.path, node: null, ...(sel ? { sel } : {}) }, mode);
      }, error => { if (!isJobCancelled(error)) notify(failText('Finding a path', error)); });
    } catch (error) { notify(failText('Finding a path', error)); }
  };
  const playHere = useCallback((goal: Goal) => explore(goal, 'push'), [tuning.patch]);

  // `node=<id>`: show that node. When the path doesn't already end there, the explorer writes one.
  useEffect(() => {
    if (!session || !url.node) return;
    try {
      if (nodeAt(currentFrame(session).state, session.tree) === url.node) navigate({ node: null, sel: { kind: 'node', node: url.node } }, 'replace');
      else explore({ node: url.node }, 'replace');
    } catch (error) {
      notify(failText('Opening the node', error));
    }
  }, [session, url.node]);

  // ------------------------------------------------ index, graph, notes, dev
  const deps = useMemo(() => { try { return template ? dependencyIndex(template) : null; } catch { return null; } }, [template]);
  const depsRef = useRef<DependencyIndex | null>(deps);
  depsRef.current = deps;
  const graph = useMemo(() => {
    if (!session) return null;
    try {
      // Clock marks count as settable, as in compileIncident.
      return callGraph(session.tree, { counts: session.counts, seed: session.resolved.spec?.seed, situation: session.situation, clockMarks: clockMarksOf(session.instance.clocks), clockNexts: sessionClockNexts(session) });
    } catch { return null; }
  }, [session]);

  const dev = useDevServer();
  const type = url.call?.type;
  const [notesState, setNotesState] = useState<{ type: IncidentType; file: NotesFile; hash: string | null; shared: boolean } | null>(null);
  useEffect(() => {
    if (!type) return;
    let live = true;
    loadNotesFile(type).then(loaded => { if (live) setNotesState({ type, ...loaded }); },
      error => { if (live) notify(`Notes for this call could not be read: ${error instanceof Error ? error.message : String(error)}`); });
    return () => { live = false; };
  }, [type]);
  const notesRef = useRef(notesState);
  notesRef.current = notesState;
  const notes = useMemo<LabContextValue['notes']>(() => {
    const current = notesState && notesState.type === type ? notesState : null;
    return {
      file: current?.file ?? emptyNotes(type ?? 'hostage_crisis'),
      shared: current?.shared ?? (dev.available === true),
      save: async file => {
        const held = notesRef.current;
        if (!type) return 'error';
        const saved = await saveNotesFile(type, file, held && held.type === type ? held.hash : null);
        if ('ok' in saved) {
          const next = { type, file, hash: saved.hash, shared: saved.shared };
          notesRef.current = next;
          setNotesState(next);
          return 'ok';
        }
        if ('conflict' in saved) return 'conflict';
        notify(saved.error);
        return 'error';
      },
      // Read the file again (after a 409), so the next save carries the hash it has on disk now.
      reload: async () => {
        if (!type) return null;
        try {
          const loaded = await loadNotesFile(type);
          const next = { type, ...loaded };
          notesRef.current = next;
          setNotesState(next);
          return loaded.file;
        } catch (error) {
          notify(`Notes for this call could not be read: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        }
      },
    };
  }, [notesState, type, dev.available]);

  // ------------------------------------------------ layers and keys
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  useShellKeys({
    palette: () => setPalette(open => !open),
    surface: tab => navigate({ tab }),
    note: () => navigate({ notes: true }, 'replace'),
    drawer: () => navigate({ notes: !urlRef.current.notes }, 'replace'),
    shortcuts: () => setShortcuts(true),
  });

  // ------------------------------------------------ context, title, debug handle
  const value: LabContextValue = useMemo(() => ({
    url, navigate, call, step, rewind, playHere,
    tuning: { ...tuning, setPatch }, jobs: pool(), dev, notes, deps, graph, notify,
  }), [url, call, tuning, dev, notes, deps, graph, playHere]);

  const title = callTitle(type);
  useEffect(() => { document.title = title ? `Scenario Lab · ${title}` : 'Scenario Lab'; }, [title]);

  const debugSource = useRef<DebugSource>({ url, session, deps, pool: pool(), patch: tuning.patch });
  debugSource.current = { url, session, deps, pool: pool(), patch: tuning.patch };
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__lab = createLabDebug(() => debugSource.current);
    return () => { delete window.__lab; };
  }, []);

  // ------------------------------------------------ render
  const narrow = useNarrow();
  const entry = SURFACE_REGISTRY[url.tab];
  const callNotices = [...callNoticesFor(call, url.call, navigate), ...sessionNotices(session, url.tab, navigate)];
  const Surface = entry.Component;
  const Review = REVIEW.Component;
  return (
    <LabContext.Provider value={value}>
      <div className="lab-root" data-lab="ti-lab-build-marker" data-surface={url.tab}>
        <TopBar onPalette={() => setPalette(true)} onShortcuts={() => setShortcuts(true)} />
        <CallStrip />
        <PendingBanner />
        <NoticeBar notices={[...callNotices, ...notices]} onDismiss={dismiss} />
        <main className="lab-main" aria-label={entry.label}>
          <SurfaceBoundary name={entry.label} resetKey={`${url.tab}|${key}`}>
            {entry.needsCall && !url.call ? <PickACall surface={entry.label} /> : <Surface />}
          </SurfaceBoundary>
        </main>
        <Drawer open={url.notes} onClose={() => navigate({ notes: false }, 'replace')} title={title ? `Review · ${title}` : 'Review'} width={narrow ? 360 : 400}>
          <SurfaceBoundary name={REVIEW.label} resetKey={key}><Review /></SurfaceBoundary>
        </Drawer>
        <CommandPalette open={palette} onClose={() => setPalette(false)} />
        <ShortcutSheet open={shortcuts} onClose={() => setShortcuts(false)} />
      </div>
    </LabContext.Provider>
  );
}

/** The call's own state as notices: generator errors with the action that fixes them. These stay
 * while the state lasts. */
function callNoticesFor(call: CallState, draw: LabCall | null, navigate: LabContextValue['navigate']): Notice[] {
  if (call.status !== 'error' || !draw) return [];
  const { error } = call;
  const base = { id: 'call', dismissible: false } as const;
  switch (error.kind) {
    case 'host-moved':
      // The generator moved the call to another seed of this building, or to another building type
      // (then its own message says where, and no seed here would help).
      if (error.movedTo === undefined) return [{ ...base, tone: 'warn', text: error.message }];
      return [{ ...base, tone: 'warn', text: `This building can't host the call; the generator moved it to seed ${error.movedTo}.`,
        actions: [{ label: `Use seed ${error.movedTo}`, run: () => navigate({ call: { ...draw, seed: error.movedTo!, id: null } }) }] }];
    case 'not-call-tree':
      return [{ ...base, tone: 'error', text: error.message, actions: [{ label: 'All calls', run: () => navigate({ tab: 'calls', call: null, path: '' }) }] }];
    case 'old-version':
      return [{ ...base, tone: 'error', text: error.message, actions: [{ label: 'Open the current version', run: () => navigate({ call: defaultCall(draw.type), path: '' }) }] }];
    default:
      return [{ ...base, tone: 'error', text: `Could not generate this call: ${error.message}`,
        actions: [{ label: 'Next building seed', run: () => navigate({ call: { ...draw, seed: draw.seed + 1, id: null } }) }] }];
  }
}

/** The open call's own note (the game snapshot expired, so the lab replayed the game's moves on the
 * reference squad) on every surface but Play, which shows it beside the frame. */
function sessionNotices(session: Session | null, tab: LabUrl['tab'], navigate: LabContextValue['navigate']): Notice[] {
  if (!session?.note || tab === 'play') return [];
  return [{ id: 'session-note', tone: 'warn', dismissible: false, text: session.note,
    actions: [{ label: 'Use reference squad as is', run: () => navigate({ handoff: null, hist: '' }) }] }];
}

/** A surface that needs a call, opened with none in focus. */
function PickACall({ surface }: { surface: string }) {
  return (
    <section className="lab-pick">
      <h1 className="lab-pick-title"><Glyph name="plan" size={18} />Pick a call for {surface}</h1>
      <PickCards />
    </section>
  );
}

function PickCards() {
  const { navigate } = useLab();
  return (
    <div className="lab-calls-grid">
      {CALL_TEMPLATES.map(template => (
        <CallCard key={template.type} template={template}
          onOpen={() => navigate({ call: defaultCall(template.type), path: '', node: null, sel: null, handoff: null, hist: '' })} />
      ))}
    </div>
  );
}
