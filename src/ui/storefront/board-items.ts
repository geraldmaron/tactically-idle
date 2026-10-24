// Which store items help a call on the board (canvas Store, "For calls on your board"). Built only from
// what the board already shows the player: each live call's shortages (sim/board-suggestions.ts, the
// Bring chips) and the gear its briefing says its choices can use (operation-selectors `usefulItemIds`).
// Nothing hidden about a call is read. Pure: no React, no store.
import type { GameState, Id } from '../../sim/types';
import { boardShortages } from '../../sim/board-suggestions';
import { briefing } from '../../sim/operation-selectors';
import { getScenario } from '../../sim/scenario-registry';
import { isBasicKit } from '../../sim/basic-kit';

export interface BoardCallUse {
  scenarioId: Id;
  /** The call's type, for its building art. */
  type: string | null;
  familyId: string | null;
  /** The department has fewer ready than one squad needs for this call. */
  short: { have: number; need: number } | null;
}

/** Each item that helps a live call, with the calls it helps; items the board is short of come first. */
export function boardItemUses(g: GameState, now: number): Map<Id, BoardCallUse[]> {
  const at = Math.max(now, g.department.clockHighWater);
  const uses = new Map<Id, BoardCallUse[]>();
  const add = (itemId: Id, use: BoardCallUse) => {
    const list = uses.get(itemId) ?? [];
    const same = list.find((u) => u.scenarioId === use.scenarioId);
    if (same) { same.short ??= use.short; return; }
    list.push(use);
    uses.set(itemId, list);
  };
  for (const card of g.incidents ?? []) {
    if (card.expiresAt <= at) continue;
    const scenario = getScenario(card.id);
    const base = { scenarioId: card.id, type: scenario?.incident?.type ?? card.type ?? null, familyId: scenario?.locationFamilyId ?? scenario?.incident?.familyId ?? card.familyId ?? null };
    for (const shortage of boardShortages(g, card.id, at)) {
      if (shortage.kind !== 'gear') continue;
      for (const itemId of shortage.itemIds) add(itemId, { ...base, short: { have: shortage.have, need: shortage.need } });
    }
    for (const itemId of briefing(card.id, g).usefulItemIds) if (!isBasicKit(itemId)) add(itemId, { ...base, short: null });
  }
  return uses;
}

/** True when any use is a shortage. */
export const isShort = (list: readonly BoardCallUse[] | undefined): boolean => !!list?.some((use) => use.short);
