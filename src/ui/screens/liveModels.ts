import type { ActionView, Id } from '../../sim/types';

/** Keep a small, actionable shortlist without losing the selected decision or hiding alternatives. */
export function visibleDecisions(actions: ActionView[], selectedId: Id | null, expanded: boolean): ActionView[] {
  const ordered = [...actions.filter((action) => action.eligible), ...actions.filter((action) => !action.eligible)];
  if (expanded || ordered.length <= 5) return ordered;
  const shown = ordered.slice(0, 5);
  const selected = ordered.find((action) => action.id === selectedId);
  if (selected && !shown.includes(selected)) shown[shown.length - 1] = selected;
  return shown;
}

/** Round the display distribution together so the three percentages always add to 100. */
export function outcomePercentages(likelihood: ActionView['likelihood']): Record<'favorable' | 'mixed' | 'adverse', number> {
  const bands = ['favorable', 'mixed', 'adverse'] as const;
  const rows = bands.map((band) => ({ band, raw: likelihood[band] * 100, value: Math.floor(likelihood[band] * 100) }));
  const remainder = 100 - rows.reduce((sum, row) => sum + row.value, 0);
  const ranked = [...rows].sort((a, b) => (b.raw - b.value) - (a.raw - a.value));
  for (let i = 0; i < remainder && i < ranked.length; i++) ranked[i].value++;
  return Object.fromEntries(rows.map((row) => [row.band, row.value])) as Record<typeof bands[number], number>;
}

