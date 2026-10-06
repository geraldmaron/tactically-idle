import type { SquadId } from '../../sim/types';

/** Session-only UI state: switching destinations must not reset a squad or share its draft. */
export interface SquadView {
  selectedId: SquadId | null;
  renameDrafts: Partial<Record<SquadId, string>>;
}

export type SquadViewAction =
  | { type: 'select'; squadId: SquadId }
  | { type: 'rename'; squadId: SquadId; name: string }
  | { type: 'finishRename'; squadId: SquadId };

export const INITIAL_SQUAD_VIEW: SquadView = { selectedId: null, renameDrafts: {} };

export function updateSquadView(view: SquadView, action: SquadViewAction): SquadView {
  if (action.type === 'select') return view.selectedId === action.squadId ? view : { ...view, selectedId: action.squadId };
  if (action.type === 'rename') return { ...view, renameDrafts: { ...view.renameDrafts, [action.squadId]: action.name } };
  const renameDrafts = { ...view.renameDrafts };
  delete renameDrafts[action.squadId];
  return { ...view, renameDrafts };
}
