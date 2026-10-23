// The room sheet: the room's painting, who its next step helps (numbers from the sim), the ladder of steps
// and one buy. A locked step teases what it would do and links straight to what it needs.
import { useMemo } from 'react';
import { COURSES } from '../../../content/courses';
import { DEV_NODES } from '../../../content/dev-tree';
import type { NodeOption } from '../../../sim/department-selectors';
import { tierLabel } from '../../../sim/development-tiers';
import type { GameState, Id } from '../../../sim/types';
import { Sheet } from '../../components/Sheet';
import { useNav } from '../../components/nav';
import { Button } from '../../components/ui';
import { Icon } from '../../icons';
import { moneyFull } from '../../format';
import { CostTag, Segments } from '../build-parts';
import { FaceStack } from './RoomCard';
import { NodeGlyph } from './NodeGlyph';
import { nameList, stepHelp, stepQuote, stepState, nodeSummary, type RoomView } from './room-model';
import { RoomArt } from './Station';
import { roomOfBranch, type RoomId } from './rooms';

export interface LadderRow { option: NodeOption; depth: number }

/** A room's steps as one ladder: each step right after what it needs, one level deeper. */
export function ladder(options: readonly NodeOption[]): LadderRow[] {
  const ids = new Set(options.map((o) => o.node.id));
  const parentOf = (o: NodeOption) => o.node.requires.find((id) => ids.has(id)) ?? null;
  const rows: LadderRow[] = [];
  const visit = (o: NodeOption, depth: number) => {
    rows.push({ option: o, depth });
    for (const child of options.filter((x) => parentOf(x) === o.node.id)) visit(child, depth + 1);
  };
  for (const root of options.filter((o) => parentOf(o) === null)) visit(root, 0);
  return rows;
}

/** The step a sheet opens on: the one asked for, else the room's next, else the last one built. */
export function defaultStep(view: RoomView, asked?: Id): NodeOption | undefined {
  return view.options.find((o) => o.node.id === asked) ?? view.next ?? [...view.options].reverse().find((o) => o.currentTier > 0) ?? view.options[0];
}

export function RoomSheet({ game, view, step, now, pending, onSelect, onOpenRoom, onBuy, onClose }: {
  game: GameState;
  view: RoomView;
  step: NodeOption;
  now: number;
  pending: boolean;
  onSelect: (id: Id) => void;
  /** A step needed first lives in another room: open that room instead. */
  onOpenRoom: (room: RoomId, nodeId: Id) => void;
  onBuy: () => void;
  onClose: () => void;
}) {
  const nav = useNav();
  const help = useMemo(() => stepHelp(game, step), [game, step]);
  const quote = stepQuote(step, game.department.funding);
  const state = stepState(step);
  const tiered = step.maxTier > 1;
  const effects = (step.node.tiers?.flatMap((t) => t.effects) ?? step.node.effects);
  const training = effects.some((e) => e.kind === 'unlockCourse' || e.kind === 'trainingSlots');
  const gear = effects.some((e) => ['unlockItem', 'equipmentManager', 'loadoutPresets', 'restockRules'].includes(e.kind));
  const staff = effects.some((e) => e.kind === 'commandStaff' || e.kind === 'equipmentManager');
  const course = effects.find((e) => e.kind === 'unlockCourse');
  const item = effects.find((e) => e.kind === 'unlockItem');
  const missing = step.quote.missingPrerequisites;
  const goNeeded = (id: Id) => { const node = DEV_NODES[id]; const room = roomOfBranch(node.branch); if (room.id === view.room.id) onSelect(id); else onOpenRoom(room.id, id); };
  const title = `${step.node.name}${tiered && step.targetTier ? ` ${tierLabel(step.targetTier)}` : ''}`;
  const rows = ladder(view.options);

  const footer = state === 'owned'
    ? <p className="room-done"><Icon name="check" size={16} />{tiered ? 'Fully built. Every tier is working.' : 'Built and working.'}</p>
    : <div className="room-buy">
      {state === 'locked'
        ? <Button variant="quiet" icon="lock" block onClick={() => goNeeded(missing[0])}>{`Needs ${missing.map((id) => DEV_NODES[id]?.name ?? id).join(' and ')}`}</Button>
        : <Button variant="primary" block disabled={!step.quote.ok || pending} onClick={onBuy}>{pending ? 'Building…' : `${tiered ? `Build tier ${tierLabel(step.targetTier!)}` : 'Build'} for ${moneyFull(step.quote.cost!.funding)}`}</Button>}
      <CostTag part="note" quote={state === 'locked' ? { ...quote, blocker: undefined } : quote} />
    </div>;

  return <Sheet open onClose={onClose} title={view.room.name} subtitle={view.open ? 'Open' : 'Not built yet'} className="room-sheet" footer={footer}>
    <div className="room-detail">
      <RoomArt room={view.room} open={view.open} className="room-hero" />
      <section aria-labelledby="room-step" className="room-step">
        <h3 id="room-step" className="room-step-title">{title}</h3>
        <p className="room-effect">{state === 'owned' ? (step.currentEffects.filter((l) => !/^Unlocks (course|purchase):/.test(l))[0] ?? nodeSummary(step)) : help.effect}</p>
      </section>
      {help.rows.length > 0 && <section aria-labelledby="room-who"><h3 id="room-who" className="room-label">Who it helps</h3>
        <ul className="room-who card" data-ui-list>{help.rows.map((row) => <li key={row.key} className="room-who-row">
          <span className="room-who-lead">{row.officerIds.length ? <FaceStack game={game} ids={row.officerIds} now={now} /> : <span className="room-who-icon" aria-hidden="true"><Icon name="people" size={20} /></span>}</span>
          <span className="room-who-main">
            <span className="room-who-name">{row.officerIds.length ? nameList(game, row.officerIds) : row.label}</span>
            <span className="room-who-note">{row.officerIds.length ? row.label : ''}{row.note ? `${row.officerIds.length ? '. ' : ''}${row.note}` : ''}</span>
          </span>
          <span className="room-who-delta"><s>{row.from}</s><b>{row.to}</b></span>
        </li>)}</ul></section>}
      <section aria-labelledby="room-ladder"><h3 id="room-ladder" className="room-label">The ladder</h3>
        <ol className="room-ladder card" data-ui-list>{rows.map(({ option: o, depth }) => {
          const s = stepState(o);
          const q = stepQuote(o, game.department.funding);
          const needs = o.quote.missingPrerequisites;
          const tierPart = o.maxTier > 1 ? ` ${tierLabel(o.currentTier || 1)}` : '';
          return <li key={o.node.id} data-state={s} data-depth={depth} style={{ '--depth': depth } as React.CSSProperties}>
            <button type="button" className="room-step-row" data-development-node={o.node.id} aria-current={o.node.id === step.node.id ? 'step' : undefined}
              aria-label={`${o.node.name}${tierPart}. ${s === 'owned' ? 'Built' : s === 'locked' ? `Locked, needs ${needs.map((id) => DEV_NODES[id]?.name ?? id).join(' and ')}` : s === 'ready' ? 'Ready to build' : 'Needs funding'}. ${nodeSummary(o)}`}
              onClick={() => onSelect(o.node.id)}>
              <span className="room-step-glyph"><NodeGlyph option={o} size={32} />{s === 'owned' && <span className="room-step-mark"><Icon name="check" size={16} /></span>}{s === 'locked' && <span className="room-step-mark"><Icon name="lock" size={16} /></span>}</span>
              <span className="room-step-main">
                <span className="room-step-name">{o.node.name}</span>
                {/* The chosen step's effect is already the line under its headline; its row only names it. */}
                {o.node.id !== step.node.id && <span className="room-step-fx">{s === 'owned' && o.maxTier > 1 && !o.targetTier ? 'Every tier built' : nodeSummary(o)}</span>}
                {o.maxTier > 1 && <span className="room-step-tiers"><Segments done={o.currentTier} total={o.maxTier} /></span>}
              </span>
              <span className="room-step-price" aria-hidden="true"><CostTag part="value" quote={q} /></span>
            </button>
            {s === 'locked' && <Button size="sm" variant="quiet" icon="lock" className="room-needs" onClick={() => goNeeded(needs[0])}>{`Needs ${needs.map((id) => DEV_NODES[id]?.name ?? id).join(' and ')}`}</Button>}
          </li>;
        })}</ol></section>
      {(training || gear || staff) && <div className="room-links">
        {training && <Button size="sm" icon="mortarboard" onClick={() => { onClose(); nav.openTraining(course?.kind === 'unlockCourse' ? { certId: COURSES[course.courseId]?.grants.cert } : undefined); }}>Open Training</Button>}
        {gear && <Button size="sm" icon="gear" onClick={() => { onClose(); if (item?.kind === 'unlockItem') nav.openEquipment({ itemId: item.itemId }); else nav.go('gear'); }}>Open Armory</Button>}
        {staff && <Button size="sm" icon="people" onClick={() => { onClose(); nav.go('hq'); }}>Open Command Staff</Button>}
      </div>}
    </div>
  </Sheet>;
}

