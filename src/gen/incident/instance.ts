// Incident instances (docs/incident-domain-model.md, §12): one call drawn from a template, with
// every person explicit. The building placement (rooms, routes, start points, names) comes from
// placeCast, the same function the call-tree compiler uses, so the instance and the compiled
// scenario can never disagree about who is where.
import type { CastDraw, CastIdentity, PlacedCast } from './trees-v13/compile';
import { doorInto, memberId, placeCast, resolveNext, textBinder, treeFactId, withCallTree } from './trees-v13/compile';
import { scenarioRecipe, scenarioSituationsV10 } from '../../content/scenario-recipes';
import type { ScenarioCharacteristic } from '../../content/scenario-recipes';
import type { AgeBand, Clock, Conditions, Dist, GroupRole, IncidentClass, IncidentPerson, IncidentTemplate, PersonSpec, Placement, Pronouns, ScaleClass, Weapon, WeaponKind } from '../../content/incidents/types';
import { ageBandOf, IDENTITY_DEFAULT, WEAPON_ARMAMENT } from '../../content/incidents/types';
import { templateAt } from '../../content/incidents';
import { hashIndex, hashSeed } from '../../sim/rng';
import { nearestOpening } from '../../sim/spatial';
import { coverOnLine } from '../../sim/spatial-factors';
import type { ClockDef, IncidentPersonDef, IncidentSpec, ScenarioDefinition } from '../../sim/scenario-types';
import type { BuiltLocation, Id, Vec } from '../../sim/types';

export interface IncidentInstance {
  type: IncidentTemplate['type'];
  spec: IncidentSpec;
  /** Index into the tree's situations: the hidden truth of this call. */
  situation: number;
  pacing: ScenarioCharacteristic;
  /** Turn group → the node this call drew. */
  turns: Record<string, string>;
  location: { familyId: string; seed: number; setting: string; outsideSpaceId: Id; sceneSpaceId: Id; sceneRoomType: string };
  people: IncidentPerson[];
  clocks: Clock[];
  conditions: Conditions;
  complications: string[];
  /** The placement the compiler consumes. */
  placed: PlacedCast;
}

// ---------------------------------------------------------------- draws

/** A mechanics-free draw: fixed values pass through; weighted options use the call seed. */
export function draw<T>(dist: Dist<T>, key: string): T {
  if (dist === null || typeof dist !== 'object' || !('pick' in (dist as object))) return dist as T;
  const options = (dist as { pick: readonly (readonly [T, number])[] }).pick;
  const total = options.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = (hashSeed(key) % 10000) / 10000 * total;
  for (const [value, weight] of options) { if ((roll -= weight) < 0) return value; }
  return options[options.length - 1][0];
}

/** A situation's overrides on a slot's person: shallow, except the threat profile and meters merge. */
function personSpec(base: PersonSpec, override: Partial<PersonSpec> | undefined): PersonSpec {
  if (!override) return base;
  return { ...base, ...override,
    threat: override.threat ? { ...base.threat!, ...override.threat } : base.threat,
    meters: override.meters ? { ...base.meters, ...override.meters } : base.meters,
    knowledge: override.knowledge ? { ...base.knowledge, ...override.knowledge } : base.knowledge };
}

/** Where someone stands, from the building alone. 'cover' and 'shielded' arrive with the furniture
 * cover data of milestone 2. */
export function placementOf(built: BuiltLocation, spaceId: Id, at: Vec, floor: number): Placement {
  if (floor > 0) return 'upstairs';
  const door = nearestOpening(built, spaceId, at, ['door', 'doorway', 'sliding']);
  if (door && door.distance <= 5) return 'doorway';
  const window = nearestOpening(built, spaceId, at, ['window']);
  if (window && window.distance <= 5) return 'window';
  return 'deep';
}

const ARMAMENT_ORDER = ['none', 'blunt', 'edged', 'unknown', 'handgun', 'long_gun'] as const;

/** One call from a template on this building. Throws when the building can't host it, exactly as
 * the compiler does, so hosting moves the call to another seed. */
export function drawInstance(template: IncidentTemplate, built: BuiltLocation, spec: IncidentSpec): IncidentInstance {
  const tree = template.tree;
  const situationIndex = scenarioRecipe(spec).variant;
  const model = template.situations.find(entry => entry.index === situationIndex);
  // Everyone a slot draws past its key roles is a member of the tree's counted role for that slot
  // (CallTree.groups): 'others_1', 'others_2'. A situation can set them as a group ('others').
  const groupOfSlot = new Map(Object.entries(tree.groups ?? {}).map(([group, def]) => [def.slot, group]));
  const counts = new Map(template.cast.map(slot => [slot.id, slot.count.min === slot.count.max ? slot.count.min
    : slot.count.min + pickIndex(slot.count.weights ?? Array.from({ length: slot.count.max - slot.count.min + 1 }, () => 1), `${spec.seed}:${slot.id}:count-m1`)]));
  const members: Record<string, number> = {};
  for (const slot of template.cast) {
    const group = groupOfSlot.get(slot.id);
    if (slot.count.max > slot.keyRoles.length && !group) throw new Error(`${template.type}: slot ${slot.id} can draw people past its key roles, and the tree names no group for them`);
    if (group) members[group] = Math.max(0, counts.get(slot.id)! - slot.keyRoles.length);
  }
  const engineIds = (slot: IncidentTemplate['cast'][number]) => Array.from({ length: counts.get(slot.id)! }, (_, i) =>
    i < slot.keyRoles.length ? { id: slot.keyRoles[i] } : { id: memberId(groupOfSlot.get(slot.id)!, i - slot.keyRoles.length + 1), group: groupOfSlot.get(slot.id)! });
  const specOf = (slot: IncidentTemplate['cast'][number], roleKey: string, group?: string) =>
    personSpec(slot.person, model?.people?.[roleKey] ?? (group ? model?.people?.[group] : undefined) ?? model?.people?.[slot.id]);
  // Identity first, from one distribution for every kind of person: names follow the pronouns.
  const identityOf = (p: PersonSpec, id: string) => {
    const years = p.identity?.years ? p.identity.years.min + hashIndex(hashSeed(`${spec.seed}:${id}:years-m1`), p.identity.years.max - p.identity.years.min + 1) : undefined;
    return { pronouns: draw<Pronouns>(p.identity?.pronouns ?? IDENTITY_DEFAULT.pronouns, `${spec.seed}:${id}:pronouns-m1`), ...(years !== undefined ? { age: years } : {}) };
  };
  const draws: CastDraw = Object.fromEntries(template.cast.flatMap(slot => engineIds(slot).map(({ id, group }) => [id, identityOf(specOf(slot, id, group), id)])));
  const placed = placeCast(tree, built, spec, draws, members);
  const rooms = new Map(built.location.rooms.map(room => [room.id, room]));
  const people: IncidentPerson[] = [];

  for (const slot of template.cast) {
    const ids = engineIds(slot);
    for (const [i, { id: roleKey, group }] of ids.entries()) {
      const id = roleKey;
      const p = specOf(slot, roleKey, group);
      const key = (field: string) => `${spec.seed}:${id}:${field}:m1`;
      const identity: CastIdentity | undefined = placed.cast[roleKey];
      const drawn = draws[roleKey];
      const position = positionOf(p, roleKey);
      // A group slot: its first person leads (or is alone), everyone else draws a role and how
      // strongly the leader holds them, from the call seed.
      const groupRole: GroupRole | undefined = !p.group ? undefined : i === 0
        ? { id: slot.id, role: ids.length > 1 ? 'leader' : 'lone', influence: 1 }
        : { id: slot.id, role: draw(p.group.role, `${spec.seed}:${id}:group-role:m5`),
          influence: Math.round((p.group.influence.min + (p.group.influence.max - p.group.influence.min) * (hashSeed(`${spec.seed}:${id}:influence:m5`) % 10001) / 10000) * 100) / 100 };
      // A fixed list passes through untouched; weighted lists are drawn per person (slice 5).
      const weapons = draw<Weapon[]>(p.weapons ?? [], `${spec.seed}:${id}:weapons:m5`).map(weapon => ({ ...weapon }));
      const carried = weapons.filter(weapon => weapon.where !== 'elsewhere' && weapon.real !== 'replica').map(weapon => WEAPON_ARMAMENT[weapon.kind]);
      const armament = carried.reduce((best, next) => ARMAMENT_ORDER.indexOf(next) > ARMAMENT_ORDER.indexOf(best) ? next : best, 'none' as (typeof ARMAMENT_ORDER)[number]);
      people.push({
        id, slot: slot.id, roleKey, ...(group ? { countedRole: group } : {}), kind: slot.kind,
        label: `{${roleKey}}`,
        ...(identity ? { name: { first: identity.firstName, surname: identity.surname, pronouns: identity.pronouns } } : {}),
        pronouns: drawn.pronouns, ...(drawn.age !== undefined ? { years: drawn.age } : {}),
        age: drawn.age !== undefined ? ageBandOf(drawn.age) : draw(p.age, key('age')), mobility: p.mobility === undefined ? 'normal' : draw(p.mobility, key('mobility')), needs: [...p.needs ?? []],
        position,
        ...(p.hold ? { hold: { ...p.hold } } : {}),
        ...(p.subjectAware !== undefined ? { subjectAware: p.subjectAware } : {}),
        ...(p.activity ? { activity: p.activity } : {}),
        ...(p.threat ? { threat: { armament, readiness: p.threat.readiness, disposition: draw(p.threat.disposition, key('disposition')), intent: p.threat.intent, awareness: p.threat.awareness } } : {}),
        weapons,
        ...(p.proficiency !== undefined ? { proficiency: draw(p.proficiency, key('proficiency')) } : {}),
        ...(p.volatility !== undefined ? { volatility: draw(p.volatility, key('volatility')) } : {}),
        ...(p.noDeathOnCard ? { noDeathOnCard: true } : {}),
        ...(p.record ? { record: { ...p.record } } : {}),
        ...(p.relationshipToSubject ? { relationshipToSubject: p.relationshipToSubject } : {}),
        ...(groupRole ? { group: groupRole } : {}),
        demands: (p.demands ?? []).map(demand => ({ ...demand })),
        meters: { ...p.meters },
        ...(p.animal ? { animal: { ...p.animal } } : {}),
        knowledge: structuredClone(p.knowledge ?? {}),
        sightlines: (p.sightlines ?? []).map(line => ({ ...line })),
      });
    }
  }

  /** Where placeCast put this person: key roles and group members alike, so the instance and the
   * compiled scenario never disagree. */
  function positionOf(p: PersonSpec, roleKey: string): IncidentPerson['position'] {
    if (p.offsite) return { kind: 'offsite', where: p.offsite };
    const spaceId = placed.roomOf[roleKey];
    if (spaceId === placed.outside) return { kind: 'outside', spaceId, at: placed.anchors[roleKey].outside };
    const room = rooms.get(spaceId)!;
    const { inside: at, outside } = placed.anchors[roleKey];
    return { kind: 'inside', spaceId, roomType: room.type, at, outside, placement: placementOf(built, spaceId, at, room.floor), floor: room.floor };
  }

  const turns = Object.fromEntries(Object.keys(tree.turns ?? {}).map(group => {
    const next = resolveNext(tree, { turn: group }, spec.seed);
    return [group, 'node' in next ? next.node : ''];
  }));
  const conditions: Conditions = {
    timeOfDay: draw(template.conditions.timeOfDay, `${spec.seed}:time:m1`),
    power: draw(template.conditions.power, `${spec.seed}:power:m1`),
    weather: draw(template.conditions.weather, `${spec.seed}:weather:m1`),
    crowd: draw(template.conditions.crowd, `${spec.seed}:crowd:m1`),
  };
  const sceneRoom = rooms.get(placed.room.id)!;
  return {
    type: template.type, spec: { ...spec }, situation: situationIndex, pacing: placed.recipe.characteristic, turns,
    location: { familyId: spec.familyId, seed: spec.buildingSeed, setting: built.location.setting, outsideSpaceId: placed.outside, sceneSpaceId: placed.room.id, sceneRoomType: sceneRoom.type },
    people, clocks: (model?.clocks ?? []).map(clock => drawClock(clock, spec.seed)), conditions, complications: [], placed,
  };
}

/** A situation's clock for one call: the rate drawn within its spread, from the call seed. */
function drawClock(clock: Clock, seed: number): Clock {
  const copy = structuredClone(clock);
  if (!clock.rateSpread) return copy;
  const u = (hashSeed(`${seed}:${clock.id}:rate-m2`) % 10000) / 10000;
  copy.ratePerMin = Math.round(clock.ratePerMin * (1 + clock.rateSpread * (2 * u - 1)) * 100) / 100;
  return copy;
}

/** The instance's clocks as the engine runs them (sim/clocks.ts), text bound for this call. A clock
 * the story still runs by itself stays in the instance for the lab, and out of the engine. */
export function clocksFor(instance: IncidentInstance, bind: (text: string) => string, factIds: ReadonlySet<string>): ClockDef[] {
  return instance.clocks.filter(clock => !clock.story).map(clock => {
    const factId = clock.factKey ? treeFactId(clock.factKey) : undefined;
    return {
      id: clock.id, label: bind(clock.label), kind: clock.kind, ...(clock.owner ? { owner: clock.owner } : {}),
      start: clock.start, ratePerMin: clock.ratePerMin, rateKnown: clock.rateKnown,
      cues: clock.cues.map(cue => ({ at: cue.at, text: bind(cue.text), ...(cue.mark ? { mark: cue.mark } : {}), ...(cue.reveal ? { reveal: true } : {}) })),
      ...(factId && factIds.has(factId) ? { factId } : {}),
      ...(clock.urgent ? { urgent: bind(clock.urgent) } : {}),
      ...(clock.onOut ? { onOut: { ...clock.onOut } } : {}),
    };
  });
}

/** The instance's people as the engine reads them (sim/incident-factors.ts): the threat profile,
 * the facts that tell the team about it, the furniture between each person and the door into their
 * room, their group and who holds them. Key roles and group members alike; offsite people (another
 * unit's problem) are not on the map and not here. */
export function incidentPeopleFor(instance: IncidentInstance, built: BuiltLocation, factIds: ReadonlySet<string>): IncidentPersonDef[] {
  const out: IncidentPersonDef[] = [];
  for (const person of instance.people) {
    if (person.position.kind !== 'inside' || !person.roleKey) continue;
    const { spaceId, at } = person.position;
    const fact = (id: string | undefined) => id && factIds.has(id) ? id : undefined;
    let cover: IncidentPersonDef['cover'], doorFt: number | undefined;
    if (person.threat && person.threat.armament !== 'none') {
      // The door the team comes through: the first opening on this room's way out.
      const doorAt = doorInto(built, spaceId, instance.location.outsideSpaceId);
      const found = doorAt ? coverOnLine(built, spaceId, at, doorAt) : null;
      if (found) cover = { objectId: found.object.id, label: found.object.type.replace(/_/g, ' '), grade: found.grade };
      if (doorAt) doorFt = Math.round(Math.hypot(at.x - doorAt.x, at.y - doorAt.y) * 10) / 10;
    }
    const weapon = person.weapons.find(entry => entry.where !== 'elsewhere');
    const armamentFactId = fact(person.knowledge.weapons?.learnedBy), dispositionFactId = fact(person.knowledge.disposition?.learnedBy);
    out.push({
      id: person.roleKey, kind: person.kind, label: person.name?.first ?? person.label, minor: MINORS.includes(person.age), spaceId, at: { ...at },
      ...(person.threat ? { threat: { ...person.threat } } : {}),
      ...(armamentFactId ? { armamentFactId } : {}), ...(dispositionFactId ? { dispositionFactId } : {}),
      ...(cover ? { cover } : {}),
      ...(weapon ? { weapon: { kind: weapon.kind, real: weapon.real } } : {}),
      ...(person.proficiency ? { proficiency: person.proficiency } : {}),
      ...(doorFt !== undefined ? { doorFt } : {}),
      ...(MINORS.includes(person.age) || person.noDeathOnCard ? { noFatal: true } : {}),
      ...(person.kind === 'subject' && person.meters.agitation !== undefined && person.meters.rapport !== undefined
        ? { meters: { agitation: person.meters.agitation, rapport: person.meters.rapport }, volatility: person.volatility ?? 'shifting' } : {}),
      ...(person.group ? { group: { ...person.group } } : {}),
      ...(person.hold ? { hold: { by: person.hold.by, kind: person.hold.kind } } : {}),
    });
  }
  return out;
}

/** A call drawn from its template and compiled for the engine: the instance's people placed once
 * (placeCast), the tree compiled onto them, and the people and clocks the engine reads. */
export function compileIncident(scenario: ScenarioDefinition, built: BuiltLocation, template: IncidentTemplate): ScenarioDefinition {
  const instance = drawInstance(template, built, scenario.incident!);
  const clockMarks = instance.clocks.filter(clock => !clock.story).flatMap(clock => [...clock.cues.flatMap(cue => cue.mark ? [cue.mark] : []), ...clock.onOut?.mark ? [clock.onOut.mark] : []]);
  const compiled = withCallTree(scenario, built, template.tree, instance.placed, clockMarks);
  const factIds = new Set(compiled.facts.map(fact => fact.id));
  const clocks = clocksFor(instance, textBinder(template.tree, built, instance.placed), factIds);
  return { ...compiled, incidentPeople: incidentPeopleFor(instance, built, factIds), ...(clocks.length ? { clocks } : {}) };
}

/** The instance behind a generated call-tree scenario, on the building it was compiled for. */
export function instanceOf(s: ScenarioDefinition, built: BuiltLocation): IncidentInstance | null {
  const template = s.incident ? templateAt(s.incident.type, s.incident.contentVersion) : undefined;
  return template && s.incident ? drawInstance(template, built, hostedSpec(s)) : null;
}

/** The spec the call was compiled with. A call its drawn building can't host moves to another
 * seed (generateIncident) and keeps its drawn spec as its ID; names and rooms follow the
 * building actually used, recorded in locationFamilyId and locationSeed. */
export function hostedSpec(s: ScenarioDefinition): IncidentSpec {
  return { ...s.incident!, familyId: s.locationFamilyId.split('__')[0], buildingSeed: s.locationSeed };
}

function pickIndex(weights: readonly number[], key: string): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = (hashSeed(key) % 10000) / 10000 * total;
  for (let i = 0; i < weights.length; i++) if ((roll -= weights[i]) < 0) return i;
  return weights.length - 1;
}

// ---------------------------------------------------------------- aggregates (§12)

export interface Aggregates {
  incidentClass: IncidentClass;
  scaleClass: ScaleClass;
  subjects: number;
  armed: number;
  hostile: number;
  hostages: number;
  victims: number;
  trapped: number;
  minors: number;
  animals: number;
  /** People the team can't yet place as subject, held or bystander. */
  unidentified: number;
  weapons: Partial<Record<WeaponKind, number>>;
  /** Who talks for the subjects: the group leader, or the first subject. */
  leader?: Id;
  mostDangerous?: Id;
  clocks: number;
  /** Beliefs the team starts without. */
  unknowns: number;
}

const MINORS: readonly AgeBand[] = ['infant', 'child', 'teen'];

/** The class is derived from the people, never labelled (§1): an expressive hold makes it a victim
 * incident, any other hold a hostage incident, a seeking subject an active threat, a subject who
 * is outside the building a rescue, and anything else a barricade. */
export function incidentClassOf(people: readonly IncidentPerson[]): IncidentClass {
  if (people.some(person => person.hold?.kind === 'expressive')) return 'victim';
  if (people.some(person => person.hold)) return 'hostage';
  const subjects = people.filter(person => person.kind === 'subject');
  if (subjects.some(person => person.activity === 'seeking')) return 'active_threat';
  if (subjects.length && subjects.every(person => person.activity === 'offsite')) return 'rescue';
  return 'barricade';
}

export const scaleClassOf = (subjects: number): ScaleClass => subjects <= 1 ? 'lone' : subjects === 2 ? 'pair' : subjects <= 4 ? 'small_group' : 'group';

export function aggregates(instance: IncidentInstance): Aggregates {
  const people = instance.people;
  const subjects = people.filter(person => person.kind === 'subject');
  const armed = subjects.filter(person => person.weapons.some(weapon => weapon.where !== 'elsewhere'));
  const weapons: Partial<Record<WeaponKind, number>> = {};
  for (const person of people) for (const weapon of person.weapons) weapons[weapon.kind] = (weapons[weapon.kind] ?? 0) + 1;
  const danger = (person: IncidentPerson) => ARMAMENT_ORDER.indexOf(person.threat?.armament ?? 'none');
  const leader = subjects.find(person => person.group?.role === 'leader') ?? subjects.find(person => person.roleKey) ?? subjects[0];
  const mostDangerous = [...subjects].sort((a, b) => danger(b) - danger(a))[0];
  return {
    incidentClass: incidentClassOf(people), scaleClass: scaleClassOf(subjects.length),
    subjects: subjects.length, armed: armed.length, hostile: subjects.filter(person => person.threat?.disposition === 'hostile').length,
    hostages: people.filter(person => person.kind === 'hostage').length, victims: people.filter(person => person.kind === 'victim').length,
    trapped: people.filter(person => person.kind === 'trapped').length, minors: people.filter(person => MINORS.includes(person.age)).length,
    animals: people.filter(person => person.kind === 'animal').length, weapons,
    unidentified: people.filter(person => person.knowledge.kind?.status === 'unknown').length,
    ...(leader ? { leader: leader.id } : {}), ...(mostDangerous ? { mostDangerous: mostDangerous.id } : {}),
    clocks: instance.clocks.length,
    unknowns: people.reduce((sum, person) => sum + Object.values(person.knowledge).filter(belief => belief?.status === 'unknown').length, 0),
  };
}

/** What makes two calls different to a player (§12). Building seed and names are not in it. */
export function signature(instance: IncidentInstance): string {
  const a = aggregates(instance);
  const holds = instance.people.filter(person => person.hold).map(person => `${person.kind}:${person.hold!.kind}`).sort().join('+') || 'none';
  const placements = instance.people.filter(person => person.roleKey && person.position.kind === 'inside')
    .map(person => `${person.roleKey}@${person.position.kind === 'inside' ? person.position.placement : ''}`).sort().join('+');
  const turns = Object.entries(instance.turns).map(([group, node]) => `${group}=${node}`).sort().join('+');
  return [instance.type, a.incidentClass, `s${instance.situation}`, instance.pacing, turns, a.scaleClass, holds, placements, instance.complications.join('+') || 'plain'].join('|');
}

// ---------------------------------------------------------------- counting (§12)

export interface TemplateCount {
  /** Hidden-truth situation × mid-call turn: what changes the decisions today. */
  setups: number;
  pacingVariants: number;
  /** Distinct cast sizes the slots allow. */
  castShapes: number;
  complicationSets: number;
  /** setups × pacing × cast shapes × complication sets. */
  signatures: number;
  /** Signatures that change a decision or an outcome distribution. In milestone 1 only the
   * situation and turn do; placement, cast size and conditions start counting in milestone 2. */
  behaviourallyDistinct: number;
  families: number;
  sceneRoomTypes: number;
}

export function countTemplate(template: IncidentTemplate): TemplateCount {
  const turnDraws = Object.values(template.tree.turns ?? {}).reduce((product, group) => product * group.length, 1);
  const setups = template.tree.situations.length * turnDraws;
  const pacingVariants = new Set(scenarioSituationsV10(template.type).map(situation => situation.characteristic)).size;
  const castShapes = template.cast.reduce((product, slot) => product * (slot.count.max - slot.count.min + 1), 1);
  const complicationSets = 1 + template.complications.length;
  return {
    setups, pacingVariants, castShapes, complicationSets, signatures: setups * pacingVariants * castShapes * complicationSets,
    behaviourallyDistinct: setups, families: template.tree.families.length, sceneRoomTypes: template.tree.scene.rooms.length,
  };
}
