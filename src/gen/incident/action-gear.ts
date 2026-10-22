// What a call-tree choice asks of the team's gear, read from what the choice physically does: where
// the team goes (`team.to`) and what it sends (`team.signal`).
// The compiler adds it to the action's own `equipment` and `capabilities`, so carried gear moves the
// odds wherever it bears, and the loadout planner and the briefing recommend it there.
//
// A phone call, a text or a wait asks nothing of carried gear, so it gets none. Basic kit (radio,
// sidearm, carbine, light body armor) is part of every officer (sim/basic-kit.ts), not a choice,
// so it adds nothing here: a bonus on it would raise every call alike. What a choice
// authors itself wins: a derived effect is dropped when an authored one has its tag or group.
import type { TreeChoice } from '../../content/call-trees/types';
import type { ActionCapabilities, EquipmentEffect } from '../../sim/scenario-types';

/** Score points per physical act. Read while a call compiles, so it is baked into issued calls and
 * stays out of the lab's live tuning surface, like TEAM_MOVES. */
export const GEAR_BY_ACTION = {
  /** A voice sent through the walls from outside: the loud hailer carries it, range permitting. */
  voice: { tag: 'hailer', value: 4, group: 'voice', range: 'target', label: 'Hailer carries the voice inside' },
  /** The team goes into the building, or in to bring someone out: a shield leads. */
  move: { tag: 'shield', value: 4, label: 'Shield up front' },
} as const satisfies Record<string, EquipmentEffect>;

/** A watch from outside (a vantage with no voice, or a sightline): exterior observation aids. */
export const WATCH_CAPABILITY = 'visible_exterior' as const;

type Physical = Pick<TreeChoice, 'team' | 'equipment' | 'capabilities'>;

/** The gear rules this choice's physical act brings, before authored ones are merged in. */
export function derivedGear(choice: Physical): { equipment: EquipmentEffect[]; watch: boolean } {
  const to = choice.team?.to, signal = choice.team?.signal?.channel;
  const equipment: EquipmentEffect[] = [];
  const goesIn = to === 'scene' || to === 'escort' || (typeof to === 'object' && 'room' in to);
  const vantage = typeof to === 'object' && 'vantage' in to;
  if (signal === 'voice') equipment.push({ ...GEAR_BY_ACTION.voice });
  if (goesIn) equipment.push({ ...GEAR_BY_ACTION.move });
  return { equipment, watch: signal === 'visual' || (vantage && signal === undefined) };
}

/** The choice's equipment and capabilities: what it authors, plus what its physical act brings
 * that it doesn't already author. Undefined fields stay absent, as a choice that declares none. */
export function gearFor(choice: Physical): { equipment?: EquipmentEffect[]; capabilities?: ActionCapabilities } {
  const derived = derivedGear(choice);
  const authored = choice.equipment ?? [];
  const taken = new Set(authored.flatMap(effect => [effect.tag, effect.group ?? effect.tag]));
  const equipment = [...authored.map(effect => structuredClone(effect)),
    ...derived.equipment.filter(effect => !taken.has(effect.tag) && !taken.has(effect.group ?? effect.tag))];
  const rules = [...new Set([...(choice.capabilities?.rules ?? []), ...(derived.watch ? [WATCH_CAPABILITY] : [])])];
  const capabilities = choice.capabilities ? { ...structuredClone(choice.capabilities), rules } : rules.length ? { rules } : undefined;
  return { ...(equipment.length ? { equipment } : {}), ...(capabilities ? { capabilities } : {}) };
}
