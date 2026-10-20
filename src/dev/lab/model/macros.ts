// The Tuning studio's dials (spec 7.5). A dial stores nothing of its own: it reads its position from
// raw tuning fields and writes only those fields, so the patch (and tuning.json) only ever holds raw
// fields, and a dial's position survives a save. Multipliers are relative to the source defaults
// (×1 = default). Every dial writes live fields only (read at call time), so each one moves the
// call-level previews.
//
// The patch helpers here (paths in and out of a `{ TABLE: { field } }` patch) are shared with the
// studio's own model (surfaces/tuning/studio.ts).
import type { TuningPatch, TuningPath } from '../../../sim/tuning';
import type { TuningGroup } from '../../../sim/tuning-meta';

/** `defaults`: the full source tables. `current`: the full tables as the dial should read them
 * (defaults, then tuning.json, then the unsaved patch). */
export interface DialLayers { defaults: TuningPatch; current: TuningPatch }

export interface MacroDial { id: string; label: string; help: string; group: TuningGroup; writes: readonly TuningPath[];
  range: [number, number]; step: number; neutral: number;
  read(layers: DialLayers): number | 'custom';
  write(value: number, layers: DialLayers): TuningPatch;
  /** How the value reads: points, a multiple of the defaults, a chance or a plain number. */
  kind: 'offset' | 'multiple' | 'chance' | 'number';
  /** Dials shown together on one card (the two upset chances), with a link toggle. */
  pair?: string;
  /** Text after the value ("points", "per point of rating"). */
  unit?: string }

// ---------------------------------------------------------------- patch paths

type Data = Record<string, unknown>;
const isPlain = (value: unknown): value is Data => typeof value === 'object' && value !== null && !Array.isArray(value);
const clone = <V>(value: V): V => (Array.isArray(value) ? value.map(clone) : isPlain(value)
  ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value) as V;

/** The value at a dotted path (`TABLE.field.key`), or undefined. */
export function getPath(tables: TuningPatch, path: TuningPath): unknown {
  let node: unknown = tables;
  for (const key of path.split('.')) {
    if (!isPlain(node)) return undefined;
    node = node[key];
  }
  return node;
}

/** A copy of `patch` with `value` at `path` (objects created on the way). */
export function setPath(patch: TuningPatch, path: TuningPath, value: unknown): TuningPatch {
  const out = clone(patch) as Data;
  const keys = path.split('.');
  let node = out;
  keys.slice(0, -1).forEach(key => {
    if (!isPlain(node[key])) node[key] = {};
    node = node[key] as Data;
  });
  node[keys[keys.length - 1]] = clone(value);
  return out as TuningPatch;
}

/** A copy of `patch` without `path`, empty objects pruned on the way back up. */
export function unsetPath(patch: TuningPatch, path: TuningPath): TuningPatch {
  const keys = path.split('.');
  const drop = (node: unknown, depth: number): unknown => {
    if (!isPlain(node)) return node;
    const key = keys[depth];
    if (!(key in node)) return node;
    const out = { ...node };
    if (depth === keys.length - 1) delete out[key];
    else {
      const child = drop(node[key], depth + 1);
      if (isPlain(child) && !Object.keys(child).length) delete out[key]; else out[key] = child;
    }
    return out;
  };
  return drop(patch, 0) as TuningPatch;
}

/** `over` laid on `base` leaf by leaf (lists replace whole), as the registry merges. */
export function overlay(base: TuningPatch, over: TuningPatch): TuningPatch {
  const merge = (a: unknown, b: unknown): unknown => {
    if (!isPlain(a) || !isPlain(b)) return clone(b);
    const out: Data = clone(a);
    for (const [key, item] of Object.entries(b)) out[key] = key in out ? merge(out[key], item) : clone(item);
    return out;
  };
  return merge(base, over) as TuningPatch;
}

/** Several patches laid one on the next. */
export const mergePatches = (...patches: TuningPatch[]): TuningPatch => patches.reduce((sum, next) => overlay(sum, next), {} as TuningPatch);

const numberAt = (tables: TuningPatch, path: TuningPath): number => {
  const value = getPath(tables, path);
  if (typeof value !== 'number') throw new Error(`No number at ${path}`);
  return value;
};

// ---------------------------------------------------------------- numbers

/** Decimals a step needs (0.005 → 3, 0.5 → 1, 5 → 0). */
export const stepDecimals = (step: number): number => Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
const round = (value: number, decimals: number) => { const f = 10 ** decimals; return Math.round(value * f) / f; };
const clamp = (value: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, value));
/** `value` clamped to the range and moved onto the step grid. */
export function snap(value: number, range: readonly [number, number], step: number): number {
  return round(clamp(range[0] + Math.round((clamp(value, range) - range[0]) / step) * step, range), stepDecimals(step) + 2);
}
/** Written values keep four decimals: enough for every table, and free of float dust (16 × 1.1). */
const tidy = (value: number) => round(value, 6);

function patchOf(values: Record<TuningPath, number>): TuningPatch {
  return Object.entries(values).reduce((patch, [path, value]) => setPath(patch, path, value), {} as TuningPatch);
}

// ---------------------------------------------------------------- dial builders

const R = 'RESOLUTION_TUNING';
const FAV = `${R}.favorableAt`, ADV = `${R}.adverseAt`;

/** Difficulty and the mixed window, from the two thresholds against their defaults. */
function thresholds({ defaults, current }: DialLayers) {
  const f0 = numberAt(defaults, FAV), a0 = numberAt(defaults, ADV);
  const df = numberAt(current, FAV) - f0, da = numberAt(current, ADV) - a0;
  return { f0, a0, difficulty: (df + da) / 2, window: df - da };
}

/** One field, written as is. */
function direct(spec: Omit<MacroDial, 'writes' | 'read' | 'write' | 'kind'> & { path: TuningPath; kind?: MacroDial['kind'] }): MacroDial {
  const { path, kind = 'number', ...rest } = spec;
  return {
    ...rest, kind, writes: [path],
    read: layers => round(numberAt(layers.current, path), 6),
    write: value => patchOf({ [path]: snap(value, spec.range, spec.step) }),
  };
}

/** Several fields, each its default × k. `shape` turns default × k into the written value (rounding,
 * caps); the dial reads k back when every field agrees on one multiple, else on the step grid when
 * the shaped values reproduce exactly; else 'custom'. */
function multiple(spec: Omit<MacroDial, 'writes' | 'read' | 'write' | 'kind' | 'neutral'> & { paths: readonly TuningPath[];
  shape?: (scaled: number, path: TuningPath, layers: DialLayers) => number }): MacroDial {
  const { paths, shape = scaled => tidy(scaled), ...rest } = spec;
  const write = (value: number, layers: DialLayers) => {
    const k = clamp(value, spec.range);
    return patchOf(Object.fromEntries(paths.map(path => [path, shape(numberAt(layers.defaults, path) * k, path, layers)])));
  };
  const reproduces = (k: number, layers: DialLayers) => {
    const written = write(k, layers);
    return paths.every(path => Math.abs(numberAt(written, path) - numberAt(layers.current, path)) < 1e-9);
  };
  return {
    ...rest, kind: 'multiple', neutral: 1, writes: paths, write,
    read: layers => {
      const ratios = paths.map(path => numberAt(layers.current, path) / numberAt(layers.defaults, path));
      if (ratios.every(r => Math.abs(r - ratios[0]) < 1e-6) && reproduces(ratios[0], layers)) return round(ratios[0], 6);
      const steps = Math.round((spec.range[1] - spec.range[0]) / spec.step);
      const mean = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
      let best: number | null = null;
      for (let i = 0; i <= steps; i++) {
        const k = round(spec.range[0] + i * spec.step, stepDecimals(spec.step) + 2);
        if (reproduces(k, layers) && (best === null || Math.abs(k - mean) < Math.abs(best - mean))) best = k;
      }
      return best ?? 'custom';
    },
  };
}

const FORCE_PROFILES = ['firearm', 'less_lethal_device', 'less_lethal_impact'] as const;
const WEAPONS = ['handgun', 'long_gun', 'shotgun', 'edged', 'blunt', 'improvised', 'unknown'] as const;
const BANDS = ['favorable', 'mixed', 'adverse'] as const;

/** The lowest an upset chance may go (the registry's guard, spec 7.1): forced bands aim inside the
 * tails, and the gate's "no style guarantees clean" check relies on them. */
export const UPSET_FLOOR = 0.005;

// ---------------------------------------------------------------- the dials

export const MACRO_DIALS: readonly MacroDial[] = [
  {
    id: 'difficulty', label: 'Difficulty', group: 'odds', kind: 'offset', unit: 'points', range: [-10, 10], step: 0.5, neutral: 0, writes: [FAV, ADV],
    help: 'Moves both result thresholds together. Up makes every choice harder: fewer go well and more go badly. Choices already at the floor or ceiling don\'t move.',
    read: layers => round(thresholds(layers).difficulty, 6),
    write: (value, layers) => {
      const { f0, a0, window } = thresholds(layers);
      const d = clamp(value, [-10, 10]);
      return patchOf({ [FAV]: tidy(f0 + d + window / 2), [ADV]: tidy(a0 + d - window / 2) });
    },
  },
  {
    id: 'mixed-window', label: 'Complications window', group: 'odds', kind: 'offset', unit: 'points', range: [-10, 10], step: 0.5, neutral: 0, writes: [FAV, ADV],
    help: 'Moves the thresholds apart or together. Wider: more choices partly work, with complications. Narrower: results land clean or bad more often.',
    read: layers => round(thresholds(layers).window, 6),
    write: (value, layers) => {
      const { f0, a0, difficulty } = thresholds(layers);
      const w = clamp(value, [-10, 10]);
      return patchOf({ [FAV]: tidy(f0 + difficulty + w / 2), [ADV]: tidy(a0 + difficulty - w / 2) });
    },
  },
  direct({ id: 'span', path: `${R}.span`, label: 'Skill vs luck', group: 'odds', unit: 'points of spread', range: [30, 120], step: 5, neutral: 60,
    help: 'How far the dice spread a result around what the squad earned. Lower: the squad matters more. Higher: luck matters more and odds flatten toward the middle.' }),
  direct({ id: 'setback', path: `${R}.setbackChance`, label: 'Setback chance', group: 'odds', kind: 'chance', pair: 'upsets', range: [UPSET_FLOOR, 0.12], step: 0.005, neutral: 0.04,
    help: 'Chance any choice goes badly, however strong the squad.' }),
  direct({ id: 'luck', path: `${R}.luckChance`, label: 'Lucky-break chance', group: 'odds', kind: 'chance', pair: 'upsets', range: [UPSET_FLOOR, 0.12], step: 0.005, neutral: 0.03,
    help: 'Chance any choice goes well, however weak the squad.' }),
  direct({ id: 'quality', path: `${R}.ratingScale`, label: 'Officer quality', group: 'odds', unit: 'points per rating point', range: [0.3, 0.9], step: 0.01, neutral: 0.55,
    help: 'How much the officers\' ratings count toward a result. Higher: a strong squad pulls further ahead of a weak one.' }),
  direct({ id: 'pressure', path: `${R}.pressureMax`, label: 'Scene pressure', group: 'pressure', unit: 'points at full pressure', range: [0, 40], step: 1, neutral: 22,
    help: 'How much a tense scene drags the lead officer down when nobody keeps their composure. 0 takes pressure out of the odds.' }),
  multiple({ id: 'armed', paths: ['THREAT_TUNING.difficulty.execution', 'THREAT_TUNING.difficulty.contact'], label: 'Armed subjects', group: 'subjects', range: [0.5, 1.5], step: 0.05,
    help: 'How much a weapon in hand hardens entries and talking. Above ×1 an armed subject is harder to reach either way.' }),
  multiple({ id: 'talk', paths: ['METERS_V1.odds.rapport', 'METERS_V1.odds.agitation'], label: 'Talk pays', group: 'subjects', range: [0.5, 2], step: 0.05,
    help: 'How much rapport built and agitation calmed since the call began help the next attempt at talking.' }),
  direct({ id: 'cascade', path: 'CASCADE_V1.base', label: 'Groups follow a surrender', group: 'subjects', kind: 'chance', range: [0.05, 0.6], step: 0.01, neutral: 0.25,
    help: 'Base chance a group member walks out with a leader who gives up, before influence, rapport and agitation move it.' }),
  multiple({ id: 'lethality', paths: FORCE_PROFILES.map(p => `FORCE_RISK_V1.${p}.fatal`), label: 'Force lethality', group: 'harm', range: [0.25, 2], step: 0.05,
    help: 'How often force kills, for firearms and both less-lethal tools. Taking someone by hand stays never fatal, and each killed share stays below its badly hurt share.',
    // fatal = min(default × k, serious − 0.001): never 0 (the guard keeps it above), never at or past serious.
    shape: (scaled, path, layers) => {
      const serious = numberAt(layers.current, path.replace(/\.fatal$/, '.serious'));
      return tidy(Math.max(0.0001, Math.min(scaled, serious - 0.001)));
    } }),
  multiple({ id: 'exposure', paths: WEAPONS.map(w => `INCOMING_FIRE_V1.hit.${w}`), label: 'Officer exposure', group: 'harm', range: [0.5, 1.5], step: 0.05,
    help: 'Chance an officer is hit when an armed subject attacks, for every weapon. The engine still clamps each final chance to the hit floor and ceiling.',
    shape: scaled => round(clamp(scaled, [0, 1]), 2) }),
  multiple({ id: 'pace', paths: BANDS.map(b => `${R}.bandTime.${b}`), label: 'Pace', group: 'time', range: [0.6, 1.6], step: 0.05,
    help: 'How long every choice takes, whatever its result. Above ×1 the clocks run down sooner against the same choices.' }),
  multiple({ id: 'strain', paths: BANDS.map(b => `${R}.bandStress.${b}`), label: 'Strain per choice', group: 'strain', range: [0.5, 1.5], step: 0.05,
    help: 'How much stress each choice puts on the officers who carry it out, whatever its result.' }),
  direct({ id: 'payout', path: 'OUTCOME_SCORE_V1.factor.base', label: 'Reward baseline', group: 'debrief', unit: 'reward factor', range: [0.5, 0.9], step: 0.01, neutral: 0.7,
    help: 'What a call pays in funding, experience and trust before its own score lines move it.' }),
];

export const dialById = (id: string): MacroDial | undefined => MACRO_DIALS.find(dial => dial.id === id);

/** The other dial of a pair (the two upset chances), or null. */
export const partnerOf = (dial: MacroDial): MacroDial | null => (dial.pair ? MACRO_DIALS.find(other => other.pair === dial.pair && other.id !== dial.id) ?? null : null);

/** A paired dial moved with its partner linked: the partner moves by the same amount, both kept on
 * their grid and range (so an upset chance never goes under UPSET_FLOOR). */
export function linkedWrite(dial: MacroDial, value: number, layers: DialLayers): TuningPatch {
  const own = dial.write(value, layers);
  const partner = partnerOf(dial);
  const before = dial.read(layers);
  const other = partner?.read(layers);
  if (!partner || typeof before !== 'number' || typeof other !== 'number') return own;
  const moved = numberAt(own, dial.writes[0]) - before;
  return overlay(own, partner.write(other + moved, layers));
}

/** Where "Make them move together" puts a custom dial: the mean multiple of its fields on the grid. */
export function togetherValue(dial: MacroDial, layers: DialLayers): number {
  const ratios = dial.writes.map(path => numberAt(layers.current, path) / numberAt(layers.defaults, path));
  return snap(ratios.reduce((sum, r) => sum + r, 0) / ratios.length, dial.range, dial.step);
}

/** The dial's value in words: "+2", "×1.10", "4.0%", "0.55". */
export function dialText(dial: MacroDial, value: number): string {
  const decimals = stepDecimals(dial.step);
  if (dial.kind === 'offset') return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(decimals)}`;
  if (dial.kind === 'multiple') return `×${value.toFixed(2)}`;
  if (dial.kind === 'chance') return `${(value * 100).toFixed(Math.max(0, decimals - 2))}%`;
  return value.toFixed(decimals);
}
