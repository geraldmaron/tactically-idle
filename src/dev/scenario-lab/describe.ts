// Plain-text descriptions of authored scenario data for the scenario lab: conditions,
// requirements, checks and outcome effects, with fact, room and service IDs resolved to the
// labels the scenario gives them. Developer wording; never shown in the game.
import type { ActionDefinition, ActionRequirements, Condition, OutcomeEffect, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, Id } from '../../sim/types';
import { CERT_LABEL, RATING_LABEL } from '../../sim/resolution';

export const pct = (p: number) => `${Math.round(p * 1000) / 10}`;
export const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`;

export function factLabel(s: ScenarioDefinition, id: Id): string {
  return s.facts.find(fact => fact.id === id)?.label ?? id;
}
export function actionTitle(s: ScenarioDefinition, id: Id): string {
  for (const stage of [s.stages.assess, s.stages.adapt, s.stages.resolve]) { const action = stage.actions.find(a => a.id === id); if (action) return action.title; }
  return id;
}
export function serviceLabel(s: ScenarioDefinition, id: Id): string {
  return s.externalServices?.find(service => service.id === id)?.label ?? id;
}
export function spaceLabel(built: BuiltLocation | null, id: Id | null | undefined): string {
  if (!id) return '—';
  const space = built?.location.rooms.find(room => room.id === id) ?? built?.location.zones.find(zone => zone.id === id);
  return space ? space.label : id;
}

export function conditionText(c: Condition | undefined, s: ScenarioDefinition): string[] {
  if (!c) return [];
  const out: string[] = [];
  for (const fact of c.facts ?? []) out.push(`${factLabel(s, fact.factId)} is ${fact.in.join(' or ')}`);
  if (c.flags?.length) out.push(`flags ${c.flags.join(', ')}`);
  if (c.notFlags?.length) out.push(`not ${c.notFlags.join(', ')}`);
  if (c.pressureAtLeast !== undefined) out.push(`pressure ≥ ${c.pressureAtLeast}`);
  if (c.pressureBelow !== undefined) out.push(`pressure < ${c.pressureBelow}`);
  return out;
}

export function requirementText(r: ActionRequirements, s: ScenarioDefinition): string[] {
  const out: string[] = [];
  if (r.certs?.length) out.push(`cert: ${r.certs.map(cert => CERT_LABEL[cert] ?? cert).join(' + ')}`);
  if (r.allTags?.length) out.push(`carries all: ${r.allTags.join(', ')}`);
  if (r.anyTags?.length) out.push(`carries any: ${r.anyTags.join(' / ')}`);
  if (r.minSquads) out.push(`${r.minSquads.count}+ squads (${r.minSquads.reason})`);
  for (const fact of r.facts ?? []) out.push(`${factLabel(s, fact.factId)} ${fact.in.join('/')} (${fact.reason})`);
  for (const flag of r.flags ?? []) out.push(`flag ${flag.flag} (${flag.reason})`);
  for (const flag of r.notFlags ?? []) if (!flag.flag.startsWith('used:')) out.push(`not ${flag.flag} (${flag.reason})`);
  for (const service of r.externalSupport ?? []) out.push(`${serviceLabel(s, service.serviceId)} ${service.status} (${service.reason})`);
  for (const opening of r.openings ?? []) out.push(`opening ${opening.openingId}${opening.lockedTag ? ` (locked needs ${opening.lockedTag})` : ''}`);
  if (r.env?.length) out.push(`needs ${r.env.join(', ')}`);
  if (r.responsivePeople?.length) out.push(`responsive: ${r.responsivePeople.join(', ')}`);
  for (const prop of r.storyProps ?? []) out.push(`prop ${prop.propId} (${prop.reason})`);
  return out;
}
/** The three bands change the run identically (ignoring prose): the check decides nothing. */
export function bandsIdentical(a: ActionDefinition): boolean {
  const strip = (band: 'favorable' | 'mixed' | 'adverse') => JSON.stringify(a.outcomes[band].map(({ text: _text, ...rest }) => rest));
  return strip('favorable') === strip('mixed') && strip('mixed') === strip('adverse');
}
export const isOneShot = (a: ActionDefinition) => !!a.requires.notFlags?.some(flag => flag.flag === `used:${a.id}`);

export function checkText(a: ActionDefinition): string {
  const ratings = a.check.ratings.map(r => `${RATING_LABEL[r.key] ?? r.key} ${Math.round(r.weight * 100)}%`).join(', ');
  return `${a.check.kind} check · ${ratings} · difficulty ${a.check.difficulty}`;
}

export function equipmentText(a: ActionDefinition): string[] {
  const out = (a.equipment ?? []).map(e => `${e.label} (${e.tag}) +${e.value}${e.narrowValue !== undefined ? `, +${e.narrowValue} narrow` : ''}${e.group ? `, group ${e.group}` : ''}${e.range ? `, range ${e.range}` : ''}`);
  if (a.certBonus) out.push(`${a.certBonus.label} (${a.certBonus.cert}) +${a.certBonus.value}`);
  for (const use of a.consumes ?? []) out.push(`consumes ${use.qty} × ${use.tag}`);
  return out;
}

export function capabilityText(a: ActionDefinition): string[] {
  const c = a.capabilities;
  const out: string[] = [];
  if (c) {
    if (c.rules.length) out.push(`rules ${c.rules.join(', ')}`);
    if (c.required?.length) out.push(`required ${c.required.join(', ')}`);
    if (c.responseContext) out.push(`context ${c.responseContext}`);
    if (c.accessMethod) out.push(`access ${c.accessMethod}`);
    if (c.deescalation) out.push('de-escalation');
    if (c.vehicleAccessible !== undefined) out.push(c.vehicleAccessible ? 'vehicle accessible' : 'no vehicle access');
  }
  if (a.forceProfile) out.push(`force: ${a.forceProfile.kind} on ${a.forceProfile.personId} (${a.forceProfile.personRole})`);
  if (a.personCare) out.push(`care: ${a.personCare.kind} ${a.personCare.personId}`);
  if (a.commandOnly) out.push('command only');
  if (a.awaitSupport) out.push(`waits for ${a.awaitSupport}`);
  if (a.storyRoute) out.push(`route ${a.storyRoute} (${a.storyRouteActor ?? 'person'})`);
  if (a.support) out.push(`support: ${a.support.label}, up to ${a.support.maxSquads} squad(s), +${a.support.max}`);
  for (const m of a.modifiers ?? []) out.push(`${m.source === 'difficulty' ? 'difficulty' : 'score'} ${m.value > 0 ? '+' : ''}${m.value} when ${conditionTextShort(m.when)}: ${m.label}`);
  return out;
}
const conditionTextShort = (c: Condition) => [
  ...(c.facts ?? []).map(f => `${f.factId} ${f.in.join('/')}`), ...(c.flags ?? []), ...(c.notFlags ?? []).map(f => `!${f}`),
  ...(c.pressureAtLeast !== undefined ? [`pressure ≥ ${c.pressureAtLeast}`] : []), ...(c.pressureBelow !== undefined ? [`pressure < ${c.pressureBelow}`] : []),
].join(', ') || 'always';

/** One outcome effect as short chips (what changes) plus its condition and text. */
export function effectParts(e: OutcomeEffect, s: ScenarioDefinition): { when: string[]; chips: string[]; text: string | null } {
  const chips: string[] = [];
  if (e.stage) chips.push(`→ ${e.stage}`);
  if (e.ending) chips.push(`END ${s.endings[e.ending]?.title ?? e.ending}`);
  for (const k of e.knowledge ?? []) chips.push(`${factLabel(s, k.factId)} = ${k.status}`);
  for (const id of e.reveal ?? []) chips.push(`reveal ${factLabel(s, id)}`);
  const flags = (e.setFlags ?? []).filter(flag => !flag.startsWith('used:'));
  if (flags.length) chips.push(`+ ${flags.join(', ')}`);
  if (e.clearFlags?.length) chips.push(`− ${e.clearFlags.join(', ')}`);
  for (const id of e.requestSupport ?? []) chips.push(`request ${serviceLabel(s, id)}`);
  for (const id of e.acceptSupport ?? []) chips.push(`accept ${serviceLabel(s, id)}`);
  if (e.objective) chips.push(`objective ${signed(e.objective)}`);
  if (e.civilian) chips.push(`civilian ${signed(e.civilian)}`);
  if (e.pressure) chips.push(`pressure ${signed(e.pressure)}`);
  if (e.extraMinutes) chips.push(`+${e.extraMinutes} min`);
  for (const o of e.openings ?? []) chips.push(`${o.openingId} ${o.state}`);
  if (e.storyExitState) chips.push(`exit ${e.storyExitState}`);
  if (e.officerHarm) chips.push(`officer ${e.officerHarm.severity}: ${e.officerHarm.label}`);
  if (e.officerCare) chips.push(`officer care ${e.officerCare}`);
  const when = [...conditionText(e.when, s), ...(e.truth ?? []).map(t => `truth: ${factLabel(s, t.factId)} is ${t.is ? 'true' : 'false'}`)];
  return { when, chips, text: e.text ?? null };
}
