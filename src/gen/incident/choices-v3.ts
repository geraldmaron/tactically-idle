import type { BuiltLocation } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { action, commonEndings, finalizeActions, type V3Context } from './common-v3';
import { buildWelfareV3 } from './welfare-v3';
import { buildAssistanceV3 } from './assistance-v3';
import { buildProtectiveV3 } from './protective-v3';

export function withVersionThreeChoices(scenario: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  scenario.version = 3;
  scenario.endings = commonEndings();
  const spec = scenario.incident!;
  const targetId = scenario.facts[0].spaceId;
  const targetName = built.location.rooms.find((room) => room.id === targetId)!.label.toLowerCase();
  const opening = built.location.openings.find((candidate) => candidate.type === 'door' && (candidate.a === targetId || candidate.b === targetId));
  const ctx: V3Context = { scenario, built, targetId, targetName, entryId: built.location.entries[0], openingId: opening?.id, difficulty: 34 + spec.tier * 3 };
  scenario.environment = { timeOfDay: spec.seed % 3 === 0 ? 'night' : 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: false, plansOnFile: false, alarm: spec.type === 'burglary' || spec.type === 'business_robbery' ? 'triggered' : 'none', cctv: false };
  if (spec.type === 'medical_complication') buildAssistanceV3(ctx);
  else if (spec.type === 'barricaded' || spec.type === 'business_robbery' || spec.type === 'disturbance') buildProtectiveV3(ctx);
  else buildWelfareV3(ctx);
  finalizeActions(scenario);
  return scenario;
}

// Re-export only the public authoring helper for focused content tests.
export { action };
