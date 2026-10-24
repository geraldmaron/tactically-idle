// Where the player is inside Operations (docs/world-redesign.md, C1 to C3): the segment, the crew whose
// ladder shows, and the dossier or warrant prep open on top of Investigations. Kept outside the screens, like
// call-flow.ts, so another surface (the City tab's Now strip) can open a dossier or a warrant with one call.
// Memory only: a reload lands on Now. No React, no game store.
import { useSyncExternalStore } from 'react';
import type { Id } from '../../../sim/types';

export type OpsSection = 'now' | 'investigations' | 'archive';
export type TieChoice = 'talks' | 'holds';

export interface OpsView {
  section: OpsSection;
  /** The crew whose ladder Investigations shows; null picks the first. */
  crewId: Id | null;
  /** A dossier is open on this subject. */
  subjectId: Id | null;
  /** Warrant prep is open on this lead. */
  prepLeadId: Id | null;
}

export function createOpsView() {
  let view: OpsView = { section: 'now', crewId: null, subjectId: null, prepLeadId: null };
  // The knowing officer's part on a warrant, by lead. The warrant call reads this once the call lands.
  let tie: Record<Id, TieChoice> = {};
  const listeners = new Set<() => void>();
  const set = (next: OpsView) => { view = next; listeners.forEach((l) => l()); };
  return {
    get: () => view,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    section(section: OpsSection) { set({ ...view, section, subjectId: null, prepLeadId: null }); },
    crew(crewId: Id | null) { set({ ...view, crewId, subjectId: null, prepLeadId: null }); },
    openDossier(subjectId: Id) { set({ ...view, section: 'investigations', subjectId, prepLeadId: null }); },
    openPrep(prepLeadId: Id, subjectId?: Id) { set({ ...view, section: 'investigations', prepLeadId, subjectId: subjectId ?? view.subjectId }); },
    /** Back one page: prep to the dossier, the dossier to the ladder. */
    back() {
      if (view.prepLeadId) set({ ...view, prepLeadId: null });
      else if (view.subjectId) set({ ...view, subjectId: null });
    },
    tieChoice: (leadId: Id): TieChoice => tie[leadId] ?? 'talks',
    setTieChoice(leadId: Id, choice: TieChoice) { tie = { ...tie, [leadId]: choice }; listeners.forEach((l) => l()); },
  };
}

export const opsView = createOpsView();

export function useOpsView(): OpsView {
  return useSyncExternalStore(opsView.subscribe, opsView.get, opsView.get);
}
/** Re-renders on a tie choice too; returns the choice for one lead. */
export function useTieChoice(leadId: Id): TieChoice {
  return useSyncExternalStore(opsView.subscribe, () => opsView.tieChoice(leadId), () => opsView.tieChoice(leadId));
}
