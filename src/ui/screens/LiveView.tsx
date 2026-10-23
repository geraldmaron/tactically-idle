import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FactStatusChip } from '../components/FactStatusChip';
import type { ReactNode } from 'react';
import type {
  ActionView,
  BuiltLocation,
  CertId,
  FactView,
  GameState,
  Id,
  Officer,
  OutcomeBand,
  RatingKey,
  SpaceView,
  Squad,
  SquadId,
  SquadTask,
  StageId,
} from '../../sim/types';
import type { StageProgress } from '../../sim/operation-selectors';
import type { EnvironmentDefinition } from '../../sim/scenario-types';
import type { ActionResupplyPlan } from '../../sim/equipment-resupply';
import { Blueprint } from '../blueprint/Blueprint';
import { PlateArt } from '../art/Plates';
import { RoomList } from '../blueprint/RoomList';
import { floorCount } from '../blueprint/floors';
import { OfficerCard } from '../components/OfficerCard';
import { Sheet } from '../components/Sheet';
import { containSheetFocus } from '../components/sheet-focus';
import { Button, Chip, SubHead } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { armamentLabel } from '../components/incident';
import { RATING_META, ROLE_META, ROOM_TYPE_LABEL, STAGE_LABEL, TRAIT_INFO } from '../components/labels';
import { highRiskAllowed, stressBand } from '../../sim/officer';
import { STRESS_LABEL, whole } from '../components/StressDisplay';
import { CERT_NAME } from '../../content/certs';
import { incidentOfficerUnavailable } from '../../sim/incident-consequences';
import { describeConstruction } from '../../sim/spatial';
import { Face } from '../components/Face';
import { Icon, actionIcon, materialIcon, roomIcon } from '../icons';
import type { IconName } from '../icons';
import { feetInches, opMinutes, signed, sqft } from '../format';
import { CONSEQUENCE_LABEL, OutcomeForecast } from './OperationFeedback';
import { joinNames, squadName } from './operation-squads';
import { DecisionList, LeadFace, RATING_SHORT, NOW_LABEL, padDigits } from './DecisionList';
import { fillEffectLine, fillMinutesToBite, leadingPressure, liveFillViews, liveStallFeed, pressureUrgency, reachByAction, threatLandingText, landingSubjects, type LandingSubject } from './fill-gauge';
import { CommsLog, SourceTicker } from './LiveFeed';
import { readSettings } from '../settings/prefs';
import { STANCE_LABEL } from '../components/IncidentPeople';
import type { FillView } from '../../sim/clocks';
import type { CheckKind } from '../../sim/scenario-types';
import { getScenario } from '../../sim/scenario-registry';
import { CONTRIBUTOR_GROUPS } from './contributor-groups';
import { GamePeopleProvider, PeopleText } from '../people/PeopleText';
import type { Lexicon } from '../people/lexicon';
import './operation-squads.css';
import './ops-visual.css';
import './live-call.css';
import { Disclosure } from '../components/Disclosure';
import { runRoster } from '../../sim/squads';

// Presentational live-operation screen. OpsLive.tsx feeds it from the selectors.

export interface LiveViewProps {
  g: GameState;
  now: number;
  title: string;
  /** e.g. 'Residential · OP 0141' */
  subtitle: string;
  progress: StageProgress;
  /** The open decision's stall in game minutes; the threat pill's bar drains by it. */
  dither?: number;
  built: BuiltLocation;
  spaces: SpaceView[];
  squadTasks: SquadTask[];
  deployedSquads: Squad[];
  focusSquadId: SquadId | null;
  onFocusSquad: (id: SquadId) => void;
  unavailableSquadIds?: SquadId[];
  officers: Officer[];
  actions: ActionView[];
  selectedAction: ActionView | null;
  onSelectAction: (id: Id) => void;
  /** Free menu progression stays separate from tactical decisions and their forecasts. */
  activeOfficerId: Id | null;
  onSelectOfficer: (id: Id) => void;
  selectedSpaceId: Id | null;
  onSelectSpace: (id: Id) => void;
  highlightSpaceIds: Id[];
  /** Floor shown on the map (controlled). The renderer draws the floor tabs when the building has two floors. */
  floor: number;
  onFloorChange: (floor: number) => void;
  /** Incident environment; the renderer draws its own chips, so none are drawn here. */
  environment: EnvironmentDefinition | null;
  lastChange: { revision: number; spaceIds: Id[] } | null;
  showRooms: boolean;
  onToggleRooms: () => void;
  clock: number;
  pressure: number;
  canCancel: boolean;
  onCancel: () => void;
  /** Leave the call without cancelling it (OpsLive); the Lab leaves it out and shows no Step out. */
  onStepOut?: () => void;
  onOpenDetails: () => void;
  detailsOpen: boolean;
  feedback?: ReactNode;
  /** Named external services stay beside the next decision, separate from squad support. */
  supportContext?: ReactNode;
  /** The call's summary and briefing, kept in view under the title for the whole operation. */
  situation?: ReactNode;
  /** The call type's painted scene (art/Plates sceneFor), behind the pinned title. */
  scene?: string | null;
  /** A response that can no longer progress is handled outside ordinary story choices. */
  failedResponse?: ReactNode;
  /** Overlay sheets (action detail, room sheet, cancel confirm) rendered by the container. */
  children?: ReactNode;
  /** A hot call (sim/authorization.ts isHotCall): the call bar's light bar flashes red and blue. */
  sirens?: boolean;
  /** Which beat of the call shows (docs/call-presentation.md): the decision, or the result of the
   * one just confirmed, with a Continue button. Left out, the decision. */
  beat?: 'decide' | 'result';
  /** Ends the result beat; shown as a pinned button labeled `continueLabel`. */
  onContinue?: () => void;
  continueLabel?: string;
  /** Above Continue: what comes next ("Next: On the stream"). */
  continueNote?: string;
  /** Where the result beat's Continue goes: the game puts it in the shell's foot slot (ChromeFoot),
   * so toasts stand clear of it. Left out (the Lab), it pins to the bottom of the screen. */
  footWrap?: (node: ReactNode) => ReactNode;
  /** The game's people lexicon for this call: names are colored while "Color names by role" is on.
   * Left out (the Scenario Lab), the surrounding PeopleProvider decides. */
  people?: Lexicon | null;
}

/** Whether the player folded the scene's map down to one line, kept per browser (a convenience: a
 * blocked store just means the map starts open). */
const MAP_FOLD_KEY = 'ti.live.mapFolded';
function readMapFolded(): boolean {
  // Folded unless the player opened it: under 4B the scene comes before the choices, and an open map
  // by default would push the first choice off a 390x844 screen. A choice the player made is kept.
  try { return typeof localStorage === 'undefined' || localStorage.getItem(MAP_FOLD_KEY) !== '0'; } catch { return true; }
}
function writeMapFolded(folded: boolean): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(MAP_FOLD_KEY, folded ? '1' : '0'); } catch { /* the choice just isn't remembered */ }
}

/** The live call as one screen (docs/call-presentation.md, "One screen"): a pinned strip with
 * everything that runs down or builds up, the scene's map and the squad, then the story and the
 * choices, or the result of the last one. Reference opens in place: the briefing from the title, a
 * room from the map, an officer from their face. Nothing switches views. */
export function LiveView(p: LiveViewProps) {
  const focus = p.deployedSquads.find((s) => s.id === p.focusSquadId) ?? p.deployedSquads[0] ?? null;
  const sel = p.selectedAction;
  const multi = p.deployedSquads.length > 1;
  const beat = p.beat ?? 'decide';
  const [materials, setMaterials] = useState(false);
  const [mapKey, setMapKey] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [mapFull, setMapFull] = useState(false);
  const mapElement = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const map = mapElement.current;
    if (!mapFull || !map?.parentElement) return;
    // Keep the drawing mounted so its pan and zoom survive. The scene owns the modal while it
    // is full-screen, using the same focus, inert, Escape and restoration rules as a Sheet.
    return containSheetFocus(map.parentElement, map, null, () => setMapFull(false));
  }, [mapFull]);
  const [mapFolded, setMapFolded] = useState(readMapFolded);
  // From stage 2 the map folds to its header unless the player opens it for that stage (owner chose
  // 4B, 2026-10-21, docs/ops-experience.md); stage 1 keeps the player's remembered choice.
  const [stageMap, setStageMap] = useState<{ stage: string; open: boolean } | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  // The head's "Your call" shortcut shows whenever the first choice sits below the first viewport,
  // whatever the screen height or text size; its slot is always reserved so the head never shifts.
  const liveRoot = useRef<HTMLDivElement>(null);
  const watchedChoice = useRef<{ el: Element; io: IntersectionObserver } | null>(null);
  const [choicesBelow, setChoicesBelow] = useState(false);
  useLayoutEffect(() => {
    const el = liveRoot.current?.querySelector('.operation-choices .callbtn') ?? liveRoot.current?.querySelector('.operation-choices') ?? null;
    if (watchedChoice.current?.el === el) return;
    watchedChoice.current?.io.disconnect();
    watchedChoice.current = null;
    if (!el) { setChoicesBelow(false); return; }
    // Measured now as well, so the first frame already shows the shortcut; the observer follows scroll and resize.
    setChoicesBelow(el.getBoundingClientRect().bottom > innerHeight);
    // Below means not wholly in view and cut off at the bottom: a choice half under the fold still needs the jump.
    const io = new IntersectionObserver(([entry]) => setChoicesBelow(entry.intersectionRatio < 1 && entry.boundingClientRect.bottom > (entry.rootBounds?.bottom ?? innerHeight) - 0.5), { threshold: [0, 1] });
    io.observe(el);
    watchedChoice.current = { el, io };
  });
  // Clear the remembered element too: StrictMode runs this cleanup and then the effect above again,
  // which must observe afresh rather than find the same element and skip.
  useLayoutEffect(() => () => { watchedChoice.current?.io.disconnect(); watchedChoice.current = null; }, []);
  const [officerOpen, setOfficerOpen] = useState<Id | null>(null);
  const expanded = expandedStage === p.progress.stage;
  const available = p.actions.map((action) => action.id === sel?.id ? sel : action);
  // Renderer props that may not be declared yet (floor tabs, environment overlay). Spread so this compiles either way.
  const blueprintExtras = { floor: p.floor, onFloorChange: p.onFloorChange, environment: p.environment ?? undefined };
  const changed = !!p.lastChange?.spaceIds.length;
  // A folded map opens itself on a result that changed the scene, so the player sees what moved.
  const stageNumber = p.progress.stages.findIndex((step) => step.state === 'current') + 1;
  const stageOpen = stageMap?.stage === p.progress.stage ? stageMap.open : null;
  const folded = stageNumber >= 2 ? !(stageOpen ?? false) : mapFolded;
  // The result beat leads with the story; its scene stays folded to one line until opened.
  const [sceneOpen, setSceneOpen] = useState(false);
  const mapShown = mapFull || (beat === 'result' ? sceneOpen : !folded);
  const toggleFold = () => {
    if (beat === 'result') { setSceneOpen(!sceneOpen); return; }
    const next = mapShown;
    if (stageNumber >= 2) setStageMap({ stage: p.progress.stage, open: !next });
    else { setMapFolded(next); writeMapFolded(next); }
  };
  const threat = beat === 'decide' ? p.progress.threat ?? null : null;
  // Gauges that fill keep running through the result, so they stay in the strip on both beats. The
  // strip shows the threat, the decision's own clock, and every pressure source as it runs (owner
  // 2026-10-21: the crowd and the stream count live beside the drain, not one pressure at a time).
  const fills = liveFillViews(p.g, p.dither ?? 0);
  const pressure = leadingPressure(threat, p.dither ?? 0, []);
  // A hot call's lights sweep across the strip and the top of the scene, red then blue, as hard as
  // the pressure biting hardest: the threat's drain or a source filling (owner, 2026-10-21: stress in
  // the decision). Off with the Flashing lights setting; still under reduced motion (live-call.css).
  const washLevel = p.sirens && readSettings().flashing ? strongest([
    ...(pressure?.kind === 'threat' ? [pressureUrgency(pressure)] : []),
    ...fills.map((view) => pressureUrgency({ kind: 'fill', view, left: fillMinutesToBite(view) })),
  ]) : null;
  const comms = beat === 'decide' ? liveStallFeed(p.g, p.dither ?? 0) : [];
  const landed = pressure?.kind === 'threat' && pressure.left <= 0 ? threatLandingText(p.g) : null;
  const subjects = landed ? landingSubjects(p.g, p.dither ?? 0) : [];
  const reach = reachByAction(p.g, available.map((action) => action.id));
  const casualties = p.g.activeRun?.officerCasualties ?? {};
  const focusTask = focus ? p.squadTasks.find((task) => task.squadId === focus.id) : undefined;
  const focusWhere = p.spaces.find((space) => space.id === focusTask?.positionId)?.label ?? focusTask?.positionId;
  const whereLine = focus ? `${focus.name}${focusWhere ? ` at ${focusWhere}` : ''}` : 'The scene';
  const officerShown = officerOpen ? p.officers.find((o) => o.id === officerOpen) ?? null : null;
  // A new beat starts on the story, with the full map closed.
  const beatKey = `${beat}:${p.lastChange?.revision ?? ''}`;
  const [beatSeen, setBeatSeen] = useState(beatKey);
  if (beatSeen !== beatKey) {
    setBeatSeen(beatKey);
    if (mapFull) setMapFull(false);
    if (sceneOpen) setSceneOpen(false);
  }

  // What is said on scene while the player decides, read after the prompt and before the choices.
  const commsLog = <CommsLog lines={comms} landed={landed ? <ThreatLanded text={landed} subjects={subjects} /> : null} />;

  const squadRow = <div className="live-squad" aria-label={focus ? focus.name : 'Your team'}>
    {multi && <div className="live-squad-rail operation-squad-focus">
      <ChoiceRail value={focus?.id ?? p.deployedSquads[0].id} kind="tabs" label="Squad for next decision" panelId="live-squad-faces" onChange={p.onFocusSquad} options={p.deployedSquads.map((s) => {
        // In the field, readiness means members still fit for high-risk work (not deploy eligibility).
        const went = p.g.activeRun ? runRoster(p.g, p.g.activeRun, s.id) : s.officerIds;
        const fit = went.filter((id) => p.g.officers[id] && highRiskAllowed(p.g.officers[id]) && (!p.g.activeRun || !incidentOfficerUnavailable(p.g, p.g.activeRun, id))).length;
        const task = p.squadTasks.find(task => task.squadId === s.id);
        const location = p.spaces.find(space => space.id === task?.positionId)?.label ?? task?.positionId;
        const unavailable = p.unavailableSquadIds?.includes(s.id) && s.id !== focus?.id;
        return { value: s.id, disabled: unavailable, accessibleLabel: `${s.name}, ${fit} of ${went.length} fit${location ? `, at ${location}` : ''}${unavailable ? ', unavailable for this decision' : ''}`,
          label: <><b>{s.id}</b><span className="squad-tab-detail"><span className="squad-tab-name">{s.name}</span>{location && <small>{location}</small>}</span><span className="choice-rail-count">{fit}/{went.length} fit</span></> };
      })} />
      <p className="operation-squad-hint">{sel ? `Reviewing with ${joinNames(sel.actingSquadIds.map(id => squadName(p.deployedSquads, id)))}. Switching here changes who acts.` : 'Choose who acts, then review a decision. Pick support in the review.'}</p>
    </div>}
    <ul className="live-squad-faces" id="live-squad-faces" role={multi ? 'tabpanel' : undefined}>
      {p.officers.map((o) => {
        const casualty = casualties[o.id];
        const band = stressBand(o.stress);
        const acting = !casualty && (sel?.officerIds.includes(o.id) ?? false);
        return <li key={o.id}>
          <button type="button" className={`live-squad-face${casualty ? ' live-squad-out' : ''}${acting ? ' live-squad-acting' : ''}`} onClick={() => { setOfficerOpen(o.id); p.onSelectOfficer(o.id); }}
            aria-label={`${o.firstName} ${o.surname}${focus?.leaderId === o.id ? ', leads the squad' : ''}, ${casualty ? `injured: ${casualty.label}, out of action` : `stress ${whole(o.stress)}, ${STRESS_LABEL[band].toLowerCase()}`}. Open their card`}>
            {/* The face carries stress as a ring and an injury from this call as a badge (the run's
                casualty record, not the officer's saved injury), so the row stays one line high. */}
            <Face size="sm" kind="officer" officer={o} status={{ stress: o.stress, band, surname: o.surname, mark: casualty ? 'injured' : null, until: null, label: casualty ? `${o.surname} is out of action` : `${o.surname}, ${STRESS_LABEL[band].toLowerCase()}` }} />
            <span className="live-squad-text">
              <span className="live-squad-name">{o.surname}{focus?.leaderId === o.id && <Icon name="star" size={16} className="live-team-leader" />}</span>
              {casualty ? <span className="live-squad-stress stress-recovery">Out of action</span>
                : <span className={`live-squad-stress lead-choice-stress stress-${band}`}>{whole(o.stress)}</span>}
            </span>
          </button>
        </li>;
      })}
      {p.officers.length === 0 && <li className="strip-empty">No officers in this squad.</li>}
    </ul>
  </div>;

  // The story: the decision and its choices, or the result of the last one.
  const story = <div className="live-story">
        {beat === 'result' ? <>          {p.feedback}
          {p.onContinue && (p.footWrap ?? ((node: ReactNode) => <div className="stickyfoot live-continue">{node}</div>))(<>
            {p.continueNote && <p className="live-continue-note">{p.continueNote}</p>}
            <Button variant="primary" block onClick={p.onContinue}>{p.continueLabel ?? 'Continue'}</Button>
          </>)}
        </> : <>
          {p.feedback}
          <section className="call operation-choices" aria-label="Your call">
            {/* 4B (docs/ops-experience.md "The decide beat"): the moment (prompt and transcript), then
                what is said on scene in its reserved box, then the choices. The stage rail names the stage, and
                the strip carries the threat and what each source does to the odds, so neither repeats
                here. Tapping a card opens its review; tapping the reviewed card again closes it. */}
            <DecisionList prompt={p.progress.prompt} exchange={p.progress.exchange} actions={available} reach={reach} selectedId={sel?.id ?? null} expanded={expanded} officers={p.g.officers}
              guidance={commsLog} onSelect={p.onSelectAction} onExpand={() => setExpandedStage(expanded ? null : p.progress.stage)} />
          </section>
          {p.failedResponse}
          {p.supportContext}
        </>}
      </div>;

  const sceneSection = (
    <section className="live-scene" aria-label="The scene">
        <div className="live-scene-head">
          <span className="live-scene-where">{focus ? <span className="squad-badge" aria-hidden="true">{focus.id}</span> : <Icon name="pin" size={16} />}{whereLine}{changed && beat === 'result' && <Chip tone="amber" icon="blueprint">Map changed</Chip>}</span>
          <span className="live-scene-actions">
            {!mapFull && <button type="button" className="hud-btn hud-btn-quiet" onClick={toggleFold} aria-expanded={mapShown} aria-controls="live-map">
              <Icon name={mapShown ? 'chevronUp' : 'chevronDown'} size={16} />{mapShown ? 'Hide map' : 'Show map'}
            </button>}
          </span>
        </div>
        <div ref={mapElement} tabIndex={mapFull ? -1 : undefined} className={`live-map${mapFull ? ' live-map-full' : ' live-map-compact'}`} id="live-map" hidden={!mapShown} role={mapFull ? 'dialog' : undefined} aria-modal={mapFull || undefined} aria-label={mapFull ? 'Map of the scene' : undefined}>
          {mapFull && <div className="live-map-full-head">
            <span className="live-scene-where"><Icon name="pin" size={16} />{whereLine}</span>
            <button type="button" className="hud-btn" onClick={() => setMapFull(false)} aria-label="Close the map"><Icon name="x" size={16} />Close</button>
          </div>}
          <div className="live-map-inner">
            {mapFull && p.showRooms ? (
              <RoomList built={p.built} spaces={p.spaces} squads={p.g.squads} selectedSpaceId={p.selectedSpaceId} onSelectSpace={p.onSelectSpace} />
            ) : (
              <Blueprint
                built={p.built}
                spaces={p.spaces}
                squadTasks={p.squadTasks}
                squads={p.g.squads}
                selectedSpaceId={p.selectedSpaceId}
                focusSquadId={focus?.id ?? null}
                highlightSpaceIds={p.highlightSpaceIds}
                onSelectSpace={p.onSelectSpace}
                lastChange={p.lastChange}
                overlays={sel?.overlays}
                showMaterials={materials}
                {...blueprintExtras}
              />
            )}
          </div>
          {mapFull && <div className="map-hud map-actions" role="group" aria-label="Map display">
            <button type="button" className="hud-btn hud-btn-quiet map-key-btn" aria-label="Map key and inspection help" aria-haspopup="dialog" aria-expanded={mapKey} onClick={() => setMapKey(true)}><Icon name="info" size={16} />Key</button>
            {!p.showRooms && <button type="button" className="hud-btn" onClick={() => setMaterials((v) => !v)} aria-pressed={materials}><Icon name="layers" size={16} />Materials</button>}
            <button type="button" className="hud-btn" onClick={p.onToggleRooms} aria-pressed={p.showRooms}><Icon name={p.showRooms ? 'blueprint' : 'list'} size={16} />{p.showRooms ? 'Map' : 'Rooms'}</button>
          </div>}
        </div>
        <Sheet open={mapKey} onClose={() => setMapKey(false)} title="Map key" maxHeight="short">
          <div className="map-key-body" aria-label="Map legend">
            <span className="map-key-items">
              <span><Icon name="user" size={20} className="lg-q legend-reported-person" />Reported</span>
              <span><Icon name="user" size={20} className="lg-ok" />Confirmed</span>
            </span>
            <p>Dashed amber people are reports at approximate positions. Mint people have a confirmed position. Small item symbols stay beside their holder; amber items are still reported, even when the person is confirmed. An absent weapon symbol does not mean unarmed. Tap a room or use Rooms to inspect names, conditions and items.</p>
          </div>
        </Sheet>
        {(beat === 'decide' || sceneOpen) && squadRow}
      </section>
  );

  const screen = (
    <div ref={liveRoot} className={`live live-one live-beat-${beat}${mapFull ? ' live-map-full-open' : ''}${pressure?.kind === 'threat' ? ` live-urgency-${pressureUrgency(pressure)}` : ''}`}>
      {/* The call's name scrolls away; the strip under it stays pinned: where the call is and the one
          pressure that bites soonest, the threat or a gauge that fills. */}
      <header className={`live-head${p.scene ? ' plate' : ''}`}>
        <PlateArt src={p.scene ?? null} />
        <div className="live-strip-head">
          {/* Step out leaves the call without cancelling it; the call waits, paused, until the player
              comes back (ui/decision-pause.ts). The Lab has no way out, so it shows none. */}
          {p.onStepOut && <button type="button" className="live-stepout" onClick={p.onStepOut}><Icon name="chevronLeft" size={20} /><span className="live-stepout-text">Step out</span></button>}
          <div className="live-title-block">
            <button type="button" className="live-title" onClick={() => setBriefingOpen(true)} aria-haspopup="dialog" aria-expanded={briefingOpen} aria-label={`${p.title}. Open the briefing`}>
              <span className="live-name">{p.title}</span>
              <Icon name="info" size={16} className="live-title-more" />
              {p.sirens && <span className="live-lightbar" role="img" aria-label="Lights and sirens"><i /><i /></span>}
            </button>
            <p className="live-sub">
              <span className="live-flag"><i className="live-dot-amber" aria-hidden="true" />Live</span>
              <span className="live-status" aria-label="Call time and pressure">
                <span className="hud-pill"><Icon name="clock" size={16} />{opMinutes(p.clock)}</span>
                <span className="hud-pill" title="Situation pressure">
                  <span className="pmeter" role="img" aria-label={`Pressure ${Math.round(p.pressure)} of 100`}>
                    <i style={{ width: `${Math.max(4, Math.min(100, p.pressure))}%` }} />
                  </span>
                  <span>{pressureWord(p.pressure)}</span>
                </span>
              </span>
            </p>
          </div>
          {<button type="button" className="hud-btn live-choice-access" data-choices-below aria-label="Your call" hidden={beat !== 'decide' || !choicesBelow} onClick={(event) => {
            const live = event.currentTarget.closest('.live');
            const firstChoice = live?.querySelector<HTMLElement>('.operation-choices .callbtn') ?? live?.querySelector<HTMLElement>('.operation-choice-count');
            firstChoice?.scrollIntoView({ block: 'center' });
            // Keyboard and screen-reader users land where the jump took the eye.
            if (firstChoice?.matches('.callbtn')) firstChoice.focus({ preventScroll: true });
          }}><Icon name="chevronDown" size={20} /></button>}
          <button type="button" className="hud-btn live-map-access" onClick={() => setMapFull(true)} aria-haspopup="dialog" aria-label="Full map"><Icon name="blueprint" size={20} /></button>
        </div>
      </header>
      <div className="live-bar live-strip">
        {washLevel && <span className={`live-wash live-wash-${washLevel}`} aria-hidden="true"><i /><i /></span>}
        <StageSteps progress={p.progress} />
        {pressure?.kind === 'threat' && <ThreatPill label={pressure.label} minutes={pressure.minutes} dither={p.dither} />}
        {fills.length > 0 && <div className="live-sources">
          {fills.map((view) => view.count || view.reactions ? <SourceTicker key={view.id} view={view} runKey={p.g.activeRun?.id} effect={sourceEffect(p.g, view)} chat={beat === 'decide'} threat={p.progress.threat ?? null} dither={p.dither ?? 0} /> : <FillGauge key={view.id} view={view} />)}
        </div>}
      </div>

      {/* 4B: on the decide beat the scene (where the squad is, the map and its faces) comes before the
          last decision, the moment and the choices. The result beat leads with the story. */}
      {beat === 'decide' && sceneSection}
      {story}
      {beat !== 'decide' && sceneSection}

      <Sheet open={briefingOpen} onClose={() => setBriefingOpen(false)} title="Briefing"
        footer={p.canCancel ? <Button variant="danger" block aria-label="Cancel the call" onClick={() => { setBriefingOpen(false); p.onCancel?.(); }}>Cancel the call</Button> : undefined}>
        <div className="live-briefing">{p.subtitle && <p className="live-briefing-sub">{p.subtitle}</p>}{p.situation}</div>
      </Sheet>
      <Sheet open={!!officerShown} onClose={() => setOfficerOpen(null)} title={officerShown ? `${officerShown.firstName} ${officerShown.surname}` : 'Officer'} maxHeight="short">
        {officerShown && (() => {
          const casualty = casualties[officerShown.id];
          const cap = !casualty && sel ? capabilityFor(sel, officerShown) : null;
          return <div className="live-officer-card">
            <OfficerCard officer={officerShown} now={p.now} incidentInjury={casualty?.label} note={casualty ? 'Out of action' : undefined} selected leader={focus?.leaderId === officerShown.id}
              chip={cap ? <span className={`capchip${cap.value < 0 ? ' capchip-neg' : ''}`}>{cap.text}</span> : undefined} />
            {sel && !casualty && <p className="dim">{sel.officerIds[0] === officerShown.id ? `Leads ${sel.title}.` : sel.officerIds.includes(officerShown.id) ? `Taking part in ${sel.title}.` : `Not on ${sel.title}.`}</p>}
          </div>;
        })()}
      </Sheet>
      {p.children}
    </div>
  );
  return p.people === undefined ? screen : <GamePeopleProvider lexicon={p.people}>{screen}</GamePeopleProvider>;
}

/** The decision point's threat, pinned under the call bar while the player decides: "<label> · <n>
 * min", over a bar. `minutes` is what the threat allows; `dither` is the stall so far
 * (docs/call-pressure.md), so the minutes left are `minutes - dither` and the bar and the text show
 * the same number. An empty bar means the threat lands on any choice. The bar only changes width
 * when the stall moves, and never animates under reduced motion. At zero the pill keeps its shape
 * and reads "Now"; what happened joins the comms log (ThreatLanded), so the pinned strip
 * never changes height and nothing under it moves (owner, 2026-10-21). */
export function ThreatPill({ label, minutes, dither = 0 }: { label: string; minutes: number; dither?: number }) {
  const left = Math.max(0, minutes - Math.max(0, dither));
  const shown = Math.ceil(left);
  const share = minutes > 0 ? Math.max(0, Math.min(1, left / minutes)) : 0;
  const urgency = pressureUrgency({ kind: 'threat', label, minutes, left });
  return <p className={`threat-pill pressure-${urgency}${left <= 0 ? ' threat-pill-landed' : ''}`} role={left <= 0 ? 'status' : undefined}
    aria-label={left <= 0 ? `${label}. It happened` : `Threat: ${label} in ${shown} ${shown === 1 ? 'minute' : 'minutes'}`}>
    <Icon name="hourglass" size={20} />
    <span className="threat-pill-label"><PeopleText text={label} /></span>
    <span className="threat-pill-sep" aria-hidden="true">·</span>
    <b className="threat-pill-min">{left <= 0 ? NOW_LABEL : `${padDigits(shown, 2)} min`}</b>
    <span className="threat-pill-bar" role="meter" aria-label="Minutes left before the threat lands" aria-valuemin={0} aria-valuemax={minutes} aria-valuenow={shown} aria-valuetext={`${shown} of ${minutes} minutes`}>
      <i style={{ width: `${(share * 100).toFixed(2)}%` }} />
    </span>
  </p>;
}

/** What the threat did when it landed (fill-gauge.ts threatLandingText), with the subjects it wound
 * up and their agitation’s rise, which grows in once (no loop). It joins the comms log, which scrolls
 * inside its own box. */
export function ThreatLanded({ text, subjects }: { text: string; subjects: readonly LandingSubject[] }) {
  return <div className="threat-landed">
    <p className="threat-landed-text"><Icon name="hourglass" size={16} /><span><PeopleText text={text} /></span></p>
    {subjects.length > 0 && <span className="threat-pill-subjects">{subjects.map((subject) =>
      <span key={subject.id} className="threat-subject" data-subject-stance={subject.stance}>
        <span className="threat-subject-name"><PeopleText text={subject.label} /> · {STANCE_LABEL[subject.stance]}</span>
        <span className="threat-subject-bar" role="meter" aria-label={`${subject.label} is more worked up`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(subject.after)}>
          <i style={{ width: `${subject.before}%` }} />
          <b style={{ left: `${subject.before}%`, width: `${Math.max(1, subject.after - subject.before)}%` }} />
        </span>
      </span>)}</span>}
  </div>;
}

/** The checks a pressure source weighs on, in the words a card would use. */
const CHECK_WORDS: Record<CheckKind, string> = {
  contact: 'talking', observation: 'watching', execution: 'moving in', pressure: 'keeping calm', medical: 'medical work', coordination: 'working together',
};

const URGENCY_ORDER = ['calm', 'warn', 'critical'] as const;
/** The most urgent of the pressures on screen; calm with none. */
function strongest(levels: readonly (typeof URGENCY_ORDER)[number][]): (typeof URGENCY_ORDER)[number] {
  return levels.reduce<(typeof URGENCY_ORDER)[number]>((best, next) => URGENCY_ORDER.indexOf(next) > URGENCY_ORDER.indexOf(best) ? next : best, 'calm');
}

/** What a pressure source does to the odds, in words, for its ticker: the checks it makes harder once
 * its first cue is heard ("Talking, keeping calm and working together are harder"), or null while it
 * pulls nothing. The count and the pull are on the ticker already, so this is the only line it adds. */
export function sourceEffect(g: LiveViewProps['g'], view: FillView): string | null {
  if (!view.count || !(view.oddsPull ?? 0)) return null;
  const run = g.activeRun;
  const kinds = (run ? getScenario(run.scenarioId)?.clocks ?? [] : []).find((def) => def.id === view.id)?.source?.odds?.kinds ?? [];
  const words = kinds.map((kind) => CHECK_WORDS[kind]);
  const checks = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)} are harder` : `${words[0] ?? 'every check'} is harder`;
  return checks.charAt(0).toUpperCase() + checks.slice(1);
}

/** A gauge that fills (a crowd filming, a subject streaming), in the threat pill's family: the label,
 * a bar that fills with a tick at each cue (heard ones marked), the state when it is stopped, slowed
 * or full, and, once its first cue is heard, one line naming everything it now does. The bar changes
 * width only when the gauge moves and never animates under reduced motion. */
export function FillGauge({ view }: { view: FillView }) {
  const state = view.full ? 'Full' : view.stopped ? 'Stopped' : view.slowed ? 'Slowed' : null;
  const value = Math.round(view.value);
  const urgency = pressureUrgency({ kind: 'fill', view, left: fillMinutesToBite(view) });
  return <div className={`fill-gauge pressure-${urgency}${view.stopped ? ' fill-gauge-stopped' : ''}`} data-fill={view.id} role="group" aria-label={`${view.label}: ${value} of 100${state ? `, ${state.toLowerCase()}` : ''}`}>
    <p className="fill-gauge-head">
      <Icon name="crowd" size={20} />
      <span className="fill-gauge-label">{view.label}</span>
      {state && <b className="fill-gauge-state">{state}</b>}
    </p>
    <span className="fill-gauge-bar" role="meter" aria-label={`${view.label} fills`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}
      aria-valuetext={`${value} of 100. ${view.cues.filter((cue) => cue.heard).length} of ${view.cues.length} warnings heard`}>
      <i style={{ width: `${Math.max(0, Math.min(100, view.value))}%` }} />
      {view.cues.map((cue) => <em key={cue.at} className={cue.heard ? 'fill-gauge-tick fill-gauge-heard' : 'fill-gauge-tick'} style={{ left: `${cue.at}%` }} aria-hidden="true" />)}
    </span>
    {view.effect && <p className="fill-gauge-effect">{fillEffectLine(view.effect)}</p>}
  </div>;
}

function pressureWord(v: number): string {
  if (v >= 75) return 'High';
  if (v >= 45) return 'Rising';
  if (v >= 20) return 'Steady';
  return 'Low';
}

/** Net contribution this officer makes to the selected action, with a short label. */
function capabilityFor(a: ActionView, o: Officer): { value: number; text: string } | null {
  const mine = a.contributors.filter((c) => c.ref === o.id);
  if (mine.length === 0) {
    if (!a.officerIds.includes(o.id)) return null;
    return { value: 0, text: ROLE_META[o.role].short };
  }
  const value = mine.reduce((s, c) => s + c.value, 0);
  const top = [...mine].sort((x, y) => Math.abs(y.value) - Math.abs(x.value))[0];
  const word = shortLabel(top.label, o);
  return { value, text: `${signed(value)} ${word}`.trim() };
}

/** '+43', '−3', '0': sign follows the rounded value so a tiny negative never reads '−0'. */
function signedPoints(v: number): string {
  const r = Math.round(v);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}`;
}

// Portrait chips are a quarter of a phone wide, so skill words stay short; the review sheet has the full names.
const SHORT: [RegExp, string][] = [
  [/communicat/i, 'Comms'],
  [/awareness/i, 'Aware'],
  [/coordinat/i, 'Coord'],
  [/composure/i, 'Calm'],
  [/shooting/i, 'Shoot'],
  [/medical/i, 'Medic'],
  [/observ/i, 'Observe'],
  [/leader/i, 'Lead'],
];

function shortLabel(label: string, o: Officer): string {
  for (const [re, word] of SHORT) if (re.test(label)) return word;
  let s = label.replace(new RegExp(`^${o.surname}\\s*`, 'i'), '').replace(new RegExp(`^${o.firstName}\\s*`, 'i'), '');
  s = s.replace(/^[:\-–\s]+/, '');
  return s.length > 10 ? 'Help' : s;
}

// ---------------------------------------------------------------- stage progress

export function StageSteps({ progress }: { progress: StageProgress }) {
  const rail = useRef<HTMLOListElement>(null);
  const current = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const strip = rail.current;
    const step = current.current;
    if (!strip || !step) return;
    const reveal = () => revealStageStep(strip, step);
    reveal();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(reveal);
    observer?.observe(strip);
    return () => observer?.disconnect();
  }, [progress.stage, progress.index]);
  const fallback: { id: StageId; label: string }[] = [
    { id: 'assess', label: 'Assess' },
    { id: 'adapt', label: 'Adapt' },
    { id: 'resolve', label: 'Resolve' },
  ];
  const stages =
    progress.stages.length > 0
      ? progress.stages
      : fallback.map((s, i) => ({ ...s, state: (i < progress.index ? 'done' : i === progress.index ? 'current' : 'todo') as 'done' | 'current' | 'todo' }));
  return (
    <ol ref={rail} className="steps" aria-label="Operation stages" tabIndex={0}>
      {stages.map((s, i) => (
        <li key={s.id} ref={s.state === 'current' ? current : undefined} className={`step step-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined} title={s.label}>
          <span className="step-track">
            <span className={`step-line${i === 0 ? ' step-line-hide' : ''}${s.state !== 'todo' ? ' step-line-on' : ''}`} />
            <span className="step-dot">{s.state === 'done' && <Icon name="check" size={16} strokeWidth={3.2} />}</span>
          </span>
          <span className="step-label">{s.label}</span>
          <span className="sr-only">{s.state === 'done' ? ' complete' : s.state === 'current' ? ' current' : ' upcoming'}</span>
        </li>
      ))}
    </ol>
  );
}

/** Reveal the current stage inside its own rail without scrolling the operation screen. */
export function revealStageStep(strip: HTMLOListElement, step: HTMLLIElement) {
  const box = step.getBoundingClientRect();
  const viewport = strip.getBoundingClientRect();
  if (box.left < viewport.left + 4) strip.scrollLeft += box.left - viewport.left - 4;
  else if (box.right > viewport.right - 4) strip.scrollLeft += box.right - viewport.right + 4;
}

// ---------------------------------------------------------------- status chip

// ---------------------------------------------------------------- action detail sheet

export interface ActionSheetProps {
  /** A small map of where the choice happens (its overlays), shown first: on the one-screen call the
   * scene's map has usually scrolled away by the time the player reviews (docs/call-presentation.md). */
  preview?: ReactNode;
  /** Support-origin reviews keep the contextual modal route and a clear Back action. */
  onBackToSupport?: () => void;
  open: boolean;
  onClose: () => void;
  view: ActionView | null;
  /** Every decision at this stage, so the player can switch without closing the sheet. */
  all: ActionView[];
  onPick: (id: Id) => void;
  squads: Squad[];
  acting: SquadId[];
  support: SquadId[];
  onToggleActing: (id: SquadId) => void;
  onToggleSupport: (id: SquadId) => void;
  /** Limits and roles come from the actual authored action, not a guessed selection count. */
  maxActing?: number;
  squadPositions?: Partial<Record<SquadId, string>>;
  unavailableActors?: SquadId[];
  unavailableSupport?: SquadId[];
  participantNames?: string[];
  supportTask?: string | null;
  targetLabel: string | null;
  onConfirm: () => void;
  resupply?: ActionResupplyPlan | null;
  resupplyMinutes?: number;
  onResupply?: () => void;
  alternatives?: ActionView[];
  onUseAlternative?: (view: ActionView) => void;
  /** The deployed officers, for the lead picker. Left out, the sheet shows no picker. */
  officers?: Readonly<Record<Id, Officer>>;
  /** Who leads now, the engine's best fit, and the lead's marks (trait ids, band_<band>). */
  lead?: Id | null;
  bestFit?: Id | null;
  /** Those taking part in the engine's order, so the faces stay put when the lead changes. */
  leadOrder?: Id[];
  leadMarks?: string[];
  /** The ratings the choice blends, heaviest first, and the certificates whose holders lead first. */
  leadBlend?: RatingKey[];
  leadCerts?: CertId[];
  /** A tap on a face among those taking part. */
  onPickLead?: (id: Id) => void;
}

export function ActionSheet(p: ActionSheetProps) {
  const v = p.view;
  const shown = p.open && !!v;
  const modal = !!p.onBackToSupport;
  // A card opens this sheet without trapping focus (the map stays live), so focus moves to its title
  // for the keyboard and the screen reader, and goes back to the card that opened it when it closes.
  // A modal sheet (from care and support) does both itself (components/sheet-focus.ts).
  useEffect(() => {
    if (!shown || modal || typeof document === 'undefined') return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      const title = document.querySelector<HTMLElement>('.operation-action-sheet .sheet-title');
      if (!title) return;
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      const active = document.activeElement;
      if (opener?.isConnected && (!active || active === document.body || active.closest('.operation-action-sheet'))) opener.focus({ preventScroll: true });
    };
  }, [shown, modal, v?.id]);
  const availableAlternative = p.all.find((action) => action.id !== v?.id && action.eligible);
  const names = (ids: SquadId[]) => ids.map((id) => squadName(p.squads, id));
  // The action bar's summary (docs/ui-ux-audit.md): who acts, the time and the supplies, with the
  // harm beside them. The card shows the same estimate and harm; the sheet doesn't repeat them.
  const squadText = p.acting.length === 0 ? 'No squad' : joinNames(names(p.acting));
  const supportingText = p.support.length ? `, ${joinNames(names(p.support))} supporting` : '';
  const resupplyNames = p.resupply?.items.reduce((list, item) => {
    const row = list.find((entry) => entry.id === item.itemId);
    if (row) row.qty += 1;
    else list.push({ id: item.itemId, name: item.name, qty: 1 });
    return list;
  }, [] as { id: Id; name: string; qty: number }[]) ?? [];
  return (
    <Sheet
      open={p.open && !!v}
      onClose={p.onClose}
      modal={!!p.onBackToSupport}
      maxHeight="short"
      className="operation-action-sheet"
      title={v ? v.title : ''}
      subtitle={v && !v.eligible ? <span className="action-sheet-locked"><Icon name="lock" size={16} />Requirements unmet</span> : undefined}
      footer={
        v && (
          <div className="operation-commit">
            <p className="operation-commit-meta">
              <span>{squadText}{supportingText} · about {v.timeLabel ?? opMinutes(v.timeCost)} · {v.suppliesRequired.length ? `${v.suppliesRequired.reduce((total, item) => total + item.qty, 0)} supplies` : 'no supplies'}</span>
              <span className={`consequence-level consequence-${v.consequenceLevel}`}>Harm {CONSEQUENCE_LABEL[v.consequenceLevel].toLowerCase()}</span>
            </p>
            <Button variant="primary" block disabled={!v.eligible || p.acting.length === 0} onClick={p.onConfirm} aria-label={`Confirm ${v.title}`}>
              Confirm
            </Button>
          </div>
        )
      }
    >
      {v && (
        <div className="adetail">
          {p.onBackToSupport && <Button variant="ghost" onClick={p.onBackToSupport}>Back to care &amp; support</Button>}
          {/* Cost and the three outcomes first (docs/ops-experience.md, Review), then who acts and
              leads, then the map and the rest. Every control stays. */}
          {v.weighing ? <dl className="action-sheet-weigh">
            <div className="action-sheet-weigh-cost"><dt>The cost.</dt><dd><PeopleText text={v.weighing.cost} /></dd></div>
            <div><dt>The pull.</dt><dd><PeopleText text={v.weighing.pull} /></dd></div>
          </dl> : v.summary !== v.outcomePreview.favorable && <p className="operation-action-summary"><PeopleText text={v.summary} /></p>}
          <OutcomeForecast action={v} />
          {v.timeRange && !v.timeLabel && v.timeRange.min !== v.timeRange.max && <p className="operation-note operation-time-range">Takes {v.timeRange.min}–{opMinutes(v.timeRange.max)} depending on the result.</p>}
          {p.squads.length > 1 && <ActionSquadAssignment {...p} view={v} />}
          {p.officers && v.eligible && <LeadPicker view={v} officers={p.officers} lead={p.lead ?? v.officerIds[0] ?? null} bestFit={p.bestFit ?? null} order={p.leadOrder} marks={p.leadMarks ?? []} blend={p.leadBlend ?? []} certs={p.leadCerts ?? []} onPick={p.onPickLead} />}
          {v.eligible && v.authority?.allowed && <p className="operation-command-line"><Icon name="radio" size={16} />{v.authority.reason}</p>}
          {p.targetLabel && <p className="action-sheet-where"><Icon name="pin" size={16} />{p.targetLabel}</p>}
          {p.preview}
          <dl className="operation-costs">
            <div><dt>Requirements</dt><dd className="chips">{requirementParts(v.requirementLine).map((part) => <Chip key={part} tone={v.eligible ? 'mint' : 'neutral'} icon={v.eligible ? 'check' : 'list'}>{part}</Chip>)}</dd></div>
            <div><dt>Supplies used when confirmed</dt><dd className="chips">{v.suppliesRequired.length ? v.suppliesRequired.map((item) => <Chip key={item.label} icon="box">{`${item.qty} × ${item.label}`}</Chip>) : <Chip>None</Chip>}</dd></div>
          </dl>
          {!v.eligible && v.reason && (
            <p className="note note-warn">
              <Icon name="lock" size={16} />
              {v.reason}
            </p>
          )}
          {!v.eligible && (p.resupply?.needed || !!p.alternatives?.length) && (
            <section className="action-resolution" aria-label="Resolve action requirements">
              {p.resupply?.needed && (
                <>
                  <strong className="action-resolution-title">Equipment from stores</strong>
                  {p.resupply.ok ? (
                    <>
                      <ul className="action-resolution-items">
                        {p.resupply.items.map((item) => <li key={item.unitId}>{squadName(p.squads, item.squadId)}: {item.name} · {item.serial}</li>)}
                      </ul>
                      <p className="action-resolution-note dim">Only the listed equipment is delivered to your chosen squads from owned stock. Your decision and squad choices stay selected for review.</p>
                      <p className="action-resolution-note dim">Available while staged outside, before your first decision. Delivery takes {p.resupply.minutes} minutes, raises pressure and commits this operation. You can no longer cancel after delivery.</p>
                      {p.onResupply && <div className="action-resolution-actions"><Button onClick={p.onResupply}>Equip {resupplyNames.map((item) => `${item.qty > 1 ? `${item.qty} × ` : ''}${item.name}`).join(' + ')} · +{p.resupply.minutes} min</Button></div>}
                    </>
                  ) : <p className="action-resolution-note dim">{p.resupply.reason}</p>}
                </>
              )}
              {!!p.alternatives?.length && p.onUseAlternative && (
                <>
                  <strong className="action-resolution-title">Ready to act</strong>
                  <p className="action-resolution-note dim">These deployed squads meet this action’s requirements.</p>
                  <div className="action-resolution-actions">
                    {p.alternatives.map((candidate) => <Button key={candidate.actingSquadIds.join('-')} onClick={() => p.onUseAlternative?.(candidate)}>Use {joinNames(names(candidate.actingSquadIds))}</Button>)}
                  </div>
                </>
              )}
            </section>
          )}
          {!v.eligible && availableAlternative && <div className="action-resolution-actions"><Button onClick={() => p.onPick(availableAlternative.id)}>Available now: {availableAlternative.title}</Button></div>}
          {!!p.resupplyMinutes && <p className="dim adetail-note">Stores deliveries: {p.resupplyMinutes} operation minutes. Equipment is reserved for this run.</p>}
          {p.all.length > 1 && <Disclosure name="decision-compare" className="operation-switcher" summary="Compare another decision" count={p.all.length}>
            <div className="switcher" role="group" aria-label="Decisions">
              {p.all.map((a) => (
                <button key={a.id} type="button" className={`pill${a.id === v.id ? ' pill-on' : ''}`} aria-pressed={a.id === v.id} onClick={() => p.onPick(a.id)}>
                  {a.title}
                </button>
              ))}
            </div>
          </Disclosure>}
          <Disclosure name="decision-odds" className="operation-contributors" summary="Why these odds" hint="Officer, equipment and situation factors">
          {v.contributors.length === 0 ? (
            <p className="dim">No contributors listed.</p>
          ) : (
            CONTRIBUTOR_GROUPS.map((gr) => {
              const rows = v.contributors.filter((c) => gr.sources.includes(c.source));
              if (rows.length === 0) return null;
              const total = rows.reduce((n, c) => n + c.value, 0);
              return (
                <div key={gr.id} className="cgroup">
                  <h4>
                    <Icon name={gr.icon} size={16} />
                    <span>{gr.label}</span>
                    <b className={total < 0 ? 'neg' : 'pos'}>{signedPoints(total)}</b>
                  </h4>
                  <ul>
                    {rows.map((c, i) => (
                      <li key={i} className={c.value < 0 ? 'neg' : 'pos'}>
                        <b>{signedPoints(c.value)}</b>
                        <span>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          </Disclosure>
          {v.uncertainty.length > 0 && (
            <>
              <SubHead icon="question" tone="amber">Still unknown</SubHead>
              <ul className="bullets">
                {v.uncertainty.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </>
          )}
          {v.details.length > 0 && (
            <>
              <SubHead icon="info">Details</SubHead>
              <ul className="bullets">
                {v.details.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

const BAND_MARK: Record<string, string> = { band_rookie: 'Rookie service', band_developing: 'Developing', band_seasoned: 'Seasoned', band_veteran: 'Veteran' };
/** A lead mark as a chip label: a trait's name, or the experience band. */
export function leadMarkLabel(mark: string): string {
  return TRAIT_INFO[mark as keyof typeof TRAIT_INFO]?.label ?? BAND_MARK[mark] ?? mark.replace(/_/g, ' ');
}

/** Who leads, among those taking part: one tap on a face swaps the lead, and the odds, the strain
 * and the results that read the lead follow. The engine's best fit leads until the player picks. */
export function LeadPicker({ view, officers, lead, bestFit, order, marks, blend = [], certs = [], onPick }: { view: ActionView; officers: Readonly<Record<Id, Officer>>; lead: Id | null; bestFit: Id | null;
  order?: readonly Id[]; marks: readonly string[]; blend?: readonly RatingKey[]; certs?: readonly CertId[]; onPick?: (id: Id) => void }) {
  // The faces keep the engine's order, so the one tapped doesn't jump to the front.
  const taking = view.officerIds.filter((id) => officers[id]);
  const ids = [...(order ?? []).filter((id) => taking.includes(id)), ...taking.filter((id) => !order?.includes(id))];
  const leader = lead ? officers[lead] : undefined;
  if (!ids.length || !leader) return null;
  const key = view.keyRating;
  const keyLabel = key ? RATING_META.find((meta) => meta.key === key)?.label ?? key : null;
  const reads = view.leadReads ?? [];
  return <section className="lead-picker" aria-label="Who leads">
    {/* The best fit is the engine's order: a needed certificate first, then the blend, worn down by stress. */}
    <span className="picker-label"><Icon name="flag" size={16} />Who leads{blend.length ? <small> · {blend.map((r) => RATING_SHORT[r]).join(' + ')}</small> : keyLabel ? <small> · {keyLabel}</small> : null}</span>
    {ids.length > 1 && onPick && <div className="lead-choices" role="radiogroup" aria-label="Who leads">
      {ids.map((id) => {
        const officer = officers[id];
        const on = id === lead;
        const band = stressBand(officer.stress);
        const rating = key ? Math.round(officer.ratings[key]) : null;
        return <button key={id} type="button" role="radio" aria-checked={on} className={`lead-choice${on ? ' lead-choice-on' : ''}`} onClick={() => onPick(id)}
          aria-label={`${officer.firstName} ${officer.surname}${rating !== null ? `, ${keyLabel} ${rating}` : ''}, ${STRESS_LABEL[band].toLowerCase()}${id === bestFit ? ', best fit' : ''}`}>
          <LeadFace officer={officer} size={40} />
          <span className="lead-choice-name">{officer.surname}</span>
          {rating !== null && key && <span className="lead-choice-rating">{RATING_SHORT[key]} <b>{rating}</b></span>}
          {certs.filter((cert) => officer.certs.includes(cert)).slice(0, 1).map((cert) => <span key={cert} className="lead-choice-cert">{CERT_NAME[cert]}</span>)}
          <span className={`lead-choice-stress stress-${band}`}>Stress {whole(officer.stress)}</span>
          {id === bestFit && <span className="lead-choice-fit">Best fit</span>}
        </button>;
      })}
    </div>}
    <p className="lead-strain"><Icon name="warning" size={16} /><span><b>{leader.surname}</b> leads: carries more strain.</span></p>
    {reads.length > 0 && <div className="lead-reads">
      <p>Results here turn on who leads.</p>
      <div className="chips">{reads.map((mark) => {
        const has = marks.includes(mark);
        return <Chip key={mark} tone={has ? 'mint' : 'neutral'} icon={has ? 'check' : 'x'} title={has ? `${leader.surname} brings this` : `${leader.surname} does not`}>{leadMarkLabel(mark)}</Chip>;
      })}</div>
    </div>}
  </section>;
}

/** Role choices precede costs/forecasts so the displayed commitment is easy to change. */
/** 'Qualified medic + trauma supplies' reads as chips; a single phrase stays one chip. */
function requirementParts(line: string): string[] {
  const parts = line.split(/\s\+\s/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)) : [line];
}

export function ActionSquadAssignment(p: ActionSheetProps & { view: ActionView }) {
  const maxActing = p.maxActing ?? 1;
  const remaining = p.squads.filter(squad => !p.acting.includes(squad.id) && !p.support.includes(squad.id));
  return <section className="pickers action-squad-assignment" aria-label="Squads for this decision">
    <div className="picker">
      <span className="picker-label"><Icon name="people" size={16} />Squad{maxActing > 1 ? 's' : ''} taking action</span>
      <p className="operation-squad-hint">{maxActing === 1 ? 'Choose one squad. Selecting another replaces the current squad.' : `Choose up to ${maxActing} squads to act together.`}</p>
      <div className="assignment-choices" role="group" aria-label="Acting squads">
        {p.squads.map(squad => {
          const selected = p.acting.includes(squad.id);
          const unavailable = p.unavailableActors?.includes(squad.id);
          const full = maxActing > 1 && p.acting.length >= maxActing;
          return <button key={squad.id} type="button" className={`pill assignment-choice${selected ? ' pill-on' : ''}`} aria-pressed={selected}
            disabled={!selected && (unavailable || full)} onClick={() => p.onToggleActing(squad.id)}>
            <strong><span className="squad-badge" aria-hidden="true">{squad.id}</span>{squad.name}{selected ? ' acts' : ''}</strong>
            {p.squadPositions?.[squad.id] && <small>At {p.squadPositions[squad.id]}</small>}
            {unavailable && <small>All officers out of action</small>}
          </button>;
        })}
      </div>
    </div>
    {!!p.view.support?.maxSquads && <div className="picker">
      <span className="picker-label"><Icon name="handover" size={16} />Supporting squad ({p.view.support.minSquads > 0 ? `${p.view.support.minSquads} required` : 'optional'})</span>
      {p.supportTask && <p className="operation-squad-hint">Support role: {p.supportTask}. Up to {p.view.support.maxSquads} squad{p.view.support.maxSquads === 1 ? '' : 's'}.</p>}
      <div className="assignment-choices" role="group" aria-label="Supporting squads">
        {p.squads.filter(squad => !p.acting.includes(squad.id)).map(squad => {
          const selected = p.support.includes(squad.id);
          const unavailable = p.unavailableSupport?.includes(squad.id);
          return <button key={squad.id} type="button" className={`pill assignment-choice${selected ? ' pill-on' : ''}`} aria-pressed={selected}
            disabled={!selected && (unavailable || p.support.length >= p.view.support!.maxSquads)} onClick={() => p.onToggleSupport(squad.id)}>
            <strong><span className="squad-badge" aria-hidden="true">{squad.id}</span>{squad.name}{selected ? ' supports' : ''}</strong>
            {p.squadPositions?.[squad.id] && <small>At {p.squadPositions[squad.id]}</small>}
            {unavailable && <small>All officers out of action</small>}
          </button>;
        })}
        {p.squads.every(squad => p.acting.includes(squad.id)) && <span className="dim">No other squad to support.</span>}
      </div>
    </div>}
    {p.participantNames && <p className="operation-squad-participants"><strong>Acting officers:</strong> {p.participantNames.length ? p.participantNames.join(', ') : 'No field participants'}</p>}
    {remaining.length > 0 && <p className="operation-squad-hint">{remaining.map(squad => `${squad.name} stays${p.squadPositions?.[squad.id] ? ` at ${p.squadPositions[squad.id]}` : ' in position'}`).join('. ')}. All deployed squads still face time and strain.</p>}
  </section>;
}

// ---------------------------------------------------------------- room sheet

export interface RoomSheetProps {
  open: boolean;
  onClose: () => void;
  space: SpaceView | null;
  built: BuiltLocation;
  squads: Squad[];
  actions: ActionView[];
  onPickAction: (id: Id) => void;
}

export function RoomSheet(p: RoomSheetProps) {
  const s = p.space;
  const d = s ? p.built.derived.spaces[s.id] : undefined;
  const loc = p.built.location;
  const type = s ? (loc.rooms.find((r) => r.id === s.id)?.type ?? loc.zones.find((z) => z.id === s.id)?.kind) : undefined;
  const construction = s ? describeConstruction(p.built, s.id) : [];
  const facts = s?.facts ?? [];
  const people = (s?.people ?? []).filter((person) => person.status !== 'unknown');
  // Verify actions are listed under their fact, so the plain action list leaves them out.
  const inFacts = new Set(facts.flatMap((f) => f.verifyActions.map((v) => v.actionId)));
  const targeting = s ? p.actions.filter((a) => (s.actionIds.includes(a.id) || a.targetId === s.id) && !inFacts.has(a.id)) : [];
  const nothing = facts.length === 0 && targeting.length === 0;
  return (
    <Sheet
      open={p.open && !!s}
      onClose={p.onClose}
      modal={false}
      maxHeight="short"
      title={s?.label ?? ''}
      subtitle={
        s ? (
          <span className="chips">
            {type && (
              <Chip icon={roomIcon(type)}>{ROOM_TYPE_LABEL[type] ?? type}</Chip>
            )}
            {floorCount(loc) > 1 && <Chip icon="layers">{floorName(d?.floor ?? loc.rooms.find((r) => r.id === s.id)?.floor ?? 0)}</Chip>}
            <FactStatusChip status={s.status} />
          </span>
        ) : undefined
      }
    >
      {s && (
        <div className="adetail">
          {s.marker && (
            <p className={`note ${s.marker.tone === 'mint' ? 'note-mint' : 'note-amber'}`}>
              <Icon name={s.marker.tone === 'mint' ? 'check' : 'question'} size={16} />
              <span>
                <b>{s.marker.text}</b>
                {s.marker.subtext ? ` ${s.marker.subtext}` : ''}
              </span>
            </p>
          )}

          {facts.length > 0 && (
            <>
              <SubHead icon="intel">What we know</SubHead>
              <ul className="factlist">
                {facts.map((f) => (
                  <FactCard key={f.id} f={f} actions={p.actions} onPick={p.onPickAction} />
                ))}
              </ul>
            </>
          )}

          {people.length > 0 && (
            <>
              <SubHead icon="user">People</SubHead>
              <ul className="peoplelist">
                {people.map((m) => (
                  <PersonRow key={m.id} m={m} />
                ))}
              </ul>
            </>
          )}

          {construction.length > 0 && (
            <>
              <SubHead icon="layers">Construction</SubHead>
              <ul className="construction">
                {construction.map((line, i) => (
                  <li key={i}>
                    <Icon name={materialIcon(line)} size={20} />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {d && (
            <ul className="facts">
              <li>
                <span>Floor area</span>
                <b>{sqft(d.area)}</b>
              </li>
              <li>
                <span>Usable space</span>
                <b>{sqft(d.usableArea)}</b>
              </li>
              <li>
                <span>Useful at once</span>
                <b>{d.capacity} {d.capacity === 1 ? 'person' : 'people'}</b>
              </li>
              <li>
                <span>Size</span>
                <b>
                  {feetInches(d.bbox.w)} × {feetInches(d.bbox.h)}
                </b>
              </li>
            </ul>
          )}

          <SubHead icon="people">Squads here</SubHead>
          {s.squadsHere.length === 0 ? (
            <p className="dim">No squad is stationed here.</p>
          ) : (
            <div className="chips">
              {s.squadsHere.map((id) => (
                <Chip key={id} tone="blue" icon="people">
                  {squadName(p.squads, id)}
                </Chip>
              ))}
            </div>
          )}

          {(targeting.length > 0 || nothing) && <SubHead icon="flag">Actions here</SubHead>}
          {nothing && <p className="dim">Nothing you can do here at this stage.</p>}
          {targeting.length > 0 && (
            <ul className="roomactions">
              {targeting.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => p.onPickAction(a.id)}>
                    <Icon name={actionIcon(a.icon)} size={24} />
                    <span>
                      <strong>{a.title}</strong>
                      <span className="dim">{a.eligible ? a.summary : (a.reason ?? 'Unavailable')}</span>
                    </span>
                    <Icon name="chevronRight" size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function floorName(f: number): string {
  return f <= 0 ? 'Ground floor' : 'Upper floor';
}

const KIND_META: Record<string, { icon: IconName; word: string }> = {
  subject: { icon: 'user', word: 'Subject' },
  civilian: { icon: 'civilian', word: 'Civilian' },
  child: { icon: 'child', word: 'Child' },
  patient: { icon: 'medic', word: 'Patient' },
  dog: { icon: 'paw', word: 'Dog' },
  unknown: { icon: 'question', word: 'Unknown person' },
};

/**
 * One person on the map, only as far as the player knows. Armament is shown as a report or a confirmation,
 * never as truth; a subject with no armament information says so rather than implying unarmed.
 */
export function PersonRow({ m }: { m: SpaceView['people'][number] }) {
  const meta = KIND_META[m.kind ?? 'unknown'] ?? KIND_META.unknown;
  const confirmed = m.status === 'confirmed';
  if (m.status === 'unknown') return null;
  if (m.status === 'disproved') return <li className="person"><strong>{m.label || 'Person report'}</strong><p>Report ruled out</p></li>;
  const hasWeapon = m.carried?.some((item) => item.glyph === 'weapon');
  const armed = hasWeapon || m.armament === 'unknown' ? null : m.armament ?? null;
  const isSubject = m.kind === 'subject' || m.kind === 'unknown' || m.kind === undefined;
  return (
    <li className="person">
      <div className="person-top">
        <Icon name={meta.icon === 'question' ? 'user' : meta.icon} size={16} />
        <strong>{m.label}</strong>
        <FactStatusChip status={m.status} />
        <span className="dim">{confirmed ? 'Position confirmed' : 'Approximate position'}</span>
      </div>
      {m.condition && <p className={`person-condition person-condition-${m.condition}`}><Icon name={m.condition === 'deceased' ? 'x' : 'bandage'} size={16} />{m.condition === 'deceased' ? 'Deceased' : 'Injured'}</p>}
      {armed ? (
        <p className={`person-arm${armed === 'none' ? ' person-arm-ok' : ''}`}>
          <Icon name={armed === 'none' ? 'checkcircle' : 'warning'} size={16} />
          <span>
            {armamentLabel(armed)} <span className="dim">({confirmed ? 'confirmed' : 'reported, unverified'})</span>
          </span>
        </p>
      ) : (
        isSubject && !hasWeapon && (
          <p className="person-arm person-arm-unk">
            <Icon name="question" size={16} />
            <span>Armament not known</span>
          </p>
        )
      )}
      {(m.carried?.length ?? 0) > 0 && <ul className="person-carried" aria-label={`Items with ${m.label || 'this person'}`}>{m.carried!.map((item) => <li key={item.id}><strong>{item.label}</strong><span>{item.status === 'confirmed' ? 'Confirmed item' : 'Reported item · unverified'}</span></li>)}</ul>}
    </li>
  );
}

/** One scenario fact: what the player was told, who said it, why it matters, and what could settle it. */
function FactCard({ f, actions, onPick }: { f: FactView; actions: ActionView[]; onPick: (id: Id) => void }) {
  const settled = f.status === 'confirmed' || f.status === 'disproved';
  const sourceLead = f.status === 'reported' ? 'Reported by' : 'Source';
  return (
    <li className={`fact fact-${f.status}`}>
      <div className="fact-top">
        <Icon name={f.status === 'confirmed' ? 'check' : f.status === 'disproved' ? 'x' : 'question'} size={20} />
        <strong>{f.label}</strong>
        <FactStatusChip status={f.status} />
      </div>
      <p className="fact-claim">{f.claim}</p>
      {f.source && (
        <p className="fact-line">
          <Icon name="chat" size={16} />
          <span>
            {sourceLead}: {f.source}
          </span>
        </p>
      )}
      {f.note && (
        <p className="fact-line">
          <Icon name="info" size={16} />
          <span>{f.note}</span>
        </p>
      )}
      {!settled && f.verifyActions.length > 0 && (
        <div className="fact-verify">
          <span className="fact-verify-h">
            <Icon name="search" size={16} />
            Can be settled by
          </span>
          <ul>
            {f.verifyActions.map((v) => {
              const live = actions.find((a) => a.id === v.actionId);
              const icon: IconName = live ? actionIcon(live.icon) : 'search';
              const body = (
                <>
                  <Icon name={icon} size={20} />
                  <span className="vtitle">{v.title}</span>
                  <Chip tone={v.availableNow ? 'amber' : 'neutral'} icon="flag">
                    {STAGE_LABEL[v.stage]}
                  </Chip>
                  <span className={`vwhen${v.availableNow ? ' vwhen-now' : ''}`}>{v.availableNow ? 'available now' : `from ${STAGE_LABEL[v.stage]}`}</span>
                  {v.availableNow && <Icon name="chevronRight" size={16} />}
                </>
              );
              return (
                <li key={v.actionId}>
                  {v.availableNow ? (
                    <button type="button" className="vbtn" onClick={() => onPick(v.actionId)}>
                      {body}
                    </button>
                  ) : (
                    <div className="vbtn vbtn-later">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

export const BAND_LABEL: Record<OutcomeBand, string> = { favorable: 'Favorable', mixed: 'Mixed', adverse: 'Adverse' };
