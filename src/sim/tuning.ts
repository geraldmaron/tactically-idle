// One registry for the game's tuning tables. Each table is wrapped where it is defined:
//   export const RESOLUTION_TUNING = tunable('RESOLUTION_TUNING', { ... }, { deny, guard });
// tunable() merges the committed overrides in ./tuning.json into the object at registration and
// returns the same object, so every reader that looks the table up at call time sees changes, and
// every entry point (app, lab, workers, vitest, Bun scripts) starts from the committed values.
//
// Layers: defaults (source) → saved (tuning.json) → an unsaved patch (lab only, in memory and posted
// to workers). applyTuningPatch() always restores the saved values first, so applying is idempotent.
// This module imports nothing from src but its JSON, so it adds no edge to the import graph.
import savedJson from './tuning.json';

/** `{ TABLE: { field: value | nested } }`: overrides by table, sparse. */
export type TuningPatch = Record<string, Record<string, unknown>>;
/** A dotted path from the table name down: 'RESOLUTION_TUNING.bandTime.mixed'. */
export type TuningPath = string;
export interface PatchProblem { path: TuningPath; reason: string }
/** A field a patch may never change: read during generation (baked into issued calls) or structural. */
export interface DenyRule { path: TuningPath; kind: 'generation' | 'structural'; reason: string }
/** `guard` sees the whole table as it would be after the patch and returns why it can't be, or null. */
export interface TunableOptions<T> { deny?: readonly DenyRule[]; guard?: (next: T) => string | null }

type Data = Record<string, unknown>;

interface Entry {
  name: string;
  /** The live table: the object the game reads. Never replaced, only written into. */
  live: Data;
  defaults: Data;
  /** Defaults plus the valid parts of tuning.json. */
  saved: Data;
  deny: readonly DenyRule[];
  guard?: (next: never) => string | null;
}

const isPlain = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const own = (value: Data, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const kindOf = (value: unknown) => Array.isArray(value) ? 'a list' : value === null ? 'null' : isPlain(value) ? 'an object' : `a ${typeof value}`;

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAVED: TuningPatch = cloneData(savedJson as unknown) as TuningPatch;
const tables = new Map<string, Entry>();
const listeners = new Set<() => void>();
let patch: TuningPatch = {};
let revision = 0;

/** A deep copy of plain data: objects, arrays and primitives. */
function cloneData<V>(value: V): V {
  if (Array.isArray(value)) return value.map(cloneData) as V;
  if (isPlain(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneData(item)])) as V;
  return value;
}

/** Write `from` into `into` leaf by leaf, keeping every object and array identity in `into`. */
function assignInto(into: Data | unknown[], from: Data | unknown[]) {
  for (const key of Object.keys(from)) {
    const target = (into as Data)[key], source = (from as Data)[key];
    if ((Array.isArray(target) && Array.isArray(source)) || (isPlain(target) && isPlain(source))) assignInto(target, source);
    else (into as Data)[key] = cloneData(source);
  }
}

function denied(entry: Entry, path: string): DenyRule | undefined {
  return entry.deny.find(rule => {
    const full = rule.path.startsWith(`${entry.name}.`) || rule.path === entry.name ? rule.path : `${entry.name}.${rule.path}`;
    return path === full || path.startsWith(`${full}.`);
  });
}

/** Merge `over` into `into` (a copy of the table) under the merge rules, collecting what was refused:
 * plain objects recurse, leaves keep their type, arrays keep their length, keys must already exist,
 * deny-listed paths are refused. Valid parts are written even when others are refused. */
function mergeInto(entry: Entry, into: Data | unknown[], over: unknown, path: string, problems: PatchProblem[]) {
  const rule = denied(entry, path);
  if (rule) { problems.push({ path, reason: `Read-only (${rule.kind}): ${rule.reason}` }); return; }
  if (Array.isArray(into)) {
    if (!Array.isArray(over)) { problems.push({ path, reason: `Expected a list of ${into.length}, got ${kindOf(over)}.` }); return; }
    if (over.length !== into.length) { problems.push({ path, reason: `Expected ${into.length} values, got ${over.length}.` }); return; }
    over.forEach((item, index) => mergeLeaf(entry, into, String(index), item, `${path}.${index}`, problems));
    return;
  }
  if (!isPlain(over)) { problems.push({ path, reason: `Expected an object of fields, got ${kindOf(over)}.` }); return; }
  for (const [key, item] of Object.entries(over)) {
    if (FORBIDDEN_KEYS.has(key)) { problems.push({ path: `${path}.${key}`, reason: 'This key is not allowed.' }); continue; }
    if (!own(into, key)) { problems.push({ path: `${path}.${key}`, reason: `No field ${key} in ${path}.` }); continue; }
    mergeLeaf(entry, into, key, item, `${path}.${key}`, problems);
  }
}

function mergeLeaf(entry: Entry, into: Data | unknown[], key: string, over: unknown, path: string, problems: PatchProblem[]) {
  const current = (into as Data)[key];
  if (Array.isArray(current) || isPlain(current)) { mergeInto(entry, current, over, path, problems); return; }
  const rule = denied(entry, path);
  if (rule) { problems.push({ path, reason: `Read-only (${rule.kind}): ${rule.reason}` }); return; }
  if (current === null ? over !== null : typeof over !== typeof current) {
    problems.push({ path, reason: `Expected ${kindOf(current)}, got ${kindOf(over)}.` });
    return;
  }
  if (typeof over === 'number' && !Number.isFinite(over)) { problems.push({ path, reason: 'Expected a finite number.' }); return; }
  (into as Data)[key] = over;
}

/** The table as `over` would leave it, starting from `base`, and every refusal. A guard refusal
 * drops the whole table's change (`next` null). */
function candidate(entry: Entry, base: Data, over: unknown): { next: Data | null; problems: PatchProblem[] } {
  const problems: PatchProblem[] = [];
  const next = cloneData(base);
  mergeInto(entry, next, over, entry.name, problems);
  const refused = entry.guard?.(next as never) ?? null;
  if (refused) return { next: null, problems: [...problems, { path: entry.name, reason: refused }] };
  return { next, problems };
}

/** Restore one table to its saved values, then lay `over` (if any) on top. */
function settle(entry: Entry, over: unknown): PatchProblem[] {
  assignInto(entry.live, entry.saved);
  if (over === undefined) return [];
  const { next, problems } = candidate(entry, entry.saved, over);
  if (next) assignInto(entry.live, next);
  return problems;
}

function settleAll(next: TuningPatch): PatchProblem[] {
  patch = cloneData(next);
  const problems: PatchProblem[] = [];
  for (const entry of tables.values()) problems.push(...settle(entry, patch[entry.name]));
  for (const name of Object.keys(patch)) if (!tables.has(name)) problems.push({ path: name, reason: `No tuning table named ${name} is registered.` });
  return problems;
}

/** Register a table and merge its committed overrides into it. Returns `defaults` itself (now holding
 * the saved values), so the export keeps one identity. An invalid override is skipped with
 * console.error, never thrown: the game always loads. Registering a name again (a hot reload)
 * replaces the old entry. */
export function tunable<T extends object>(name: string, defaults: T, opts: TunableOptions<T> = {}): T {
  const live = defaults as unknown as Data;
  const entry: Entry = { name, live, defaults: cloneData(live), saved: cloneData(live), deny: opts.deny ?? [], guard: opts.guard as Entry['guard'] };
  tables.set(name, entry);
  if (SAVED[name] !== undefined) {
    const { next, problems } = candidate(entry, entry.defaults, SAVED[name]);
    for (const problem of problems) console.error(`tuning.json: ${problem.path}: ${problem.reason}`);
    if (next) entry.saved = next;
  }
  settle(entry, patch[name]);
  return defaults;
}

/** Every reason this patch (laid on the saved values) can't fully apply; [] when valid. */
export function validatePatch(next: TuningPatch): PatchProblem[] {
  if (!isPlain(next)) return [{ path: '', reason: 'A tuning patch is an object of tables.' }];
  const problems: PatchProblem[] = [];
  for (const [name, over] of Object.entries(next)) {
    const entry = tables.get(name);
    if (!entry) { problems.push({ path: name, reason: `No tuning table named ${name} is registered.` }); continue; }
    problems.push(...candidate(entry, entry.saved, over).problems);
  }
  return problems;
}

/** Make `next` the unsaved patch: restore every table to its saved values, apply the valid parts,
 * bump the revision and tell listeners. Returns what was refused. A patch for a table that isn't
 * registered yet applies when it registers. */
export function applyTuningPatch(next: TuningPatch): PatchProblem[] {
  const problems = settleAll(next);
  revision++;
  for (const listener of [...listeners]) listener();
  return problems;
}

/** Run `fn` with `next` as the patch, then put the previous patch back. Synchronous and silent: no
 * revision bump, no listeners. Only what `fn` does before it returns sees the patch. */
export function withTuning<R>(next: TuningPatch, fn: () => R): R {
  const previous = patch;
  settleAll(next);
  try {
    return fn();
  } finally {
    settleAll(previous);
  }
}

/** Full default tables, the saved overrides (tuning.json as committed) and the unsaved patch. */
export function tuningLayers(): { defaults: TuningPatch; saved: TuningPatch; patch: TuningPatch } {
  const defaults: TuningPatch = {};
  for (const name of registeredTables()) defaults[name] = cloneData(tables.get(name)!.defaults);
  return { defaults, saved: cloneData(SAVED), patch: cloneData(patch) };
}

/** Plain objects with sorted keys, so equal content always serializes the same. */
function sortedJson(value: unknown): string {
  const sort = (item: unknown): unknown => Array.isArray(item) ? item.map(sort)
    : isPlain(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(value));
}

/** The patch laid over the saved overrides, leaf by leaf (lists replace whole). */
function overlay(base: unknown, over: unknown): unknown {
  if (!isPlain(base) || !isPlain(over)) return cloneData(over);
  const out = cloneData(base);
  for (const [key, item] of Object.entries(over)) out[key] = own(out, key) ? overlay(out[key], item) : cloneData(item);
  return out;
}

/** FNV-1a (32 bit) over sorted JSON: of the saved overrides, or of the saved overrides with the
 * unsaved patch laid over them (`current`, the default). An empty patch hashes like `saved`. */
export function tuningHash(layer: 'saved' | 'current' = 'current'): string {
  const text = sortedJson(layer === 'saved' ? SAVED : overlay(SAVED, patch));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Counts applyTuningPatch calls; withTuning leaves it alone. */
export function tuningRevision(): number {
  return revision;
}

/** Called after every applyTuningPatch. Returns the unsubscribe function. */
export function onTuningChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Names of the registered tables, sorted. */
export function registeredTables(): string[] {
  return [...tables.keys()].sort();
}
