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

export function action(ctx: V3Context, id: string, stage: StageId, title: string, icon: ActionDefinition['icon'], preview: Record<OutcomeBand, string>, over: Partial<ActionDefinition> = {}): ActionDefinition {
  return {
    id, stage, title, icon, summary: preview.favorable, targetId: ctx.targetId, task: title,
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
    report_disproved: ending('report_disproved', 'Report disproved and closed', 'The team checked the claim, recorded what disproved it, and explained the correction to the caller. No person was treated as a confirmed threat.', 2, -3),
    voluntary_resolution: ending('voluntary_resolution', 'A voluntary way forward', 'A verified conversation produced an agreed next step. The team documented who would follow through and closed the immediate concern.', 2, -3),
    aid_completed: ending('aid_completed', 'Assistance completed', 'The located person received the planned assistance. The team checked the immediate need and passed the relevant information to continuing support.', 1, -2),
    protective_resolution: ending('protective_resolution', 'Protective response completed', 'The qualified team completed the verified protective objective and transferred the remaining support responsibility. The recorded safety cost remains part of the outcome.', 1, -1),
    protected_transfer: ending('protected_transfer', 'Protected transfer completed', 'The prepared route and receiving support let the person leave the incident safely. Responsibility was explicitly transferred at the agreed meeting point.', 1, -1),
    informed_handover: ending('informed_handover', 'Specialists have a verified handover', 'Specialists received checked locations, the outstanding concern, and a clear account of what the team had already tried. Continuing support remains their responsibility.', 1, 0),
    partial_followthrough: ending('partial_followthrough', 'Follow-through remains outstanding', 'The available information was passed on, but important checks or practical arrangements remain incomplete. The receiving team has the outstanding tasks.', 0, 2),
    withdrawal_with_info: ending('withdrawal_with_info', 'Withdrew with the information preserved', 'The team stepped back after recording what it knew and what remained uncertain. The original concern is still open for the receiving team.', -1, 1),
    handed_over: ending('handed_over', 'Responsibility transferred', 'Available options were exhausted. The recorded observations and unresolved concern were passed to continuing support.', 0, 1),
  };
}
