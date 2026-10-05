import type { ActionDefinition, ScenarioDefinition } from '../scenario-types';
import type { BuiltLocation, OperationRun, StageContinuationView } from '../types';

// Issued content stays byte-for-byte stable. Only these reviewed menu actions
// can use the free navigation path; similar wording never grants an exemption.
const NAVIGATION_IDS: Readonly<Record<number, readonly string[]>> = {
  3: ['v3_welfare_proceed', 'v3_protect_proceed'],
  4: ['v4_proceed'],
};
const hasOnly = (value: object, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));

export function legacyStageNavigation(scenario: ScenarioDefinition, action: ActionDefinition): boolean {
  if (!NAVIGATION_IDS[scenario.version]?.includes(action.id) || scenario.incident?.contentVersion !== scenario.version
    || action.stage !== 'adapt' || action.approach !== 'none' || action.stressBase !== 0
    || action.workload.base !== 1 || action.workload.perSqFt !== 0 || action.workload.areaSpaces?.length
    || action.observes?.length || action.consumes?.length || action.equipment?.length || action.support
    || action.spatial || action.entry || action.storyRoute || action.storyTargetPersonId || action.awaitSupport
    || action.modifiers?.length || action.capabilities || action.certBonus || action.keyholder || action.perimeter) return false;
  const flag = `used:${action.id}`;
  if (!hasOnly(action.requires, ['notFlags']) || action.requires.notFlags?.length !== 1
    || action.requires.notFlags[0].flag !== flag || !action.visibleWhen
    || !hasOnly(action.visibleWhen, ['notFlags']) || action.visibleWhen.notFlags?.length !== 1
    || action.visibleWhen.notFlags[0] !== flag) return false;
  return (['favorable', 'mixed', 'adverse'] as const).every(band => {
    const effects = action.outcomes[band];
    return effects.length === 2 && hasOnly(effects[0], ['setFlags'])
      && effects[0].setFlags?.length === 1 && effects[0].setFlags[0] === flag
      && hasOnly(effects[1], ['stage', 'text']) && effects[1].stage === 'resolve';
  });
}

export function availableStageContinuations(scenario: ScenarioDefinition, run: OperationRun): StageContinuationView[] {
  if (run.status !== 'active' || run.stage !== 'adapt' || run.scenarioVersion !== scenario.version
    || run.revision < 1 || run.stageContinuations?.length) return [];
  return scenario.stages.adapt.actions.filter(action => legacyStageNavigation(scenario, action)
    && !run.flags.includes(`used:${action.id}`) && !run.history.some(entry => entry.actionId === action.id)).map(action => ({
    actionId: action.id, fromStage: 'adapt', toStage: 'resolve', revision: run.revision,
    label: 'Continue to response choices',
    description: 'Leaves the remaining preparation options behind. No operation time passes.',
  }));
}

/** Optional navigation is separate from scored history, so old RNG samples replay unchanged. */
export function validStageContinuations(run: OperationRun, scenario: ScenarioDefinition): boolean {
  const entries = run.stageContinuations;
  if (entries === undefined) return true;
  if (!Array.isArray(entries) || entries.length !== 1 || run.scenarioVersion !== scenario.version
    || !NAVIGATION_IDS[scenario.version] || run.revision !== run.history.length) return false;
  const entry = entries[0];
  if (!entry || typeof entry !== 'object' || !hasOnly(entry, ['version', 'actionId', 'revision', 'fromStage', 'toStage'])
    || entry.version !== 1 || entry.fromStage !== 'adapt' || entry.toStage !== 'resolve'
    || !Number.isSafeInteger(entry.revision) || entry.revision < 1 || entry.revision > run.revision) return false;
  const action = scenario.stages.adapt.actions.find(action => action.id === entry.actionId);
  if (!action || !legacyStageNavigation(scenario, action) || run.flags.includes(`used:${action.id}`)
    || run.history.some(decision => decision.actionId === action.id)
    || run.history.some((decision, index) => decision.revision !== index
      || (index < entry.revision ? decision.stage === 'resolve' : decision.stage !== 'resolve'))) return false;
  return run.stage === 'resolve' || run.stage === 'debrief';
}

/** Public presentation only: no invented identities, hidden truth or changed outcomes. */
export function legacyActionPresentation(scenario: ScenarioDefinition, action: ActionDefinition, built: BuiltLocation): Pick<ActionDefinition, 'title' | 'summary' | 'outcomePreview'> {
  if (scenario.version !== 3 || scenario.incident?.contentVersion !== 3) return action;
  const target = [...built.location.rooms, ...built.location.zones].find(space => space.id === action.targetId)?.label.toLowerCase();
  const labels: Record<string, Pick<ActionDefinition, 'title' | 'summary' | 'outcomePreview'>> = {
    v3_welfare_contact: { title: 'Ask the reported person what happened', summary: action.summary },
    v3_welfare_observe: { title: target ? `Look for the person in the ${target}` : action.title, summary: action.summary },
    v3_welfare_reconcile: { title: 'Check who is there and whether they need help', summary: action.summary },
    v3_welfare_verify: { title: target ? `Knock at the ${target} and ask about the concern` : 'Knock and ask about the reported concern', summary: action.summary },
    v3_welfare_agreement: { title: 'Ask what help the person will accept', summary: action.summary },
    v3_welfare_prepare: { title: 'Arrange access and someone to accompany the visit', summary: action.summary },
    v3_welfare_voluntary: { title: 'Check the agreed plan and support contact are in place', summary: action.summary },
    v3_welfare_assist: { title: 'Reach the person and give the agreed help', summary: action.summary },
    v3_welfare_recover: { title: 'Recheck what is unfinished and try to complete the help', summary: action.summary },
    v3_welfare_handover: { title: 'Brief specialists on the remaining welfare checks', summary: action.summary },
    assist_locate_person: { title: target ? `Find the person in the ${target}` : action.title, summary: action.summary },
    assist_commit_plan: {
      title: 'Brief the team on access and care arrangements',
      summary: 'Review the checks and preparations with the team before responding. A poor briefing can reveal gaps and add pressure.',
      outcomePreview: {
        favorable: 'The team is briefed using the current information and preparation. The person still needs a response.',
        mixed: 'The briefing takes extra time. Existing checks and preparation remain available.',
        adverse: 'Gaps in the plan add pressure. Revise the care arrangements before trying to help.',
      },
    },
    assist_informed_handover: { title: 'Brief specialists on location and unfinished care', summary: action.summary },
    v3_protect_contact: { title: 'Ask the person for their account of the incident', summary: action.summary },
    v3_protect_voluntary: { title: 'Confirm and carry out the person’s agreed next step', summary: action.summary },
    v3_protect_handover: { title: 'Brief specialists on the exit and unfinished protection', summary: action.summary },
  };
  return labels[action.id] ?? action;
}
