import { useSyncExternalStore } from 'react';
import type { Command, GameState, HandlerResult } from '../sim/types';
import { dispatch as apply } from '../sim/game';
import { createInitialState } from '../sim/department';
import { saveGame } from '../sim/save';
import { restoreCampaign } from '../sim/session';
import { randomCampaignSeed } from '../sim/personnel';

// Single game store. All mutations go through sim/game.dispatch as transactions.

const TICK_MS = 5000;

let state: GameState = boot();
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function boot(): GameState {
  return restoreCampaign(Date.now(), storage());
}

function commit(next: GameState) {
  if (next === state) return;
  state = next;
  const s = storage();
  if (s) {
    try {
      saveGame(state, Date.now(), s);
    } catch {
      /* storage full or blocked: keep playing in memory */
    }
  }
  listeners.forEach((l) => l());
}

export function send(cmd: Command): HandlerResult {
  const { state: next, result } = apply(state, cmd, { now: Date.now() });
  if (result.ok) commit(next);
  return result;
}

export function getState(): GameState {
  return state;
}

/** Dev/test helper: replace the whole state (e.g. reset). */
export function resetGame(next?: GameState) {
  commit(next ?? createInitialState(Date.now(), randomCampaignSeed()));
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState, getState);
}

if (typeof window !== 'undefined') {
  window.setInterval(() => send({ type: 'tick' }), TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') send({ type: 'tick' });
  });
  (window as unknown as { __ti: unknown }).__ti = { getState, send, resetGame };
}
