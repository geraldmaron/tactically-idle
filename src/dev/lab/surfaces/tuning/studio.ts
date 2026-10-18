// The Tuning studio's model (spec 3.7, 7): the three layers (source defaults, tuning.json, the
// unsaved patch) per field, the diff and what Save writes, units and read-mode badges, and the
// call-level previews read from the engine under the saved values and under the patch. Pure: the
// React files only wire these.
import type { Weight } from '../../../../gen/incident/trees-v13/balance';
import { WEIGHTS } from '../../../../gen/incident/trees-v13/balance';
import { cascadeChance, INCOMING_FIRE_V1 } from '../../../../sim/drawn-effects';
import { forceDistribution } from '../../../../sim/force-risk';
import type { ForceRiskProfile } from '../../../../sim/force-risk';
import { currentBuilt } from '../../../../sim/operation-selectors';
import { bandProbabilities, evaluateAction } from '../../../../sim/resolution';
import { getScenario } from '../../../../sim/scenario-registry';
import { withTuning } from '../../../../sim/tuning';
import type { TuningPatch, TuningPath } from '../../../../sim/tuning';
import { PINNED_BY, READONLY_TABLES, TUNING_META } from '../../../../sim/tuning-meta';
import type { FieldMeta, ReadMode, TuningGroup } from '../../../../sim/tuning-meta';
import type { GameState, OutcomeBand, SquadId } from '../../../../sim/types';
import { liveDecisions } from '../../../../ui/screens/live-model';
import { pairedRuns } from '../../jobs/tally';
import type { ReachTally } from '../../jobs/tally';
import { getPath, overlay, setPath, stepDecimals, unsetPath } from '../../model/macros';
import { pairedDelta, wilson } from '../../model/stats';
import type { PairedDelta } from '../../model/stats';

// ---------------------------------------------------------------- groups

export type StudioGroup = TuningGroup | 'fixed';
/** The groups by what the player feels, in nav order, each with the question it answers. */
export const GROUPS: readonly { id: StudioGroup; label: string; feel: string }[] = [
  { id: 'odds', label: 'Odds of success', feel: 'How often a choice goes well, partly works or goes badly.' },
  { id: 'pressure', label: 'Pressure', feel: 'How much a tense scene wears the squad down.' },
  { id: 'subjects', label: 'Subject behavior', feel: 'How armed people, talk and groups respond.' },
  { id: 'harm', label: 'Harm and death', feel: 'Who gets hurt when force is used or shots are fired.' },
  { id: 'time', label: 'Time', feel: 'How long choices take, and when a call runs long.' },
  { id: 'debrief', label: 'Debrief and trust', feel: 'How a call scores and what it pays.' },
  { id: 'strain', label: 'Officer strain', feel: 'What the job costs the officers, during and after.' },
  { id: 'economy', label: 'Department', feel: 'Funding, kit, recruits and the roster.' },
  { id: 'flow', label: 'Call flow', feel: 'How often calls arrive and how long they wait.' },
  { id: 'fixed', label: "Can't tune here", feel: 'Tables and fields the lab leaves alone, and why.' },
];
export const groupOf = (id: string): (typeof GROUPS)[number] => GROUPS.find(group => group.id === id) ?? GROUPS[0];

/** Groups whose fields reach a played call; the rest change the department over time. */
export const CALL_GROUPS: ReadonlySet<StudioGroup> = new Set(['odds', 'pressure', 'subjects', 'harm', 'time', 'debrief', 'strain']);

const READ_ONLY: ReadonlySet<ReadMode> = new Set(['generation', 'structural']);
export const isEditable = (meta: FieldMeta): boolean => !READ_ONLY.has(meta.mode) && meta.mode !== 'dead';

/** A group's fields: the ones that show (editable and read-only) and the unused ones behind "Show unused". */
export function groupFields(group: StudioGroup): { shown: FieldMeta[]; unused: FieldMeta[] } {
  if (group === 'fixed') return { shown: TUNING_META.filter(meta => READ_ONLY.has(meta.mode)), unused: [] };
  const mine = TUNING_META.filter(meta => meta.group === group);
  return { shown: mine.filter(meta => meta.mode !== 'dead'), unused: mine.filter(meta => meta.mode === 'dead') };
}

/** The tables the lab can't tune at all (READONLY_TABLES), for the "Can't tune here" group. */
export const READONLY = READONLY_TABLES;

export const tableOf = (path: TuningPath): string => path.split('.')[0];
/** "RESOLUTION_TUNING" → "Resolution", "FORCE_RISK_V1" → "Force risk": a table's name in words. */
export function tableWords(name: string): string {
  const words = name.replace(/_V\d+$/, '').replace(/_TUNING$/, '').toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ---------------------------------------------------------------- read modes

export const MODE_BADGE: Record<ReadMode | 'cached' | 'load-time', { label: string; help: string }> = {
  live: { label: 'Live', help: 'Read while a call plays: odds, runs and previews use it.' },
  'new-entities': { label: 'New only', help: 'Stored when a card, recruit or unit is made: affects new cards, recruits or units only.' },
  department: { label: 'Department', help: 'Economy, roster and careers: no call-level preview.' },
  display: { label: 'Labels', help: 'Display only: changes how something reads, not what happens.' },
  generation: { label: 'Generation', help: 'Read when a call is generated and baked into issued calls, so the lab keeps it read-only.' },
  structural: { label: 'Structure', help: 'Part of the game\'s structure, not its balance, so the lab keeps it read-only.' },
  dead: { label: 'Unused', help: 'Read nowhere while the game plays.' },
  cached: { label: 'Cached', help: 'Baked into a cache when it loads, so a change would not reach play.' },
  'load-time': { label: 'Load-time', help: 'Copied when the game loads, so a change would not reach play.' },
};

// ---------------------------------------------------------------- layers

/** Full tables per layer: defaults, saved (defaults + tuning.json), current (saved + the patch). */
export interface StudioLayers { defaults: TuningPatch; saved: TuningPatch; current: TuningPatch; savedSparse: TuningPatch; patch: TuningPatch }

export function studioLayers(input: { defaults: TuningPatch; saved: TuningPatch; patch: TuningPatch }): StudioLayers {
  const saved = overlay(input.defaults, input.saved);
  return { defaults: input.defaults, saved, current: overlay(saved, input.patch), savedSparse: input.saved, patch: input.patch };
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-12;
  return a === b;
}

/** Every leaf of a patch (a list is one leaf). */
export function patchLeaves(patch: TuningPatch): { path: TuningPath; value: unknown }[] {
  const out: { path: TuningPath; value: unknown }[] = [];
  const walk = (node: unknown, path: string) => {
    if (node && typeof node === 'object' && !Array.isArray(node)) for (const [key, child] of Object.entries(node)) walk(child, path ? `${path}.${key}` : key);
    else out.push({ path, value: node });
  };
  walk(patch, '');
  return out;
}

/** The patch without leaves that equal the saved value, so "unsaved" counts only real changes. */
export function normalizePatch(patch: TuningPatch, saved: TuningPatch): TuningPatch {
  return patchLeaves(patch).reduce((out, leaf) => sameValue(leaf.value, getPath(saved, leaf.path)) ? unsetPath(out, leaf.path) : out, patch);
}

/** How many fields a patch really changes, for the shell's unsaved-tuning banner: leaves equal to
 * what the game runs on now (tuning.json over the source defaults) don't count. */
export function unsavedFieldCount(patch: TuningPatch, layers: { defaults: TuningPatch; saved: TuningPatch }): number {
  return patchLeaves(normalizePatch(patch, overlay(layers.defaults, layers.saved))).length;
}

export interface FieldState { meta: FieldMeta; def: unknown; saved: unknown; now: unknown; unsaved: boolean; overridden: boolean }

export function fieldState(meta: FieldMeta, layers: StudioLayers): FieldState {
  const def = getPath(layers.defaults, meta.path), saved = getPath(layers.saved, meta.path), now = getPath(layers.current, meta.path);
  return { meta, def, saved, now, unsaved: !sameValue(now, saved), overridden: !sameValue(saved, def) };
}

/** What differs: unsaved (now vs tuning.json) and saved overrides (tuning.json vs source defaults). */
export function diffOf(layers: StudioLayers): { unsaved: FieldState[]; overrides: FieldState[] } {
  const states = TUNING_META.map(meta => fieldState(meta, layers));
  return { unsaved: states.filter(state => state.unsaved), overrides: states.filter(state => state.overridden) };
}

/** Changed-field counts per group, for the nav badges. */
export function changedByGroup(layers: StudioLayers): Partial<Record<StudioGroup, number>> {
  const out: Partial<Record<StudioGroup, number>> = {};
  for (const state of diffOf(layers).unsaved) out[state.meta.group] = (out[state.meta.group] ?? 0) + 1;
  return out;
}

/** What Save writes to tuning.json: every field whose value now differs from the source default,
 * so the file stays sparse and a patch back to the defaults saves `{}`. */
export function overridesFor(layers: StudioLayers): TuningPatch {
  return TUNING_META.reduce((out, meta) => {
    const now = getPath(layers.current, meta.path);
    return now === undefined || sameValue(now, getPath(layers.defaults, meta.path)) ? out : setPath(out, meta.path, now);
  }, {} as TuningPatch);
}

/** "Reset to defaults": a patch that puts every saved override back to its source default (it still needs Save). */
export function resetToDefaults(layers: StudioLayers): TuningPatch {
  return TUNING_META.reduce((out, meta) => {
    const def = getPath(layers.defaults, meta.path), saved = getPath(layers.saved, meta.path);
    return sameValue(def, saved) ? out : setPath(out, meta.path, def);
  }, {} as TuningPatch);
}

/** The file text the dev endpoint writes for these overrides (sorted keys, two-space indent). */
export function tuningFileText(overrides: TuningPatch): string {
  const sort = (value: unknown): unknown => Array.isArray(value) ? value.map(sort)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort((value as Record<string, unknown>)[key])])) : value;
  return `${JSON.stringify(sort(overrides), null, 2)}\n`;
}

/** Test files that pin values in the changed tables (FieldMeta.pinnedBy), plus the test that checks
 * the committed tuning.json itself. */
export function pinnedTests(paths: readonly TuningPath[]): string[] {
  const files = new Set<string>(['src/sim/tuning-tables.test.ts']);
  for (const table of new Set(paths.map(tableOf))) for (const file of PINNED_BY[table] ?? []) files.add(file);
  return [...files].sort();
}

// ---------------------------------------------------------------- units

/** `decimals` −1: as many as the value needs. */
export interface DisplayUnit { factor: number; prefix: string; suffix: string; decimals: number }

/** How a field's value reads and is typed: chances and shares as percents, milliseconds as minutes
 * or hours, multiples with ×. The number box takes the same unit. */
export function displayUnit(meta: Pick<FieldMeta, 'unit' | 'step'>): DisplayUnit {
  const step = meta.step ?? 0.01;
  // No step (a read-only count like the number of squads): as many decimals as the value needs.
  const make = (factor: number, prefix: string, suffix: string): DisplayUnit => ({ factor, prefix, suffix, decimals: meta.step === undefined ? -1 : stepDecimals(step * factor) });
  switch (meta.unit) {
    case 'chance': case 'share': case 'threshold': return make(100, '', '%');
    case 'ms': return step >= 3_600_000 ? make(1 / 3_600_000, '', ' h') : make(1 / 60_000, '', ' min');
    case '×': return make(1, '×', '');
    case undefined: return make(1, '', '');
    default: return make(1, '', ` ${meta.unit}`);
  }
}

/** A number in a field's unit: "4%", "×1.20", "90 min", "22 points". `bare` drops a word unit
 * ("points", "years") for tables that name the unit once beside the field (unitWord). */
export function formatNumber(value: number, unit: DisplayUnit, bare = false): string {
  const scaled = value * unit.factor;
  const text = unit.decimals < 0 ? String(Number(scaled.toFixed(4))) : scaled.toFixed(unit.decimals);
  const suffix = bare && wordUnit(unit) ? '' : unit.suffix;
  return `${scaled < 0 ? '−' : ''}${unit.prefix}${text.replace(/^-/, '')}${suffix}`;
}

const wordUnit = (unit: DisplayUnit) => /[a-z]{3,}/i.test(unit.suffix) && !/^ (min|h)$/.test(unit.suffix);
/** The word unit a bare value leaves out ("points"), or '' when the value carries its own (%, ×, min). */
export const unitWord = (meta: Pick<FieldMeta, 'unit' | 'step'>): string => { const unit = displayUnit(meta); return wordUnit(unit) ? unit.suffix.trim() : ''; };

/** Any field value in words (lists with their item names). */
export function formatValue(value: unknown, meta: Pick<FieldMeta, 'unit' | 'step' | 'items'>, bare = false): string {
  const unit = displayUnit(meta);
  if (typeof value === 'number') return formatNumber(value, unit, bare);
  if (Array.isArray(value)) return value.map((item, i) => `${meta.items?.[i] ? `${meta.items[i]} ` : ''}${typeof item === 'number' ? formatNumber(item, unit, bare) : String(item)}`).join(', ');
  if (value === undefined) return 'none';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

// ---------------------------------------------------------------- the moment (instant tier)

export interface MomentChoice { id: string; title: string; eligible: boolean; reason: string | null; likelihood: Record<OutcomeBand, number>;
  margin: number | null; minutes: number }

/** The choices offered at this state, as the player's list computes them (liveDecisions), with each
 * eligible one's margin (score − difficulty) from the engine's own evaluation. */
export function momentChoices(state: GameState, focus: SquadId, now: number): MomentChoice[] {
  const run = state.activeRun;
  if (!run || run.status !== 'active' || run.stage === 'debrief') return [];
  const stage = run.stage;
  const scenario = getScenario(run.scenarioId);
  const built = currentBuilt(state);
  return liveDecisions(state, now, focus).map(view => {
    const action = scenario?.stages[stage]?.actions.find(entry => entry.id === view.id);
    let margin: number | null = null;
    if (action && built && scenario && view.eligible) {
      try { margin = evaluateAction({ state, run, scenario, action, built, acting: [focus], support: [] }).margin; } catch { margin = null; }
    }
    return { id: view.id, title: view.title, eligible: view.eligible, reason: view.reason, likelihood: { ...view.likelihood }, margin, minutes: view.timeCost };
  });
}

export interface InstantRow { id: string; title: string; eligible: boolean; reason: string | null; before: MomentChoice; after: MomentChoice; moved: boolean }

/** This moment's choices under the saved tuning (before) and under the patch (after): odds,
 * margins and minutes, eligible first. Two engine passes, synchronous. */
export function instantTier(state: GameState, focus: SquadId, now: number, patch: TuningPatch): InstantRow[] {
  const before = withTuning({}, () => momentChoices(state, focus, now));
  const after = withTuning(patch, () => momentChoices(state, focus, now));
  const rows = before.map(b => {
    const a = after.find(entry => entry.id === b.id) ?? b;
    const moved = Math.abs(a.likelihood.favorable - b.likelihood.favorable) > 1e-9 || Math.abs(a.likelihood.adverse - b.likelihood.adverse) > 1e-9 || a.minutes !== b.minutes;
    return { id: b.id, title: b.title, eligible: a.eligible, reason: a.reason, before: b, after: a, moved };
  });
  return [...rows.filter(row => row.eligible), ...rows.filter(row => !row.eligible)];
}

export interface CurvePoint { margin: number; favorable: number; mixed: number; adverse: number }

/** Band chances over margin under a patch ({} = saved): bandProbabilities, the engine's formula. */
export function curvePoints(patch: TuningPatch, lo = -40, hi = 40, step = 1): CurvePoint[] {
  return withTuning(patch, () => {
    const out: CurvePoint[] = [];
    for (let m = lo; m <= hi + 1e-9; m += step) out.push({ margin: m, ...bandProbabilities(m) });
    return out;
  });
}

/** The two thresholds and the tails, saved and now, for the curve's annotations. */
export function thresholdsOf(layers: StudioLayers): { saved: { favorableAt: number; adverseAt: number }; now: { favorableAt: number; adverseAt: number } } {
  const read = (tables: TuningPatch) => ({ favorableAt: getPath(tables, 'RESOLUTION_TUNING.favorableAt') as number, adverseAt: getPath(tables, 'RESOLUTION_TUNING.adverseAt') as number });
  return { saved: read(layers.saved), now: read(layers.current) };
}

// ---------------------------------------------------------------- group previews

export const FORCE_PROFILE_LABEL: Record<ForceRiskProfile, string> = { firearm: 'Firearm', less_lethal_device: 'Less-lethal device', less_lethal_impact: 'Impact launcher', hands: 'By hand' };

/** Force outcomes per profile (forceDistribution), saved and under the patch. */
export function forcePreview(patch: TuningPatch): { profile: ForceRiskProfile; label: string; saved: Record<'fatal' | 'serious' | 'wounded' | 'none', number>; now: Record<'fatal' | 'serious' | 'wounded' | 'none', number> }[] {
  const profiles = Object.keys(FORCE_PROFILE_LABEL) as ForceRiskProfile[];
  const saved = withTuning({}, () => profiles.map(profile => forceDistribution(profile)));
  const now = withTuning(patch, () => profiles.map(profile => forceDistribution(profile)));
  return profiles.map((profile, i) => ({ profile, label: FORCE_PROFILE_LABEL[profile], saved: saved[i], now: now[i] }));
}

const WEAPON_LABEL: Record<string, string> = { handgun: 'Handgun', long_gun: 'Rifle', shotgun: 'Shotgun', edged: 'Blade', blunt: 'Blunt weapon', improvised: 'Improvised', unknown: 'Unknown weapon' };

/** Officer hit chance per weapon for an ordinary hand at mid range, with the engine's floor and ceiling. */
export function exposurePreview(patch: TuningPatch): { rows: { weapon: string; label: string; saved: number; now: number }[]; floor: { saved: number; now: number }; ceiling: { saved: number; now: number } } {
  const read = () => ({ hit: { ...INCOMING_FIRE_V1.hit } as Record<string, number>, floor: INCOMING_FIRE_V1.floor, ceiling: INCOMING_FIRE_V1.ceiling });
  const saved = withTuning({}, read), now = withTuning(patch, read);
  return {
    rows: Object.keys(saved.hit).map(weapon => ({ weapon, label: WEAPON_LABEL[weapon] ?? weapon, saved: saved.hit[weapon], now: now.hit[weapon] })),
    floor: { saved: saved.floor, now: now.floor }, ceiling: { saved: saved.ceiling, now: now.ceiling },
  };
}

export const CASCADE_AXIS = [0, 25, 50, 75, 100] as const;

/** Follow chance for a member held halfway, over rapport (rows) × agitation (columns), saved and now. */
export function cascadeGrid(patch: TuningPatch): { rapport: readonly number[]; agitation: readonly number[]; saved: number[][]; now: number[][] } {
  const grid = () => CASCADE_AXIS.map(rapport => CASCADE_AXIS.map(agitation => cascadeChance(undefined, { rapport, agitation })));
  return { rapport: CASCADE_AXIS, agitation: CASCADE_AXIS, saved: withTuning({}, grid), now: withTuning(patch, grid) };
}

export interface MeterEventRow { event: string; label: string; agitation: { saved: number; now: number }; rapport: { saved: number; now: number } }

/** How each event moves a shifting subject's agitation and rapport (METERS_V1.events), saved and now. */
export function meterEvents(layers: StudioLayers): MeterEventRow[] {
  const events = getPath(layers.current, 'METERS_V1.events') as Record<string, unknown> | undefined;
  return Object.keys(events ?? {}).map(event => {
    const at = (tables: TuningPatch, meter: string) => getPath(tables, `METERS_V1.events.${event}.${meter}`) as number;
    const label = TUNING_META.find(meta => meta.path === `METERS_V1.events.${event}.agitation`)?.label.replace(/: agitation$/, '') ?? event;
    return { event, label, agitation: { saved: at(layers.saved, 'agitation'), now: at(layers.current, 'agitation') }, rapport: { saved: at(layers.saved, 'rapport'), now: at(layers.current, 'rapport') } };
  });
}

// ---------------------------------------------------------------- quick tier

export interface QuickRow { weight: Weight; saved: { p: number; lo: number; hi: number }; patch: { p: number; lo: number; hi: number }; delta: PairedDelta }

/** Run-class shares on each side (Wilson 95%) and the paired delta per class, from two tallies of
 * the same runs (same k, same dice), clean first and death last, as the gate reads them. */
export function quickSummary(saved: ReachTally, patch: ReachTally): { runs: number; rows: QuickRow[] } {
  const share = (t: ReachTally, w: Weight) => { const k = t.weights[w] ?? 0; const [lo, hi] = wilson(k, t.runs); return { p: t.runs ? k / t.runs : 0, lo, hi }; };
  const rows = [...WEIGHTS].reverse().map(weight => {
    const pairs = pairedRuns(saved, patch, w => w === weight);
    return { weight, saved: share(saved, weight), patch: share(patch, weight), delta: pairedDelta(pairs.before, pairs.after) };
  });
  return { runs: Math.min(saved.runs, patch.runs), rows };
}

// ---------------------------------------------------------------- after a save

export const SAVED_NOTICE_KEY = 'ti-lab-tuning-saved';
export interface SavedNotice { at: number; fields: { path: TuningPath; label: string; before: string; after: string }[]; pinned: string[] }
type KeyValue = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function writeSavedNotice(notice: SavedNotice, storage: KeyValue | null): void {
  try { storage?.setItem(SAVED_NOTICE_KEY, JSON.stringify(notice)); } catch { /* the checklist is a convenience */ }
}
export function readSavedNotice(storage: KeyValue | null): SavedNotice | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(SAVED_NOTICE_KEY) ?? 'null');
    return value && typeof value === 'object' && Array.isArray((value as SavedNotice).fields) && Array.isArray((value as SavedNotice).pinned) ? value as SavedNotice : null;
  } catch { return null; }
}
export function clearSavedNotice(storage: KeyValue | null): void {
  try { storage?.removeItem(SAVED_NOTICE_KEY); } catch { /* nothing to clear */ }
}

/** The notice for a save about to happen: each changed field before (tuning.json) and after. */
export function savedNoticeFor(layers: StudioLayers, at: number): SavedNotice {
  const { unsaved } = diffOf(layers);
  return {
    at, pinned: pinnedTests(unsaved.map(state => state.meta.path)),
    fields: unsaved.map(state => ({ path: state.meta.path, label: state.meta.label, before: formatValue(state.saved, state.meta), after: formatValue(state.now, state.meta) })),
  };
}
