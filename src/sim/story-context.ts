import type { ScenarioDefinition, SpokenLine } from './scenario-types';
import type { OperationRun } from './types';
import { conditionHolds } from './conditions';

/** Reading a dilemma never consumes time, changes a run or reveals sampled truth. */
export function currentStoryPrompt(scenario: ScenarioDefinition, run: Pick<OperationRun, 'stage' | 'endingId' | 'knowledge' | 'flags' | 'pressure'>): string {
  if (run.stage === 'debrief') return scenario.endings[run.endingId ?? '']?.summary ?? 'Review the operation result.';
  if (run.flags.some(flag => flag.startsWith('completion_pending:'))) {
    if (run.flags.includes('casualty:person_fatality')) return 'The person’s death remains recorded. The completed help is retained, but the remaining scene responsibilities are unresolved.';
    const people = Object.values(scenario.story?.bindings.people ?? {}).filter(person =>
      ['wounded', 'serious'].some(severity => run.flags.includes(`person_harm:${person.id}:${severity}`)) && !run.flags.includes(`person_care:${person.id}:accepted`));
    const care = people.length ? `${people.map(person => person.label).join(' and ')} still ${people.length === 1 ? 'needs' : 'need'} accepted medical care.` : '';
    const officers = run.flags.includes('casualty:awaiting_transport') ? ' An injured officer still needs medical transport.' : '';
    return `${care}${officers}`.trim() || 'The completed help is retained. Finish the remaining care or agreed next step before closing this call.';
  }
  const stage = scenario.stages[run.stage];
  {
    const contextual = stage.contextPrompts?.find(entry => conditionHolds(entry.when, run));
    if (contextual) return contextual.prompt;
  }
  return stage.prompt;
}

/** The transcript that goes with the current prompt (call-surfaces): the lines spoken as the player
 * reaches this decision, from the same context prompt `currentStoryPrompt` picks. */
export function currentStoryExchange(scenario: ScenarioDefinition, run: Pick<OperationRun, 'stage' | 'flags' | 'knowledge' | 'pressure'>): SpokenLine[] {
  if (run.stage === 'debrief' || run.flags.some(flag => flag.startsWith('completion_pending:'))) return [];
  const contextual = scenario.stages[run.stage].contextPrompts?.find(entry => conditionHolds(entry.when, run));
  return contextual?.exchange?.map(line => ({ ...line })) ?? [];
}
