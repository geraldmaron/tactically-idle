// Which descriptors a player can switch off (owner direction 2026-10-20: every one, unless the board
// would be left with nothing to draw). Pure: it asks the engine's own drawableKinds, so the screen,
// the saved settings and the draw agree on what "no dead board" means.

import { CONTENT_DESCRIPTORS, type ContentDescriptor } from '../../content/content-descriptors';
import { drawableKinds } from '../../sim/incidents';
import { THEME_ORDER } from './labels';

/** Whether at least one kind of call stays drawable with these descriptors off. */
export const leavesCalls = (avoid: readonly ContentDescriptor[]): boolean => drawableKinds({ avoid }).length > 0;

/** Whether `descriptor` can be switched on (avoided) given what is already off. Switching one back
 * off is always allowed. */
export function canAvoid(current: readonly ContentDescriptor[], descriptor: ContentDescriptor): boolean {
  return current.includes(descriptor) || leavesCalls([...current, descriptor]);
}

/** Whether every call carries `descriptor`, so switching it off alone would leave no calls. */
export function blockedAlone(descriptor: ContentDescriptor): boolean {
  return !leavesCalls([descriptor]);
}

/** The themes a player can switch off, and the ones every call carries and so have no switch. Settings
 * and the launch advisory both list them this way. A theme that is only blocked by the other switches
 * stays in AVOIDABLE_THEMES, shown disabled until the other switch goes off. */
export const AVOIDABLE_THEMES: readonly ContentDescriptor[] = THEME_ORDER.filter((theme) => !blockedAlone(theme));
export const ALWAYS_THEMES: readonly ContentDescriptor[] = THEME_ORDER.filter((theme) => blockedAlone(theme));

/** A saved list cleaned up: known descriptors only, in list order, and any that would leave no
 * calls dropped (a later one first), so no stored state is a dead board. */
export function sanitizeAvoid(value: unknown): ContentDescriptor[] {
  const wanted = Array.isArray(value) ? CONTENT_DESCRIPTORS.filter((d) => value.includes(d)) : [];
  const kept: ContentDescriptor[] = [];
  for (const d of wanted) if (leavesCalls([...kept, d])) kept.push(d);
  return kept;
}
