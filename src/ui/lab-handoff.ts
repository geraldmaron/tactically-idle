// "Open in lab" (spec 3.9): the game hands the Scenario Lab the exact state of a live call or a
// debrief through a one-shot localStorage key, one per click, and the lab URL carries that key's
// nonce plus the run's history as a fallback. The lab may read a key more than once (it reopens a
// call when the draw or the tuning changes), so reading never removes it; writing prunes old ones.
// Pure apart from the storage it is given: no store import.
import { deserialize, serialize } from '../sim/save';
import type { GameState, OperationRun } from '../sim/types';
import { isLapse } from '../sim/types';

export interface LabHandoff { v: 1; at: number; scenarioId: string; state: GameState; screen: 'live' | 'debrief' }
/** The part of Storage this module uses, so tests can pass a fake. */
export type HandoffStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export const LAB_HANDOFF_PREFIX = 'ti-lab-handoff:';
const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP = 5;

function defaultStorage(): HandoffStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The run's decisions as the lab's path tokens, comma-joined: `${actionId}~${band}`, and after the
 * band each drawn result the decision settled, in order (`…~adverse/firearm:none/none`; a cascade's
 * `+` is written `.`, as the lab writes it), so a fallback replay can aim the same results. Current calls change stage through outcome effects, so their decisions replay their paths. */
export function historyTokens(run: OperationRun): string {
  return run.history.map((step) => {
    // A lapse replays as the threat running out (the lab's `threatId~lapse`).
    if (isLapse(step)) return `${step.threatId}~lapse`;
    const drawn = step.committed?.drawn?.map(result => result.key.replace(/\+/g, '.')) ?? [];
    return `${step.actionId}~${step.band}${drawn.length ? `/${drawn.join('/')}` : ''}`;
  }).join(',');
}

/** Keep `~ , : /` readable in the lab URL, as the lab's own writer does. */
const param = (value: string) => encodeURIComponent(value).replace(/%2C/gi, ',').replace(/%3A/gi, ':').replace(/%7E/gi, '~').replace(/%2F/gi, '/');

/** Store the state for the lab and return the lab URL: `${base}lab?id=…&handoff=…&hist=…`. Null
 * when there is no live call or debrief. When storage refuses the snapshot the URL has no
 * `handoff`, and the lab falls back to replaying `hist` with forced results on its reference squad. */
export function writeLabHandoff(state: GameState, base: string, now = Date.now(), storage: HandoffStorage | null = defaultStorage()): string | null {
  const run = state.activeRun;
  if (!run || (run.status !== 'active' && run.status !== 'debrief')) return null;
  const nonce = `${now.toString(36)}${Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0')}`;
  let stored = false;
  if (storage) {
    try {
      pruneLabHandoffs(now, storage, KEEP - 1);
      const record = { v: 1, at: now, scenarioId: run.scenarioId, screen: run.status === 'active' ? 'live' : 'debrief', save: serialize(state, now) };
      storage.setItem(LAB_HANDOFF_PREFIX + nonce, JSON.stringify(record));
      stored = true;
    } catch {
      stored = false;
    }
  }
  const query = [`id=${param(run.scenarioId)}`, ...(stored ? [`handoff=${param(nonce)}`] : []), ...(run.history.length ? [`hist=${param(historyTokens(run))}`] : [])];
  return `${base.endsWith('/') ? base : `${base}/`}lab?${query.join('&')}`;
}

/** The state handed over under this nonce, or null when it is gone or unreadable. */
export function readLabHandoff(nonce: string, storage: HandoffStorage | null = defaultStorage()): LabHandoff | null {
  if (!nonce || !storage) return null;
  try {
    const text = storage.getItem(LAB_HANDOFF_PREFIX + nonce);
    if (!text) return null;
    const record = JSON.parse(text) as { v?: unknown; at?: unknown; scenarioId?: unknown; screen?: unknown; save?: unknown };
    if (record.v !== 1 || typeof record.at !== 'number' || typeof record.scenarioId !== 'string' || typeof record.save !== 'string'
      || (record.screen !== 'live' && record.screen !== 'debrief')) return null;
    const state = deserialize(record.save);
    if (!state || state.activeRun?.scenarioId !== record.scenarioId) return null;
    return { v: 1, at: record.at, scenarioId: record.scenarioId, state, screen: record.screen };
  } catch {
    return null;
  }
}

/** Older than 24 h removed, newest 5 kept (`keep` lets a write leave room for itself). */
export function pruneLabHandoffs(now: number, storage: HandoffStorage | null = defaultStorage(), keep = KEEP): void {
  if (!storage) return;
  try {
    const found: { key: string; at: number }[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(LAB_HANDOFF_PREFIX)) continue;
      let at = Number.NaN;
      try { at = (JSON.parse(storage.getItem(key) ?? '') as { at?: number }).at ?? Number.NaN; } catch { /* unreadable: removed below */ }
      found.push({ key, at });
    }
    found.sort((a, b) => (b.at || 0) - (a.at || 0));
    found.forEach((entry, index) => {
      if (!Number.isFinite(entry.at) || now - entry.at > DAY_MS || index >= keep) storage.removeItem(entry.key);
    });
  } catch {
    // Storage blocked: nothing to prune.
  }
}
