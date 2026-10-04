import type { ScenarioDefinition } from './scenario-types';
import type { OperationRun } from './types';
import { conditionHolds } from './resolution';

/** Reading a dilemma never consumes time, changes a run or reveals sampled truth. */
export function currentStoryPrompt(scenario: ScenarioDefinition, run: Pick<OperationRun, 'stage' | 'endingId' | 'knowledge' | 'flags' | 'pressure'>): string {
  if (run.stage === 'debrief') return scenario.endings[run.endingId ?? '']?.summary ?? 'Review the operation result.';
  const stage = scenario.stages[run.stage];
  if (scenario.version >= 5) {
    const contextual = stage.contextPrompts?.find(entry => conditionHolds(entry.when, run));
    if (contextual) return contextual.prompt;
  }
  return stage.prompt;
}
