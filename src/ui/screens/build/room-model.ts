// The Build screen's view of the station: each room's state, its next step and who a step helps.
// Pure functions of the saved game. Every number a room sheet shows for a person comes from the same
// functions the sim settles with (recoveryRate, the roster and course rules), so the sheet cannot promise
// more than a purchase delivers; room-model.test.ts buys each step for real and compares.
import { COURSES, COURSE_RATING_CEILING } from '../../../content/courses';
import { DEV_NODES } from '../../../content/dev-tree';
import { ITEMS } from '../../../content/items';
import { MANAGERS } from '../../../sim/command-staff';
import { HOUR_MS, candidatePoolSize, recoveryRate } from '../../../sim/economy';
import { nodeOptions, type NodeOption } from '../../../sim/department-selectors';
import { describeEffect } from '../../../sim/develop';
import { developmentTierDefinition } from '../../../sim/development-tiers';
import { STRESS_BANDS } from '../../../sim/officer';
import { employedPatrol, patrolCapacity } from '../../../sim/patrol';
import type { GameState, Id, NodeEffect, Officer } from '../../../sim/types';
import { officerFaceStatus } from '../../components/face-status';
import { duration, fundingPerHour, money } from '../../format';
import { rotation } from '../../people/story-line';
import type { CostQuote } from '../build-parts';
import { ROOMS, roomOfBranch, type RoomDef, type RoomId } from './rooms';

/** The step to point the player at: the cheapest that can be bought now, else the cheapest whose
 * prerequisites are met, so there is always one clear next step while any remains. */
export function nextDevelopment(options: readonly NodeOption[]): NodeOption | null {
  const open = options.filter((o) => o.targetTier && o.status !== 'locked' && o.quote.cost);
  const byCost = (a: NodeOption, b: NodeOption) => a.quote.cost!.funding - b.quote.cost!.funding || a.node.id.localeCompare(b.node.id);
  return [...open.filter((o) => o.quote.ok)].sort(byCost)[0] ?? [...open].sort(byCost)[0] ?? null;
}

/** What a step opens, from the effects of the tier it buys next (or every tier once owned). */
export function nodeUnlocks(o: NodeOption): { key: string; itemId: string | null; name: string }[] {
  const effects = o.node.tiers ? (o.targetTier ? developmentTierDefinition(o.node, o.targetTier)?.effects ?? o.node.effects : o.node.tiers.flatMap((tier) => tier.effects)) : o.node.effects;
  return effects.flatMap((effect): { key: string; itemId: string | null; name: string }[] => effect.kind === 'unlockItem' ? [{ key: effect.itemId, itemId: effect.itemId, name: ITEMS[effect.itemId]?.name ?? effect.itemId }]
    : effect.kind === 'unlockCourse' ? [{ key: effect.courseId, itemId: null, name: COURSES[effect.courseId]?.name ?? effect.courseId }] : []);
}

/** An effect in the house voice. The sim's own wording (describeEffect) says "x1.5 faster" and "2 total
 * training slots", which are true but read like a spec; this says what a person would notice. */
function plainEffect(e: NodeEffect): string | null {
  switch (e.kind) {
    case 'recoveryRate': return `Stress comes off ${Math.round((e.mult - 1) * 100)}% faster`;
    case 'trainingSlots': return `${places(1 + e.delta, 'officer')} can train at once`;
    case 'rosterCap': return `Room for ${places(e.delta, 'more officer')}`;
    case 'candidatePool': return `${places(e.delta, 'more candidate')} to choose from`;
    case 'income': return `Records fees add ${fundingPerHour(e.perHour)}`;
    // The step's own name already says which post; the line says what the step does for you.
    case 'commandStaff': return 'Opens a post for you to fill';
    case 'unlockCourse': case 'unlockItem': return null;
    default: return describeEffect(e);
  }
}

/** One line on what a step does next: what it unlocks, else what changes for people. */
export function nodeSummary(o: NodeOption): string {
  const unlocks = nodeUnlocks(o).filter(() => o.targetTier);
  if (unlocks.length) return `Unlocks ${unlocks.map((u) => u.name).join(' and ')}`;
  const effects = o.targetTier ? tierEffects(o, o.targetTier) : tierEffects(o, o.currentTier || null);
  const lines = effects.map(plainEffect).filter((line): line is string => !!line);
  return lines.length ? lines.join('. ') : o.node.description;
}

export type StepState = 'owned' | 'ready' | 'short' | 'locked';
export function stepState(o: NodeOption): StepState {
  if (!o.targetTier) return 'owned';
  if (o.status === 'locked') return 'locked';
  return o.reason ? 'short' : 'ready';
}

export type RoomState = 'lit' | 'dark' | 'ready';

export interface RoomView {
  room: RoomDef;
  options: NodeOption[];
  /** Steps with at least one tier bought. */
  owned: number;
  total: number;
  /** Tiers bought and tiers there are, for the small pips. */
  tiers: number;
  tierTotal: number;
  /** Open: something is built, so the lit painting shows. */
  open: boolean;
  complete: boolean;
  next: NodeOption | null;
  /** The diorama state: ready when the next step can be bought now, else lit or dark by what is built. */
  state: RoomState;
}

export function roomViews(game: GameState, options: NodeOption[] = nodeOptions(game)): RoomView[] {
  return ROOMS.filter((room) => room.branch).map((room) => {
    const mine = options.filter((o) => o.node.branch === room.branch);
    const next = nextDevelopment(mine);
    const owned = mine.filter((o) => o.currentTier > 0).length;
    const open = owned > 0;
    return {
      room, options: mine, owned, total: mine.length,
      tiers: mine.reduce((sum, o) => sum + o.currentTier, 0), tierTotal: mine.reduce((sum, o) => sum + o.maxTier, 0),
      open, complete: mine.every((o) => !o.targetTier), next,
      state: next?.quote.ok ? 'ready' : open ? 'lit' : 'dark',
    };
  });
}

/** The room to suggest: the cheapest first step you can afford, favouring a room that is still dark. */
export function nextForStation(views: readonly RoomView[]): RoomView | null {
  const ready = views.filter((v) => v.next?.quote.ok);
  const cost = (v: RoomView) => v.next!.quote.cost!.funding;
  return [...ready].sort((a, b) => Number(a.open) - Number(b.open) || cost(a) - cost(b))[0] ?? null;
}

export interface GarageView {
  room: RoomDef;
  employed: number;
  capacity: number;
  level: number;
  /** The department level that adds bays, and how many; null at the top. */
  next: { level: number; positions: number } | null;
}

export function garageView(game: GameState): GarageView {
  const level = game.department.level;
  return {
    room: ROOMS.find((r) => r.id === 'garage')!,
    employed: employedPatrol(game).length, capacity: patrolCapacity(game), level,
    next: level < 3 ? { level: 3, positions: 8 } : level < 6 ? { level: 6, positions: 12 } : null,
  };
}

export const viewOfRoom = (views: readonly RoomView[], id: RoomId): RoomView | undefined => views.find((v) => v.room.id === id);
export const viewOfNode = (views: readonly RoomView[], nodeId: Id): RoomView | undefined => { const node = DEV_NODES[nodeId]; return node ? views.find((v) => v.room.id === roomOfBranch(node.branch).id) : undefined; };

// ------------------------------------------------------------------ who a step helps

/** One thing that changes for some people: a label, the number now and the number after. */
export interface HelpRow {
  key: string;
  /** Faces, most affected first; empty when the change belongs to the department. */
  officerIds: Id[];
  label: string;
  from: string;
  to: string;
  /** One extra recorded fact, e.g. "Back to Ready in 5h 20m, not 8h". */
  note?: string;
  /** `from` and `to` are funding amounts, drawn with the funding glyph. */
  funds?: true;
  /** The beat's line when this row is the first thing to happen, built from the same facts. */
  reaction: string;
}

export interface StepHelp {
  /** The one effect line: what the step does. */
  effect: string;
  rows: HelpRow[];
  /** Every face in the rows, deduplicated, for the room card and the Next card. */
  faces: Id[];
}

const tierEffects = (o: NodeOption, tier: number | null): NodeEffect[] => tier ? developmentTierDefinition(o.node, tier)?.effects ?? [] : [];
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);
const r1 = (n: number) => Math.round(n * 10) / 10;
const perHour = (n: number) => `${r1(n)}/h`;
const places = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
const surnames = (g: GameState, ids: readonly Id[]) => ids.map((id) => g.officers[id]?.surname).filter(Boolean) as string[];

const byStress = (a: Officer, b: Officer) => b.stress - a.stress || a.surname.localeCompare(b.surname) || a.id.localeCompare(b.id);
const roster = (g: GameState) => Object.values(g.officers);
/** Who benefits most from calmer recovery: whoever carries the most stress and is not on a call. */
const strained = (g: GameState) => roster(g).filter((o) => o.assignment?.kind !== 'operation').sort(byStress);
const squadLeaders = (g: GameState): Id[] => g.squads.map((s) => s.leaderId).filter((id): id is Id => !!id && !!g.officers[id]);

function canEnrol(o: Officer, courseId: Id): boolean {
  const course = COURSES[courseId];
  if (!course) return false;
  const { cert, rating } = course.grants;
  if ((course.requiresCerts ?? []).some((c) => !o.certs.includes(c))) return false;
  if (cert && o.certs.includes(cert)) return false;
  if (rating && o.ratings[rating.key] >= COURSE_RATING_CEILING) return false;
  return true;
}

/** What one step changes and for whom, from the saved game. The first row is the one the beat reports. */
export function stepHelp(game: GameState, option: NodeOption): StepHelp {
  const effects = tierEffects(option, option.targetTier);
  const had = tierEffects(option, option.currentTier || null);
  const rows: HelpRow[] = [];
  const add = (row: HelpRow) => rows.push(row);
  for (const effect of effects) {
    switch (effect.kind) {
      case 'recoveryRate': {
        const was = had.find((e): e is Extract<NodeEffect, { kind: 'recoveryRate' }> => e.kind === 'recoveryRate')?.mult ?? 1;
        for (const o of strained(game).slice(0, 3)) {
          const now = recoveryRate(game, o);
          const after = now * (effect.mult / was);
          const wait = (rate: number) => o.stress > STRESS_BANDS.strained && rate > 0 ? ((o.stress - STRESS_BANDS.strained) / rate) * HOUR_MS : 0;
          const back = wait(now) > 0 ? `Back to Ready in ${duration(wait(after))}, not ${duration(wait(now))}` : undefined;
          add({ key: `recovery-${o.id}`, officerIds: [o.id], label: 'Stress comes off', from: perHour(now), to: perHour(after), note: back,
            reaction: `${o.surname} is at ${Math.round(o.stress)} stress. Recovery goes from ${perHour(now)} to ${perHour(after)}.` });
        }
        break;
      }
      case 'trainingSlots': {
        const gain = effect.delta - (had.find((e): e is Extract<NodeEffect, { kind: 'trainingSlots' }> => e.kind === 'trainingSlots')?.delta ?? 0);
        const from = game.department.trainingSlots, to = from + gain;
        const inClass = roster(game).filter((o) => o.assignment?.kind === 'training').sort(byStress);
        const free = roster(game).filter((o) => !o.assignment && o.squadId).sort((a, b) => a.stress - b.stress || a.surname.localeCompare(b.surname));
        const ids = [...inClass, ...free].slice(0, 3).map((o) => o.id);
        const first = game.officers[ids[0]];
        add({ key: 'training-places', officerIds: ids, label: 'Training places', from: String(from), to: String(to),
          note: inClass.length ? `${places(inClass.length, 'officer')} in class now` : undefined,
          reaction: `${first ? `${first.surname} ${first.assignment?.kind === 'training' ? 'is mid-course' : 'is free to train'}. ` : ''}Training places go from ${from} to ${to}.` });
        break;
      }
      case 'rosterCap': {
        const gain = effect.delta - (had.find((e): e is Extract<NodeEffect, { kind: 'rosterCap' }> => e.kind === 'rosterCap')?.delta ?? 0);
        const size = roster(game).length, cap = game.department.rosterCap;
        const waiting = [...game.candidates].sort((a, b) => Number(b.shortlisted) - Number(a.shortlisted)).slice(0, 3);
        const first = waiting[0]?.officer;
        add({ key: 'roster-places', officerIds: waiting.map((c) => c.officer.id), label: 'Places on the roster', from: String(cap - size), to: String(cap - size + gain),
          note: `${size} of ${cap} places filled now`,
          reaction: `${first ? `${first.surname} ${waiting[0].shortlisted ? 'is on your shortlist' : 'is waiting in the pool'}. ` : ''}Free places go from ${cap - size} to ${cap - size + gain}.` });
        break;
      }
      case 'candidatePool': {
        const from = candidatePoolSize(game);
        add({ key: 'candidate-pool', officerIds: [], label: 'Candidates to choose from', from: String(from), to: String(from + effect.delta),
          reaction: `The pool goes from ${places(from, 'candidate')} to ${from + effect.delta}.` });
        break;
      }
      case 'income': {
        const was = had.find((e): e is Extract<NodeEffect, { kind: 'income' }> => e.kind === 'income')?.perHour ?? 0;
        add({ key: 'records-fees', officerIds: [], label: 'Records fees', from: `${money(was)}/h`, to: `${money(effect.perHour)}/h`, funds: true,
          reaction: `Records fees go from ${money(was)} to ${fundingPerHour(effect.perHour)}.` });
        break;
      }
      case 'unlockCourse': {
        const course = COURSES[effect.courseId];
        const eligible = roster(game).filter((o) => canEnrol(o, effect.courseId)).sort((a, b) => a.stress - b.stress || a.surname.localeCompare(b.surname));
        const first = eligible[0];
        add({ key: `course-${effect.courseId}`, officerIds: eligible.slice(0, 3).map((o) => o.id), label: course?.name ?? effect.courseId, from: 'Not offered', to: `${places(eligible.length, 'officer')} can enrol`,
          reaction: first ? `${first.surname} can enrol in ${course?.name ?? 'the course'}. So can ${eligible.length - 1 === 0 ? 'nobody else' : places(eligible.length - 1, 'other')}.` : `Nobody on the roster is eligible for ${course?.name ?? 'the course'} yet.` });
        break;
      }
      case 'unlockItem': {
        const item = ITEMS[effect.itemId];
        const certs = item?.requiresCerts ?? [];
        const qualified = roster(game).filter((o) => certs.every((c) => o.certs.includes(c))).sort((a, b) => a.stress - b.stress || a.surname.localeCompare(b.surname));
        const first = qualified[0];
        add({ key: `item-${effect.itemId}`, officerIds: qualified.slice(0, 3).map((o) => o.id), label: item?.name ?? effect.itemId, from: 'Not on sale',
          to: certs.length ? `${places(qualified.length, 'officer')} qualified` : 'Anyone can carry it',
          reaction: certs.length ? (first ? `${first.surname} already holds the qualification for the ${lower(item?.name ?? 'kit')}.` : `Nobody holds the qualification for the ${lower(item?.name ?? 'kit')} yet.`) : `Anyone can carry the ${lower(item?.name ?? 'kit')}.` });
        break;
      }
      case 'equipmentManager': {
        const was = had.find((e): e is Extract<NodeEffect, { kind: 'equipmentManager' }> => e.kind === 'equipmentManager');
        const pct = (n: number) => `${Math.round(n * 100)}%`;
        const leaders = squadLeaders(game).slice(0, 3);
        add({ key: 'repair-prices', officerIds: leaders, label: 'Repairs cost', from: pct(was?.repairMultiplier ?? 1), to: pct(effect.repairMultiplier),
          reaction: `Repairs now cost ${pct(effect.repairMultiplier)} of the price.` });
        add({ key: 'gear-wear', officerIds: leaders, label: 'Reusable gear wears at', from: pct(was?.wearMultiplier ?? 1), to: pct(effect.wearMultiplier),
          reaction: `Reusable gear now wears at ${pct(effect.wearMultiplier)} of the old rate.` });
        add({ key: 'service-jobs', officerIds: [], label: 'Repairs at once', from: String(was?.maxConcurrentServices ?? 1), to: String(effect.maxConcurrentServices),
          reaction: `${places(effect.maxConcurrentServices, 'repair')} can run at once.` });
        break;
      }
      case 'loadoutPresets': {
        const leaders = squadLeaders(game);
        add({ key: 'saved-sets', officerIds: leaders.slice(0, 3), label: 'Packing a squad', from: 'By hand every call', to: 'One tap',
          note: `${places(game.squads.filter((s) => s.officerIds.length).length, 'squad')} on the roster`,
          reaction: `Each of the ${places(game.squads.filter((s) => s.officerIds.length).length, 'squad')} can keep its usual kit.` });
        break;
      }
      case 'restockRules': {
        add({ key: 'restock', officerIds: squadLeaders(game).slice(0, 3), label: 'Restocking', from: 'By hand', to: 'Each hour, within your limit',
          reaction: 'Stock is refilled each hour, within the limit you set.' });
        break;
      }
      case 'commandStaff': {
        const manager = MANAGERS[effect.managerId];
        const tired = effect.managerId === 'watch_commander' || effect.managerId === 'peer_support_lead' ? strained(game).filter((o) => o.stress >= STRESS_BANDS.strained).slice(0, 3) : [];
        // The post is named once, by the step's own title; the row says who is under strain, not which post helps.
        add({ key: `post-${effect.managerId}`, officerIds: tired.map((o) => o.id), label: tired.length ? 'Under strain' : 'Command post', from: 'Post closed', to: 'Post open',
          note: tired.length ? `${places(strained(game).filter((o) => o.stress >= STRESS_BANDS.strained).length, 'officer')} above ${STRESS_BANDS.strained} stress now` : undefined,
          reaction: `The ${manager.title} post is open. You choose who fills it.` });
        break;
      }
    }
  }
  const faces = [...new Set(rows.flatMap((row) => row.officerIds))];
  return { effect: nodeSummary(option), rows, faces };
}

/** The faces a room card shows: whoever its next step helps, or its most recent step when it is complete. */
export function roomFaces(game: GameState, view: RoomView, limit = 3): Id[] {
  const option = view.next ?? view.options.find((o) => o.currentTier > 0);
  return option ? stepHelp(game, option).faces.slice(0, limit) : [];
}

/** The lines a room card turns through: what the room is for, first, then one recorded fact about each
 * person its next step helps (their state, an earned trait, calls worked). Held to what fits two lines
 * of the card. Under reduced motion the card keeps the first. */
export function roomLines(game: GameState, view: RoomView, now: number, limit = 3): string[] {
  const facts = roomFaces(game, view, limit).flatMap((id) => {
    const officer = game.officers[id];
    if (!officer) return [];
    const status = officerFaceStatus(game, id, now);
    const line = rotation({ kind: 'officer', officer, status }, now).find((l) => l.kind !== 'persona');
    const text = line ? `${officer.surname}. ${line.text}` : null;
    return text && text.length <= ROOM_LINE_MAX ? [text] : [];
  });
  return [view.room.line, ...facts];
}
const ROOM_LINE_MAX = 62;

/** The officers in a list, for a line of names ("Okafor, Brooks and Lee"). */
export function nameList(game: GameState, ids: readonly Id[]): string {
  const names = surnames(game, ids);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
}

/** An officer on the roster, or a candidate waiting in the pool: whoever a row's face stands for. */
export function personById(game: GameState, id: Id): Officer | undefined {
  return game.officers[id] ?? game.candidates.find((c) => c.officer.id === id)?.officer;
}

/** The price tag for a step, read from its own quote: price, what blocks it, the milestone that grants it free. */
export function stepQuote(o: NodeOption, funding: number): CostQuote {
  const state = stepState(o);
  const cost = o.quote.cost;
  const missing = o.quote.missingPrerequisites.map((id) => DEV_NODES[id]?.name ?? id);
  const short = !!cost && funding < cost.funding;
  const blocker = state === 'locked' ? `Needs ${missing.join(' and ')}` : short ? 'Needs funding' : undefined;
  const free = o.milestone ? { label: o.milestone.label, met: o.milestone.met, have: o.milestone.have, need: o.milestone.need } : undefined;
  return { state, price: cost?.funding ?? null, blocker, free, done: o.maxTier > 1 ? 'Max' : 'Owned' };
}
