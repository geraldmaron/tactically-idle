import { describe, expect, it } from 'vitest';
import { currentStoryPrompt } from './story-context';
import { getScenario } from './scenario-registry';
import { testCallId } from './test-fixtures';
import type { OperationRun } from './types';

describe('story dilemmas follow public committed state', () => {
  const run: Pick<OperationRun, 'stage' | 'endingId' | 'knowledge' | 'flags' | 'pressure'> = { stage: 'resolve', endingId: null, knowledge: {}, flags: [], pressure: 20 };
  const episode = () => {
    const scenario = structuredClone(getScenario(testCallId('hostageV4'))!);
    scenario.version = 5;
    scenario.stages.resolve.contextPrompts = [
      { when: { flags: ['casualty:awaiting_transport'] }, prompt: 'An injured officer needs transport. The people inside still need help.' },
      { when: { flags: ['first_safe'], notFlags: ['second_safe'] }, prompt: 'One person is outside. The other has a different reason to stay.' },
      { when: { flags: ['second_safe'], facts: [{ factId: 'care', in: ['confirmed'] }] }, prompt: 'Both people are safe. One has asked for medical help.' },
    ];
    return scenario;
  };
  it('shows the new dilemma only after the corresponding event and prioritizes injury', () => {
    const scenario = episode();
    expect(currentStoryPrompt(scenario, run)).toBe(scenario.stages.resolve.prompt);
    const partial = { ...run, flags: ['first_safe'] };
    expect(currentStoryPrompt(scenario, partial)).toContain('One person is outside');
    expect(currentStoryPrompt(scenario, { ...partial, flags: [...partial.flags, 'casualty:awaiting_transport'] })).toContain('injured officer');
  });
  it('does not expose hidden medical truth or mutate a run during repeated reads', () => {
    const scenario = episode();
    const publicRun = { ...run, flags: ['second_safe'], knowledge: { care: 'reported' as const } };
    const before = structuredClone(publicRun);
    for (const fact of scenario.facts) fact.truth = !fact.truth;
    expect(currentStoryPrompt(scenario, publicRun)).toBe(scenario.stages.resolve.prompt);
    expect(currentStoryPrompt(scenario, { ...publicRun, knowledge: { care: 'confirmed' } })).toContain('asked for medical help');
    expect(publicRun).toEqual(before);
  });
  it('leaves older prompts unchanged even when extra metadata is present', () => {
    const scenario = episode(); scenario.version = 4;
    expect(currentStoryPrompt(scenario, { ...run, flags: ['first_safe'] })).toBe(scenario.stages.resolve.prompt);
  });
});
