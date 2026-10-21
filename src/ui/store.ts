import { useSyncExternalStore } from 'react';
import type { Command, GameState, HandlerResult } from '../sim/types';
import { dueLapse, liveDither } from './timer';
import { CampaignSlots } from '../sim/campaign-slots';
import { withSaveLock } from '../sim/save-lock';
import { createSaveEnvironment } from './save-environment';
import { initializeQaCampaign } from './qa-campaign';
import { readSettings, subscribeSettings } from './settings/prefs';

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
// Only the already isolated, framed memory library can receive a QA preset.
if (environment.temporary && typeof window !== 'undefined' && window.parent !== window) {
  const initialized = initializeQaCampaign(campaigns, { temporary: true, framed: true, search: window.location.search }, Date.now());
  if (initialized && !initialized.ok) campaigns.reportStorageIssue(initialized.reason);
}
if (!locks && !isResponsivePreview) campaigns.reportStorageIssue('Safe local saving is unavailable in this browser. You can read or export existing saves; use a current browser to save progress.');
// The themes the player keeps off the board go to every settlement and every new game
// (sim/incidents.ts ContentExclusion); changing them clears the cards that no longer fit.
// The timer setting goes with every command too, so the engine reads a run-out at the screen's rate.
const syncExclusion = () => { campaigns.exclusion = { avoid: readSettings().avoidThemes }; campaigns.timer = readSettings().timer; };
syncExclusion();
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
  const now = Date.now();
  // A commit carries its stall (ui/timer.ts). The live screen passes the minutes it showed; any
  // other caller gets the stall as of now.
  const sent = cmd.type === 'decide' && cmd.ditherMinutes === undefined ? { ...cmd, ditherMinutes: liveDither(getState(), now) } : cmd;
  const result = campaigns.send(sent, now, false);
  notify();
  if (result.ok && campaigns.getSnapshot().activeSlotId) void serialized(() => { campaigns.save(Date.now()); notify(); }).catch(lockFailure);
  return result;
}

/** A stall counts only while the player can see it (owner 2026-10-21): hiding the app pauses the
 * open decision and coming back resumes it, moved on by the time away. The store owns it, so it
 * holds on every screen, not only the live call's. */
function syncDecisionVisibility(): void {
  const run = getState().activeRun;
  if (!run || run.status !== 'active' || typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden' && !run.decisionPending && run.decisionPausedAt === undefined) send({ type: 'pauseDecision', revision: run.revision });
  if (document.visibilityState === 'visible' && run.decisionPausedAt !== undefined) send({ type: 'resumeDecision', revision: run.revision });
}

/** Settle the open decision's run-out when it is due (ui/timer.ts dueLapse), whatever screen shows. */
export function settleLapse(): void {
  const lapse = dueLapse(getState(), Date.now());
  if (lapse) send(lapse);
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
  send({ type: 'tick' });
  subscribeSettings(() => { syncExclusion(); send({ type: 'tick' }); });
  window.setInterval(() => { send({ type: 'tick' }); settleLapse(); }, TICK_MS);
  window.addEventListener('beforeunload', (event) => {
    if (campaigns.getSnapshot().dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  // iOS often skips beforeunload and may kill a hidden tab, so settle and save the moment the page
  // hides instead of waiting for the next tick.
  syncDecisionVisibility();
  document.addEventListener('visibilitychange', () => { syncDecisionVisibility(); send({ type: 'tick' }); });
  window.addEventListener('pagehide', () => { syncDecisionVisibility(); send({ type: 'tick' }); });
  window.addEventListener('storage', (event) => {
    if (event.key === 'tactically-idle/campaign-slots') {
      campaigns.reportStorageIssue('Saves changed in another tab. Reload to see them before making further changes. This tab will not overwrite them.');
      notify();
    }
  });
  // Production has no console reset shortcut that can silently discard a campaign.
  if (import.meta.env.DEV) (window as unknown as { __ti: unknown }).__ti = { getState, send };
}
