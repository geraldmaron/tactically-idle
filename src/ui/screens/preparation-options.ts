import { ITEMS } from '../../content/items';
import { actionEquipmentRequirements } from '../../sim/equipment-requirements';
import { preparationEquipmentFix } from './autoPlan';

type Fix = NonNullable<ReturnType<typeof preparationEquipmentFix>>;
export interface PreparationEquipmentOption { key: string; label: string; actionTitles: string[]; fix: Fix }

/** V4 preparation is about deployability and physical choices, not hypothetical future run state. */
export function preparationOptions(args: Omit<Parameters<typeof preparationEquipmentFix>[0], 'warning'> & { warnings: string[]; practice: boolean }): { warnings: string[]; equipment: PreparationEquipmentOption[] } {
  const warnings = [...new Set(args.warnings.filter((warning) => !args.actions.some((action) => warning.startsWith(`${action.title}:`))))];
  if (args.practice || !args.chosen.length) return { warnings, equipment: [] };
  const groups = new Map<string, PreparationEquipmentOption>();
  for (const action of args.actions) {
    // Physical metadata, including capability-only bundles, owns this suggestion.
    // A future action-state failure is neither a deployment blocker nor an equipment requirement.
    const fix = preparationEquipmentFix({ ...args, warning: `${action.title}:` });
    if (!fix) continue;
    const requirements = actionEquipmentRequirements(action);
    const requirementsKey = JSON.stringify([
      requirements.groups.map((group) => [...group.itemIds].sort()).sort(),
      requirements.consumes.map((item) => [item.tag, item.qty]).sort(),
    ]);
    const repairKey = JSON.stringify(Object.entries(fix.plan.explicit).sort(([a], [b]) => a.localeCompare(b)).map(([item, ids]) => [item, [...ids].sort()]));
    const key = fix.plan.issue ? `${fix.sid}:${fix.plan.issue}:${requirementsKey}` : `${fix.sid}:${repairKey}`;
    const existing = groups.get(key);
    if (existing) { if (!existing.actionTitles.includes(action.title)) existing.actionTitles.push(action.title); continue; }
    const label = fix.plan.label || [...new Set([
      ...requirements.groups.map((group) => group.label),
      ...requirements.consumes.map((need) => Object.values(ITEMS).find((item) => item.tags.includes(need.tag))?.name ?? need.tag),
    ])].join(' + ');
    groups.set(key, { key, label, actionTitles: [action.title], fix });
  }
  return { warnings, equipment: [...groups.values()] };
}
