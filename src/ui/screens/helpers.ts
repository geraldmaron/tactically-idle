import type { GameState, Id, IncidentCard, Officer, RatingKey, SquadId } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import * as DeptSelectors from '../../sim/department-selectors';
import { nodeOptions, squadReadiness } from '../../sim/department-selectors';
import { scenarioCards } from '../../sim/operation-selectors';
import type { ScenarioCard } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { SCENARIO_ORDER } from '../../content/scenarios';
import { ageYears, gameDay } from '../../sim/calendar';
import { RATING_META } from '../components/labels';

// ---------------------------------------------------------------- cards

/** Board incidents newest first, tolerant of saves that predate the incident board. */
export function incidentsOf(g: GameState): IncidentCard[] {
  return (g as { incidents?: IncidentCard[] }).incidents ?? [];
}

/** A card for a scenario the selectors did not list (a generated incident, or a past one replayed). */
function synthCard(g: GameState, s: ScenarioDefinition, now: number): ScenarioCard {
  const eligible: SquadId[] = [];
  const why: string[] = [];
  for (const sq of g.squads) {
    const r = squadReadiness(g, sq.id, now);
    if (r.deployable) eligible.push(sq.id);
    else if (r.issues[0]) why.push(`${sq.name}: ${r.issues[0]}`);
  }
  const issues: string[] = [];
  if (g.activeRun) issues.push('An operation is already in progress');
  if (eligible.length < s.squadRange.min) {
    issues.push(eligible.length === 0 ? 'No squad is ready to deploy' : `Needs ${s.squadRange.min} ready squads`);
    issues.push(...why);
  }
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    setting: s.setting,
    summary: s.summary,
    variantLabel: s.variantLabel,
    squadRange: s.squadRange,
    pressureLabel: s.pressureLabel,
    eligibleSquadIds: eligible,
    issues,
  };
}

/** Every card the selectors list, plus board incidents they did not. */
export function allCards(g: GameState, now: number): ScenarioCard[] {
  const base = scenarioCards(g, now);
  const have = new Set(base.map((c) => c.id));
  const extra: ScenarioCard[] = [];
  for (const inc of incidentsOf(g)) {
    if (have.has(inc.id)) continue;
    const s = getScenario(inc.id);
    if (s) {
      extra.push(synthCard(g, s, now));
      have.add(inc.id);
    }
  }
  return [...extra, ...base];
}

/** One scenario's card, listed or not (past incidents replay from the debrief log). */
export function cardFor(g: GameState, id: Id, now: number): ScenarioCard | undefined {
  const hit = allCards(g, now).find((c) => c.id === id);
  if (hit) return hit;
  const s = getScenario(id);
  return s ? synthCard(g, s, now) : undefined;
}

export interface BoardEntry {
  card: ScenarioCard;
  incident: IncidentCard;
  scenario: ScenarioDefinition | null;
}

export interface PracticeEntry {
  card: ScenarioCard;
  scenario: ScenarioDefinition | null;
  /** Standing assignments allow real runs; exercises and past incidents require practice. */
  kind: 'standing' | 'exercise' | 'replay';
}

/** Live incidents, newest first. */
export function boardEntries(g: GameState, now: number): BoardEntry[] {
  const cards = allCards(g, now);
  const out: BoardEntry[] = [];
  for (const inc of incidentsOf(g)) {
    const card = cards.find((c) => c.id === inc.id);
    const scenario = getScenario(inc.id);
    if (card && !scenario?.practiceOnly) out.push({ card, incident: inc, scenario });
  }
  return out;
}

/** Authored assignments, then past incidents that are no longer on the board. */
export function practiceEntries(g: GameState, now: number): PracticeEntry[] {
  const cards = allCards(g, now);
  const onBoard = new Set(incidentsOf(g).map((i) => i.id));
  const out: PracticeEntry[] = [];
  for (const id of SCENARIO_ORDER) {
    const card = cards.find((c) => c.id === id);
    const scenario = getScenario(id);
    if (card) out.push({ card, scenario, kind: scenario?.practiceOnly ? 'exercise' : 'standing' });
  }
  const seen = new Set<Id>(SCENARIO_ORDER);
  for (const d of g.debriefs ?? []) {
    if (seen.has(d.scenarioId) || onBoard.has(d.scenarioId)) continue;
    seen.add(d.scenarioId);
    const s = getScenario(d.scenarioId);
    if (s) out.push({ card: synthCard(g, s, now), scenario: s, kind: 'replay' });
    if (out.length >= SCENARIO_ORDER.length + 5) break;
  }
  return out;
}

/** Authored exercises and closed incidents can only be launched as practice. */
export function isReplayOnly(g: GameState, id: Id): boolean {
  if (getScenario(id)?.practiceOnly) return true;
  if (SCENARIO_ORDER.includes(id)) return false;
  return !incidentsOf(g).some((i) => i.id === id);
}

// ---------------------------------------------------------------- board summary (department selector, optional)

export interface BoardNote {
  /** Epoch ms of the next expected arrival, if the selector says so. */
  nextAt: number | null;
  /** Ready-made line from the selector, if it offers one. */
  line: string | null;
}

/**
 * Reads `boardSummary(state, now)` when the department module provides it. Its return shape is not
 * frozen yet, so this accepts a numeric `next*` timestamp or a string `line`/`nextLine`/`next`.
 */
export function boardNote(g: GameState, now: number): BoardNote {
  const fn = (DeptSelectors as unknown as Record<string, unknown>)['boardSummary'];
  if (typeof fn !== 'function') return { nextAt: null, line: null };
  try {
    const r = (fn as (s: GameState, n: number) => unknown)(g, now);
    if (!r || typeof r !== 'object') return { nextAt: null, line: null };
    const rec = r as Record<string, unknown>;
    let nextAt: number | null = null;
    let line: string | null = null;
    for (const [k, v] of Object.entries(rec)) {
      if (/^next/i.test(k) && typeof v === 'number' && Number.isFinite(v)) nextAt = v;
      if (/^(line|nextLine|next|nextArrivalLine)$/.test(k) && typeof v === 'string') line = v;
    }
    return { nextAt, line };
  } catch {
    return { nextAt: null, line: null };
  }
}

// ---------------------------------------------------------------- misc

export function scenarioTitle(g: GameState, scenarioId: Id, now: number): string {
  const card = cardFor(g, scenarioId, now);
  if (card) return card.title;
  return scenarioId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function hasNodeEffect(g: GameState, kind: 'loadoutPresets' | 'restockRules'): { unlocked: boolean; reason: string | null } {
  const nodes = nodeOptions(g).filter((n) => n.node.effects.some((e) => e.kind === kind));
  if (nodes.some((n) => n.status === 'unlocked')) return { unlocked: true, reason: null };
  const n = nodes[0];
  if (!n) return { unlocked: false, reason: 'Unlock the matching Logistics node in Develop.' };
  return { unlocked: false, reason: `Locked: unlock "${n.node.name}" in Develop${n.reason ? ` (${n.reason})` : ''}.` };
}

export function topRatings(o: Officer, n = 3): { key: RatingKey; label: string; value: number }[] {
  return RATING_META.map((r) => ({ key: r.key, label: r.short, value: o.ratings[r.key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

export function officerList(g: GameState): Officer[] {
  return Object.values(g.officers).sort((a, b) => a.surname.localeCompare(b.surname));
}

/**
 * Props that give a portrait its age. Spread onto <Portrait>. The renderer's `age` prop is optional and
 * may not exist yet; spreading keeps this compiling either way.
 */
export function agePortraitProps(g: Pick<GameState, 'department'>, officer: Pick<Officer, 'bornDay'>, now: number): { age?: number } {
  if (!Number.isFinite(officer.bornDay)) return {};
  return { age: ageYears(officer, gameDay(g, now)) };
}
