import type { ScenarioDefinition } from '../../sim/scenario-types';

/** Apply a text transform to display fields while preserving machine identifiers. */
export function mapScenarioText(input: ScenarioDefinition, text: (value: string) => string): ScenarioDefinition {
  const s = structuredClone(input);
  const fields = <T extends object>(value: T, names: readonly (keyof T)[]) => {
    for (const key of names) if (typeof value[key] === 'string') value[key] = text(value[key] as string) as T[keyof T];
  };
  const lines = (list: { speaker: string; line: string }[] | undefined) => { for (const line of list ?? []) fields(line, ['speaker', 'line']); };
  fields(s, ['title', 'summary', 'variantLabel', 'pressureLabel', 'coldOpen']);
  for (const person of s.briefing.people ?? []) fields(person, ['name', 'text']);
  s.briefing.known = s.briefing.known.map(text); s.briefing.unknown = s.briefing.unknown.map(text);
  fields(s.briefing, ['dispatchReason']);
  if (s.briefing.teamResponsibilities) s.briefing.teamResponsibilities = s.briefing.teamResponsibilities.map(text);
  for (const f of s.facts) {
    fields(f, ['label', 'markerSource', 'claim', 'source', 'note', 'reportedText', 'uncertainty']);
    fields(f.markers, ['unknown', 'reported', 'confirmed', 'disproved']);
    if (f.resolved) fields(f.resolved, ['confirmed', 'disproved']);
    if (f.person) fields(f.person, ['label']);
  }
  for (const o of s.objectives) fields(o, ['label']);
  for (const c of s.civilianOutcomes ?? []) fields(c, ['label']);
  for (const service of s.externalServices ?? []) fields(service, ['label', 'description']);
  for (const threat of s.threats ?? []) fields(threat, ['because']);
  if (s.difficulty) s.difficulty.drivers = s.difficulty.drivers.map(text);
  for (const stage of Object.values(s.stages)) {
    fields(stage, ['label', 'prompt']);
    for (const entry of stage.contextPrompts ?? []) { fields(entry, ['prompt']); lines(entry.exchange); if (entry.threat) fields(entry.threat, ['label']); }
    for (const a of stage.actions) {
      fields(a, ['title', 'summary', 'task', 'hazardReason']);
      if (a.weighing) fields(a.weighing, ['pull', 'cost']);
      for (const map of [a.outcomePreview, a.resultLabels]) if (map) fields(map, ['favorable', 'mixed', 'adverse']);
      for (const list of [a.requires.facts, a.requires.flags, a.requires.notFlags, a.requires.storyProps, a.requires.externalSupport])
        for (const item of list ?? []) fields(item, ['reason']);
      if (a.requires.minSquads) fields(a.requires.minSquads, ['reason']);
      for (const opening of a.requires.openings ?? []) fields(opening, ['blockedReason', 'lockedNote']);
      for (const list of [a.equipment, a.modifiers]) for (const item of list ?? []) fields(item, ['label']);
      if (a.certBonus) fields(a.certBonus, ['label']);
      if (a.threat) {
        fields(a.threat, ['label']);
        for (const effect of a.threat.effects) fields(effect, ['text']);
        // Push-back lines are spoken lines: bind their speaker and words like any exchange.
        for (const effect of (a.threat.pushback ?? []).flatMap(line => line.effects)) { fields(effect, ['text']); lines(effect.exchange); }
      }
      if (a.support) fields(a.support, ['label', 'task']);
      if (a.spatial) fields(a.spatial, ['noun']);
      // Drawn consequences (v13) carry their own effects per result: bind those too.
      for (const effect of Object.values(a.outcomes).flat().flatMap(entry => [entry, ...Object.values(entry.variants ?? {}).flat()])) {
        fields(effect, ['text']); lines(effect.exchange); if (effect.officerHarm) fields(effect.officerHarm, ['label']);
      }
    }
  }
  for (const ending of Object.values(s.endings)) {
    fields(ending, ['title', 'summary', 'epilogue']); for (const entry of ending.epilogueIf ?? []) fields(entry, ['epilogue']); if (ending.remainingTasks) ending.remainingTasks = ending.remainingTasks.map(text);
  }
  if (s.story) {
    if (s.story.episode) s.story.episode.publicContext = s.story.episode.publicContext.map(text);
    for (const person of Object.values(s.story.bindings.people)) {
      fields(person, ['label']);
      for (const transition of person.transitions) {
        fields(transition, ['label']); if ('label' in transition.to) fields(transition.to, ['label']);
      }
    }
    for (const prop of Object.values(s.story.bindings.props)) fields(prop, ['label']);
  }
  return s;
}
