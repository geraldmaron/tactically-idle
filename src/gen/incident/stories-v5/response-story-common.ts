import type { ActionDefinition, Condition, FactDefinition, OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import type { BuiltLocation, OutcomeBand, StageId } from '../../../sim/types';

export const RESPONSE_BANDS: OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
export const noOfficerDuty = ['casualty:untreated', 'casualty:awaiting_transport'];
export interface ResponseStory {
  s: ScenarioDefinition;
  built: BuiltLocation;
  target: string;
  outside: string;
  difficulty: number;
  id: (name: string) => string;
}
/** New stories keep only location/reward metadata from the supplied generated shell. */
export function responseStory(input: ScenarioDefinition, built: BuiltLocation, prefix: string): ResponseStory {
  const s = structuredClone(input);
  s.version = 5;
  s.facts = [];
  s.civilianOutcomes = [];
  s.externalServices = [];
  s.endings = {};
  s.stages = {
    assess: { id: 'assess', label: 'First contact', prompt: '', actions: [] },
    adapt: { id: 'adapt', label: 'What changed', prompt: '', actions: [] },
    resolve: { id: 'resolve', label: 'Follow through', prompt: '', actions: [] },
  };
  s.environment = { timeOfDay: 'night', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: false, plansOnFile: false, alarm: 'none', cctv: false };
  return { s, built, target: input.facts[0].spaceId, outside: built.location.entries[0], difficulty: 32 + (input.incident?.tier ?? 1) * 3, id: name => `${prefix}${name}` };
}
export function responseFact(ctx: ResponseStory, name: string, label: string, truth: boolean, claim: string, confirmed: string, disproved: string, hidden = false): FactDefinition {
  return { id: ctx.id(name), label, spaceId: ctx.target, truth, initial: hidden ? 'unknown' : 'reported', showWhenUnknown: !hidden, markers: { reported: 'CHECK NEEDED', confirmed: 'CHECKED', disproved: 'RULED OUT' }, claim, source: hidden ? null : 'Dispatch report', note: hidden ? null : 'This account still needs checking.', resolved: { confirmed, disproved }, uncertainty: hidden ? 'Further details depend on the conversation.' : claim };
}
export const responsePreview = (text: string): ActionDefinition['outcomePreview'] => ({ favorable: text, mixed: text, adverse: text });
export function responseAction(ctx: ResponseStory, name: string, stage: StageId, title: string, summary: string, preview: string | NonNullable<ActionDefinition['outcomePreview']>, extra: Partial<ActionDefinition> = {}): ActionDefinition {
  return { id: ctx.id(name), stage, title, summary, task: title, targetId: ctx.target, icon: 'radio', requires: {}, check: { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty: ctx.difficulty }, approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 3, capabilities: { rules: [], deescalation: true }, consequenceLevel: 'low', outcomePreview: typeof preview === 'string' ? responsePreview(preview) : preview, outcomes: { favorable: [], mixed: [], adverse: [] }, ...extra };
}
export function responseSame(action: ActionDefinition, effects: OutcomeEffect[]): ActionDefinition {
  for (const band of RESPONSE_BANDS) action.outcomes[band] = structuredClone(effects);
  return action;
}
export function responseVisible(ctx: ResponseStory, flags: string[] = [], notFlags: string[] = []): Condition {
  return { flags: flags.map(ctx.id), notFlags: notFlags.map(ctx.id) };
}
export const responseFlag = (ctx: ResponseStory, name: string, reason: string) => ({ flag: ctx.id(name), reason });
export const responseKnown = (ctx: ResponseStory, name: string, reason: string, status: 'confirmed' | 'disproved' = 'confirmed') => ({ factId: ctx.id(name), in: [status], reason });
export function responseDoors(ctx: ResponseStory): NonNullable<ActionDefinition['requires']['openings']> {
  return ctx.built.location.openings.filter(o => (o.a === ctx.target || o.b === ctx.target) && ['door', 'doorway', 'sliding'].includes(o.type)).slice(0, 1).map(o => ({ openingId: o.id, blockedReason: 'The checked route is blocked; this move cannot be completed.', lockedNote: 'The locked route adds time before this move can be completed.' }));
}
export function responseFinish(ctx: ResponseStory): ScenarioDefinition {
  for (const stage of Object.values(ctx.s.stages)) for (const action of stage.actions) {
    const used = `used:${action.id}`;
    action.visibleWhen = { ...action.visibleWhen, notFlags: [...action.visibleWhen?.notFlags ?? [], used] };
    action.requires.notFlags = [...action.requires.notFlags ?? [], { flag: used, reason: 'This step has already been attempted' }];
    for (const effects of Object.values(action.outcomes)) effects.unshift({ setFlags: [used], ...(action.stage === 'resolve' ? { stage: 'resolve' as const } : {}) });
  }
  return ctx.s;
}
export function responsePartial(ctx: ResponseStory, stage: StageId, text: string, ending = 'partial'): ActionDefinition {
  return responseSame(responseAction(ctx, `${stage}_partial`, stage, 'End with the progress made', 'Keep the checked facts and the help still needed in the record.', text, { icon: 'handover', commandOnly: true, workload: { base: 1, perSqFt: 0 }, stressBase: 0 }), [{ ending: ctx.id(ending), objective: 20, text }]);
}
