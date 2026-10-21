// Content descriptors a call's data can see (docs/content-rating.md, "Derived and declared"), and
// the gate that holds each situation's declared list to them.
//
// Reach is walked per situation from the root and from where this situation's clocks send the call
// when they run out, through every turn and group size any call can draw. An outcome counts when its
// node is reached and none of its conditions is false here: a fact against this situation's truth
// (a building-settled fact may go either way), a clock low or out that this situation doesn't have.
// Meters, marks and timing never rule one out, so the list is what some call of this situation can
// show, never less.
import { CONTENT_DESCRIPTORS, type ContentDescriptor } from '../../../content/content-descriptors';
import type { CallTree, TreeIf, TreeNext, TreeOutcome } from '../../../content/call-trees/types';
import { ageBandOf, type IncidentTemplate } from '../../../content/incidents/types';
import type { OutcomeBand } from '../../../sim/types';
import { outcomeNexts } from '../trees-v13/compile';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
export type Situation = 0 | 1 | 2;

/** Every outcome this situation can reach, with where it sits. */
export function reachableOutcomes(template: IncidentTemplate, situation: Situation): { node: string; choice: string; band: OutcomeBand; outcome: TreeOutcome }[] {
  const tree = template.tree;
  const clocks = new Set((template.situations.find(model => model.index === situation)?.clocks ?? []).map(clock => clock.id));
  const holds = (entry: TreeIf) => {
    if ('fact' in entry) {
      const truth = tree.facts[entry.fact]?.truth ?? tree.situations[situation].truth[entry.fact];
      return truth === undefined || truth === entry.is;
    }
    // A clock this call doesn't have is never low or out.
    if ('low' in entry) return clocks.has(entry.clock) || !entry.low;
    if ('out' in entry) return clocks.has(entry.clock) || !entry.out;
    return true;
  };
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const land = (next: TreeNext): string[] => 'node' in next ? [next.node] : 'turn' in next ? tree.turns?.[next.turn] ?? [] : [];
  const fromClocks = (template.situations.find(model => model.index === situation)?.clocks ?? [])
    .flatMap(clock => !clock.story ? [clock.onOut?.next, clock.onFull?.next].flatMap(next => next ? land(next) : []) : []);
  const seen = new Set([tree.root, ...fromClocks]);
  const found: { node: string; choice: string; band: OutcomeBand; outcome: TreeOutcome }[] = [];
  for (const queue = [...seen]; queue.length;) {
    const node = byId.get(queue.shift()!);
    if (!node) continue;
    for (const choice of node.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band]) {
      if (!([] as TreeIf[]).concat(outcome.if ?? []).every(holds)) continue;
      found.push({ node: node.id, choice: choice.id, band, outcome });
      for (const id of outcomeNexts(outcome).flatMap(land)) if (!seen.has(id)) { seen.add(id); queue.push(id); }
    }
  }
  return found;
}

/** The descriptors this situation's data sets, in list order. `death`: a reachable fatal harm, or
 * a force outcome without `noFatal` (its fatal result routes with the hurt one when it names no
 * route of its own, compile.ts). `injury`: any reachable harm, an officer injury, the subject firing
 * at the team, force (its hurt result), or a clock of this situation that harms when it runs out.
 * `police_gunfire`: any reachable force outcome. */
export function derivedDescriptors(template: IncidentTemplate, situation: Situation): ContentDescriptor[] {
  const outcomes = reachableOutcomes(template, situation).map(entry => entry.outcome);
  const clockHarm = (template.situations.find(model => model.index === situation)?.clocks ?? []).some(clock => clock.onOut?.harm || clock.onFull?.harm);
  const found = new Set<ContentDescriptor>();
  for (const outcome of outcomes) {
    const harms = Object.values(outcome.harm ?? {});
    if (harms.includes('fatal') || (outcome.force && !outcome.force.noFatal)) found.add('death');
    if (harms.length || outcome.officer || outcome.fire || outcome.force) found.add('injury');
    if (outcome.force) found.add('police_gunfire');
  }
  if (clockHarm) found.add('injury');
  return CONTENT_DESCRIPTORS.filter(descriptor => found.has(descriptor));
}

/** Subjects this situation spares with `noFatal` force who can be drawn as adults (drawn years
 * reaching 18, or else an adult or elderly age band, after the situation's override): the people the E4 cross-check
 * covers. Minors are never killed anyway, so `noFatal` on them says nothing about self-harm. */
export function adultNoFatalSubjects(template: IncidentTemplate, situation: Situation): string[] {
  const tree = template.tree;
  const spared = new Set(reachableOutcomes(template, situation).flatMap(({ outcome }) => outcome.force?.noFatal ? [outcome.force.on] : []));
  const model = template.situations.find(entry => entry.index === situation);
  return tree.roles.filter(role => role.kind === 'subject' && spared.has(role.id)).filter(role => {
    const slot = template.cast.find(entry => entry.keyRoles.includes(role.id));
    // As drawInstance resolves a person: the role's override, else the slot's, merged shallowly
    // over the slot's person; drawn years, when given, set the age band in place of `age`.
    const person = { ...slot?.person, ...(model?.people?.[role.id] ?? (slot ? model?.people?.[slot.id] : undefined)) };
    const years = person.identity?.years;
    if (years) return ageBandOf(years.max) === 'adult' || ageBandOf(years.max) === 'elderly';
    const age = person.age ?? 'adult';
    const bands = typeof age === 'string' ? [age] : age.pick.map(([band]) => band);
    return bands.some(band => band === 'adult' || band === 'elderly');
  }).map(role => role.id);
}

export interface DescriptorFinding { type: string; situation: Situation; message: string }

/** The gate: a situation's declared list leaves out nothing its data derives, and an adult subject
 * spared by `noFatal` force has `suicide_self_harm` declared or a recorded screen reason. A
 * situation with no list declares nothing. */
export function descriptorFindings(template: IncidentTemplate): DescriptorFinding[] {
  const tree: CallTree = template.tree;
  return ([0, 1, 2] as const).flatMap(situation => {
    const declared = new Set(tree.situations[situation].descriptors ?? []);
    const findings: DescriptorFinding[] = [];
    const missing = derivedDescriptors(template, situation).filter(descriptor => !declared.has(descriptor));
    if (missing.length) findings.push({ type: tree.type, situation, message: `situation ${situation} leaves out ${missing.join(', ')}, which its data derives` });
    const spared = adultNoFatalSubjects(template, situation);
    if (spared.length && !declared.has('suicide_self_harm') && !tree.situations[situation].selfHarmScreened?.trim())
      findings.push({ type: tree.type, situation, message: `situation ${situation} spares ${spared.join(', ')} with noFatal force but declares neither suicide_self_harm nor a selfHarmScreened reason` });
    const unknown = [...declared].filter(descriptor => !(CONTENT_DESCRIPTORS as readonly string[]).includes(descriptor));
    if (unknown.length) findings.push({ type: tree.type, situation, message: `situation ${situation} declares ${unknown.join(', ')}, which is not a content descriptor` });
    return findings;
  });
}
