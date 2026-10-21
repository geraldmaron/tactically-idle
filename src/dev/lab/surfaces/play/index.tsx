// Play, the lab's hub (spec 3.2): the real game in a phone frame, the Director on the left that sets
// up the call, the path rail above the frame, and the X-ray rail on the right that annotates what the
// player sees with what they can't. This file wires them: the shown frame (with the one orchestrated
// motion when a path arrives from "Play here"), the selected choice (URL `sel`), moves (rolled or
// forced, through the shell's step), the toast the game shows after a commit, "Where this leads"
// runs, and the keys. Every number and route comes from the model files (model/xray, next-step,
// dilemma) over the engine.
import { isLapse } from '../../../../sim/types';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { sampleFor } from '../../../../gen/incident/gates/engine-driver';
import { choiceActionId } from '../../../../gen/incident/trees-v13/compile';
import type { Weight } from '../../../../gen/incident/trees-v13/balance';
import type { OutcomeBand } from '../../../../sim/types';
import { useLab } from '../../context';
import { RUN_DEFAULTS } from '../../jobs/budgets';
import { isJobCancelled } from '../../jobs/pool';
import type { JobHandle } from '../../jobs/pool';
import type { LabMove } from '../../model/call';
import { dilemma } from '../../model/dilemma';
import { aimsDrawn, compareSituations, previewBand, previewDrawn } from '../../model/next-step';
import type { SituationRun } from '../../model/next-step';
import { currentFrame, moveToken, nodeAt } from '../../model/session';
import type { Frame, Session } from '../../model/session';
import { squadLine } from '../../model/squads';
import { pathChance, pathSteps, priorSteps, weightsWanted, withWeights, xrayChoices } from '../../model/xray';
import { onDirector } from '../../shell/director';
import { chordKey, isTyping } from '../../shell/keys';
import { REDUCED_MOTION, useMedia, useNarrow } from '../../shell/media';
import { BAND_WORDS, cx, Glyph, modalOpen, Skeleton } from '../../viz';
import { Director } from './Director';
import type { DirectorFocus } from './Director';
import type { Leads } from './FullNote';
import { DEVICE, GameFrame } from './GameFrame';
import type { ForcePick, FrameToast } from './GameFrame';
import { LeaderLine } from './LeaderLine';
import { PathRail } from './PathRail';
import { XrayRail } from './XrayRail';
import './play.css';

const RESULT: Record<OutcomeBand, { title: string; tone: FrameToast['tone'] }> = {
  favorable: { title: 'Went well', tone: 'ok' }, mixed: { title: 'Had complications', tone: 'amber' }, adverse: { title: 'Went badly', tone: 'error' },
};
/** The orchestrated motion (spec 4.6): 120 ms a step, the whole replay at most 1.2 s. */
const STEP_MS = 120, PLAY_CAP_MS = 1200;

let directorOpen = false;
const tokensTo = (s: Session, index: number) => s.frames.slice(1, index + 1).map(frame => moveToken(frame.move!)).join(',');
function commonPrefix(a: readonly Frame[], b: readonly Frame[]): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return Math.max(0, n - 1);
}
/** "Squad A (719)" → "squad A (719)" for a pill that reads as one phrase. */
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

export default function PlaySurface() {
  const { url, call } = useLab();
  if (!url.call) return null;
  if (call.status === 'ready') return <Play session={call.session} />;
  return (
    <div className="lab-play lab-play-loading">
      <aside className="lab-play-director">{call.status === 'loading' && <div className="lab-dir"><Skeleton lines={8} /></div>}</aside>
      <div className="lab-play-stage">
        <div className="lab-frame-stage">
          <div className="lab-frame-ghost" style={{ width: 390 * 0.72, height: DEVICE[390] * 0.72 }}>
            {call.status === 'loading' ? <><Skeleton lines={3} /><p className="lab-muted">Building the call…</p></>
              : <p className="lab-muted">The frame opens when the call does. The notice above says why it can't.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Play({ session }: { session: Session }) {
  const { url, navigate, step, rewind, playHere, deps, jobs, notify, tuning } = useLab();
  const narrow = useNarrow();
  const reduced = useMedia(REDUCED_MOTION);
  const root = useRef<HTMLDivElement>(null);
  // The Director drawer (900 px) stays open across draw changes, which remount the surface.
  const [dirOpen, setDirOpenState] = useState(() => directorOpen);
  const setDirOpen = (next: boolean | ((open: boolean) => boolean)) => setDirOpenState(open => { directorOpen = typeof next === 'function' ? next(open) : next; return directorOpen; });
  // A call strip chip opens its Director section here (spec 3.0).
  const [dirFocus, setDirFocus] = useState<DirectorFocus | null>(null);
  useEffect(() => onDirector(section => { setDirOpen(true); setDirFocus({ section, seq: Date.now() }); }), []);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [toast, setToast] = useState<FrameToast | null>(null);
  const [force, setForce] = useState<ForcePick | null>(null);
  const [compare, setCompare] = useState<SituationRun[] | 'running' | null>(null);
  const [leads, setLeads] = useState<Record<string, Leads>>({});
  const [play, setPlay] = useState<{ at: number; to: number } | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [reveal, setReveal] = useState<{ id: string; seq: number } | null>(null);
  const leadHandles = useRef(new Map<string, JobHandle>());
  const railRef = useRef<HTMLElement>(null);

  // ------------------------------------------------ arrivals and steps
  const prev = useRef<Session | null>(null);
  useLayoutEffect(() => {
    const before = prev.current;
    prev.current = session;
    const frames = session.frames;
    const last = frames.length - 1;
    const sameCall = !!before && before.key === session.key;
    if (sameCall && before.frames === frames) return;
    setForce(null);
    if (sameCall && frames.length === before.frames.length + 1 && commonPrefix(before.frames, frames) === before.frames.length - 1) {
      // One step: the new chip slides in and the game's toast names the result.
      setFresh(last);
      const entry = frames[last].state.activeRun?.history.at(-1);
      const h = entry && !isLapse(entry) ? entry : undefined;
      const band = frames[last].band;
      if (band) setToast({ id: Date.now(), title: h?.committed?.resultLabel ?? RESULT[band].title, tone: h?.committed?.resultLabel ? 'info' : RESULT[band].tone });
      return;
    }
    setFresh(null);
    // A path that arrived from elsewhere (Play here, the palette, Back): replay it, unless it was
    // already shown or the window asks for no motion.
    const from = sameCall ? commonPrefix(before.frames, frames) : before ? last : url.sel ? 0 : last;
    if (last > from) {
      if (reduced) { setFlash(true); window.setTimeout(() => setFlash(false), 900); }
      else setPlay({ at: from, to: last });
    }
  }, [session]);

  useEffect(() => {
    if (!play) return;
    if (play.at >= play.to) { setPlay(null); return; }
    const steps = Math.max(1, play.to);
    const timer = window.setTimeout(() => setPlay(p => p && { ...p, at: p.at + 1 }), Math.min(STEP_MS, PLAY_CAP_MS / steps));
    return () => window.clearTimeout(timer);
  }, [play]);

  const shown = play ? play.at : session.frames.length - 1;
  const frame = session.frames[Math.min(shown, session.frames.length - 1)];
  const frameKey = `${session.key}|${tokensTo(session, shown)}`;

  // After a step or a rewind, bring "This moment" back into view in the rail.
  useEffect(() => {
    const rail = railRef.current, moment = rail?.querySelector<HTMLElement>('.lab-moment');
    if (!rail || !moment || play) return;
    const top = moment.offsetTop - 2;
    if (rail.scrollTop > top) rail.scrollTo({ top });
  }, [frameKey, play]);

  // ------------------------------------------------ what the engine knows at this frame
  const baseRows = useMemo(() => xrayChoices(session, frame, deps), [session, frame, deps]);
  const aiming = useMemo(() => aimsDrawn(), []);
  // Run classes of the endings each band reaches: one forced step each, a choice per idle slice (spec 9.6).
  const [weights, setWeights] = useState<{ key: string; map: Map<string, Weight> }>({ key: '', map: new Map() });
  useEffect(() => {
    const wanted = weightsWanted(baseRows, aiming);
    if (!wanted.length || play) return;
    let cancelled = false, at = 0;
    const map = new Map<string, Weight>();
    const idle = (fn: () => void) => { if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn, { timeout: 400 }); else globalThis.setTimeout(fn, 30); };
    const slice = () => {
      if (cancelled) return;
      const id = wanted[at]?.actionId;
      while (at < wanted.length && wanted[at].actionId === id) {
        const want = wanted[at++];
        const preview = want.drawn ? previewDrawn(session, frame, want.actionId, want.band, want.drawn) : previewBand(session, frame, want.actionId, want.band);
        if (preview?.weight) map.set(want.key, preview.weight);
      }
      setWeights({ key: frameKey, map: new Map(map) });
      if (at < wanted.length) idle(slice);
    };
    idle(slice);
    return () => { cancelled = true; };
  }, [baseRows, play]);
  const rows = useMemo(() => withWeights(baseRows, weights.key === frameKey ? weights.map : new Map()), [baseRows, weights, frameKey]);
  const dRows = useMemo(() => (frame.state.activeRun ? dilemma(rows, deps, frame.state.activeRun) : []), [rows, deps, frame]);
  const steps = useMemo(() => pathSteps(session), [session]);
  const prior = useMemo(() => priorSteps(session), [session]);
  const chance = useMemo(() => { try { return pathChance({ ...session, frames: session.frames.slice(0, shown + 1) }); } catch { return null; } }, [session, shown]);
  const line = useMemo(() => squadLine(session.frames[0].state, session.squad), [session]);
  const who = lower(line.label);
  const tabs = useMemo(() => new Map(rows.map((row, i) => [row.actionId, i + 1])), [rows]);

  const node = nodeAt(frame.state, session.tree);
  const sel = url.sel;
  const selectedFromUrl = sel && (sel.kind === 'choice' || sel.kind === 'band') && sel.node === node ? choiceActionId(session.tree.type, sel.node, sel.choice) : null;
  const selectedId = rows.some(row => row.actionId === selectedFromUrl) ? selectedFromUrl : rows[0]?.actionId ?? null;

  // A selection made elsewhere (the palette, another surface) that this path doesn't reach: play to it.
  const handled = useRef<string | null>(null);
  const selText = sel ? JSON.stringify(sel) : '';
  useEffect(() => {
    const first = handled.current === null;
    if (handled.current === selText) return;
    handled.current = selText;
    if (!sel || play) return;
    const at = currentFrame(session);
    if (sel.kind === 'ending' && at.state.activeRun?.endingId !== sel.ending) playHere({ ending: sel.ending });
    else if (!first && (sel.kind === 'choice' || sel.kind === 'band') && nodeAt(at.state, session.tree) !== sel.node) playHere({ offered: choiceActionId(session.tree.type, sel.node, sel.choice) });
  }, [selText]);

  // ------------------------------------------------ moves
  const move = useCallback((m: LabMove) => {
    setForce(null);
    setPlay(null);
    step(m);
    if (url.sel) navigate({ sel: null }, 'replace');
  }, [url.sel]);
  const roll = (id: string) => move({ kind: 'roll', actionId: id });
  const forceBand = (id: string, band: OutcomeBand) => move({ kind: 'decide', actionId: id, band });
  const forceDrawn = (id: string, band: OutcomeBand, drawn: string[]) => move({ kind: 'decide', actionId: id, band, drawn } as LabMove);
  const confirm = (id: string) => {
    if (url.dice === 'roll') { roll(id); return; }
    const view = frame.views.find(entry => entry.id === id);
    if (!view) return;
    setForce({ actionId: id, title: view.title, bands: (['favorable', 'mixed', 'adverse'] as const).map(band => ({
      band, label: BAND_WORDS[band], p: view.likelihood[band], disabled: sampleFor(view, band) === null ? `Can't come out ${BAND_WORDS[band].toLowerCase()} at this margin` : null,
    })) });
  };
  const go = (index: number) => {
    if (index < 0 || index > session.frames.length - 1 + session.ahead.length) return;
    setPlay(null);
    rewind(index);
    if (url.sel && url.sel.kind !== 'choice') navigate({ sel: null }, 'replace');
  };
  const select = (id: string, fromFrame = false) => {
    const x = rows.find(row => row.actionId === id);
    if (!x) return;
    navigate({ sel: { kind: 'choice', node: x.node, choice: x.choice } });
    if (!fromFrame) setReveal(r => ({ id, seq: (r?.seq ?? 0) + 1 }));
  };

  // ------------------------------------------------ where this leads
  useEffect(() => () => { for (const handle of leadHandles.current.values()) handle.cancel(); }, []);
  const runLeads = (id: string) => {
    const key = `${frameKey}|${id}`;
    leadHandles.current.get(key)?.cancel();
    const total = RUN_DEFAULTS.fromHere;
    const set = (value: Leads) => setLeads(map => ({ ...map, [key]: value }));
    set({ status: 'running', done: 0, total, tally: null });
    const handle = jobs.run({ kind: 'reach-call', start: { kind: 'state', state: frame.state }, firstChoice: id, style: url.style, runs: [0, total] },
      { patch: tuning.patch, contentKey: session.contentKey, onProgress: (done, all, partial) => setLeads(map => ({ ...map, [key]: { status: 'running', done, total: all, tally: partial ?? map[key]?.tally ?? null } })) });
    leadHandles.current.set(key, handle);
    handle.promise.then(result => { if (result.kind === 'reach') set({ status: 'done', done: total, total, tally: result.tally }); },
      error => { if (!isJobCancelled(error)) set({ status: 'error', done: 0, total, tally: null, message: `Runs from here failed: ${error instanceof Error ? error.message : String(error)}` }); });
  };
  const frameLeads = useMemo(() => Object.fromEntries(Object.entries(leads).filter(([key]) => key.startsWith(`${frameKey}|`)).map(([key, value]) => [key.slice(frameKey.length + 1), value])), [leads, frameKey]);

  // ------------------------------------------------ compare situations
  useEffect(() => { setCompare(null); }, [session.key, session.frames.length]);
  const runCompare = () => {
    setCompare('running');
    window.setTimeout(() => {
      try { setCompare(compareSituations(session, url)); } catch (error) { setCompare(null); notify(`Comparing situations failed: ${error instanceof Error ? error.message : String(error)}`); }
    }, 16);
  };

  // ------------------------------------------------ keys (spec 3.2)
  const keys = useRef<(event: KeyboardEvent) => void>(() => {});
  keys.current = (event: KeyboardEvent) => {
    const k = event.key;
    const target = event.target as HTMLElement | null;
    const onControl = !!target?.closest?.('button, a, summary, [role="radio"], [role="tab"]');
    if (/^[1-9]$/.test(k)) { const row = rows[Number(k) - 1]; if (row) { event.preventDefault(); select(row.actionId); } return; }
    const lowerKey = k.toLowerCase();
    if (force && (lowerKey === 'w' || lowerKey === 'c' || lowerKey === 'b')) {
      const band = lowerKey === 'w' ? 'favorable' : lowerKey === 'c' ? 'mixed' : 'adverse';
      if (!force.bands.find(entry => entry.band === band)?.disabled) { event.preventDefault(); forceBand(force.actionId, band); }
      return;
    }
    const selected = rows.find(row => row.actionId === selectedId);
    if (lowerKey === 'w' || lowerKey === 'c' || lowerKey === 'b') {
      const band = lowerKey === 'w' ? 'favorable' : lowerKey === 'c' ? 'mixed' : 'adverse';
      if (selected?.bands[band].possible) { event.preventDefault(); forceBand(selected.actionId, band); }
      return;
    }
    if (lowerKey === 'r' || (k === 'Enter' && !onControl)) { if (force) { event.preventDefault(); roll(force.actionId); } else if (selected?.view.eligible) { event.preventDefault(); roll(selected.actionId); } return; }
    if (k === '[') { event.preventDefault(); go(shown - 1); return; }
    if (k === ']') { event.preventDefault(); go(shown + 1); return; }
    if (k === 'Backspace') { event.preventDefault(); go(shown - 1); return; }
    if (lowerKey === 'x') { event.preventDefault(); navigate({ xray: !url.xray }, 'replace'); return; }
    if (lowerKey === 't') { event.preventDefault(); navigate({ truth: !url.truth }, 'replace'); return; }
    if (lowerKey === 'p') { event.preventDefault(); navigate({ names: !url.names }, 'replace'); return; }
    if (lowerKey === 'f' || lowerKey === 'd' || lowerKey === 's') {
      event.preventDefault();
      const tab = lowerKey === 'f' ? 'flow' : lowerKey === 'd' ? 'deps' : 'script';
      navigate({ tab, ...(selected ? { sel: { kind: 'choice', node: selected.node, choice: selected.choice } } : {}) });
    }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target) || modalOpen()) return;
      // G then a letter belongs to the shell's surface switch.
      if (chordKey(event)) return;
      keys.current(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ------------------------------------------------ layout
  const run = frame.state.activeRun;
  const ended = !!run && (run.status !== 'active' || run.stage === 'debrief');
  const screen = url.screen ?? (ended ? 'debrief' : 'live');
  const directorButton = narrow ? (
    <button type="button" className={cx('lab-button', 'lab-play-dirbutton', dirOpen && 'lab-play-dirbutton-on')} aria-expanded={dirOpen} onClick={() => setDirOpen(open => !open)}>
      <Glyph name="plan" />Director
    </button>
  ) : undefined;

  return (
    <div ref={root} className={cx('lab-play', !url.xray && 'lab-play-noxray', narrow && 'lab-play-narrow')} data-playing={play ? 'true' : undefined}>
      <aside className={cx('lab-play-director', narrow && dirOpen && 'lab-play-director-open')} aria-label="Director" hidden={narrow && !dirOpen}>
        {narrow && <div className="lab-play-dirtop"><span>Director</span><button type="button" className="lab-icon-button" aria-label="Close the Director" onClick={() => setDirOpen(false)}><Glyph name="close" /></button></div>}
        <Director session={session} focus={dirFocus} />
      </aside>
      <div className="lab-play-stage">
        {session.note && (
          <div className="lab-play-note" role="status">
            <Glyph name="info" />
            <p>{session.note}</p>
            <button type="button" className="lab-button lab-button-quiet" onClick={() => navigate({ handoff: null, hist: '' })}>Use reference squad as is</button>
          </div>
        )}
        <PathRail steps={steps} prior={prior} shown={shown} revealed={play ? play.at : Infinity} fresh={fresh} flash={flash} chance={chance} who={who}
          onGo={go} compare={compare} onCompare={runCompare} canCompare={session.squad.kind !== 'game'} directorButton={directorButton}
          onOpenSituation={situationRun => situationRun.call !== null && url.call && navigate({ call: { ...url.call, call: situationRun.call, id: null } })} />
        <GameFrame state={frame.state} screen={screen} width={url.width} zoom={url.zoom} names={url.names} truth={url.truth}
          tabs={tabs} selectedId={url.xray ? selectedId : null} hoverId={hoverId} playing={!!play} reveal={reveal}
          onReview={id => select(id, true)} onConfirm={confirm} onFail={() => move({ kind: 'fail', actionId: 'response_failure' })}
          toast={toast} onToastDone={() => setToast(null)} force={force} onForce={band => force && (band === 'roll' ? roll(force.actionId) : forceBand(force.actionId, band))} onForceCancel={() => setForce(null)}
          onLapse={threatId => move({ kind: 'lapse', actionId: threatId })} />
      </div>
      {url.xray && (
        <aside className="lab-play-rail" aria-label="X-ray" ref={railRef}>
          <XrayRail narrow={narrow} session={session} frame={frame} rows={rows} dilemma={dRows} deps={deps} selectedId={selectedId} who={who} aiming={aiming}
            onSelect={select} onHover={setHoverId} onForce={forceBand} onForceDrawn={forceDrawn} onRoll={roll} leads={frameLeads} onLeads={runLeads}
            onNote={() => navigate({ notes: true, ...(selectedId ? { sel: { kind: 'choice', node: rows.find(r => r.actionId === selectedId)!.node, choice: rows.find(r => r.actionId === selectedId)!.choice } } : {}) }, 'replace')} />
        </aside>
      )}
      {url.xray && !(narrow && dirOpen) && <LeaderLine root={root} selectedId={selectedId} watch={`${frameKey}|${selectedId}|${screen}|${url.width}|${url.zoom}`} reduced={reduced} />}
    </div>
  );
}
