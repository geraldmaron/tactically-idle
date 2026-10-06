// Pure view model for the casebook and the featured operation. No React here, so the
// spoiler rules (locked and undiscovered rows carry no call content) are testable.
import { scenarioSituationsV10, specForSituationV10 } from '../../content/scenario-recipes';
import type { ScenarioSituation } from '../../content/scenario-recipes';
import { SCENARIO_TYPES_V10 } from '../../content/scenario-types-v10';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { ITEMS } from '../../content/items';
import { isUnlocked, missingRequirements, unlockRule } from '../../content/unlocks';
import type { MissingRequirement } from '../../content/unlocks';
import { ALL_BUILDING_FAMILIES, PROCEDURAL_FAMILIES, baseFamilyIdV7 } from '../../gen/building';
import { incidentId } from '../../gen/incident';
import { casebookRecipes, betterBest, situationCount } from '../../sim/casebook';
import type { RecipeRef } from '../../sim/casebook';
import { hashSeed } from '../../sim/rng';
import { getScenario } from '../../sim/scenario-registry';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import type { CasebookBest, GameState } from '../../sim/types';
import { CERT_LABEL } from '../components/labels';
import { familyBlurb, familyLabel } from '../components/incident';

/** Layouts tried per practice choice before showing whatever building the generator chose. */
const NATIVE_SEED_TRIES = 16;

export const isGeneratedBuilding = (familyId: string) => PROCEDURAL_FAMILIES.some((family) => family.id === familyId);

/** Picker text for a building type. Generated types name their floors, because the number
 * of floors changes how a squad searches and is only visible on the map's floor tabs. */
export function buildingOptionLabel(familyId: string): string {
  const family = ALL_BUILDING_FAMILIES.find((f) => f.id === familyId);
  if (!family) return familyLabel(familyId);
  if (!isGeneratedBuilding(familyId)) return `${familyLabel(familyId)} · ${(familyBlurb(familyId) ?? '').split(' · ')[0]}`;
  const [min, max] = family.floors;
  return max < 2 ? familyLabel(familyId) : `${familyLabel(familyId)} · ${min === max ? `${max} floors` : `${min} or ${max} floors`}`;
}

/** Practice spec through the issued v10 helper. A building type that only v11 lists is
 * played at v11, which draws situations from the call seed exactly as v10 does. */
export function practiceSpec(type: IncidentType, familyId: string, situation: ScenarioSituation, buildingSeed: number): IncidentSpec {
  const spec = specForSituationV10(type, familyId, situation, buildingSeed);
  const inV10 = SCENARIO_TYPES_V10.some((info) => info.type === type && info.families.includes(familyId));
  return inV10 ? spec : { ...spec, contentVersion: 11 };
}

/** The practice scenario for one choice, and the building seed it uses. A generated layout
 * cannot host every story; the generator then moves the call to another layout, which would
 * show a different building or situation than the one chosen, so this steps to the next
 * layout of the chosen type instead. */
export function practiceScenarioV10(type: IncidentType, familyId: string, situation: ScenarioSituation, fromSeed: number): { scenario: ScenarioDefinition | null; buildingSeed: number } {
  let fallback: { scenario: ScenarioDefinition; buildingSeed: number } | null = null;
  for (let k = 0; k < NATIVE_SEED_TRIES; k++) {
    const buildingSeed = fromSeed + k;
    let scenario: ScenarioDefinition | null = null;
    try { scenario = getScenario(incidentId(practiceSpec(type, familyId, situation, buildingSeed))); } catch { scenario = null; }
    if (!scenario) continue;
    if (baseFamilyIdV7(scenario.locationFamilyId) === familyId && scenario.locationSeed === buildingSeed) return { scenario, buildingSeed };
    fallback ??= { scenario, buildingSeed };
  }
  return fallback ?? { scenario: null, buildingSeed: fromSeed };
}

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

export function casebookRows(state: Pick<GameState, 'casebook' | 'debriefs' | 'department' | 'officers' | 'units'>): CasebookRow[] {
  const recipes = [...casebookRecipes(state).values()];
  return SCENARIO_TYPES_V11.map((info): CasebookRow => {
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
    return { ...base, status: 'found', situations, ...(best ? { best } : {}), buildings: [...new Set(mine.map((entry: { ref: RecipeRef }) => entry.ref.familyId))], missing };
  });
}

export interface CasebookFilter { type: IncidentType | 'all'; setting: CasebookSetting | 'all'; status: CasebookStatus | 'all' }

export function filterRows(rows: readonly CasebookRow[], filter: CasebookFilter): CasebookRow[] {
  return rows.filter((row) => (filter.type === 'all' || row.type === filter.type)
    && (filter.setting === 'all' || row.settings.includes(filter.setting))
    && (filter.status === 'all' || row.status === filter.status));
}

/** Header counts: frameworks found and situations found, against what exists. */
export function casebookTotals(rows: readonly CasebookRow[]): { frameworks: number; frameworksFound: number; situations: number; situationsFound: number; locked: number } {
  return {
    frameworks: rows.length,
    frameworksFound: rows.filter((row) => row.status === 'found').length,
    situations: rows.reduce((sum, row) => sum + row.situationsTotal, 0),
    situationsFound: rows.reduce((sum, row) => sum + (row.status === 'found' ? row.situations.length : 0), 0),
    locked: rows.filter((row) => row.status === 'locked').length,
  };
}

/** A fresh layout for casebook practice: stable per recipe, never a live call's seed. */
export function practiceStartSeed(type: IncidentType, familyId: string, situation: ScenarioSituation): number {
  return 1000 + (hashSeed(`${type}/${familyId}/${situation.variant}/${situation.characteristic}:casebook`) % 90000);
}

// ---------------------------------------------------------------- featured operation

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(now: number): string {
  const date = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Frameworks the featured operation draws from: the issued v10 catalog, limited to those
 * every department is sent from its first day (a plain level rule no campaign is below),
 * so the call is the same for everyone and never shows a locked framework's content. */
export const FEATURED_TYPES: readonly IncidentType[] = SCENARIO_TYPES_V10
  .filter((info) => { const rule = unlockRule(info.type); return !rule.anyCert?.length && !rule.anyItem?.length && rule.level <= 3; })
  .map((info) => info.type);

export interface FeaturedOperation {
  dateKey: string;
  type: IncidentType;
  label: string;
  familyId: string;
  situation: ScenarioSituation;
  scenario: ScenarioDefinition | null;
}

/** Today's featured call, derived only from the date: the same framework, building type,
 * situation and building seed for every player. Played as practice. */
export function featuredOperation(dateKey: string): FeaturedOperation {
  const h = hashSeed(`featured-operation:${dateKey}`);
  const type = FEATURED_TYPES[h % FEATURED_TYPES.length];
  const info = SCENARIO_TYPES_V10.find((entry) => entry.type === type)!;
  const familyId = info.families[hashSeed(`featured-building:${dateKey}`) % info.families.length];
  const situations = scenarioSituationsV10(type);
  const situation = situations[hashSeed(`featured-situation:${dateKey}`) % situations.length];
  const fromSeed = 1 + (hashSeed(`featured-seed:${dateKey}`) % 100000);
  return { dateKey, type, label: info.label, familyId, situation, scenario: practiceScenarioV10(type, familyId, situation, fromSeed).scenario };
}

/** Best practice result on today's featured call among the current debriefs. */
export function featuredBestFromDebriefs(debriefs: GameState['debriefs'], scenarioId: string): (CasebookBest & { ending: string }) | null {
  let best: (CasebookBest & { ending: string }) | null = null;
  for (const report of debriefs ?? []) {
    if (!report.practice || report.scenarioId !== scenarioId) continue;
    const candidate = { completed: report.completionAchieved === true, objective: report.objective.score, safety: report.civilianSafety.score, label: report.objective.label, ending: report.endingTitle };
    if (betterBest(candidate, best ?? undefined)) best = candidate;
  }
  return best;
}
