// The player frame (spec 3.2 "Frame"): the game's own screens running in-page on the lab's engine
// state, inside a phone-sized `.app` with its own overlay root, so sheets and toasts stay inside the
// device. The live screen is the game's LiveView fed by liveScreen (the selector block OpsLive uses),
// with the game's ActionSheet; Confirm hands the move to the lab (rolled or forced per the Director).
// Card, briefing and debrief are the game's CallTile, PrepBriefing and DebriefContents. Outside
// `.app`, an overlay layer draws the lab's marks over the device: numbered tabs on the choice cards,
// a blueprint wash on the hovered one, tape tags beside people when the hidden truth is shown, and the
// band picker after a forced Confirm. The overlay is progressive: a missing hook draws nothing.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import '../../../../ui/app.css';
import '../../../../ui/screens/ops-visual.css';
import { NOW } from '../../../../gen/incident/gates/engine-driver';
import { briefing, builtForScenario, decisionViews, lastResolution, pendingDebrief } from '../../../../sim/operation-selectors';
import { responseFailurePlan } from '../../../../sim/response-failure';
import { getScenario } from '../../../../sim/scenario-registry';
import type { GameState, Id, OutcomeBand, SquadId } from '../../../../sim/types';
import { DepartmentContext } from '../../../../ui/components/department-context';
import { IncidentPeopleStatus } from '../../../../ui/components/IncidentPeople';
import { OverlayRootContext, Sheet } from '../../../../ui/components/Sheet';
import { ToastView } from '../../../../ui/components/ToastView';
import type { ToastItem, ToastTone } from '../../../../ui/components/ToastView';
import { Button, Card } from '../../../../ui/components/ui';
import { lexiconFor } from '../../../../ui/people/lexicon';
import { PeopleProvider } from '../../../../ui/people/PeopleText';
import { CallTile } from '../../../../ui/screens/CallTile';
import { DebriefContents } from '../../../../ui/screens/DebriefContents';
import { cardFor } from '../../../../ui/screens/helpers';
import { buildIntel } from '../../../../ui/screens/intel';
import { liveScreen } from '../../../../ui/screens/live-model';
import type { ActionSelection, Override } from '../../../../ui/screens/live-model';
import { ActionSheet, LiveView, RoomSheet } from '../../../../ui/screens/LiveView';
import { focusActingSquad, toggleActingSquad, toggleSupportingSquad } from '../../../../ui/screens/operation-squads';
import { OperationFeedback } from '../../../../ui/screens/OperationFeedback';
import { PrepBriefing } from '../../../../ui/screens/PrepBriefing';
import { SituationPanel } from '../../../../ui/screens/SituationPanel';
import { SupportContext } from '../../../../ui/screens/SupportContext';
import type { FrameScreen } from '../../types';
import { cx, Glyph } from '../../viz';
import { personTruth } from '../../model/xray';
import { useMedia } from '../../shell/media';

export const DEVICE = { 390: 844, 430: 932 } as const;
/** The game's short-screen rules read the window height, not the frame (spec 3.2). */
const SHORT_WINDOW = '(max-height: 700px)';

/** A toast as the game shows it after a commit, drawn by the game's own ToastView (its ToastProvider
 * needs the store, so the lab keeps the one toast itself). */
export interface FrameToast { id: number; title: string; tone: ToastTone }
/** The band picker after a forced Confirm: each band with its natural chance, or why it can't come out. */
export interface ForcePick { actionId: string; title: string; bands: { band: OutcomeBand; label: string; p: number; disabled: string | null }[] }

interface Rect { x: number; y: number; w: number; h: number }
interface Marks { cards: (Rect & { id: string; visible: boolean })[]; people: (Rect & { id: string })[]; screen: Rect | null; firstVisible: boolean | null }
const NO_MARKS: Marks = { cards: [], people: [], screen: null, firstVisible: null };

export function GameFrame(p: {
  state: GameState; screen: FrameScreen; width: 390 | 430; zoom: 'fit' | '1'; names: boolean; truth: boolean;
  tabs: Map<string, number>; selectedId: string | null; hoverId: string | null; playing: boolean;
  /** Bumped when a choice is picked outside the frame: its card scrolls into view, as a player would scroll to it. */
  reveal: { id: string; seq: number } | null;
  onReview(id: string): void; onConfirm(id: string): void; onFail(): void;
  toast: FrameToast | null; onToastDone(): void; force: ForcePick | null; onForce(band: OutcomeBand | 'roll'): void; onForceCancel(): void;
}) {
  const fitBox = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const device = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [marks, setMarks] = useState<Marks>(NO_MARKS);
  const short = useMedia(SHORT_WINDOW);
  const width = p.width, height = DEVICE[p.width];
  const run = p.state.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  // Fit scales the device to the room the stage gives it; 1:1 lets the stage scroll.
  useLayoutEffect(() => {
    const el = fitBox.current;
    if (!el) return;
    const fit = () => {
      if (p.zoom === '1') { setScale(1); return; }
      const bezel = 18;
      const k = Math.min(1, (el.clientHeight - bezel) / height, (el.clientWidth - bezel) / width);
      setScale(Math.max(0.3, Math.floor(k * 1000) / 1000));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [p.zoom, width, height]);

  // The overlay's marks, measured from the game's own hooks (data-action-id, data-person).
  const truthOf = useMemo(() => new Map((scenario?.incidentPeople ?? []).map(person => [person.id, personTruth(person)])), [scenario]);
  const measure = useCallback(() => {
    const box = slot.current, dev = device.current;
    if (!box || !dev) return;
    const base = box.getBoundingClientRect();
    const rel = (r: DOMRect): Rect => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height });
    const screenEl = dev.querySelector('.screen');
    const sr = screenEl?.getBoundingClientRect();
    const inView = (r: DOMRect) => !sr || (r.bottom > sr.top + 4 && r.top < sr.bottom - 4);
    // A sheet open over the cards hides them: no marks on what the player can't see.
    const sheetOpen = !!dev.querySelector('.overlay-root .sheet');
    const cards = sheetOpen ? [] : [...dev.querySelectorAll<HTMLElement>('.callbtn[data-action-id]')].map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.actionId!, ...rel(r), visible: inView(r) }; });
    const seen = new Set<string>();
    const people = p.truth ? [...dev.querySelectorAll<HTMLElement>('.people-name[data-person]')].flatMap(el => {
      const id = el.dataset.person!, r = el.getBoundingClientRect();
      if (seen.has(id) || !truthOf.has(id) || !inView(r) || r.width === 0) return [];
      seen.add(id);
      return [{ id, ...rel(r) }];
    }) : [];
    // Whether the first choice card shows with the screen scrolled to the top (rects are scaled; scrollTop isn't).
    const first = dev.querySelector('.callbtn');
    let firstVisible: boolean | null = null;
    if (first && screenEl && sr && screenEl.clientHeight > 0) {
      const k = sr.height / screenEl.clientHeight;
      firstVisible = first.getBoundingClientRect().bottom - sr.top + screenEl.scrollTop * k <= sr.height + 0.5;
    }
    const next: Marks = { cards, people, screen: sr ? rel(sr) : null, firstVisible };
    setMarks(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
  }, [p.truth, truthOf]);

  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    const dev = device.current;
    if (!p.reveal || !dev) return;
    const screenEl = dev.querySelector<HTMLElement>('.screen');
    const card = dev.querySelector<HTMLElement>(`.callbtn[data-action-id="${CSS.escape(p.reveal.id)}"]`);
    if (!screenEl || !card) return;
    const sr = screenEl.getBoundingClientRect(), cr = card.getBoundingClientRect();
    const k = sr.height / (screenEl.clientHeight || 1);
    if (cr.top >= sr.top && cr.bottom <= sr.bottom) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    screenEl.scrollTo({ top: screenEl.scrollTop + (cr.top - sr.top) / k - 96, behavior: reduce ? 'auto' : 'smooth' });
  }, [p.reveal?.seq]);
  useEffect(() => {
    const dev = device.current;
    if (!dev) return;
    let raf = 0;
    const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(later);
    observer.observe(dev);
    // The game's own state (a sheet opening, Show all, a disclosure) changes the DOM without a render here.
    const mutations = new MutationObserver(later);
    mutations.observe(dev, { childList: true, subtree: true });
    dev.addEventListener('scroll', later, true);
    window.addEventListener('resize', later);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); mutations.disconnect(); dev.removeEventListener('scroll', later, true); window.removeEventListener('resize', later); };
  }, [measure]);

  const slotWidth = width * scale;
  const gutter = Math.floor(((fitBox.current?.clientWidth ?? slotWidth) - slotWidth) / 2) - 8;
  const tape = placeTape(marks.people.map(person => ({ ...person, text: truthOf.get(person.id) ?? '' })), slotWidth, gutter);

  return (
    <div className="lab-frame-stage">
      <div className={cx('lab-frame-fit', p.zoom === '1' && 'lab-frame-full')} ref={fitBox}>
        <div className="lab-frame-slot" ref={slot} style={{ width: width * scale, height: height * scale }}>
          <div className={cx('lab-frame-device', p.playing && 'lab-frame-playing')} ref={device} style={{ width, height, transform: `translateZ(0) scale(${scale})` }} data-width={width}>
            <GameApp state={p.state} screen={p.screen} names={p.names} onReview={p.onReview} onConfirm={p.onConfirm} onFail={p.onFail}
              toast={p.toast} onToastDone={p.onToastDone} />
          </div>
          <div className="lab-frame-overlay" aria-hidden={!p.force}>
            {marks.cards.filter(card => card.visible && p.tabs.has(card.id)).map(card => (
              <span key={card.id} className={cx('lab-frame-card', card.id === p.hoverId && 'lab-frame-card-hover', card.id === p.selectedId && 'lab-frame-card-on')}
                style={{ left: card.x, top: card.y, width: card.w, height: card.h }}>
                <span className="lab-frame-tab" data-lab-tab={card.id}>{p.tabs.get(card.id)}</span>
              </span>
            ))}
            {tape.leaders.length > 0 && (
              <svg className="lab-frame-leaders" aria-hidden="true">{tape.leaders.map(d => <path key={d} d={d} />)}</svg>
            )}
            {tape.tags.map(tag => (
              <span key={tag.id} className="lab-tag lab-tag-tape lab-frame-tape" style={{ left: tag.left, top: tag.top, maxWidth: tag.maxWidth }} title={`Hidden truth: ${tag.text}`}>{tag.text}</span>
            ))}
            {p.force && <ForcePicker pick={p.force} onPick={p.onForce} onCancel={p.onForceCancel} />}
          </div>
        </div>
      </div>
      <p className="lab-frame-chips">
        <span className="lab-chip">{width} × {height}{p.zoom === 'fit' && scale < 1 ? ` at ${Math.round(scale * 100)}%` : ' at 1:1'}</span>
        {marks.firstVisible !== null && p.screen === 'live' && (
          <span className={marks.firstVisible ? 'lab-chip lab-chip-ok' : 'lab-chip lab-chip-bad'} title="From the first choice card's position with the screen scrolled to the top">
            First choice visible without scrolling <Glyph name={marks.firstVisible ? 'clean' : 'close'} size={12} title={marks.firstVisible ? 'yes' : 'no'} />
          </span>
        )}
        {p.truth && <span className="lab-chip lab-frame-legend"><span className="lab-tag lab-tag-tape">tape</span> the player can't see this</span>}
        {short && <span className="lab-chip lab-chip-warn">Window under 701 px tall: the game's short-screen rules are on</span>}
      </p>
    </div>
  );
}

/** The game's own app for one state: `.app` with the department, the overlay root sheets open into
 * and people colors (`names`), the screen asked for, and the toast after a commit. Play draws it in
 * the phone frame; the true-device page (`?frame=player`) draws it full window. */
export function GameApp(p: {
  state: GameState; screen: FrameScreen; names: boolean;
  onReview(id: string): void; onConfirm(id: string): void; onFail(): void;
  toast: FrameToast | null; onToastDone(): void;
}) {
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const run = p.state.activeRun;
  const scenario = run ? getScenario(run.scenarioId) : null;
  const officers = useMemo(() => {
    if (!run) return [];
    return p.state.squads.filter(squad => run.squadIds.includes(squad.id)).flatMap(squad => squad.officerIds.flatMap(id => p.state.officers[id] ? [{ ...p.state.officers[id], squad: squad.id }] : []));
  }, [p.state, run]);
  const lexicon = useMemo(() => (p.names && scenario ? lexiconFor(scenario, run ?? null, officers) : null), [p.names, scenario, run, officers]);
  // The game's ToastView times itself from its item and callback, so both stay the same object
  // until the toast changes.
  const toastItem = useMemo<ToastItem | null>(() => (p.toast ? { ...p.toast, lines: [] } : null), [p.toast]);
  const toastDone = useRef(p.onToastDone);
  toastDone.current = p.onToastDone;
  const onToastDone = useCallback(() => toastDone.current(), []);

  let body: ReactNode;
  if (!run || !scenario) body = <div className="page"><p className="dim">No call is running in this state.</p></div>;
  else if (p.screen === 'card') body = <CardScreen state={p.state} />;
  else if (p.screen === 'brief') body = <BriefScreen state={p.state} />;
  else if (p.screen === 'debrief') body = <DebriefScreen state={p.state} />;
  else if (run.status !== 'active' || run.stage === 'debrief') body = <div className="page"><p className="dim">The call has ended. Rewind a step to see the live screen.</p></div>;
  // The live screen stays mounted across steps, as the game's does: the map updates in place.
  else body = <LiveScreen state={p.state} onReview={p.onReview} onConfirm={p.onConfirm} onFail={p.onFail} />;

  return (
    <div className="app">
      <DepartmentContext.Provider value={p.state.department}>
        <OverlayRootContext.Provider value={overlay}>
          <PeopleProvider lexicon={lexicon}>
            <main className="screen screen-ops" key={p.screen}>{body}</main>
          </PeopleProvider>
        </OverlayRootContext.Provider>
      </DepartmentContext.Provider>
      <div className="toasts" role="status" aria-live="polite">
        {toastItem && <ToastView key={toastItem.id} item={toastItem} onDone={onToastDone} />}
      </div>
      <div className="overlay-root" ref={setOverlay} />
    </div>
  );
}

/** Tape tags for the hidden truth about each person in view. With room beside the device they sit
 * in the gutter at the name's height, tied to it by a dashed leader, so they cover none of the game's
 * text; without room they sit just after the name. Lifted clear of each other (about 6.3 px a character). */
function placeTape(people: (Rect & { id: string; text: string })[], slotWidth: number, gutter: number):
  { tags: { id: string; text: string; left: number; top: number; maxWidth?: number }[]; leaders: string[] } {
  const H = 17;
  const tags: { id: string; text: string; left: number; top: number; maxWidth?: number; w: number }[] = [];
  const leaders: string[] = [];
  const inGutter = gutter >= 64;
  for (const person of [...people].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = Math.min(inGutter ? gutter : 220, 12 + person.text.length * 6.3);
    let left = inGutter ? slotWidth + 12 : person.x + person.w + 3;
    let top = inGutter ? person.y + person.h / 2 - H / 2 : person.y - 10;
    const clash = () => tags.some(tag => left < tag.left + tag.w && tag.left < left + w && top < tag.top + H && tag.top < top + H);
    for (let tries = 0; tries < 6 && clash(); tries++) top += inGutter ? H + 2 : -(H + 2);
    tags.push({ id: person.id, text: person.text, left, top, w, ...(inGutter ? { maxWidth: gutter } : {}) });
    if (inGutter) {
      // A dashed tape line under the name, and a leader from the device's edge at that line to the tag:
      // nothing crosses the game's text.
      const under = person.y + person.h + 1;
      leaders.push(`M${person.x.toFixed(1)},${under.toFixed(1)} H${(person.x + person.w).toFixed(1)}`);
      const x1 = slotWidth - 2, y1 = person.y + person.h / 2, x2 = slotWidth + 10, y2 = top + H / 2;
      leaders.push(`M${x1.toFixed(1)},${y1.toFixed(1)} C${x1 + 6},${y1.toFixed(1)} ${x2 - 6},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`);
    }
  }
  return { tags: tags.map(({ w: _w, ...tag }) => tag), leaders };
}

const BAND_KEY: Record<OutcomeBand, string> = { favorable: 'W', mixed: 'C', adverse: 'B' };

/** After a Confirm with dice "Force": which band the lab applies. */
function ForcePicker({ pick, onPick, onCancel }: { pick: ForcePick; onPick(band: OutcomeBand | 'roll'): void; onCancel(): void }) {
  return (
    <div className="lab-force" role="dialog" aria-label={`Force the result of ${pick.title}`}>
      <p className="lab-force-title">Force the result <span className="lab-force-choice">{pick.title}</span></p>
      <div className="lab-force-bands">
        {pick.bands.map(entry => (
          <button key={entry.band} type="button" className={cx('lab-force-band', `lab-force-${entry.band}`)} disabled={!!entry.disabled} title={entry.disabled ?? `${entry.label}: natural chance ${Math.round(entry.p * 100)}% (engine, now)`}
            onClick={() => onPick(entry.band)}>
            <span className="lab-force-label">{entry.label}</span>
            <span className="lab-force-p">{Math.round(entry.p * 100)}%</span>
            <kbd className="lab-kbd">{BAND_KEY[entry.band]}</kbd>
          </button>
        ))}
        <button type="button" className="lab-force-band lab-force-roll" onClick={() => onPick('roll')} title="Use the run's own dice">
          <span className="lab-force-label"><Glyph name="drawn" size={13} />Roll</span><kbd className="lab-kbd">R</kbd>
        </button>
      </div>
      <button type="button" className="lab-button lab-button-quiet lab-force-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}

// ---------------------------------------------------------------- the game's screens

/** OpsLive's wiring with the lab's moves in place of the store: one selector block (liveScreen),
 * the game's LiveView, its review sheet and room sheet, its result record and situation panel. */
function LiveScreen({ state, onReview, onConfirm,  onFail }: { state: GameState; onReview(id: string): void; onConfirm(id: string): void; onFail(): void }) {
  const run = state.activeRun!;
  const [focusId, setFocusId] = useState<SquadId | null>(() => run.history.at(-1)?.actingSquadIds[0] ?? null);
  const [selection, setSelection] = useState<ActionSelection | null>(null);
  const [activeOfficer, setActiveOfficer] = useState<Id | null>(null);
  const [selSpace, setSelSpace] = useState<Id | null>(null);
  const [panel, setPanel] = useState<'none' | 'action' | 'room' | 'support' | 'failure'>('none');
  const [showRooms, setShowRooms] = useState(false);
  const [override, setOverride] = useState<Override | null>(null);
  const [floor, setFloor] = useState(0);
  // The map shows what the last decision changed, as the game does after a commit.
  const lastChange = useMemo(() => {
    const r = lastResolution(state);
    if (!r) return null;
    return { revision: r.revision, spaceIds: [r.targetId, ...r.knowledgeChanges.map(k => k.factId)].filter((x): x is Id => !!x) };
  }, [state]);

  // A new frame (a step, a rewind) starts with nothing under review, as after a commit in the game.
  const shownState = useRef(state);
  if (shownState.current !== state) {
    shownState.current = state;
    if (selection || override || panel !== 'none') { setSelection(null); setOverride(null); setActiveOfficer(null); setPanel('none'); }
  }
  const screen = liveScreen(state, NOW, { focusId, selection, override, floor, activeOfficer, selectedSpaceId: selSpace, lastChange, showRooms, detailsOpen: panel === 'action' });
  const targetFloor = screen?.review.targetFloor ?? null;
  useEffect(() => { if (targetFloor !== null) setFloor(targetFloor); }, [screen?.review.view?.id, targetFloor]);
  if (!screen) return <div className="page"><p className="dim">Operation location unavailable.</p></div>;
  const { model, review } = screen;
  const { deployed, focus, view, acting, support, actionRule, maxActing, resupply, alternatives, scenario, spaceById, targetLabel, availableMembers, actorUnavailable, floorOf } = review;
  const decisions = decisionViews(state);
  const failurePlan = responseFailurePlan(state);

  const pickAction = (id: Id) => {
    if (view?.id === id || !model.actions.some(action => action.id === id) || run.stage === 'debrief') return;
    setSelection({ runId: run.id, stage: run.stage, actionId: id });
    setOverride({ actionId: id, acting: focus ? [focus.id] : [], support: [] });
    setActiveOfficer(null);
    onReview(id);
  };
  const selectAction = (id: Id) => {
    if (view?.id === id) { setPanel(panel === 'action' ? 'none' : 'action'); return; }
    pickAction(id);
    setPanel('action');
  };
  const confirm = () => {
    if (!view?.eligible || panel !== 'action') return;
    setPanel('none');
    onConfirm(view.id);
  };

  return (
    <LiveView
      {...model}
      onFocusSquad={id => { if (view && actorUnavailable(id)) return; setFocusId(id); setActiveOfficer(null); if (view) setOverride({ actionId: view.id, ...focusActingSquad({ acting, support }, id) }); }}
      onSelectAction={selectAction}

      onSelectOfficer={setActiveOfficer}
      onSelectSpace={id => { setSelSpace(id); setPanel('room'); const f = floorOf(id); if (f !== null) setFloor(f); }}
      onFloorChange={setFloor}
      onToggleRooms={() => setShowRooms(value => !value)}
      onCancel={() => {}}
      onOpenDetails={() => setPanel(panel === 'action' ? 'none' : 'action')}
      feedback={<OperationFeedback officers={state.officers} decisions={decisions} explicitCompletion={(scenario?.version ?? 0) >= 4} onOpenLog={() => setPanel('none')} />}
      situation={scenario && <SituationPanel scenario={scenario} run={run} />}
      supportContext={scenario && <><IncidentPeopleStatus scenario={scenario} run={run} state={state} />
        <SupportContext scenario={scenario} run={run} actions={model.actions} open={panel === 'support'} onOpen={() => setPanel('support')} onClose={() => setPanel('none')}
          onPickAction={id => { pickAction(id); setPanel('action'); }} /></>}
      failedResponse={failurePlan && <section className="call operation-failed-response" aria-label="Failed response">
        <h3>{failurePlan.title}</h3>
        <p>{failurePlan.reason}</p>
        <p className="dim">Review the people and duties still unresolved before ending this response.</p>
        <Button variant="danger" block onClick={() => setPanel('failure')}>Review failed response</Button>
      </section>}
    >
      <ActionSheet
        open={panel === 'action'}
        onClose={() => setPanel('none')}
        view={view}
        all={model.actions}
        onPick={pickAction}
        squads={deployed}
        acting={acting}
        support={support}
        onToggleActing={id => { if (!view || (!acting.includes(id) && actorUnavailable(id))) return; const next = toggleActingSquad({ acting, support }, id, maxActing); setOverride({ actionId: view.id, ...next }); setFocusId(next.acting.includes(id) ? id : next.acting[0]); }}
        onToggleSupport={id => { if (!view?.support || (!support.includes(id) && availableMembers(id).length === 0)) return; setOverride({ actionId: view.id, ...toggleSupportingSquad({ acting, support }, id, view.support.maxSquads) }); }}
        maxActing={maxActing}
        squadPositions={Object.fromEntries(run.squadTasks.map(task => [task.squadId, spaceById.get(task.positionId)?.label ?? task.positionId]))}
        unavailableActors={deployed.filter(squad => actorUnavailable(squad.id)).map(squad => squad.id)}
        unavailableSupport={deployed.filter(squad => availableMembers(squad.id).length === 0).map(squad => squad.id)}
        participantNames={view?.officerIds.map(id => state.officers[id]).filter(officer => !!officer).map(officer => `${officer.firstName} ${officer.surname}`) ?? []}
        supportTask={actionRule?.support ? `${actionRule.support.label} at ${spaceById.get(actionRule.support.coverSpaceId)?.label ?? actionRule.support.coverSpaceId}` : null}
        targetLabel={targetLabel}
        onConfirm={confirm}
        resupply={resupply}
        resupplyMinutes={(run.resupplies ?? []).reduce((sum, delivery) => sum + delivery.minutes, 0)}
        alternatives={alternatives}
        onUseAlternative={candidate => { setFocusId(candidate.actingSquadIds[0] ?? null); setOverride({ actionId: candidate.id, acting: candidate.actingSquadIds, support: candidate.supportSquadIds }); }}
      />
      <RoomSheet open={panel === 'room'} onClose={() => setPanel('none')} space={selSpace ? (spaceById.get(selSpace) ?? null) : null} built={model.built} squads={deployed} actions={model.actions}
        onPickAction={id => { pickAction(id); setPanel('action'); }} />
      <Sheet open={panel === 'failure' && !!failurePlan} onClose={() => setPanel('none')} title={failurePlan?.title ?? 'Failed response'}
        footer={<div className="row-actions"><Button onClick={() => setPanel('none')}>Keep reviewing</Button><Button variant="danger" onClick={() => { setPanel('none'); onFail(); }}>Confirm failed response</Button></div>}>
        {failurePlan && <><p>{failurePlan.reason}</p><h3>Still unresolved</h3><ul className="bullets">{failurePlan.remainingTasks.map(task => <li key={task}>{task}</li>)}</ul><p>{failurePlan.consequence}</p></>}
      </Sheet>
    </LiveView>
  );
}

/** The board card (OpsBoard's tile), as the call arrives. */
function CardScreen({ state }: { state: GameState }) {
  const run = state.activeRun!;
  const scenario = getScenario(run.scenarioId);
  const card = cardFor(state, run.scenarioId, NOW);
  if (!card || !scenario) return <div className="page"><p className="dim">No board card for this call.</p></div>;
  return (
    <div className="page">
      <CallTile card={card} scenario={scenario} familyId={scenario.locationFamilyId} type={scenario.incident?.type ?? null} tier={scenario.incident?.tier ?? null}
        footer={<Button variant="primary" className="optile-go">Prepare</Button>} />
    </div>
  );
}

/** The prepare screen's briefing: only what the player is told at dispatch. */
function BriefScreen({ state }: { state: GameState }) {
  const run = state.activeRun!;
  const scenario = getScenario(run.scenarioId);
  const built = useMemo(() => builtForScenario(run.scenarioId), [run.scenarioId]);
  const intel = useMemo(() => buildIntel(scenario ?? null, built), [scenario, built]);
  const brief = useMemo(() => briefing(run.scenarioId, state, run.squadIds), [run.scenarioId, state, run.squadIds]);
  return <div className="page"><PrepBriefing scenario={scenario} built={built} brief={brief} intel={intel} /></div>;
}

/** The debrief, with "What was really there" as the game shows it. */
function DebriefScreen({ state }: { state: GameState }) {
  const d = pendingDebrief(state);
  if (!d) return <div className="page"><Card><h2 className="section-title">Debrief</h2><p className="dim">The call is still running. The debrief opens when it ends.</p></Card></div>;
  const scenario = getScenario(d.scenarioId);
  return (
    <div className="debrief-layout">
      <div className="page debrief">
        <DebriefContents result={d} officers={state.officers} decisions={d.decisions ?? decisionViews(state)} scenario={scenario ?? undefined} />
      </div>
      <div className="debrief-footer"><Button variant="primary" block>Close debrief</Button></div>
    </div>
  );
}
