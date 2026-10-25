// The editorial brief, built from the controls (control E1). A reviewer or editor model, or a person,
// gets the same instructions the gates enforce plus the ones only a reader can: the brief lists, for a
// surface, each control's rule and what to do about it, and the standing limits on what an editor
// may touch. Generating it from the registry keeps the pass from drifting from the policy.
import { controlsFor, type Surface } from './controls';

export const EDITOR_LIMITS: readonly string[] = [
  'Change text only. Never change ids, marks, facts, conditions, outcome routing or tokens like {rider.first}, {clerk.He} or {delivery_app}.',
  'Keep the number of strings and the order of options. Every preview must stay true of every situation that reaches it.',
  'Do not state or hint at what a situation hides until a result earns it.',
  'Leave a line alone when it already works. Report a line you would change and did not, with the reason.',
  'No em dashes, en dashes or colons except in clock times. Times carry AM or PM.',
  'Propose each change as the field path, the old text, the new text and the control it serves. The caller applies and gates it.',
];

/** The brief for one surface as markdown. */
export function editorialBrief(surface: Surface): string {
  const controls = controlsFor(surface);
  const lines = controls.map((control) => `- ${control.id} ${control.title} (${control.severity}). ${control.rule} Editor: ${control.editor}`);
  return [`# Editorial brief, ${surface}`, '', '## Limits', ...EDITOR_LIMITS.map((limit) => `- ${limit}`), '', '## Controls', ...lines, ''].join('\n');
}
