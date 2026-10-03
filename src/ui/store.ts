import { useSyncExternalStore } from 'react';
import type { Command, GameState, HandlerResult } from '../sim/types';
import { CampaignSlots } from '../sim/campaign-slots';
import { withSaveLock } from '../sim/save-lock';
import { createSaveEnvironment } from './save-environment';

// Single game store. All mutations go through sim/game.dispatch as transactions.

const TICK_MS = 5000;

const listeners = new Set<() => void>();
const environment = createSaveEnvironment({
  search: typeof window === 'undefined' ? '' : window.location.search,
  framed: typeof window !== 'undefined' && window.parent !== window,
  getLocks: () => typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null,
  getLocalStorage: () => window.localStorage,
});
const { locks, storage } = environment;
export const isResponsivePreview = environment.temporary;

const campaigns = await withSaveLock(locks, () => new CampaignSlots(storage(), Date.now()))
  .catch(() => new CampaignSlots(storage(true), Date.now()));
if (!locks && !isResponsivePreview) campaigns.reportStorageIssue('Safe local saving is unavailable in this browser. You can read or export existing saves; use a current browser to save progress.');
let pendingSave: Promise<unknown> = Promise.resolve();
function serialized<T>(action: () => T): Promise<T> {
  const result = pendingSave.then(() => withSaveLock(locks, action));
  pendingSave = result.catch(() => undefined);
  return result;
}

function notify() {
  listeners.forEach((l) => l());
}
function lockFailure(): HandlerResult {
  const reason = 'Local saving could not acquire its browser lock. No saved data was changed. Export your current game before leaving.';
  campaigns.reportStorageIssue(reason); notify(); return { ok: false, reason };
}

export function send(cmd: Command): HandlerResult {
  const result = campaigns.send(cmd, Date.now(), false);
  notify();
  if (result.ok && campaigns.getSnapshot().activeSlotId) void serialized(() => { campaigns.save(Date.now()); notify(); }).catch(lockFailure);
  return result;
}

export function getState(): GameState {
  return campaigns.getSnapshot().state;
}

export type SaveAction =
  | { type: 'save' }
  | { type: 'load'; id: number; discardUnsaved?: boolean }
  | { type: 'new' | 'copy'; id: number; name: string; overwrite: boolean; discardUnsaved?: boolean }
  | { type: 'rename'; id: number; name: string }
  | { type: 'import'; id: number; name: string; data: string; overwrite: boolean }
  | { type: 'delete'; id: number; confirmed: boolean; permanent?: boolean }
  | { type: 'undoDelete' };

export function manageSave(action: SaveAction): Promise<HandlerResult> {
  return serialized(() => {
  const now = Date.now();
  let result: HandlerResult;
  switch (action.type) {
    case 'save': result = campaigns.save(now); break;
    case 'load': result = campaigns.load(action.id, now, action.discardUnsaved); break;
    case 'new': result = campaigns.newGame(action.id, action.name, now, action.overwrite, action.discardUnsaved); break;
    case 'copy': result = campaigns.saveAs(action.id, action.name, now, action.overwrite); break;
    case 'rename': result = campaigns.rename(action.id, action.name, now); break;
    case 'import': result = campaigns.importGame(action.id, action.name, action.data, now, action.overwrite); break;
    case 'delete': result = campaigns.delete(action.id, now, action.confirmed, action.permanent); break;
    case 'undoDelete': result = campaigns.undoDelete(now); break;
  }
  notify();
  return result;
  }).catch(lockFailure);
}

export const exportCurrentSave = () => campaigns.exportCurrent(Date.now());
export const exportSlotSave = (id: number) => campaigns.exportSlot(id);
export const exportSaveRecovery = () => campaigns.exportRecovery();
export const getCampaignSnapshot = campaigns.getSnapshot;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useCampaigns() {
  return useSyncExternalStore(subscribe, getCampaignSnapshot, getCampaignSnapshot);
}

if (typeof window !== 'undefined') {
  if (campaigns.getSnapshot().activeSlotId) void serialized(() => { campaigns.save(Date.now()); notify(); }).catch(lockFailure);
  window.setInterval(() => send({ type: 'tick' }), TICK_MS);
  window.addEventListener('beforeunload', (event) => {
    if (campaigns.getSnapshot().dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') send({ type: 'tick' });
  });
  // Production has no console reset shortcut that can silently discard a campaign.
  if (import.meta.env.DEV) (window as unknown as { __ti: unknown }).__ti = { getState, send };
}
