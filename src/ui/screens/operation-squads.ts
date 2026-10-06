import type { SquadId } from '../../sim/types';

export interface SquadSelection {
  acting: SquadId[];
  support: SquadId[];
}

/** A focus change is an explicit request to use that squad for the reviewed decision. */
export function focusActingSquad(selection: SquadSelection, id: SquadId): SquadSelection {
  return { acting: [id], support: selection.support.filter(squad => squad !== id) };
}

/** Single-team decisions switch in one tap; joint actions keep bounded, disjoint roles. */
export function toggleActingSquad(selection: SquadSelection, id: SquadId, maxActing: number): SquadSelection {
  if (maxActing <= 1) return focusActingSquad(selection, id);
  const selected = selection.acting.includes(id);
  if ((selected && selection.acting.length === 1) || (!selected && selection.acting.length >= maxActing)) return selection;
  const acting = selected ? selection.acting.filter(squad => squad !== id) : [...selection.acting, id];
  return { acting, support: selection.support.filter(squad => !acting.includes(squad)) };
}

export function toggleSupportingSquad(selection: SquadSelection, id: SquadId, maxSupport: number): SquadSelection {
  if (selection.acting.includes(id)) return selection;
  const selected = selection.support.includes(id);
  if (!selected && selection.support.length >= maxSupport) return selection;
  return { acting: selection.acting, support: selected ? selection.support.filter(squad => squad !== id) : [...selection.support, id] };
}

export function toggleDeploymentSquad(chosen: SquadId[], id: SquadId, maxSquads: number): SquadId[] {
  if (chosen.includes(id)) return chosen.filter(squad => squad !== id);
  if (maxSquads === 1) return [id];
  return chosen.length >= maxSquads ? chosen : [...chosen, id].sort();
}
