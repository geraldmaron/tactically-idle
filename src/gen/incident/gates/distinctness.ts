import { getScenario } from '../../../sim/scenario-registry';
import type { ActionDefinition, ScenarioDefinition } from '../../../sim/scenario-types';
import { hashSeed } from '../../../sim/rng';
import type { GameState } from '../../../sim/types';
import { applyMove, availableMoves, NOW, startGateRun, withDraftScenario } from './engine-driver';
import { actionViews } from '../../../sim/operation-selectors';
import type { Move } from './engine-driver';

/** Distinctness gate (docs/scenario-scale-plan.md §4). A recipe's fingerprint is the set of
 * every reachable decision path through the real engine, written without any prose:
 *
 *   stage : action family : outcome class   ...   => ending
 *
 * - action family: check kind, whether the team walks to it, whether it moves the person.
 * - outcome class: the run-state change the engine applied (stage change, facts revealed and
 *   to what, story flags set, ending), with the framework prefix stripped from IDs.
 *
 * Two recipes that differ only in wording, names or rooms get the same fingerprint. */
export interface RecipeFingerprint { key: string; hash: string; paths: string[]; truncated: boolean }

const MAX_PATHS = 4000;

function family(action: ActionDefinition): string {
  return [action.check.kind, action.approach === 'path' ? 'walk' : action.approach === 'none' ? '' : action.approach, action.storyRoute ? `moves-${action.storyRouteActor ?? 'person'}` : '']
    .filter(Boolean).join('+');
}
function normalizer(s: ScenarioDefinition): (id: string) => string {
  const prefixes = [s.incident ? `v9_${s.incident.type}_` : null, s.incident ? `${s.incident.type}_` : null].filter((p): p is string => !!p);
  return id => { for (const prefix of prefixes) if (id.startsWith(prefix)) return id.slice(prefix.length); return id; };
}

function outcomeClass(s: ScenarioDefinition, before: GameState, after: GameState): string {
  const a = before.activeRun!, b = after.activeRun!, norm = normalizer(s), parts: string[] = [];
  if (b.status !== 'active') {
    const ending = b.endingId ? s.endings[b.endingId] : null;
    return `end:${b.endingId ? norm(b.endingId) : 'none'}${ending?.disposition ? `/${ending.disposition}` : ''}`;
  }
  if (b.stage !== a.stage) parts.push(`to-${b.stage}`);
  const revealed = Object.entries(b.knowledge).filter(([id, status]) => a.knowledge[id] !== status).map(([id, status]) => `${norm(id)}=${status}`).sort();
  if (revealed.length) parts.push(`reveal(${revealed.join(',')})`);
  const flags = b.flags.filter(flag => !a.flags.includes(flag) && !flag.startsWith('used:')).map(norm).sort();
  if (flags.length) parts.push(`flags(${flags.join(',')})`);
  return parts.join(' ') || 'no-change';
}

function explore(s: ScenarioDefinition, start: GameState): { paths: string[]; truncated: boolean } {
  const memo = new Map<string, string[]>();
  let truncated = false;
  const keyOf = (state: GameState) => {
    const run = state.activeRun!;
    return JSON.stringify([run.stage, run.status, [...run.flags].sort(), Object.entries(run.knowledge).sort()]);
  };
  const walk = (state: GameState, depth: number): string[] => {
    const run = state.activeRun!;
    if (run.status !== 'active') return [''];
    const key = keyOf(state), hit = memo.get(key);
    if (hit) return hit;
    if (depth > 40) { truncated = true; return ['...']; }
    const out = new Set<string>();
    const views = actionViews(state, NOW, 'A');
    for (const move of availableMoves(state, views)) {
      const after = applyMove(state, move, views);
      if (!after) continue;
      const step = stepToken(s, state, after, move);
      for (const rest of walk(after, depth + 1)) {
        out.add(rest ? `${step} > ${rest}` : step);
        if (out.size >= MAX_PATHS) { truncated = true; break; }
      }
    }
    if (!out.size) out.add('stuck');
    const list = [...out].sort();
    memo.set(key, list);
    return list;
  };
  return { paths: walk(start, 0), truncated };
}

function stepToken(s: ScenarioDefinition, before: GameState, after: GameState, move: Move): string {
  const stage = before.activeRun!.stage;
  if (move.kind === 'fail') return `${stage}:failed-response:${outcomeClass(s, before, after)}`;
  if (move.kind === 'continue') return `${stage}:continue:${outcomeClass(s, before, after)}`;
  const action = s.stages[stage as keyof typeof s.stages].actions.find(entry => entry.id === move.actionId)!;
  return `${stage}:${family(action)}:${outcomeClass(s, before, after)}`;
}

/** Fingerprint a call resolvable by ID through the scenario registry (issued or current). */
export function fingerprintById(id: string, key = id): RecipeFingerprint {
  const s = getScenario(id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return fingerprintResolved(s, id, key);
}
/** Fingerprint a draft definition that is not registered (an agent package, or a reskin). */
export function fingerprintDraft(s: ScenarioDefinition, key: string): RecipeFingerprint {
  return withDraftScenario(s, id => fingerprintResolved({ ...s, id }, id, key));
}
function fingerprintResolved(s: ScenarioDefinition, id: string, key: string): RecipeFingerprint {
  const { paths, truncated } = explore(s, startGateRun(id));
  return { key, paths, truncated, hash: hashSeed(paths.join('\n')).toString(16).padStart(8, '0') };
}

export interface Collision { a: string; b: string; hash: string }
/** Pairs of recipes whose decision paths and endings are identical. */
export function collisions(prints: readonly RecipeFingerprint[]): Collision[] {
  const out: Collision[] = [];
  for (let i = 0; i < prints.length; i++) for (let j = i + 1; j < prints.length; j++)
    if (prints[i].paths.join('\n') === prints[j].paths.join('\n')) out.push({ a: prints[i].key, b: prints[j].key, hash: prints[i].hash });
  return out;
}
/** The first path present in one fingerprint and not the other, to explain a difference. */
export function firstDifference(a: RecipeFingerprint, b: RecipeFingerprint): string | null {
  const other = new Set(b.paths);
  return a.paths.find(path => !other.has(path)) ?? (() => { const mine = new Set(a.paths); return b.paths.find(path => !mine.has(path)) ?? null; })();
}
