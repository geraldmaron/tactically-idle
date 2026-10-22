// Where the player is in a call before it goes live, and the draft they are building, kept outside
// the screens (docs/ui-ux-audit.md, "Exits from a flow"). The open call and its step live in browser
// history, so Back, browser Back and Forward move between the board, the brief and the deploy step.
// The draft (squads, kit, staging, support) lives here, so it survives Back, a detour to another tab
// and a return; it is dropped when the call deploys or leaves the board. Memory only: a reload starts
// the call's preparation again. No React, no game store.
import { useSyncExternalStore } from 'react';
import type { Id, SquadId } from '../../sim/types';
import type { AutoNote, Explicit, Loadouts } from './autoPlan';

export type FlowStep = 'brief' | 'deploy';
export interface OpenCall { scenarioId: Id; step: FlowStep }

/** Everything the player has set on Prepare for one call. */
export interface PrepareDraft {
  chosen: SquadId[];
  /** The squad whose kit and staging the deploy step shows when two are chosen. */
  setupSquad: SquadId | null;
  positions: Partial<Record<SquadId, Id>>;
  loadouts: Loadouts;
  explicit: Explicit;
  autoNote: Partial<Record<SquadId, AutoNote>>;
  autoWarnings: string[];
  autoUndo: { loadouts: Loadouts; explicit: Explicit; notes: Partial<Record<SquadId, AutoNote>>; warnings: string[] } | null;
  staging: Partial<Record<SquadId, Id>>;
  supportUnitId: Id | null;
  floor: number;
}

export const EMPTY_DRAFT: PrepareDraft = {
  chosen: [], setupSquad: null, positions: {}, loadouts: {}, explicit: {}, autoNote: {}, autoWarnings: [], autoUndo: null, staging: {}, supportUnitId: null, floor: 0,
};

/** The history key. Other owners spread `history.state` when they push, so a tab detour carries
 * the open call along and a return lands on the same step. */
export const CALL_FLOW_HISTORY_KEY = 'tacticallyIdleCallFlow';
type HistoryPort = Pick<History, 'state' | 'pushState' | 'replaceState' | 'back'>;
interface FlowEntry { open: OpenCall | null; pushed?: boolean }

export function createCallFlow(history: HistoryPort | null) {
  let open: OpenCall | null = null;
  let drafts: Record<Id, PrepareDraft> = {};
  const listeners = new Set<() => void>();
  let snapshot: { open: OpenCall | null; drafts: Record<Id, PrepareDraft> } = { open, drafts };
  const emit = () => { snapshot = { open, drafts }; listeners.forEach((l) => l()); };
  const entry = (): FlowEntry | null => history?.state?.[CALL_FLOW_HISTORY_KEY] ?? null;
  const write = (next: OpenCall | null, mode: 'push' | 'replace') => {
    open = next;
    if (history) {
      const value: FlowEntry = { open: next, pushed: mode === 'push' || (entry()?.pushed ?? false) };
      const state = { ...history.state, [CALL_FLOW_HISTORY_KEY]: value };
      if (mode === 'push') history.pushState(state, ''); else history.replaceState(state, '');
    }
    emit();
  };
  const same = (a: OpenCall | null, b: OpenCall | null) => a?.scenarioId === b?.scenarioId && a?.step === b?.step;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    /** Open a call from the board on its brief. Its draft, if any, is kept. */
    openCall(scenarioId: Id) {
      if (same(open, { scenarioId, step: 'brief' })) return;
      write({ scenarioId, step: 'brief' }, 'push');
    },
    /** Move forward to a step (Choose team). */
    goStep(step: FlowStep) {
      if (!open || open.step === step) return;
      write({ ...open, step }, 'push');
    },
    /** The head's Back: the deploy step goes to the brief, the brief to the board. Walks history
     * when this flow pushed the entry, so browser Forward returns; otherwise replaces it. */
    back() {
      if (!open) return;
      const here = entry();
      if (history && here?.pushed && same(here.open, open)) { history.back(); return; }
      write(open.step === 'deploy' ? { ...open, step: 'brief' } : null, 'replace');
    },
    /** The call went live (or is gone): leave the flow and drop its draft. */
    close(scenarioId?: Id) {
      if (scenarioId) { const { [scenarioId]: _gone, ...rest } = drafts; drafts = rest; }
      if (open && (!scenarioId || open.scenarioId === scenarioId)) write(null, 'replace');
      else emit();
    },
    /** Browser Back or Forward landed on an entry: show what it holds. */
    onPop() {
      const next = entry()?.open ?? null;
      if (same(next, open)) return;
      open = next;
      emit();
    },
    draft: (scenarioId: Id): PrepareDraft => drafts[scenarioId] ?? EMPTY_DRAFT,
    updateDraft(scenarioId: Id, update: (draft: PrepareDraft) => PrepareDraft) {
      const before = drafts[scenarioId] ?? EMPTY_DRAFT;
      const after = update(before);
      if (after === before) return;
      drafts = { ...drafts, [scenarioId]: after };
      emit();
    },
    /** Drafts for calls no longer on the board are dropped. */
    prune(onBoard: (scenarioId: Id) => boolean) {
      const keep = Object.fromEntries(Object.entries(drafts).filter(([id]) => onBoard(id)));
      if (Object.keys(keep).length === Object.keys(drafts).length) return;
      drafts = keep;
      emit();
    },
  };
}

export type CallFlow = ReturnType<typeof createCallFlow>;

/** The game's one flow, on the window's history. */
export const callFlow = createCallFlow(typeof window === 'undefined' ? null : window.history);
if (typeof window !== 'undefined') {
  // History survives a reload but drafts don't, so a reload starts on the board: drop the open call
  // the page was showing before it.
  if (window.history.state?.[CALL_FLOW_HISTORY_KEY]) {
    const { [CALL_FLOW_HISTORY_KEY]: _stale, ...rest } = window.history.state;
    window.history.replaceState(rest, '');
  }
  window.addEventListener('popstate', () => callFlow.onPop());
}

export function useCallFlow() {
  return useSyncExternalStore(callFlow.subscribe, callFlow.getSnapshot, callFlow.getSnapshot);
}

/** One draft field as [value, set], where set takes a value or an update from the latest draft. */
export function draftField<K extends keyof PrepareDraft>(scenarioId: Id, draft: PrepareDraft, key: K): [PrepareDraft[K], (next: PrepareDraft[K] | ((previous: PrepareDraft[K]) => PrepareDraft[K])) => void] {
  return [draft[key], (next) => callFlow.updateDraft(scenarioId, (current) => {
    const value = typeof next === 'function' ? (next as (previous: PrepareDraft[K]) => PrepareDraft[K])(current[key]) : next;
    return Object.is(value, current[key]) ? current : { ...current, [key]: value };
  })];
}
