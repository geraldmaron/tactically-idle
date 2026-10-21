// The push-back gate (docs/call-pressure.md, "Push-back lines"): a threat's lines are never played
// in a situation that declares `suicide_self_harm` (E4). The lines live on a node's threat, shared by
// every situation of the tree, so the compiler strips them where the situation declares the theme
// (trees-v13/compile.ts); this gate compiles each such situation and fails if a compiled threat
// still carries any. It also holds each line to its rules: a threshold above 0 and below the threat's
// minutes, a unique id, and a speaking role or group.
import type { CallTree } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { buildLocation } from '../../../sim/location';
import type { ScenarioDefinition } from '../../../sim/scenario-types';
import { generateIncident } from '../index';
import { compileIncident, hostedSpec } from '../instance';
import { scenarioRecipe } from '../../../content/scenario-recipes';

export interface PushbackFinding { type: string; message: string }

/** The tree's own rules for its lines, read from the data. */
export function pushbackDataFindings(tree: CallTree): PushbackFinding[] {
  const speakers = new Set([...tree.roles.map(role => role.id), ...Object.keys(tree.groups ?? {})]);
  return tree.nodes.flatMap(node => {
    const threat = node.threat;
    if (!threat?.pushback?.length) return [];
    const ids = new Set<string>();
    return threat.pushback.flatMap((line): PushbackFinding[] => {
      const found: PushbackFinding[] = [];
      const at = `${tree.type} ${node.id} push-back ${line.id}`;
      if (!line.id || ids.has(line.id)) found.push({ type: tree.type, message: `${at}: needs a unique id` });
      ids.add(line.id);
      if (!(line.at > 0 && line.at < threat.minutes)) found.push({ type: tree.type, message: `${at}: fires at ${line.at}, not above 0 and below the threat's ${threat.minutes} minutes` });
      if (!speakers.has(line.by)) found.push({ type: tree.type, message: `${at}: ${line.by} is no role or group` });
      if (!line.line.trim()) found.push({ type: tree.type, message: `${at}: is empty` });
      return found;
    });
  });
}

/** Compile a call of this situation of the template, or null when no building hosts it. */
function compileSituation(template: IncidentTemplate, situation: number): ScenarioDefinition | null {
  for (let seed = 1; seed < 400; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: template.type, familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base);
    if (scenarioRecipe(spec).variant !== situation) continue;
    try { return compileIncident({ ...base, id: `pushback-${template.type}-${situation}-${seed}`, incident: spec }, buildLocation(base.locationFamilyId, base.locationSeed), template); } catch { continue; }
  }
  return null;
}

/** The compiled choices that carry push-back lines. */
export function carriedPushback(scenario: ScenarioDefinition): string[] {
  return Object.values(scenario.stages).flatMap(stage => stage.actions).filter(action => action.threat?.pushback?.length).map(action => action.id);
}

/** The gate: a compiled call of a situation declaring `suicide_self_harm` carries no push-back
 * line on any threat, and a tree's lines keep to their rules. */
export function pushbackFindings(template: IncidentTemplate): PushbackFinding[] {
  const findings = pushbackDataFindings(template.tree);
  if (!template.tree.nodes.some(node => node.threat?.pushback?.length)) return findings;
  template.tree.situations.forEach((situation, index) => {
    if (!situation.descriptors?.includes('suicide_self_harm')) return;
    const compiled = compileSituation(template, index);
    if (!compiled) { findings.push({ type: template.tree.type, message: `situation ${index} declares suicide_self_harm and no building compiled it to check its push-back lines` }); return; }
    const carried = carriedPushback(compiled);
    if (carried.length) findings.push({ type: template.tree.type, message: `situation ${index} declares suicide_self_harm, but ${carried.length} compiled choices still carry push-back lines (e.g. ${carried[0]})` });
  });
  return findings;
}
