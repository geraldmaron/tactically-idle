// The shape of drawn consequences, as the call model defines it (docs/incident-domain-model.md, M2
// slices 2 and 5): which variant keys a cascade can resolve to and how they route, and every effect
// an outcome can apply once its variants are counted. The compiler writes variants against these
// keys and the engine's draw (sim/drawn-effects.ts) picks among them, so both read one definition.
// Pure: no chance, no state.
import type { OutcomeEffect } from '../../sim/scenario-types';

/** What one member does in a cascade: follows the leader out, stays inside, or was already out (or
 * hurt) before it, and takes no part. */
export type CascadeState = 'follows' | 'stays' | 'out';
export const CASCADE_STATES: readonly CascadeState[] = ['follows', 'stays', 'out'];

/** A cascade's result key: each member's state in the group's order ('follows+stays'). */
export const cascadeKey = (states: readonly CascadeState[]) => states.join('+');
/** Where a cascade routes: everyone still inside followed (or nobody was left to), some did, or none. */
export function cascadeResult(states: readonly CascadeState[]): 'all' | 'some' | 'none' {
  const inside = states.filter(state => state !== 'out');
  const followed = inside.filter(state => state === 'follows').length;
  return followed === inside.length ? 'all' : followed === 0 ? 'none' : 'some';
}
/** Every state combination of a group this size, as keys. */
export function cascadeCombos(size: number): CascadeState[][] {
  let combos: CascadeState[][] = [[]];
  for (let i = 0; i < size; i++) combos = combos.flatMap(combo => CASCADE_STATES.map(state => [...combo, state]));
  return combos;
}

/** Every effect an action's band can apply once drawn effects resolve: for save validation. */
export function withVariants(effects: OutcomeEffect[]): OutcomeEffect[] {
  return effects.flatMap(effect => [effect, ...Object.values(effect.variants ?? {}).flat()]);
}
