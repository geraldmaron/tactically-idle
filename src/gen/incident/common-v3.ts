// Content v3 is isolated from issued v1/v2 definitions. All preparation is one-shot;
// its value comes from subsequent gates/effects, never repeatable progress awards.
import type { ActionDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand, StageId } from '../../sim/types';
import { hashSeed } from '../../sim/rng';

export interface V3Context {
  scenario: ScenarioDefinition;
  built: BuiltLocation;
  targetId: string;
  targetName: string;
  entryId: string;
  openingId?: string;
  difficulty: number;
}

// A card describes the attempted action. Outcome forecasts are separate, conditional copy.
export function action(ctx: V3Context, id: string, stage: StageId, title: string, summary: string, icon: ActionDefinition['icon'], preview: Record<OutcomeBand, string>, over: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id, stage, title, icon, summary, targetId: ctx.targetId, task: title,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.55 }, { key: 'composure', weight: 0.45 }], difficulty: ctx.difficulty },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 3,
    outcomePreview: preview, consequenceLevel: 'moderate', outcomes: { favorable: [], mixed: [], adverse: [] },
    ...over,
  };
}

export function finalizeActions(scenario: ScenarioDefinition): void {
  for (const stage of Object.values(scenario.stages)) for (const a of stage.actions) {
    const flag = `used:${a.id}`;
    a.requires.notFlags = [...a.requires.notFlags ?? [], { flag, reason: 'This step has already been attempted' }];
    a.visibleWhen = { ...a.visibleWhen, notFlags: [...a.visibleWhen?.notFlags ?? [], flag] };
    for (const band of ['favorable', 'mixed', 'adverse'] as const) a.outcomes[band].unshift({ setFlags: [flag] });
  }
}

// Independent fact streams avoid making hidden truth a synonym for public time,
// building layout, or the equipment variant selected by the same incident seed.
export function incidentTruth(ctx: V3Context, claim: string, likelihood = 0.65): boolean {
  return hashSeed(`${ctx.scenario.incident!.seed}:truth:${claim}`) / 0x100000000 < likelihood;
}

export function commonEndings(): ScenarioDefinition['endings'] {
  const ending = (id: string, title: string, summary: string, trustAdjust: number, strain: number) => ({ id, title, summary, trustAdjust, strain });
  return {
    report_disproved: ending('report_disproved', 'Mistaken report closed', 'The team checked the report, found it was wrong, and explained the correction to the caller.', 2, -3),
    voluntary_resolution: ending('voluntary_resolution', 'Agreed plan completed', 'The person agreed on the next step. The team confirmed who would help and closed the immediate call.', 2, -3),
    aid_completed: ending('aid_completed', 'Help completed', 'The person received the planned help. The team passed the details to anyone providing further support.', 1, -2),
    protective_resolution: ending('protective_resolution', 'Response completed', 'The team completed the response and handed over any remaining support. The recorded safety losses still apply.', 1, -1),
    protected_transfer: ending('protected_transfer', 'Person brought outside', 'The person reached the agreed meeting point, where the waiting team took over.', 1, -1),
    informed_handover: ending('informed_handover', 'Specialists took over', 'Specialists received the checked details, remaining concerns, and what the team had tried. They are responsible for the next steps.', 1, 0),
    partial_followthrough: ending('partial_followthrough', 'More help or checks needed', 'The team passed on what it knew. The receiving team still needs to finish important checks or arrangements.', 0, 2),
    withdrawal_with_info: ending('withdrawal_with_info', 'Team left; call unresolved', 'The team left and passed on what it knew and what it could not confirm. The original concern remains open.', -1, 1),
    handed_over: ending('handed_over', 'Another team took over', 'No available choices remained. The team passed on its observations and the unresolved concern.', 0, 1),
  };
}
