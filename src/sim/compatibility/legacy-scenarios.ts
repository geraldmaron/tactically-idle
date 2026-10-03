import type { ActionDefinition, ScenarioDefinition } from '../scenario-types';

/** Preserve the raw issued-v1 action snapshot; effective power is normalized by the engine. */
export function restoreLegacyMaplePowerSnapshot(scenario: ScenarioDefinition): void {
  for (const stage of Object.values(scenario.stages)) stage.actions = stage.actions.map((action) => {
    if (action.id !== 'ms_thermal') return action;
    return Object.fromEntries(Object.entries(action).flatMap(([key, value]) => {
      if (key === 'consumes') return [];
      if (key === 'summary') return [[key, 'Uses a battery pack']];
      if (key === 'stressBase') return [[key, value], ['consumes', [{ tag: 'battery', qty: 1 }]]];
      return [[key, value]];
    })) as unknown as ActionDefinition;
  });
}
