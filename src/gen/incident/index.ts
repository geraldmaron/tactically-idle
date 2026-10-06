import { restoreLegacyMaplePowerSnapshot } from '../../sim/compatibility/legacy-scenarios';
import { withVersionThreeChoices } from './choices-v3';
import { withVersionFourChoices } from './choices-v4';
import { withHighRiskVersionFourChoices } from './high-risk-v4';
import { withVersionFiveStory } from './stories-v5';
import { withVersionSixStory } from './stories-v6';
import { withVersionSevenScene } from './scenes-v7';
import { withVersionEightDecisions } from './decisions-v8';
import { furnishedFamilyIdV7 } from '../building/furnishing-v7';
import type { ActionDefinition, IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, Room, StageId, Vec } from '../../sim/types';
import { buildLocation, pointInPolygon, polygonBBox } from '../../sim/location';
import { hashSeed, next, pick } from '../../sim/rng';
import { tierRewardMultiplier } from '../../sim/incidents';
import { MS_OCCUPANCY } from '../../content/scenarios/ms-occupancy';
import { MS_URGENT } from '../../content/scenarios/ms-urgent';
import { BUILDING_FAMILIES } from '../building';
import { RESIDENTIAL_LAYOUT_NOTES } from '../../content/locations/residential-v1';

export interface IncidentTypeInfo {
  type: IncidentType;
  label: string;
  families: string[];
  squads: [min: number, max: number];
}
const homes = BUILDING_FAMILIES.filter((family) => family.setting !== 'business').map((family) => family.id);
const allFamilies = BUILDING_FAMILIES.map((f) => f.id);
// A bounded, playable neighbourhood catalog. Other schema types remain readable
// in legacy Maple seed IDs, but are not advertised as new generated templates.
export const INCIDENT_TYPES: IncidentTypeInfo[] = [
  { type: 'welfare_check', label: 'Welfare check', families: homes, squads: [1, 2] },
  { type: 'disturbance', label: 'Reported disturbance', families: allFamilies, squads: [1, 3] },
  { type: 'medical_complication', label: 'Medical assistance', families: allFamilies, squads: [1, 2] },
  { type: 'burglary', label: 'Alarm response', families: ['market_row'], squads: [1, 3] },
  { type: 'false_intruder', label: 'Uncertain occupancy', families: homes, squads: [1, 2] },
];
/** Future calls use v6; issued v1–v5 seed tuples retain their original content. */
export const INCIDENT_CONTENT_VERSION = 8;
/** Highest incident content version this build can read. */
export const SUPPORTED_INCIDENT_CONTENT_VERSION = 8;
export const INCIDENT_TYPES_V2: IncidentTypeInfo[] = [
  ...INCIDENT_TYPES,
  { type: 'barricaded', label: 'Reported barricade', families: homes, squads: [1, 3] },
  { type: 'business_robbery', label: 'Reported business robbery', families: ['market_row'], squads: [1, 3] },
];
export const HIGH_RISK_TYPES_V4: IncidentType[] = ['active_armed_incident', 'hostage_crisis', 'protected_rescue'];
export const INCIDENT_TYPES_V4: IncidentTypeInfo[] = [
  ...INCIDENT_TYPES_V2,
  { type: 'active_armed_incident', label: 'Active armed incident', families: allFamilies, squads: [1, 3] },
  { type: 'hostage_crisis', label: 'Hostage crisis', families: allFamilies, squads: [1, 3] },
  { type: 'protected_rescue', label: 'Protected rescue', families: allFamilies, squads: [1, 3] },
];
export const INCIDENT_TYPES_V5: IncidentTypeInfo[] = [
  { type: 'welfare_check', label: 'Conflicting reports', families: homes, squads: [1, 2] },
  { type: 'medical_complication', label: 'Medical assistance', families: ['market_row'], squads: [1, 2] },
  { type: 'barricaded', label: 'Protective response', families: homes, squads: [1, 3] },
  { type: 'active_armed_incident', label: 'Active armed incident', families: ['market_row'], squads: [1, 3] },
  { type: 'hostage_crisis', label: 'Hostage crisis', families: ['market_row'], squads: [1, 3] },
  { type: 'protected_rescue', label: 'Protected rescue', families: ['juniper_court_v1', 'willow_terrace_v1', 'harbour_court'], squads: [1, 3] },
];
const legacyTypes: IncidentType[] = ['domestic', 'person_in_crisis', 'barricaded', 'business_robbery', 'holding', 'missing_vulnerable', 'vacant_occupancy'];
const validTypes = new Set([...INCIDENT_TYPES_V4.map((x) => x.type), ...legacyTypes]);

/** The saved ID carries the entire deterministic seed tuple. */
export function incidentId(spec: IncidentSpec): string {
  return `gen:${spec.type}:${spec.familyId}:${spec.buildingSeed}:${spec.seed}:${spec.tier}:${spec.contentVersion}`;
}
export function parseIncidentId(id: string): IncidentSpec | null {
  const m = /^gen:([a-z_]+):([a-z0-9_]+):(\d+):(\d+):(\d+):(\d+)$/.exec(id);
  if (!m || !validTypes.has(m[1] as IncidentType)) return null;
  const [buildingSeed, seed, tier, contentVersion] = m.slice(3).map(Number);
  if (![buildingSeed, seed, tier, contentVersion].every(Number.isSafeInteger) || tier < 1 || tier > 5 || contentVersion < 1 || contentVersion > SUPPORTED_INCIDENT_CONTENT_VERSION) return null;
  if (HIGH_RISK_TYPES_V4.includes(m[1] as IncidentType) && (contentVersion < 4 || m[2] === 'maple_street')) return null;
  if (contentVersion >= 5 && !INCIDENT_TYPES_V5.some(type => type.type === m[1] && type.families.includes(m[2]))) return null;
  if (m[2] !== 'maple_street' && !allFamilies.includes(m[2])) return null;
  return { type: m[1] as IncidentType, familyId: m[2], buildingSeed, seed, tier, contentVersion };
}

/** Seeded placement in usable floor space, away from beds, desks and shelving. */
function occupantPoint(room: Room, built: BuiltLocation, seed: number): Vec {
  const bounds = polygonBBox(room.polygon);
  const free = (p: Vec) => pointInPolygon(p, room.polygon) && !built.location.objects.some((o) =>
    o.in === room.id && o.tags.includes('blocks_space') && p.x >= o.x - 0.4 && p.x <= o.x + o.w + 0.4 && p.y >= o.y - 0.4 && p.y <= o.y + o.h + 0.4,
  );
  let state = seed;
  for (let i = 0; i < 100; i++) {
    const x = next(state);
    const y = next(x.state);
    state = y.state;
    const p = { x: Math.round((bounds.x + 1 + x.value * (bounds.w - 2)) * 100) / 100, y: Math.round((bounds.y + 1 + y.value * (bounds.h - 2)) * 100) / 100 };
    if (free(p)) return p;
  }
  for (let y = bounds.y + 1; y < bounds.y + bounds.h - 1; y++)
    for (let x = bounds.x + 1; x < bounds.x + bounds.w - 1; x++) if (free({ x, y })) return { x, y };
  throw new Error(`No usable occupant position in ${room.id}`);
}

export function generateIncident(spec: IncidentSpec): ScenarioDefinition {
  if (!parseIncidentId(incidentId(spec))) throw new Error('Invalid incident specification');
  // Keep legacy actions and fact IDs stable. Previously saved Maple board specs
  // now resolve, while authored tutorial/practice scenarios remain untouched.
  if (spec.familyId === 'maple_street') {
    const old = structuredClone(spec.type === 'medical_complication' ? MS_URGENT : MS_OCCUPANCY);
    if (spec.contentVersion === 1) restoreLegacyMaplePowerSnapshot(old);
    return { ...old, id: incidentId(spec), locationSeed: spec.buildingSeed, incident: { ...spec } };
  }
  const locationFamilyId = spec.contentVersion >= 7 ? furnishedFamilyIdV7(spec.familyId) : spec.familyId;
  const built = buildLocation(locationFamilyId, spec.buildingSeed);
  if (built.issues.some((i) => i.severity === 'error')) throw new Error('Incident location is invalid');
  const { location } = built;
  const urgent = spec.type === 'medical_complication';
  const business = location.setting === 'business';
  const alarm = spec.type === 'burglary';
  const uncertain = spec.type === 'false_intruder';
  const kind = (spec.contentVersion >= 5 ? INCIDENT_TYPES_V5 : spec.contentVersion >= 4 ? INCIDENT_TYPES_V4 : spec.contentVersion >= 2 ? INCIDENT_TYPES_V2 : INCIDENT_TYPES).find((x) => x.type === spec.type);
  if (!kind || !kind.families.includes(spec.familyId)) throw new Error('Unsupported incident and building combination');
  const candidates = location.rooms.filter((r) => business ? ['office', 'storage'].includes(r.type) : urgent ? ['bedroom', 'bathroom', 'living'].includes(r.type) : ['bedroom', 'living'].includes(r.type));
  const chosen = pick(hashSeed(incidentId(spec)), candidates);
  const target = chosen.value;
  const targetName = target.label.toLowerCase();
  const at = occupantPoint(target, built, chosen.state);
  const hasWindow = location.openings.some((o) => o.type === 'window' && (o.a === target.id || o.b === target.id));
  const personLabel = urgent ? 'Person needing help' : business ? 'Staff member' : 'Resident';
  const report = spec.type === 'barricaded' ? `A caller reports a distressed person refusing to leave the ${targetName}. The report of a barricade has not been verified.`
    : spec.type === 'business_robbery' ? `A caller reports a possible robbery and a person in the ${targetName}. Staff locations and the circumstances are unconfirmed.`
    : urgent ? `A caller reports someone needs medical help in the ${targetName}.`
    : alarm ? `The shop alarm has sounded. A caller reports movement in the ${targetName}.`
      : uncertain ? `A neighbour reports an unfamiliar person in the ${targetName}; their identity is unconfirmed.`
        : spec.type === 'disturbance' ? `Raised voices were reported in the ${targetName}. The caller cannot explain what happened.`
          : `A neighbour has been unable to reach the resident, last reported in the ${targetName}.`;
  const layoutNote = RESIDENTIAL_LAYOUT_NOTES[spec.familyId] ?? (spec.familyId === 'cedar_close'
    ? 'A long, narrow hall links the bedrooms to the front room; the rear lane gives a second approach.'
    : spec.familyId === 'harbour_court'
      ? 'The flat opens onto a shared walkway and a small courtyard. Concrete outer walls limit signals.'
      : 'Shop shelving interrupts sightlines. The stockroom has its own steel delivery door.');
  const difficulty = 37 + spec.tier * 4;
  const action = (id: string, stage: StageId, title: string, icon: ActionDefinition['icon']): ActionDefinition => ({
    id, stage, title, icon, summary: '{lead} ready', targetId: target.id, task: title,
    requires: {}, check: { kind: 'coordination', ratings: [{ key: 'coordination', weight: 0.5 }, { key: 'composure', weight: 0.5 }], difficulty },
    approach: 'none', workload: { base: 3, perSqFt: 0 }, stressBase: 3,
    outcomes: { favorable: [], mixed: [], adverse: [] },
  });
  const contact = action('gen_contact', 'assess', 'Make contact', 'radio');
  contact.summary = `Call toward the ${targetName}`;
  contact.task = 'Contact';
  contact.approach = hasWindow ? 'window' : 'path';
  contact.check = { kind: 'contact', ratings: [{ key: 'communication', weight: 0.7 }, { key: 'composure', weight: 0.3 }], difficulty };
  contact.spatial = { channel: 'sound', subjectFactId: 'f_person', weight: 16, noun: 'Voice' };
  contact.equipment = [{ tag: 'throw_phone', value: 8, range: 'opening', label: 'a two-way line' }];
  contact.outcomes = {
    favorable: [{ stage: 'adapt', objective: 22, pressure: -5, knowledge: [{ factId: 'f_person', status: 'confirmed' }], setFlags: ['in_contact'], text: `Someone answered from the ${targetName}. A line of contact is open.` }],
    mixed: [{ stage: 'adapt', objective: 10, setFlags: ['in_contact'], text: 'A faint answer established contact, but the report remains unconfirmed.' }],
    adverse: [{ stage: 'adapt', pressure: 6, text: 'There was no clear answer. The team needs another way to check the report.' }],
  };
  const observe = action('gen_observe', 'assess', 'Check the report', 'intel');
  observe.summary = hasWindow ? 'Observe through an exterior opening' : 'Approach the room to observe';
  observe.task = 'Observe';
  observe.approach = hasWindow ? 'window' : 'path';
  observe.check = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.7 }, { key: 'coordination', weight: 0.3 }], difficulty };
  observe.spatial = { channel: 'visual', subjectFactId: 'f_person', weight: 16, noun: 'Sightline' };
  observe.workload = { base: 4, perSqFt: 0.018 };
  observe.outcomes = {
    favorable: [{ stage: 'adapt', objective: 20, knowledge: [{ factId: 'f_person', status: 'confirmed' }], text: `One person was seen in the ${targetName}.` }],
    mixed: [{ stage: 'adapt', objective: 8, text: 'There are signs of someone inside, but the view is incomplete.' }],
    adverse: [{ stage: 'adapt', pressure: 3, text: 'The observation did not settle the report.' }],
  };
  const verify = action('gen_verify', 'adapt', urgent ? 'Locate the person' : 'Verify the room', 'search');
  verify.summary = `Reach the ${targetName}`;
  verify.task = 'Checking';
  verify.approach = 'path';
  verify.check = { kind: 'observation', ratings: [{ key: 'awareness', weight: 0.6 }, { key: 'coordination', weight: 0.4 }], difficulty: difficulty - 4 };
  verify.workload = { base: 2, perSqFt: 0.025 };
  verify.capacityBound = location.rooms.some((r) => r.id === 'hall') ? ['hall', target.id] : [target.id];
  verify.outcomes = {
    favorable: [{ stage: 'resolve', objective: 20, knowledge: [{ factId: 'f_person', status: 'confirmed' }], setFlags: ['verified'], text: `${personLabel} was located in the ${targetName}; the team has a clear picture.` }],
    mixed: [{ stage: 'resolve', objective: 10, knowledge: [{ factId: 'f_person', status: 'confirmed' }], text: 'The person was located, though reaching the room took longer than planned.' }],
    adverse: [{ stage: 'resolve', pressure: 8, text: 'The approach stalled before the report could be verified.' }],
  };
  const coordinate = action('gen_coordinate', 'adapt', urgent ? 'Prepare medical support' : 'Coordinate support', 'perimeter');
  coordinate.summary = urgent ? 'Prepare help while the location remains uncertain' : 'Hold positions and share the caller’s account';
  coordinate.outcomes = {
    favorable: [{ stage: 'resolve', objective: 12, pressure: -5, setFlags: ['support_ready'], text: 'The team shared the report and prepared support.' }],
    mixed: [{ stage: 'resolve', objective: 6, setFlags: ['support_ready'], text: 'Support is ready, with gaps still left in the information.' }],
    adverse: [{ stage: 'resolve', pressure: 4, text: 'Coordination took time without improving the picture.' }],
  };
  const resolve = action('gen_resolve', 'resolve', urgent ? 'Bring the person to help' : alarm ? 'Resolve the alarm call' : uncertain ? 'Confirm identity and resolve' : spec.type === 'disturbance' ? 'Settle the disturbance' : 'Complete the welfare check', urgent ? 'medic' : 'door');
  resolve.summary = urgent ? 'Reach them and coordinate care' : 'Reach the person and settle the report';
  resolve.task = urgent ? 'Assistance' : 'Resolution';
  resolve.approach = 'path';
  resolve.tempo = urgent ? 'urgent' : 'normal';
  resolve.workload = { base: urgent ? 2 : 4, perSqFt: 0.015 };
  resolve.check = { kind: urgent ? 'medical' : 'contact', ratings: urgent ? [{ key: 'medical', weight: 0.7 }, { key: 'coordination', weight: 0.3 }] : [{ key: 'communication', weight: 0.6 }, { key: 'composure', weight: 0.4 }], difficulty: difficulty + 3 };
  resolve.modifiers = [
    { label: 'The report is still unconfirmed', when: { facts: [{ factId: 'f_person', in: ['unknown', 'reported'] }] }, source: 'difficulty', value: 8 },
    { label: 'Support prepared', when: { flags: ['support_ready'] }, source: 'preparation', value: 5 },
    { label: 'An open line of contact', when: { flags: ['in_contact'] }, source: 'preparation', value: 5 },
  ];
  if (urgent) resolve.equipment = [{ tag: 'medkit', value: 8, label: 'medical supplies ready' }];
  resolve.outcomes = {
    favorable: [{ ending: 'resolved', objective: 60, knowledge: [{ factId: 'f_person', status: 'confirmed' }], text: urgent ? 'The person reached medical support safely.' : business ? 'A staff member was found safe and the report was resolved.' : 'The resident was reached safely and the concern was resolved.' }],
    mixed: [{ ending: 'resolved_late', objective: 38, civilian: -5, text: 'The call was resolved, but delays made it harder for the person inside.' }],
    adverse: [{ ending: 'handed_over', objective: 20, civilian: -10, text: 'The team could not safely complete the call; specialists took over with the available information.' }],
  };
  const handover = action('gen_handover', 'resolve', 'Hand over to specialists', 'handover');
  handover.summary = 'Pass on the map and everything learned';
  handover.check.difficulty = 25;
  handover.outcomes = {
    favorable: [{ ending: 'handed_over', objective: 35, text: 'Specialists received a clear handover and the team’s observations.' }],
    mixed: [{ ending: 'handed_over', objective: 25, text: 'Specialists took over with a few gaps to fill.' }],
    adverse: [{ ending: 'handed_over', objective: 15, text: 'Specialists took over; the handover left some questions unanswered.' }],
  };
  const multiplier = tierRewardMultiplier(spec.tier);
  const scenario: ScenarioDefinition = {
    id: incidentId(spec), version: 1, code: `CALL ${String(spec.seed % 10000).padStart(4, '0')}`,
    title: location.name, setting: location.setting, locationFamilyId, locationSeed: spec.buildingSeed,
    summary: report, variantLabel: kind.label, pressureLabel: urgent ? 'Medical time pressure' : 'Time to verify',
    squadRange: { min: 1, max: Math.min(kind.squads[1], business ? 3 : 2) },
    briefing: { known: [report, layoutNote], unknown: ['The caller’s report has not been checked by the team.', urgent ? 'How quickly the person needs help.' : 'Why the person has not explained what happened.'] },
    facts: [{
      id: 'f_person', label: `Reported person in the ${targetName}`, spaceId: target.id, truth: true, initial: 'reported', showWhenUnknown: true,
      markers: { reported: urgent ? 'NEEDS HELP?' : 'PERSON?', confirmed: urgent ? 'PERSON LOCATED' : 'OCCUPIED' },
      markerSource: 'per caller', claim: `The caller reports someone in the ${targetName}.`, source: 'Caller (unverified)',
      note: 'Contact or observation can verify the reported location.', resolved: { confirmed: `${personLabel} has been located in the ${targetName}.` },
      person: { label: personLabel, at }, uncertainty: `Whether the caller has correctly placed someone in the ${targetName}`,
    }],
    objectives: [{ id: 'o_safety', label: urgent ? 'Bring the person to medical help' : 'Resolve the reported concern safely' }, { id: 'o_information', label: 'Verify the caller’s account' }],
    pressure: urgent ? { start: 30, perMinute: 1.7, threshold: 60, civilianPerMinute: 1.5 } : { start: 10 + spec.tier * 2, perMinute: 0.35, threshold: 75, civilianPerMinute: 1 },
    stages: {
      assess: { id: 'assess', label: 'Assess', prompt: `Check the report from the ${targetName}.`, actions: [contact, observe] },
      adapt: { id: 'adapt', label: 'Adapt', prompt: urgent ? 'Balance confirmation against time to help.' : 'Verify the location or prepare support with what you know.', actions: [verify, coordinate] },
      resolve: { id: 'resolve', label: 'Resolve', prompt: 'Complete the call or hand over the information.', actions: [resolve, handover] },
    },
    endings: {
      resolved: { id: 'resolved', title: urgent ? 'Medical support reached' : 'Concern resolved safely', summary: 'The team reached the person and completed the call.', trustAdjust: 1, strain: -2 },
      resolved_late: { id: 'resolved_late', title: 'Resolved after delays', summary: 'The concern was resolved, with avoidable delays.', trustAdjust: 0, strain: 1 },
      handed_over: { id: 'handed_over', title: 'Handed to specialist support', summary: 'Specialists took over with the available information.', trustAdjust: 0, strain: 0 },
    },
    rewards: { funding: Math.round((business ? 2100 : 1700) * multiplier), devPoints: Math.round(2 * multiplier), trust: Math.round(4 * multiplier), xp: Math.round(30 * multiplier) },
    incident: { ...spec },
  };
  if (spec.contentVersion === 8) return withVersionEightDecisions(withVersionSevenScene(withVersionSixStory(scenario, built), built), built);
  if (spec.contentVersion === 7) return withVersionSevenScene(withVersionSixStory(scenario, built), built);
  if (spec.contentVersion === 6) return withVersionSixStory(scenario, built);
  if (spec.contentVersion === 5) return withVersionFiveStory(scenario, built);
  if (spec.contentVersion === 4) return HIGH_RISK_TYPES_V4.includes(spec.type) ? withHighRiskVersionFourChoices(scenario, built) : withVersionFourChoices(scenario, built);
  if (spec.contentVersion === 3) return withVersionThreeChoices(scenario, built);
  return spec.contentVersion === 2 ? withVersionTwoCapabilities(scenario, built) : scenario;
}

/** Additive v2 mechanics. Never runs for a saved v1 scenario. */
function withVersionTwoCapabilities(s: ScenarioDefinition, built: BuiltLocation): ScenarioDefinition {
  s.version = 2;
  const spec = s.incident!;
  const target = s.facts[0].spaceId;
  const exterior = built.location.entries[0];
  const highRisk = spec.type === 'barricaded' || spec.type === 'business_robbery';
  const contact = s.stages.assess.actions.find((a) => a.id === 'gen_contact')!;
  const observe = s.stages.assess.actions.find((a) => a.id === 'gen_observe')!;
  const coordinate = s.stages.adapt.actions.find((a) => a.id === 'gen_coordinate')!;
  const verify = s.stages.adapt.actions.find((a) => a.id === 'gen_verify')!;
  const resolve = s.stages.resolve.actions.find((a) => a.id === 'gen_resolve')!;
  s.environment = { timeOfDay: spec.seed % 3 === 0 ? 'night' : 'day', weather: 'clear', power: 'on', clutter: 0, hazards: [], communication: 'normal', crowd: 0, keyholder: !highRisk, plansOnFile: false, alarm: spec.type === 'business_robbery' ? 'triggered' : 'none', cctv: false };
  contact.capabilities = { rules: [], deescalation: true };
  contact.equipment = [{ tag: 'hailer', value: 5, group: 'contact_link', label: 'one-way contact aid' }, { tag: 'throw_phone', value: 8, group: 'contact_link', range: 'opening', label: 'a two-way line' }];
  observe.capabilities = { rules: ['visible_exterior', 'dark_visible_scene'] };
  coordinate.targetId = exterior;
  coordinate.capabilities = { rules: ['weak_radio_link', 'scene_coordination'], vehicleAccessible: true };
  coordinate.support = { max: 8, coverSpaceId: exterior, reachMinutes: 15, maxSquads: 2, label: 'sharing the current report', task: 'Coordinate' };
  resolve.capabilities = { rules: [], deescalation: !highRisk || spec.type === 'barricaded' };

  const extra = (id: string, stage: StageId, title: string, targetId = target): ActionDefinition => ({
    id, stage, title, icon: 'shield', summary: title, targetId, task: title,
    requires: {}, check: { kind: 'execution', ratings: [{ key: 'composure', weight: 0.6 }, { key: 'coordination', weight: 0.4 }], difficulty: 40 + spec.tier * 4 },
    approach: 'none', observes: [], workload: { base: 3, perSqFt: 0 }, stressBase: 3,
    outcomes: {
      favorable: [{ objective: stage === 'resolve' ? 60 : 14, pressure: -3, ...(stage === 'resolve' ? { ending: 'resolved' } : {}), text: stage === 'resolve' ? 'The reported concern was resolved safely.' : 'The team completed the declared support task safely.' }],
      mixed: [{ objective: stage === 'resolve' ? 38 : 7, civilian: -4, ...(stage === 'resolve' ? { ending: 'resolved_late' } : {}), text: stage === 'resolve' ? 'The call was resolved after delay, with a reduced safety margin.' : 'The support task partly worked, with avoidable delay.' }],
      adverse: [{ objective: stage === 'resolve' ? 20 : 2, civilian: -12, pressure: 6, ...(stage === 'resolve' ? { ending: 'handed_over' } : {}), text: stage === 'resolve' ? 'The call remained unresolved; specialists took over after the safety margin worsened.' : 'The support task did not go as planned; specialists received the remaining concerns.' }],
    },
  });
  if (spec.type === 'medical_complication') {
    const medical = extra('gen_medical_aid', 'resolve', 'Provide qualified medical assistance');
    medical.icon = 'medic';
    medical.approach = 'path';
    medical.requires = { certs: ['advanced_first_aid'], allTags: ['medkit'], facts: [{ factId: 'f_person', in: ['confirmed'], reason: 'Locate the patient before giving assistance' }] };
    medical.consumes = [{ tag: 'medkit', qty: 1 }];
    medical.check = { kind: 'medical', ratings: [{ key: 'medical', weight: 0.8 }, { key: 'coordination', weight: 0.2 }], difficulty: 39 + spec.tier * 4 };
    medical.capabilities = { rules: ['medical_exposure'] };
    medical.equipment = [{ tag: 'medkit', value: 8, label: 'medical supplies ready' }];
    medical.outcomes.favorable[0].text = 'Qualified assistance resolved the medical concern and completed the care handover.';
    medical.outcomes.mixed[0].text = 'The medical concern was resolved after delays, with a reduced patient safety margin.';
    medical.outcomes.adverse[0].text = 'Medical assistance did not safely resolve the concern; specialist care took over after the patient safety margin worsened.';
    s.stages.resolve.actions.unshift(medical);
  }
  if (highRisk) {
    s.pressure = { start: 20 + spec.tier * 2, perMinute: 0.7, threshold: 75, civilianPerMinute: 1 };
    s.pressureLabel = 'Time to verify and protect';
    s.briefing.known.push('The report does not establish a threat. Communication, protected assistance and specialist handover are available alternatives.');
    s.briefing.unknown.push('The subject’s circumstances and safety of adjacent areas.');
    s.facts.push({ id: 'f_adjacent_safety', label: 'Adjacent area checked', spaceId: target, truth: true, initial: 'unknown', showWhenUnknown: false,
      markers: { unknown: 'UNCHECKED', confirmed: 'CHECKED' }, claim: 'The adjacent area has been checked.', source: null,
      note: 'Safety of the adjacent area is unconfirmed. Verify it before context-dependent intervention or access.', uncertainty: 'Whether the adjacent area has been checked' });
    for (const band of ['favorable', 'mixed'] as const) verify.outcomes[band][0].knowledge!.push({ factId: 'f_adjacent_safety', status: 'confirmed' });
    const containment = extra('gen_protective_containment', 'adapt', 'Maintain declared protective containment', exterior);
    containment.capabilities = { rules: ['authorized_response'], responseContext: spec.type === 'barricaded' ? 'constrained' : 'open' };
    containment.requires = { certs: ['entry_team'] };
    containment.equipment = [{ tag: 'shield', value: 5, narrowValue: 2, group: 'personal_protection', label: 'protected support' }];
    s.stages.adapt.actions.push(containment);
    const specialist = extra('gen_specialist_support', 'adapt', 'Prepare declared specialist support', exterior);
    specialist.summary = 'A qualified separate support role for the verified scene; blocked views offer no benefit';
    specialist.requires = { certs: ['precision_support'], allTags: ['precision_support'], minSquads: { count: 2, reason: 'Specialist support needs a separate supporting squad' } };
    specialist.spatial = { channel: 'visual', weight: 10, noun: 'Support view' };
    specialist.capabilities = { rules: ['specialist_support'], required: ['specialist_support'], subjectFactIds: ['f_person'] };
    specialist.support = { max: 6, coverSpaceId: exterior, reachMinutes: 12, maxSquads: 1, label: 'separate support role', task: 'Support' };
    s.stages.adapt.actions.push(specialist);

    resolve.title = 'Continue communication toward a voluntary resolution';
    resolve.summary = 'Verify the concern through calm contact; specialist handover remains available';
    resolve.task = 'Communication';
    resolve.approach = 'none';
    resolve.check.difficulty = 36 + spec.tier * 4;
    resolve.capabilities = { rules: [], deescalation: true };
    resolve.outcomes.favorable[0].text = 'Calm communication resolved the concern without a forced intervention.';
    const evacuation = extra('gen_protected_evacuation', 'resolve', 'Coordinate an exterior protected evacuation', exterior);
    evacuation.check.kind = 'coordination';
    evacuation.capabilities = { rules: ['vehicle_exterior'], vehicleAccessible: !built.location.zones.find((z) => z.id === exterior)?.tags.includes('narrow') };
    evacuation.outcomes.favorable[0].text = 'Exterior protected assistance resolved the reported concern and completed the evacuation handover.';
    evacuation.outcomes.mixed[0].text = 'The exterior evacuation was completed after delays, with a reduced civilian safety margin.';
    evacuation.outcomes.adverse[0].text = 'The exterior evacuation could not be completed safely; specialists took over the remaining concern.';
    s.stages.resolve.actions.push(evacuation);

    for (const [id, title, rule, tag, supply, cert] of [
      ['gen_device_option', 'Consider a device-class intervention', 'less_lethal_device', 'energy_device', 'energy_cartridge', 'less_lethal'],
      ['gen_impact_option', 'Consider an impact-class intervention', 'less_lethal_impact', 'impact_launcher', 'impact_supply', 'advanced_less_lethal'],
    ] as const) {
      const a = extra(id, 'resolve', title);
      a.summary = 'Requires verified context and a qualified operator; an adverse result can cause harm';
      a.requires = { allTags: [tag], certs: [cert] };
      a.consumes = [{ tag: supply, qty: 1 }];
      a.approach = 'path';
      a.spatial = { channel: 'visual', subjectFactId: 'f_person', weight: 10, noun: 'Scene view' };
      a.capabilities = { rules: [rule], required: [rule], subjectFactIds: ['f_person'], safetyFactIds: ['f_adjacent_safety'] };
      a.outcomes.favorable[0].text = `${rule === 'less_lethal_device' ? 'Device-class' : 'Impact-class'} intervention resolved the verified concern; the team completed the safety handover.`;
      a.outcomes.mixed[0].text = `${rule === 'less_lethal_device' ? 'Device-class' : 'Impact-class'} intervention resolved the concern after delay, with a reduced civilian safety margin.`;
      a.outcomes.adverse[0].civilian = -20;
      a.outcomes.adverse[0].text = `${rule === 'less_lethal_device' ? 'Device-class' : 'Impact-class'} intervention did not resolve the concern safely; civilian safety worsened and specialist care took over.`;
      s.stages.resolve.actions.push(a);
    }
    const door = built.location.openings.find((o) => o.type === 'door' && (o.a === target || o.b === target) && ['hollow_core', 'solid_core', 'steel'].includes(o.material ?? ''));
    if (door) for (const accessMethod of ['mechanical', 'charge'] as const) {
      // Steel supports a mechanical alternative; it never grants a charge bypass.
      if (accessMethod === 'charge' && door.material === 'steel') continue;
      const a = extra(`gen_access_${accessMethod}`, 'adapt', accessMethod === 'mechanical' ? 'Prepare qualified mechanical access' : 'Compare abstract single-use access');
      a.icon = 'door';
      a.approach = 'path';
      a.targetId = door.a === target ? door.b : door.a;
      a.requires = { allTags: [accessMethod === 'mechanical' ? 'rescue_tool' : 'door_charge'], certs: ['controlled_access'] };
      if (accessMethod === 'charge') a.consumes = [{ tag: 'door_charge', qty: 1 }];
      a.capabilities = { rules: ['permitted_door_access'], required: ['permitted_door_access'], accessMethod, openingId: door.id, safetyFactIds: ['f_adjacent_safety'] };
      for (const [band, civilian] of [['favorable', -2], ['mixed', -6], ['adverse', -14]] as const) {
        a.outcomes[band][0].pressure = accessMethod === 'charge' ? 8 : 1;
        if (accessMethod === 'charge') a.outcomes[band][0].civilian = civilian;
        if (band !== 'adverse') a.outcomes[band][0].openings = [{ openingId: door.id, state: 'open' }];
      }
      s.stages.adapt.actions.push(a);
    }
    if (door) {
      const inspect = extra('gen_inspect_opening', 'adapt', 'Inspect the accessible opening');
      inspect.icon = 'intel';
      inspect.summary = 'A qualified camera operator checks the local view after the opening is accessible';
      inspect.requires = { allTags: ['inspection_camera'], certs: ['drone_operator'] };
      inspect.check.kind = 'observation';
      inspect.spatial = { channel: 'visual', subjectFactId: 'f_person', weight: 12, noun: 'Camera view' };
      inspect.capabilities = { rules: ['opening_inspection'], required: ['opening_inspection'], openingId: door.id };
      inspect.outcomes.favorable[0].knowledge = [{ factId: 'f_person', status: 'confirmed' }];
      s.stages.adapt.actions.push(inspect);
    }
    // A separate, one-shot context check allows preparing access before moving
    // to the resolution stage. It never confirms anything via equipment alone.
    const safety = extra('gen_check_context', 'adapt', 'Check the adjacent area and reported location');
    safety.icon = 'search';
    safety.check.kind = 'observation';
    safety.approach = 'path';
    for (const band of ['favorable', 'mixed'] as const) safety.outcomes[band][0].knowledge = [{ factId: 'f_person', status: 'confirmed' }, { factId: 'f_adjacent_safety', status: 'confirmed' }];
    s.stages.adapt.actions.unshift(safety);
  }
  for (const stage of Object.values(s.stages)) for (const a of stage.actions) {
    const flag = `used:${a.id}`;
    a.requires.notFlags = [...(a.requires.notFlags ?? []), { flag, reason: 'This step has already been completed' }];
    for (const band of ['favorable', 'mixed', 'adverse'] as const) a.outcomes[band][0].setFlags = [...(a.outcomes[band][0].setFlags ?? []), flag];
  }
  return s;
}

/** Prefer unused v5 story types, then unused compatible locations, without extra RNG draws. */
export function drawIncidentSpec(
  rngState: number,
  ctx: { level: number; trust: number; contentVersion: number; avoidFamilies?: readonly string[]; avoidTypes?: readonly IncidentType[]; recentTypes?: readonly IncidentType[] },
): { spec: IncidentSpec; state: number } {
  // Four slots for each everyday call, one for each specialist report. Keep the
  // v1 array and number of PRNG draws exactly unchanged for saved campaigns.
  let pool = ctx.contentVersion >= 5
    ? INCIDENT_TYPES_V5
    : ctx.contentVersion >= 4
    ? [...INCIDENT_TYPES_V2, ...INCIDENT_TYPES_V4.slice(INCIDENT_TYPES_V2.length).flatMap(type => [type, type])]
    : ctx.contentVersion >= 2
    ? [...INCIDENT_TYPES.flatMap((type) => [type, type, type, type]), ...INCIDENT_TYPES_V2.slice(INCIDENT_TYPES.length)]
    : INCIDENT_TYPES;
  if (ctx.contentVersion >= 5) {
    const unused = pool.filter(type => !ctx.avoidTypes?.includes(type.type));
    if (unused.length) pool = unused;
    if (ctx.contentVersion >= 6) {
      const lessRecent = pool.filter(type => !ctx.recentTypes?.includes(type.type));
      if (lessRecent.length) pool = lessRecent;
    }
  }
  // Restrict v5 family selection to remaining stories before preferring a fresh
  // location. Otherwise a fresh home could repeat a story while a shop story is unused.
  const families = ctx.contentVersion >= 5 ? allFamilies.filter(id => pool.some(type => type.families.includes(id))) : allFamilies;
  const fresh = families.filter(id => !ctx.avoidFamilies?.includes(id));
  const family = pick(rngState, fresh.length ? fresh : families);
  const incident = pick(family.state, pool.filter((x) => x.families.includes(family.value)));
  const building = next(incident.state);
  const seed = next(building.state);
  const tier = next(seed.state);
  const cap = Math.max(1, Math.min(5, 1 + Math.floor(ctx.level / 2), ctx.trust < 40 ? 2 : 5));
  return {
    spec: { type: incident.value.type, familyId: family.value, buildingSeed: Math.floor(building.value * 0x100000000), seed: Math.floor(seed.value * 0x100000000), tier: 1 + Math.floor(tier.value * cap), contentVersion: ctx.contentVersion },
    state: tier.state,
  };
}
