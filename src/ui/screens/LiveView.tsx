import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ActionView,
  BuiltLocation,
  Contributor,
  FactView,
  GameState,
  Id,
  Officer,
  OutcomeBand,
  SpaceView,
  Squad,
  SquadId,
  SquadTask,
  StageId,
  StageContinuationView,
} from '../../sim/types';
import type { StageProgress } from '../../sim/operation-selectors';
import type { EnvironmentDefinition } from '../../sim/scenario-types';
import type { ActionResupplyPlan } from '../../sim/equipment-resupply';
import { Blueprint } from '../blueprint/Blueprint';
import { RoomList } from '../blueprint/RoomList';
import { floorCount } from '../blueprint/floors';
import { OfficerCard } from '../components/OfficerCard';
import { Sheet } from '../components/Sheet';
import { Button, Chip, SubHead } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { armamentLabel } from '../components/incident';
import { ROLE_META, ROOM_TYPE_LABEL, STAGE_LABEL } from '../components/labels';
import { highRiskAllowed } from '../../sim/officer';
import { incidentOfficerUnavailable } from '../../sim/incident-consequences';
import { describeConstruction } from '../../sim/spatial';
import { Icon, actionIcon, materialIcon, roomIcon } from '../icons';
import type { IconName } from '../icons';
import { feetInches, opMinutes, signed, sqft } from '../format';
import { CONSEQUENCE_LABEL, OddsBar, OutcomeForecast } from './OperationFeedback';
import { outcomePercentages, visibleDecisions } from './liveModels';
import './operation-squads.css';
import './ops-visual.css';

// Presentational live-operation screen. OpsLive.tsx feeds it from the selectors.

export interface LiveViewProps {
  g: GameState;
  now: number;
  title: string;
  /** e.g. 'RESIDENTIAL / OP 0141' */
  subtitle: string;
  progress: StageProgress;
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
  continuations?: StageContinuationView[];
  onContinueStage?: (actionId: Id) => void;
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
  onOpenDetails: () => void;
  detailsOpen: boolean;
  feedback?: ReactNode;
  /** Named external services stay beside the next decision, separate from squad support. */
  supportContext?: ReactNode;
  /** The call's summary and briefing, kept in view under the title for the whole operation. */
  situation?: ReactNode;
  /** One line naming the last result, kept just above the next decision; the full record sits below it. */
  lastDecision?: ReactNode;
  /** A response that can no longer progress is handled outside ordinary story choices. */
  failedResponse?: ReactNode;
  /** Overlay sheets (action detail, room sheet, cancel confirm) rendered by the container. */
  children?: ReactNode;
}

export function LiveView(p: LiveViewProps) {
  const focus = p.deployedSquads.find((s) => s.id === p.focusSquadId) ?? p.deployedSquads[0] ?? null;
  const sel = p.selectedAction;
  const multi = p.deployedSquads.length > 1;
  const [materials, setMaterials] = useState(false);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const expanded = expandedStage === p.progress.stage;
  const available = p.actions.map((action) => action.id === sel?.id ? sel : action);
  const decisions = visibleDecisions(available, sel?.id ?? null, expanded);
  // Renderer props that may not be declared yet (floor tabs, environment overlay). Spread so this compiles either way.
  const blueprintExtras = { floor: p.floor, onFloorChange: p.onFloorChange, environment: p.environment ?? undefined };

  return (
    <div className="live">
      <div className="live-title">
        <div className="live-id">
          <h2 className="live-name">{p.title}</h2>
          <p className="live-sub">
            <span className="live-flag">
              <i className="live-dot-amber" aria-hidden="true" />
              LIVE
            </span>
            <span>{p.subtitle}</span>
            {p.canCancel && (
              <button type="button" className="linkbtn live-cancel" onClick={p.onCancel} aria-label="Cancel operation">
                Cancel
              </button>
            )}
          </p>
        </div>
        <StageSteps progress={p.progress} />
      </div>

      {p.situation}

      <div className="live-map">
        <div className="map-hud map-status" aria-label="Operation time and pressure">
          <span className="hud-pill">
            <Icon name="clock" size={14} />
            {opMinutes(p.clock)}
          </span>
          <span className="hud-pill" title="Situation pressure">
            <span className="pmeter" role="img" aria-label={`Pressure ${Math.round(p.pressure)} of 100`}>
              <i style={{ width: `${Math.max(4, Math.min(100, p.pressure))}%` }} />
            </span>
            <span>{pressureWord(p.pressure)}</span>
          </span>
        </div>
        <div className="live-map-inner">
          {p.showRooms ? (
            <RoomList built={p.built} spaces={p.spaces} selectedSpaceId={p.selectedSpaceId} onSelectSpace={p.onSelectSpace} />
          ) : (
            <Blueprint
              built={p.built}
              spaces={p.spaces}
              squadTasks={p.squadTasks}
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
        <div className="map-hud map-actions" role="group" aria-label="Map display">
          {/* The map labels reported people in place, so the key is on demand instead of a permanent row. */}
          <details className="map-key">
            <summary className="hud-btn hud-btn-quiet" aria-label="Map key and inspection help"><Icon name="info" size={16} />Key</summary>
            <div className="map-key-body" aria-label="Map legend">
              <span className="map-key-items">
                <span><Icon name="user" size={18} className="lg-q legend-reported-person" />Reported</span>
                <span><Icon name="user" size={18} className="lg-ok" />Confirmed</span>
              </span>
              <p>Dashed amber people are reports at approximate positions. Mint people have a confirmed position. Small item symbols stay beside their holder; amber items are still reported, even when the person is confirmed. An absent weapon symbol does not mean unarmed. Tap a room or use Rooms to inspect names, conditions and items.</p>
            </div>
          </details>
          {!p.showRooms && (
            <button type="button" className="hud-btn" onClick={() => setMaterials((v) => !v)} aria-pressed={materials}>
              <Icon name="layers" size={16} />
              Materials
            </button>
          )}
          <button type="button" className="hud-btn" onClick={p.onToggleRooms} aria-pressed={p.showRooms}>
            <Icon name={p.showRooms ? 'blueprint' : 'list'} size={16} />
            {p.showRooms ? 'Map' : 'Rooms'}
          </button>
        </div>
      </div>

      {multi && (
        <div className="live-squad-rail operation-squad-focus">
          <p className="picker-label">Squad for next decision</p>
          <ChoiceRail value={focus?.id ?? p.deployedSquads[0].id} kind="tabs" label="Squad for next decision" panelId="deployed-officer-strip" onChange={p.onFocusSquad} options={p.deployedSquads.map((s) => {
            // In the field, readiness means members still fit for high-risk work (not deploy eligibility).
            const fit = s.officerIds.filter((id) => p.g.officers[id] && highRiskAllowed(p.g.officers[id]) && (!p.g.activeRun || !incidentOfficerUnavailable(p.g, p.g.activeRun, id))).length;
            const task = p.squadTasks.find(task => task.squadId === s.id);
            const location = p.spaces.find(space => space.id === task?.positionId)?.label ?? task?.positionId;
            const unavailable = p.unavailableSquadIds?.includes(s.id) && s.id !== focus?.id;
            return { value: s.id, disabled: unavailable, accessibleLabel: `Squad ${s.id}, ${s.name}, ${fit} of ${s.officerIds.length} fit${location ? `, at ${location}` : ''}${unavailable ? ', unavailable for this decision' : ''}`,
              label: <><b>{s.id}</b><span className="squad-tab-detail"><span className="squad-tab-name">{s.name}</span>{location && <small>{location}</small>}</span><span className="choice-rail-count">{fit}/{s.officerIds.length} fit</span></> };
          })} />
          <p className="operation-squad-hint">{sel ? `Reviewing with ${sel.actingSquadIds.map(id => `Squad ${id}`).join(' + ')}. Switching here changes who acts.` : 'Choose who acts, then review a decision. Pick support in the review.'}</p>
        </div>
      )}

      <div className="strip" id="deployed-officer-strip" role={multi ? 'tabpanel' : undefined} aria-label={focus ? `${focus.name} officers` : 'Officers'}>
        {p.officers.map((o) => {
          const casualty = p.g.activeRun?.officerCasualties?.[o.id];
          const acting = !casualty && (sel?.officerIds.includes(o.id) ?? false);
          const active = p.activeOfficerId === o.id;
          const cap = !casualty && active && sel ? capabilityFor(sel, o) : null;
          return (
            <OfficerCard
              key={o.id}
              officer={o}
              now={p.now}
              incidentInjury={casualty?.label}
              note={casualty ? 'Out of action' : undefined}
              selected={active}
              onClick={() => p.onSelectOfficer(o.id)}
              leader={focus?.leaderId === o.id}
              chip={
                cap ? (
                  <span className={`capchip${cap.value < 0 ? ' capchip-neg' : ''}`}>
                    {cap.text}
                  </span>
                ) : acting ? (
                  <span className="capchip capchip-quiet">Taking part</span>
                ) : undefined
              }
            />
          );
        })}
        {p.officers.length === 0 && <p className="strip-empty">No officers in this squad.</p>}
      </div>

      {p.lastDecision}

      <div className="call operation-choices" aria-label="Your call">
        <div className="call-head">
          <span className="call-label">YOUR NEXT DECISION</span>
          {sel && (
            <button type="button" className="call-details" onClick={p.onOpenDetails} aria-expanded={p.detailsOpen}>
              Review decision
              <Icon name="chevronDown" size={14} />
            </button>
          )}
        </div>
        {p.progress.prompt && <p className="operation-stage-prompt">{p.progress.prompt}</p>}
        {p.actions.length > 0 && <p className="operation-choice-count">{available.filter((action) => action.eligible).length} available{available.some((action) => !action.eligible) ? ` · ${available.filter((action) => !action.eligible).length} unavailable` : ''}. Tap one to review costs and odds.</p>}
        {p.actions.length === 0 ? (
          <p className="call-empty">No decisions available right now.</p>
        ) : (
          <div className="call-grid">
            {decisions.map((a, index) => {
              const on = sel?.id === a.id;
              // Available choices lead as full cards; unavailable ones follow as slim rows that stay reviewable.
              const firstLocked = !a.eligible && (index === 0 || decisions[index - 1].eligible);
              return (
                <Fragment key={a.id}>
                {firstLocked && <p className="call-locked-label"><Icon name="lock" size={13} />Unavailable now</p>}
                <button
                  type="button"
                  className={`callbtn${on ? ' callbtn-on' : ''}${a.eligible ? '' : ' callbtn-off'}`}
                  aria-pressed={on}
                  aria-label={`Review ${a.title}${a.eligible ? '' : ': requirements unmet'}`}
                  onClick={() => p.onSelectAction(a.id)}
                >
                  <Icon name={a.eligible ? actionIcon(a.icon) : 'lock'} size={!a.eligible ? 16 : p.actions.length > 2 ? 24 : 30} className="callbtn-icon" />
                  <span className="callbtn-text">
                    <span className="callbtn-title">{a.title}</span>
                    <span className="callbtn-sum">
                      {!a.eligible && a.reason ? (
                        <>
                          <Icon name="lock" size={11} /> {a.reason}
                        </>
                      ) : (
                        a.summary
                      )}
                    </span>
                    {a.eligible && a.authority?.allowed && <span className="callbtn-command"><Icon name="radio" size={12} />{a.authority.reason}</span>}
                    {a.eligible && <span className="callbtn-forecast">
                      {!a.eventResult && <OddsBar likelihood={a.likelihood} mini />}
                      <span className="callbtn-forecast-text">{a.timeLabel ?? `~${opMinutes(a.timeCost)}`} · {!a.eventResult ? `${outcomePercentages(a.likelihood).favorable}% chance to go well · ` : ''}<span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>possible harm: {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span></span>
                    </span>}
                  </span>
                </button>
                </Fragment>
              );
            })}
          </div>
        )}
        {p.actions.length > 5 && <Button block className="operation-more-choices" onClick={() => setExpandedStage(expanded ? null : p.progress.stage)} aria-expanded={expanded}>{expanded ? 'Show fewer choices' : `Show all ${p.actions.length} choices`}</Button>}
      </div>
      {!!p.continuations?.length && p.onContinueStage && <section className="call operation-continuations" aria-label="Next stage">
        {p.continuations.map((continuation) => <div key={continuation.actionId}>
          <p className="dim">{continuation.description}</p>
          <Button variant="ghost" block onClick={() => p.onContinueStage?.(continuation.actionId)}>{continuation.label}</Button>
        </div>)}
      </section>}
      {p.failedResponse}
      {p.feedback}
      {p.supportContext}
      {p.actions.length > 0 && <DecisionDock available={available.filter((action) => action.eligible).length} />}
      {p.children}
    </div>
  );
}

/** A floating shortcut back to the decisions, shown only while they sit below the visible area. */
function DecisionDock({ available }: { available: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const dock = ref.current;
    const target = dock?.closest('.live')?.querySelector('.operation-choices');
    if (!dock || !target || typeof IntersectionObserver === 'undefined') return;
    const root = dock.closest('.screen');
    const observer = new IntersectionObserver(([entry]) => {
      const bottom = entry.rootBounds?.bottom ?? window.innerHeight;
      setBelow(!entry.isIntersecting && entry.boundingClientRect.top >= bottom - 1);
    }, { root, threshold: 0, rootMargin: '0px 0px -40px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);
  const go = () => {
    const target = ref.current?.closest('.live')?.querySelector<HTMLElement>('.operation-choices');
    target?.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    target?.querySelector<HTMLElement>('.callbtn')?.focus({ preventScroll: true });
  };
  return <div ref={ref} className={`decision-dock${below ? ' decision-dock-on' : ''}`} aria-hidden={!below}>
    <button type="button" className="decision-dock-btn" tabIndex={below ? 0 : -1} onClick={go}>
      <Icon name="chevronDown" size={16} />
      Next decision{available > 0 ? <b>{available}</b> : null}
    </button>
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
            <span className="step-dot">{s.state === 'done' && <Icon name="check" size={9} strokeWidth={3.2} />}</span>
          </span>
          <span className="step-label">{s.label.toUpperCase()}</span>
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

export function StatusChip({ status }: { status: SpaceView['status'] }) {
  switch (status) {
    case 'confirmed':
      return (
        <Chip tone="mint" icon="check">
          Confirmed
        </Chip>
      );
    case 'unknown':
      return (
        <Chip tone="amber" icon="question">
          Unknown
        </Chip>
      );
    case 'reported':
      return (
        <Chip tone="amber" icon="question">
          Reported
        </Chip>
      );
    case 'disproved':
      return (
        <Chip tone="danger" icon="x">
          Disproved
        </Chip>
      );
    default:
      return <Chip>Not tracked</Chip>;
  }
}

// ---------------------------------------------------------------- action detail sheet

/** One group per contributor source, in the order a player reads them: who, what they carry, where, then the situation. */
const GROUPS: { source: Contributor['source']; label: string; icon: IconName }[] = [
  { source: 'rating', label: 'Officer ratings', icon: 'gauge' },
  { source: 'condition', label: 'Officer condition', icon: 'pulse' },
  { source: 'trait', label: 'Traits', icon: 'star' },
  { source: 'equipment', label: 'Equipment', icon: 'wrench' },
  { source: 'space', label: 'Space and position', icon: 'blueprint' },
  { source: 'support', label: 'Support', icon: 'handover' },
  { source: 'preparation', label: 'Preparation', icon: 'list' },
  { source: 'familiarity', label: 'Familiarity', icon: 'book' },
  { source: 'pressure', label: 'Pressure', icon: 'flame' },
  { source: 'difficulty', label: 'Difficulty', icon: 'mountain' },
];

export interface ActionSheetProps {
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
}

export function ActionSheet(p: ActionSheetProps) {
  const v = p.view;
  const availableAlternative = p.all.find((action) => action.id !== v?.id && action.eligible);
  const names = (ids: SquadId[]) => ids.map((id) => p.squads.find((s) => s.id === id)?.name ?? id);
  const squadText = p.acting.length === 0 ? 'No squad' : p.acting.length === 1 ? `Squad ${p.acting[0]}` : `Squads ${p.acting.join(' + ')}`;
  const supportingText = p.support.length ? ` · Support: ${p.support.join(' + ')}` : '';
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
      subtitle={v ? <span className="action-sheet-glance">
        {v.eligible && !v.eventResult ? <OddsBar likelihood={v.likelihood} /> : <span className="action-sheet-locked"><Icon name={v.eligible ? 'flag' : 'lock'} size={13} />{v.eligible ? 'Set event' : 'Requirements unmet'}</span>}
        <span className={`consequence-level consequence-${v.consequenceLevel}`}>Harm {CONSEQUENCE_LABEL[v.consequenceLevel].toLowerCase()}</span>
      </span> : undefined}
      footer={
        v && (
          <div className="operation-commit">
            <p className="operation-commit-meta">Acting: {squadText}{supportingText} · Est. {v.timeLabel ?? opMinutes(v.timeCost)}{v.suppliesRequired.length ? ` · ${v.suppliesRequired.reduce((total, item) => total + item.qty, 0)} supplies` : ' · No supplies'}</p>
            <Button variant="primary" block disabled={!v.eligible || p.acting.length === 0} onClick={p.onConfirm}>
              Confirm: {v.title}
            </Button>
          </div>
        )
      }
    >
      {v && (
        <div className="adetail">
          {p.onBackToSupport && <Button variant="ghost" onClick={p.onBackToSupport}>Back to care &amp; support</Button>}
          {p.squads.length > 1 && <ActionSquadAssignment {...p} view={v} />}
          {v.summary !== v.outcomePreview.favorable && <p className="operation-action-summary">{v.summary}</p>}
          {v.eligible && v.authority?.allowed && <p className="operation-command-line"><Icon name="radio" size={14} />{v.authority.reason}</p>}
          <div className="chips action-glance">
            <Chip icon="clock">Estimated time: {v.timeLabel ?? opMinutes(v.timeCost)}</Chip>
            {p.targetLabel && <Chip icon="pin">{p.targetLabel}</Chip>}
            {names(p.support).length > 0 && <Chip tone="blue" icon="handover">Support: {names(p.support).join(', ')}</Chip>}
          </div>
          {v.timeRange && !v.timeLabel && <p className="operation-note operation-time-range">{v.timeRange.min === v.timeRange.max ? `${opMinutes(v.timeRange.min)} for any outcome.` : `${v.timeRange.min}–${opMinutes(v.timeRange.max)} depending on the result.`}</p>}
          <OutcomeForecast action={v} />
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
                        {p.resupply.items.map((item) => <li key={item.unitId}>Squad {item.squadId}: {item.name} · {item.serial}</li>)}
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
                    {p.alternatives.map((candidate) => <Button key={candidate.actingSquadIds.join('-')} onClick={() => p.onUseAlternative?.(candidate)}>Use Squad {candidate.actingSquadIds.join(' + ')} · {names(candidate.actingSquadIds).join(' + ')}</Button>)}
                  </div>
                </>
              )}
            </section>
          )}
          {!v.eligible && availableAlternative && <div className="action-resolution-actions"><Button onClick={() => p.onPick(availableAlternative.id)}>Available now: {availableAlternative.title}</Button></div>}
          {!!p.resupplyMinutes && <p className="dim adetail-note">Stores deliveries: {p.resupplyMinutes} operation minutes. Equipment is reserved for this run.</p>}
          {p.all.length > 1 && <details className="operation-switcher"><summary>Compare another decision ({p.all.length})</summary>
            <div className="switcher" role="group" aria-label="Decisions">
              {p.all.map((a) => (
                <button key={a.id} type="button" className={`pill${a.id === v.id ? ' pill-on' : ''}`} aria-pressed={a.id === v.id} onClick={() => p.onPick(a.id)}>
                  {a.title}
                </button>
              ))}
            </div>
          </details>}
          <details className="operation-contributors">
          <summary>Why these odds · officer, equipment and situation factors</summary>
          {v.contributors.length === 0 ? (
            <p className="dim">No contributors listed.</p>
          ) : (
            GROUPS.map((gr) => {
              const rows = v.contributors.filter((c) => c.source === gr.source);
              if (rows.length === 0) return null;
              const total = rows.reduce((n, c) => n + c.value, 0);
              return (
                <div key={gr.source} className="cgroup">
                  <h4>
                    <Icon name={gr.icon} size={15} />
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
          </details>
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
      <span className="picker-label"><Icon name="people" size={14} />Squad{maxActing > 1 ? 's' : ''} taking action</span>
      <p className="operation-squad-hint">{maxActing === 1 ? 'Choose one squad. Selecting another replaces the current squad.' : `Choose up to ${maxActing} squads to act together.`}</p>
      <div className="assignment-choices" role="group" aria-label="Acting squads">
        {p.squads.map(squad => {
          const selected = p.acting.includes(squad.id);
          const unavailable = p.unavailableActors?.includes(squad.id);
          const full = maxActing > 1 && p.acting.length >= maxActing;
          return <button key={squad.id} type="button" className={`pill assignment-choice${selected ? ' pill-on' : ''}`} aria-pressed={selected}
            disabled={!selected && (unavailable || full)} onClick={() => p.onToggleActing(squad.id)}>
            <strong>{squad.id} · {squad.name}{selected ? ' · Acting' : ''}</strong>
            {p.squadPositions?.[squad.id] && <small>At {p.squadPositions[squad.id]}</small>}
            {unavailable && <small>All officers out of action</small>}
          </button>;
        })}
      </div>
    </div>
    {!!p.view.support?.maxSquads && <div className="picker">
      <span className="picker-label"><Icon name="handover" size={14} />Supporting squad ({p.view.support.minSquads > 0 ? `${p.view.support.minSquads} required` : 'optional'})</span>
      {p.supportTask && <p className="operation-squad-hint">Support role: {p.supportTask}. Up to {p.view.support.maxSquads} squad{p.view.support.maxSquads === 1 ? '' : 's'}.</p>}
      <div className="assignment-choices" role="group" aria-label="Supporting squads">
        {p.squads.filter(squad => !p.acting.includes(squad.id)).map(squad => {
          const selected = p.support.includes(squad.id);
          const unavailable = p.unavailableSupport?.includes(squad.id);
          return <button key={squad.id} type="button" className={`pill assignment-choice${selected ? ' pill-on' : ''}`} aria-pressed={selected}
            disabled={!selected && (unavailable || p.support.length >= p.view.support!.maxSquads)} onClick={() => p.onToggleSupport(squad.id)}>
            <strong>{squad.id} · {squad.name}{selected ? ' · Supporting' : ''}</strong>
            {p.squadPositions?.[squad.id] && <small>At {p.squadPositions[squad.id]}</small>}
            {unavailable && <small>All officers out of action</small>}
          </button>;
        })}
        {p.squads.every(squad => p.acting.includes(squad.id)) && <span className="dim">No other squad to support.</span>}
      </div>
    </div>}
    {p.participantNames && <p className="operation-squad-participants"><strong>Acting officers:</strong> {p.participantNames.length ? p.participantNames.join(', ') : 'No field participants'}</p>}
    {remaining.length > 0 && <p className="operation-squad-hint">{remaining.map(squad => `Squad ${squad.id} remains${p.squadPositions?.[squad.id] ? ` at ${p.squadPositions[squad.id]}` : ' in position'}`).join('. ')}. All deployed squads still face time and strain.</p>}
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
            <StatusChip status={s.status} />
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
                    <Icon name={materialIcon(line)} size={18} />
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
                  {id} · {p.squads.find((q) => q.id === id)?.name ?? id}
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
                    <Icon name={actionIcon(a.icon)} size={22} />
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
        <StatusChip status={m.status} />
        <span className="dim">{confirmed ? 'Position confirmed' : 'Approximate position'}</span>
      </div>
      {m.condition && <p className={`person-condition person-condition-${m.condition}`}><Icon name={m.condition === 'deceased' ? 'x' : 'bandage'} size={14} />{m.condition === 'deceased' ? 'Deceased' : 'Injured'}</p>}
      {armed ? (
        <p className={`person-arm${armed === 'none' ? ' person-arm-ok' : ''}`}>
          <Icon name={armed === 'none' ? 'checkcircle' : 'warning'} size={14} />
          <span>
            {armamentLabel(armed)} <span className="dim">({confirmed ? 'confirmed' : 'reported, unverified'})</span>
          </span>
        </p>
      ) : (
        isSubject && !hasWeapon && (
          <p className="person-arm person-arm-unk">
            <Icon name="question" size={14} />
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
        <Icon name={f.status === 'confirmed' ? 'check' : f.status === 'disproved' ? 'x' : 'question'} size={18} />
        <strong>{f.label}</strong>
        <StatusChip status={f.status} />
      </div>
      <p className="fact-claim">{f.claim}</p>
      {f.source && (
        <p className="fact-line">
          <Icon name="chat" size={14} />
          <span>
            {sourceLead}: {f.source}
          </span>
        </p>
      )}
      {f.note && (
        <p className="fact-line">
          <Icon name="info" size={14} />
          <span>{f.note}</span>
        </p>
      )}
      {!settled && f.verifyActions.length > 0 && (
        <div className="fact-verify">
          <span className="fact-verify-h">
            <Icon name="search" size={13} />
            Can be settled by
          </span>
          <ul>
            {f.verifyActions.map((v) => {
              const live = actions.find((a) => a.id === v.actionId);
              const icon: IconName = live ? actionIcon(live.icon) : 'search';
              const body = (
                <>
                  <Icon name={icon} size={18} />
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
