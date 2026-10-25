// The color a result beat's frame takes (docs/result-surface.md). One word per result, read from the
// saved decision record and never from a band alone: a task that worked but hurt someone is not a
// win, and an authored event or a team's use of force has no band to read. Presentation only,
// store-free. The frame is a steady cue beside the words (the result's pill and title say the same).
import type { DecisionView } from '../../sim/types';

export type Verdict = 'good' | 'warn' | 'harm' | 'neutral';

export function verdictOf(d: DecisionView): Verdict {
  // A drawn use of force and an authored event carry their own label, not a band.
  if (d.forceOutcome || d.resultLabel) return 'neutral';
  const harmed = [...(d.personCasualties ?? []).map((person) => person.severity), ...(d.officerCasualties ?? []).map((officer) => officer.severity)];
  const worst = harmed.includes('fatal') || harmed.includes('serious') ? 'harm' : harmed.length ? 'warn' : null;
  // Nobody chose: the time ran out. Amber, with the hourglass pill beside it.
  if (d.lapse || !d.band) return worst ?? 'warn';
  if (d.band === 'adverse') return 'harm';
  if (worst) return worst;
  return d.band === 'favorable' ? 'good' : 'warn';
}
