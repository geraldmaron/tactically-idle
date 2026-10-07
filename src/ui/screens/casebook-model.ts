// Pure view model for the casebook. No React here, so the spoiler rules (locked and
// undiscovered rows carry no call content) are testable.
import { scenarioSituationsV10 } from '../../content/scenario-recipes';
import type { ScenarioSituation } from '../../content/scenario-recipes';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { ITEMS } from '../../content/items';
import { isUnlocked, missingRequirements, RETIRED_FROM_DISPATCH } from '../../content/unlocks';
import type { MissingRequirement } from '../../content/unlocks';
import { ALL_BUILDING_FAMILIES } from '../../gen/building';
import { casebookRecipes, betterBest, situationCount } from '../../sim/casebook';
import type { IncidentType } from '../../sim/scenario-types';
import type { CasebookBest, GameState } from '../../sim/types';
import { CERT_LABEL } from '../components/labels';

// ---------------------------------------------------------------- requirements

const list = (words: readonly string[]) => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1)}`;

/** Plain requirement lines for a locked framework. Capabilities only, never call content. */
export function requirementLines(missing: MissingRequirement): string[] {
  const lines: string[] = [];
  if (missing.level !== undefined) lines.push(`Department level ${missing.level}`);
  if (missing.anyCert?.length) lines.push(`An officer certified in ${list(missing.anyCert.map((cert) => CERT_LABEL[cert] ?? cert))}`);
  if (missing.anyItem?.length) lines.push(`${list(missing.anyItem.map((item) => ITEMS[item]?.name ?? item))} in stock`);
  return lines;
}

// ---------------------------------------------------------------- casebook rows

export type CasebookStatus = 'found' | 'unfound' | 'locked';
export type CasebookSetting = 'homes' | 'businesses';

export interface CasebookSituation {
  variant: number;
  /** Discovered pacings of this situation, in catalog order. */
  pacings: ScenarioSituation[];
  best?: CasebookBest;
  /** Building types this situation was met in. */
  buildings: string[];
}

interface RowBase { type: IncidentType; label: string; settings: CasebookSetting[]; families: string[]; situationsTotal: number }
export interface FoundRow extends RowBase {
  status: 'found';
  situations: CasebookSituation[];
  best?: CasebookBest;
  buildings: string[];
  /** Set when the framework is no longer dispatched (for example a certified officer left). */
  missing: string[];
}
export interface UnfoundRow extends RowBase { status: 'unfound' }
export interface LockedRow extends RowBase { status: 'locked'; missing: string[] }
export type CasebookRow = FoundRow | UnfoundRow | LockedRow;

const settingOf = (familyId: string): CasebookSetting => ALL_BUILDING_FAMILIES.find((f) => f.id === familyId)?.setting === 'business' ? 'businesses' : 'homes';

/** One row per framework. A framework retired from dispatch keeps a found row as history and
 * has no row at all when the campaign never met it. */
export function casebookRows(state: Pick<GameState, 'casebook' | 'debriefs' | 'department' | 'officers' | 'units'>): CasebookRow[] {
  const recipes = [...casebookRecipes(state).values()];
  return SCENARIO_TYPES_V11.filter((info) => !RETIRED_FROM_DISPATCH.has(info.type) || recipes.some((entry) => entry.ref.type === info.type)).map((info): CasebookRow => {
    const base: RowBase = {
      type: info.type,
      label: info.label,
      settings: [...new Set(info.families.map(settingOf))].sort(),
      families: info.families,
      situationsTotal: situationCount(info.type),
    };
    const mine = recipes.filter((entry) => entry.ref.type === info.type);
    const missing = requirementLines(missingRequirements(state, info.type));
    if (!mine.length) return isUnlocked(state, info.type) ? { ...base, status: 'unfound' } : { ...base, status: 'locked', missing };
    const order = scenarioSituationsV10(info.type);
    const variants = [...new Set(mine.map((entry) => entry.ref.variant))].sort((a, b) => a - b);
    const situations = variants.map((variant): CasebookSituation => {
      const here = mine.filter((entry) => entry.ref.variant === variant);
      const pacings = order.filter((s) => s.variant === variant && here.some((entry) => entry.ref.characteristic === s.characteristic));
      let best: CasebookBest | undefined;
      for (const entry of here) if (entry.best && betterBest(entry.best, best)) best = entry.best;
      return {
        variant,
        pacings: pacings.length ? pacings : [{ variant: variant as ScenarioSituation['variant'], characteristic: here[0].ref.characteristic }],
        ...(best ? { best } : {}),
        buildings: [...new Set(here.map((entry) => entry.ref.familyId))],
      };
    });
    let best: CasebookBest | undefined;
    for (const situation of situations) if (situation.best && betterBest(situation.best, best)) best = situation.best;
    return { ...base, status: 'found', situations, ...(best ? { best } : {}), buildings: [...new Set(mine.map((entry) => entry.ref.familyId))], missing };
  });
}

export interface CasebookFilter { type: IncidentType | 'all'; setting: CasebookSetting | 'all'; status: CasebookStatus | 'all' }

export function filterRows(rows: readonly CasebookRow[], filter: CasebookFilter): CasebookRow[] {
  return rows.filter((row) => (filter.type === 'all' || row.type === filter.type)
    && (filter.setting === 'all' || row.settings.includes(filter.setting))
    && (filter.status === 'all' || row.status === filter.status));
}

/** Header counts: frameworks found and situations found, against what can still be dispatched.
 * Rows of frameworks retired from dispatch stay listed as history but are not counted. */
export function casebookTotals(allRows: readonly CasebookRow[]): { frameworks: number; frameworksFound: number; situations: number; situationsFound: number; locked: number } {
  const rows = allRows.filter((row) => !RETIRED_FROM_DISPATCH.has(row.type));
  return {
    frameworks: rows.length,
    frameworksFound: rows.filter((row) => row.status === 'found').length,
    situations: rows.reduce((sum, row) => sum + row.situationsTotal, 0),
    situationsFound: rows.reduce((sum, row) => sum + (row.status === 'found' ? row.situations.length : 0), 0),
    locked: rows.filter((row) => row.status === 'locked').length,
  };
}
