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
const legacyTypes: IncidentType[] = ['domestic', 'person_in_crisis', 'barricaded', 'business_robbery', 'holding', 'missing_vulnerable', 'vacant_occupancy'];
const validTypes = new Set([...INCIDENT_TYPES.map((x) => x.type), ...legacyTypes]);

/** The saved ID carries the entire deterministic seed tuple. */
export function incidentId(spec: IncidentSpec): string {
  return `gen:${spec.type}:${spec.familyId}:${spec.buildingSeed}:${spec.seed}:${spec.tier}:${spec.contentVersion}`;
}
export function parseIncidentId(id: string): IncidentSpec | null {
  const m = /^gen:([a-z_]+):([a-z0-9_]+):(\d+):(\d+):(\d+):(\d+)$/.exec(id);
  if (!m || !validTypes.has(m[1] as IncidentType)) return null;
  const [buildingSeed, seed, tier, contentVersion] = m.slice(3).map(Number);
  if (![buildingSeed, seed, tier, contentVersion].every(Number.isSafeInteger) || tier < 1 || tier > 5 || contentVersion < 1) return null;
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
    return { ...old, id: incidentId(spec), locationSeed: spec.buildingSeed, incident: { ...spec } };
  }
  const built = buildLocation(spec.familyId, spec.buildingSeed);
  if (built.issues.some((i) => i.severity === 'error')) throw new Error('Incident location is invalid');
  const { location } = built;
  const urgent = spec.type === 'medical_complication';
  const business = location.setting === 'business';
  const alarm = spec.type === 'burglary';
  const uncertain = spec.type === 'false_intruder';
  const kind = INCIDENT_TYPES.find((x) => x.type === spec.type);
  if (!kind || !kind.families.includes(spec.familyId)) throw new Error('Unsupported incident and building combination');
  const candidates = location.rooms.filter((r) => business ? ['office', 'storage'].includes(r.type) : urgent ? ['bedroom', 'bathroom', 'living'].includes(r.type) : ['bedroom', 'living'].includes(r.type));
  const chosen = pick(hashSeed(incidentId(spec)), candidates);
  const target = chosen.value;
  const targetName = target.label.toLowerCase();
  const at = occupantPoint(target, built, chosen.state);
  const hasWindow = location.openings.some((o) => o.type === 'window' && (o.a === target.id || o.b === target.id));
  const personLabel = urgent ? 'Person needing help' : business ? 'Staff member' : 'Resident';
  const report = urgent ? `A caller reports someone needs medical help in the ${targetName}.`
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
  return {
    id: incidentId(spec), version: 1, code: `CALL ${String(spec.seed % 10000).padStart(4, '0')}`,
    title: location.name, setting: location.setting, locationFamilyId: spec.familyId, locationSeed: spec.buildingSeed,
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
}

/** Avoid the locations already on the board while another is available. */
export function drawIncidentSpec(
  rngState: number,
  ctx: { level: number; trust: number; contentVersion: number; avoidFamilies?: readonly string[] },
): { spec: IncidentSpec; state: number } {
  const fresh = allFamilies.filter((id) => !ctx.avoidFamilies?.includes(id));
  const family = pick(rngState, fresh.length ? fresh : allFamilies);
  const incident = pick(family.state, INCIDENT_TYPES.filter((x) => x.families.includes(family.value)));
  const building = next(incident.state);
  const seed = next(building.state);
  const tier = next(seed.state);
  const cap = Math.max(1, Math.min(5, 1 + Math.floor(ctx.level / 2), ctx.trust < 40 ? 2 : 5));
  return {
    spec: { type: incident.value.type, familyId: family.value, buildingSeed: Math.floor(building.value * 0x100000000), seed: Math.floor(seed.value * 0x100000000), tier: 1 + Math.floor(tier.value * cap), contentVersion: ctx.contentVersion },
    state: tier.state,
  };
}
