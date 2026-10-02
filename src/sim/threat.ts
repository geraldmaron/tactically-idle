// People, threats and movement for generated incidents.
//
// Truth versus knowledge. `run.people` is where everyone really is; the player only ever
// holds `run.lastSeen`, reported points and fact statuses. Resolution is computed twice:
// once from what the player believes (the displayed risk band and the contributors marked
// 'expected') and once from the truth (what actually decides the outcome). When they
// differ, the debrief says so ("Armament was a long gun, not unarmed as reported").
//
// Threats are game abstractions: category, readiness, disposition, intent, awareness.
// They change difficulty, strain, options and civilian safety. No ballistic model, no
// wound detail, no procedure. A successful use of force is never the better outcome.
import type { BuiltLocation, Contributor, Id, KnowledgeStatus, Officer, OperationRun, StageId, Vec } from './types';
import type { ActionDefinition, Armament, CheckKind, Disposition, EnvironmentDefinition, FactDefinition, Intent, PersonDefinition, PersonRole, PoliceAwareness, Readiness, ScenarioDefinition, ThreatProfile } from './scenario-types';
import { FACT_PREFIX, PERSON_FLAG } from './scenario-types';
import { signalBetweenFloors } from './spatial';
import { centroidOf, SPATIAL_TUNING, spaceLabel } from './spatial-factors';
import { difficultyContributor, ENV_TUNING, floorOfSpace } from './environment';

const round1 = (n: number) => Math.round(n * 10) / 10;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export const THREAT_TUNING = {
  /** 0..1 weight of an armament category. */
  armament: { none: 0, blunt: 0.35, edged: 0.55, handgun: 0.8, long_gun: 1, unknown: 0.6 } as Record<Armament, number>,
  /** Multiplier by readiness. */
  readiness: { concealed: 0.55, carried: 0.8, brandished: 1 } as Record<Readiness, number>,
  /** Difficulty points at full threat, by check kind. Entry-type work feels it most. */
  difficulty: { execution: 16, medical: 9, contact: 6, observation: 5, coordination: 3, pressure: 5 } as Record<CheckKind, number>,
  /** Share counted for the 1st, 2nd, 3rd and later subject: diminishing but real. */
  seats: [1, 0.45, 0.25, 0.15],
  /** Strain multiplier per point of seated threat. */
  strainExecution: 0.3,
  strainOther: 0.15,
  strainCap: 1.6,
  /** Civilian safety lost on an adverse result per point of seated threat, by check kind. */
  civilian: { execution: 9, medical: 5, contact: 5, observation: 3, coordination: 2, pressure: 3 } as Record<CheckKind, number>,
  /** Share of the adverse civilian cost a 'mixed' result carries. */
  mixedShare: 0.4,
  /** Civilians farther than adjacent still bear this share of the exposure. */
  distantShare: 0.35,
  /** When nobody but the subjects is in the building, the abstract bystander share. */
  noCivilianShare: 0.5,
  /** Contact score by disposition. */
  contact: { cooperative: 5, distressed: 3, intoxicated: -5, agitated: -6, hostile: -10, in_crisis: -2 } as Record<Disposition, number>,
  /** Share of the contact effect that carries onto a 'pressure' check (holding the line). */
  pressureKindShare: 0.5,
  crisisCalm: 7,
  crisisUrgent: -6,
  awareness: { unaware: 4, suspicious: 0, aware: -5 } as Record<PoliceAwareness, number>,
  barricadeWait: 4,
  barricadeSlow: 1.3,
  /** Waiting while someone may harm themselves or others. */
  harmWait: -5,
  escapeWait: -3,
  /** Pressure rate added per active harm-intent subject (cap two). */
  harmRate: 0.35,
  /** Civilian safety lost per minute of waiting, by intent. */
  harmWaitCivilian: { harm_self: 0.5, harm_others: 0.8 },
  barricadeRate: 0.6,
};

export const ARMAMENT_PHRASE: Record<Armament, string> = {
  none: 'no weapon',
  blunt: 'a blunt weapon',
  edged: 'a blade',
  handgun: 'a handgun',
  long_gun: 'a long gun',
  unknown: 'an unknown item',
};
/** 'unarmed' when named alone ("not unarmed as reported"). */
const ARMAMENT_NAME: Record<Armament, string> = { none: 'unarmed', blunt: 'a blunt weapon', edged: 'a blade', handgun: 'a handgun', long_gun: 'a long gun', unknown: 'unknown' };
const READINESS_PHRASE: Record<Readiness, string> = { concealed: 'kept out of sight', carried: 'carried', brandished: 'brandished' };
const DISPOSITION_PHRASE: Record<Disposition, string> = {
  cooperative: 'cooperative',
  distressed: 'distressed',
  intoxicated: 'intoxicated',
  agitated: 'agitated',
  hostile: 'hostile',
  in_crisis: 'in crisis',
};
export const ARMAMENT_LABEL = ARMAMENT_NAME;

const CIVILIAN_ROLES: PersonRole[] = ['resident', 'child', 'elderly', 'staff', 'customer', 'held_person', 'patient'];
export const isCivilianRole = (r: PersonRole) => CIVILIAN_ROLES.includes(r);

// ---------------------------------------------------------------- flags

export const STALE_FLAG = (personId: Id) => `stale:${personId}`;

/** Contained, evacuated or gone: no longer a threat contributor and no longer moves. */
export function isNeutralised(flags: string[], personId: Id): boolean {
  return flags.includes(PERSON_FLAG.contained(personId)) || flags.includes(PERSON_FLAG.evacuated(personId)) || flags.includes(PERSON_FLAG.escaped(personId));
}
/** Stays where they are: neutralised or with police. */
export function isFixed(flags: string[], personId: Id): boolean {
  return isNeutralised(flags, personId) || flags.includes(PERSON_FLAG.withPolice(personId));
}
export function isAlarmTriggered(env: EnvironmentDefinition | null, flags: string[]): boolean {
  return env?.alarm === 'triggered' || flags.includes('alarm:triggered');
}

// ---------------------------------------------------------------- facts and people

type Dyn = Pick<OperationRun, 'knowledge' | 'flags'> & Partial<Pick<OperationRun, 'people' | 'lastSeen' | 'revision'>>;

const factIndexes = new WeakMap<ScenarioDefinition, Map<Id, FactDefinition>>();
function factIndex(s: ScenarioDefinition): Map<Id, FactDefinition> {
  let m = factIndexes.get(s);
  if (!m) {
    m = new Map(s.facts.map((f) => [f.id, f]));
    factIndexes.set(s, m);
  }
  return m;
}

/** Facts of a person whose id carries the prefix (FACT_PREFIX.location etc.). */
export function personFacts(s: ScenarioDefinition, p: PersonDefinition, prefix: string): FactDefinition[] {
  const idx = factIndex(s);
  return p.factIds.filter((id) => id.startsWith(prefix)).map((id) => idx.get(id)).filter((f): f is FactDefinition => Boolean(f));
}

const statusOf = (run: Pick<OperationRun, 'knowledge'>, f: FactDefinition): KnowledgeStatus => run.knowledge[f.id] ?? f.initial;

/** Where everyone really is at the start. */
export function initialPeople(s: ScenarioDefinition): Record<Id, { spaceId: Id; at: Vec }> {
  const out: Record<Id, { spaceId: Id; at: Vec }> = {};
  for (const p of s.people ?? []) out[p.id] = { spaceId: p.spaceId, at: { ...p.at } };
  return out;
}

/** People the player already sees at the start (their location fact starts confirmed). */
export function initialLastSeen(s: ScenarioDefinition): Record<Id, { spaceId: Id; at: Vec; revision: number }> {
  const out: Record<Id, { spaceId: Id; at: Vec; revision: number }> = {};
  for (const p of s.people ?? []) {
    if (personFacts(s, p, FACT_PREFIX.location).some((f) => f.initial === 'confirmed')) out[p.id] = { spaceId: p.spaceId, at: { ...p.at }, revision: 0 };
  }
  return out;
}

/** True positions with a fallback for runs saved before people existed. */
export function truthPeople(run: Pick<OperationRun, 'people'>, s: ScenarioDefinition): Record<Id, { spaceId: Id; at: Vec }> {
  return run.people ?? initialPeople(s);
}

// ---------------------------------------------------------------- knowledge: where and what

export interface BelievedPosition {
  spaceId: Id;
  at: Vec;
  /** confirmed = seen and not since gone; last_seen = seen there, may have moved; reported = a report's approximate point. */
  basis: 'confirmed' | 'last_seen' | 'reported';
}

/** Where the player believes a person is. Never reads truth. */
export function believedPosition(s: ScenarioDefinition, built: BuiltLocation, p: PersonDefinition, run: Dyn): BelievedPosition | null {
  const seen = (run.lastSeen ?? (run.people ? undefined : initialLastSeen(s)))?.[p.id];
  if (seen) return { spaceId: seen.spaceId, at: seen.at, basis: run.flags.includes(STALE_FLAG(p.id)) ? 'last_seen' : 'confirmed' };
  const locs = personFacts(s, p, FACT_PREFIX.location);
  const rep = locs.find((f) => statusOf(run, f) === 'reported');
  if (rep) return { spaceId: rep.spaceId, at: rep.person?.reportedAt ?? centroidOf(built, rep.spaceId), basis: 'reported' };
  return null;
}

export interface BeliefProfile {
  armament: Armament;
  readiness: Readiness;
  armSource: 'confirmed' | 'reported' | 'assumed';
  disposition?: Disposition;
  intent?: Intent;
  awareness?: PoliceAwareness;
  demSource: 'confirmed' | 'reported' | 'unknown';
}

const IMPLICIT_DOG: ThreatProfile = { armament: 'blunt', readiness: 'brandished', disposition: 'agitated', intent: 'harm_others', awareness: 'aware' };

/** The threat profile the engine uses for a person (a dangerous dog has an implicit one). */
export function profileOf(p: PersonDefinition): ThreatProfile | null {
  return p.threat ?? (p.role === 'dangerous_dog' ? IMPLICIT_DOG : null);
}

function upgradeAwareness(a: PoliceAwareness): PoliceAwareness {
  return a === 'unaware' ? 'suspicious' : 'aware';
}

/** What the player believes about a person's threat. Unknown fields stay undefined (no assumption). */
export function believedProfile(s: ScenarioDefinition, p: PersonDefinition, run: Dyn, pos: BelievedPosition | null): BeliefProfile | null {
  const t = profileOf(p);
  if (!t) return null;
  const alarm = isAlarmTriggered(s.environment ?? null, run.flags);
  const arm = personFacts(s, p, FACT_PREFIX.armament);
  const cond = personFacts(s, p, FACT_PREFIX.condition);
  const settled = (list: FactDefinition[]) => list.some((f) => ['confirmed', 'disproved'].includes(statusOf(run, f)));
  const told = (list: FactDefinition[]) => list.some((f) => statusOf(run, f) === 'reported');
  const seenIt = pos?.basis === 'confirmed';

  let armament: Armament;
  let readiness: Readiness;
  let armSource: BeliefProfile['armSource'];
  if (settled(arm) || (arm.length === 0 && seenIt)) {
    armament = t.armament;
    readiness = t.readiness;
    armSource = 'confirmed';
  } else if (told(arm) || p.reported?.armament) {
    armament = p.reported?.armament ?? 'unknown';
    readiness = p.reported?.readiness ?? 'carried';
    armSource = 'reported';
  } else {
    armament = 'unknown';
    readiness = 'carried';
    armSource = 'assumed';
  }

  let disposition: Disposition | undefined;
  let intent: Intent | undefined;
  let awareness: PoliceAwareness | undefined;
  let demSource: BeliefProfile['demSource'] = 'unknown';
  if (settled(cond) || (cond.length === 0 && seenIt)) {
    disposition = t.disposition;
    intent = t.intent;
    awareness = t.awareness;
    demSource = 'confirmed';
  } else if (told(cond) || p.reported?.disposition || p.reported?.intent || p.reported?.awareness) {
    disposition = p.reported?.disposition;
    intent = p.reported?.intent;
    awareness = p.reported?.awareness;
    demSource = 'reported';
  }
  if (awareness && alarm) awareness = upgradeAwareness(awareness);
  return { armament, readiness, armSource, disposition, intent, awareness, demSource };
}

// ---------------------------------------------------------------- subjects

export interface Subject {
  personId: Id;
  label: string;
  role: PersonRole;
  spaceId: Id;
  at: Vec;
  armament: Armament;
  readiness: Readiness;
  armSource: BeliefProfile['armSource'];
  disposition?: Disposition;
  intent?: Intent;
  awareness?: PoliceAwareness;
  demSource: BeliefProfile['demSource'];
}

export type Basis = 'truth' | 'belief';

/** Everyone carrying a threat profile who is not neutralised, from the truth or from the player's knowledge. */
export function subjectsFor(basis: Basis, s: ScenarioDefinition, built: BuiltLocation, run: Dyn): Subject[] {
  const out: Subject[] = [];
  const people = truthPeople(run, s);
  const alarm = isAlarmTriggered(s.environment ?? null, run.flags);
  for (const p of s.people ?? []) {
    const t = profileOf(p);
    if (!t || isNeutralised(run.flags, p.id)) continue;
    if (basis === 'truth') {
      const at = people[p.id] ?? { spaceId: p.spaceId, at: p.at };
      out.push({
        personId: p.id,
        label: p.label,
        role: p.role,
        spaceId: at.spaceId,
        at: at.at,
        armament: t.armament,
        readiness: t.readiness,
        armSource: 'confirmed',
        disposition: t.disposition,
        intent: t.intent,
        awareness: alarm ? upgradeAwareness(t.awareness) : t.awareness,
        demSource: 'confirmed',
      });
    } else {
      const pos = believedPosition(s, built, p, run);
      if (!pos) continue; // nobody knows this person is there
      const prof = believedProfile(s, p, run, pos);
      if (!prof) continue;
      out.push({ personId: p.id, label: p.label, role: p.role, spaceId: pos.spaceId, at: pos.at, ...prof });
    }
  }
  return out;
}

/** Threat level 0..1 of one subject. */
export function threatLevel(s: Pick<Subject, 'armament' | 'readiness'>): number {
  return THREAT_TUNING.armament[s.armament] * THREAT_TUNING.readiness[s.readiness];
}

const seatWeight = (i: number) => THREAT_TUNING.seats[Math.min(i, THREAT_TUNING.seats.length - 1)];

function adjacent(built: BuiltLocation, a: Id, b: Id): boolean {
  return (built.derived.adjacency[a] ?? []).some((e) => e.to === b);
}

/** Subjects in or next to the target space, or in sight of a place where a squad stands. */
export function relevantSubjects(subjects: Subject[], built: BuiltLocation, targetId: Id, stands: { at: Vec; spaceId: Id }[] = []): Subject[] {
  return subjects.filter((s) => {
    if (s.spaceId === targetId || adjacent(built, s.spaceId, targetId) || adjacent(built, targetId, s.spaceId)) return true;
    const sf = floorOfSpace(built, s.spaceId);
    for (const st of stands) {
      const t = signalBetweenFloors(built, { at: st.at, floor: floorOfSpace(built, st.spaceId) }, { at: s.at, floor: sf }, 'visual').transmission;
      if (t >= SPATIAL_TUNING.tonePartial) return true;
    }
    return false;
  });
}

// ---------------------------------------------------------------- contributors

export interface ThreatFx {
  /** 'difficulty' contributors (negative values: difficulty added). */
  difficulty: Contributor[];
  difficultyAdd: number;
  /** Score contributors (sources 'condition', 'trait', 'pressure'). */
  score: Contributor[];
  scoreSum: number;
  /** Strain multiplier for the officers taking part. */
  strainMult: number;
  /** Time multiplier (waiting out a barricade is slow). */
  timeMult: number;
  details: string[];
}

export const NO_THREAT_FX: ThreatFx = { difficulty: [], difficultyAdd: 0, score: [], scoreSum: 0, strainMult: 1, timeMult: 1, details: [] };

function tag(s: Subject): string {
  return s.armSource === 'confirmed' ? '' : s.armSource === 'reported' ? ' (as reported)' : ' (assumed)';
}

const expected = (basis: Basis, src: 'confirmed' | 'reported' | 'assumed' | 'unknown', label: string): string => (basis === 'belief' && src !== 'confirmed' ? `Expected: ${lower(label)}` : label);

/**
 * Contributors for the threat around an action. `relevant` are the subjects in range of
 * the target; `all` are every active subject (intent is about the whole incident).
 * The same function serves the displayed estimate (basis 'belief') and the resolution
 * (basis 'truth'), so both come from one set of rules.
 */
export function threatFx(basis: Basis, relevant: Subject[], all: Subject[], action: ActionDefinition, participants: Officer[]): ThreatFx {
  const T = THREAT_TUNING;
  const kind = action.check.kind;
  const isEntry = kind === 'execution' || Boolean(action.entry);
  const fx: ThreatFx = { difficulty: [], difficultyAdd: 0, score: [], scoreSum: 0, strainMult: 1, timeMult: 1, details: [] };
  const addScore = (c: Contributor) => {
    fx.score.push(c);
    fx.scoreSum += c.value;
  };

  // 1) armament x readiness raises difficulty and strain (entry-type work most of all)
  const byThreat = [...relevant].sort((a, b) => threatLevel(b) - threatLevel(a) || a.personId.localeCompare(b.personId));
  let seated = 0;
  byThreat.forEach((s, i) => {
    const lvl = threatLevel(s);
    if (lvl <= 0) return;
    const w = seatWeight(i);
    const add = round1(T.difficulty[kind] * lvl * w);
    if (add < 0.5) return;
    seated += lvl * w;
    const what =
      s.role === 'dangerous_dog'
        ? `${s.label}: an aggressive animal`
        : s.armSource === 'assumed'
          ? `${s.label}: armament unknown, assuming caution`
          : `${s.label} with ${ARMAMENT_PHRASE[s.armament]}, ${READINESS_PHRASE[s.readiness]}${tag(s)}`;
    fx.difficulty.push(difficultyContributor(expected(basis, s.armSource, what), add));
    fx.difficultyAdd += add;
  });
  if (seated > 0) fx.strainMult = Math.min(T.strainCap, 1 + (kind === 'execution' ? T.strainExecution : T.strainOther) * seated);
  if (fx.difficultyAdd > 0) fx.details.push(`${relevant.filter((s) => threatLevel(s) > 0).length === 1 ? 'A subject nearby raises' : 'Subjects nearby raise'} the risk of this work.`);

  // 2) disposition changes contact
  const kindShare = kind === 'contact' ? 1 : kind === 'pressure' ? T.pressureKindShare : 0;
  if (kindShare > 0) {
    const withDisp = relevant.filter((s) => s.disposition);
    const eff = (s: Subject) => T.contact[s.disposition!] * kindShare;
    const ordered = [...withDisp].sort((a, b) => Math.abs(eff(b)) - Math.abs(eff(a)) || a.personId.localeCompare(b.personId));
    ordered.forEach((s, i) => {
      const v = round1(eff(s) * seatWeight(i));
      if (Math.abs(v) < 0.5) return;
      const phrase = DISPOSITION_PHRASE[s.disposition!];
      const verb = v > 0 ? 'easier to reach' : s.disposition === 'hostile' ? 'hardest to reach' : 'harder to reach';
      const src = s.demSource === 'confirmed' ? 'confirmed' : 'reported';
      addScore({ label: expected(basis, src, `${s.label} is ${phrase}: ${verb}${s.demSource === 'reported' ? ' (as reported)' : ''}`), value: v, source: 'condition', ref: s.personId });
    });
    const crisis = withDisp.find((s) => s.disposition === 'in_crisis');
    if (crisis) {
      const calm = participants.find((o) => o.traits.includes('calm_voice') || o.certs.includes('crisis_negotiation'));
      if (calm) addScore({ label: `${calm.surname}: ${calm.traits.includes('calm_voice') ? 'calm voice' : 'negotiation training'} steadies a person in crisis`, value: T.crisisCalm * kindShare, source: 'trait', ref: calm.id });
      if (action.tempo === 'urgent') addScore({ label: 'Rushing a person in crisis makes it worse', value: T.crisisUrgent * kindShare, source: 'condition', ref: crisis.personId });
    }
  }

  // 3) awareness changes surprise (observation and entry-type work)
  if (kind === 'observation' || isEntry) {
    const withAw = relevant.filter((s) => s.awareness && T.awareness[s.awareness] !== 0);
    const ordered = [...withAw].sort((a, b) => Math.abs(T.awareness[b.awareness!]) - Math.abs(T.awareness[a.awareness!]) || a.personId.localeCompare(b.personId));
    ordered.forEach((s, i) => {
      const v = round1(T.awareness[s.awareness!] * seatWeight(i));
      if (Math.abs(v) < 0.5) return;
      const text = s.awareness === 'unaware' ? `${s.label} is unaware of police: surprise helps` : `${s.label} knows police are here: no surprise`;
      addScore({ label: expected(basis, s.demSource === 'confirmed' ? 'confirmed' : 'reported', text + (s.demSource === 'reported' ? ' (as reported)' : '')), value: v, source: 'condition', ref: s.personId });
    });
  }

  // 4) intent changes what waiting does (about the whole incident, not just the room)
  if (action.tempo === 'waiting') {
    const barricaded = all.filter((s) => s.intent === 'barricade');
    const harm = all.filter((s) => s.intent === 'harm_self' || s.intent === 'harm_others');
    const escaping = all.filter((s) => s.intent === 'escape');
    const src = (s: Subject) => (s.demSource === 'confirmed' ? 'confirmed' : 'reported');
    if (harm.length === 0 && barricaded.length > 0) {
      const s = barricaded[0];
      addScore({ label: expected(basis, src(s), `${s.label} is barricaded in: waiting is safe, just slow`), value: T.barricadeWait, source: 'condition', ref: s.personId });
      fx.timeMult = T.barricadeSlow;
    }
    harm.forEach((s, i) => {
      const v = round1(T.harmWait * seatWeight(i));
      addScore({
        label: expected(basis, src(s), `Waiting while ${lower(s.label)} may ${s.intent === 'harm_self' ? 'hurt themselves' : 'hurt someone'}`),
        value: v,
        source: 'pressure',
        ref: s.personId,
      });
    });
    if (harm.length === 0 && barricaded.length === 0 && escaping.length > 0) {
      const s = escaping[0];
      addScore({ label: expected(basis, src(s), `Waiting gives ${lower(s.label)} time to slip away`), value: T.escapeWait, source: 'condition', ref: s.personId });
    }
  }
  fx.difficultyAdd = round1(fx.difficultyAdd);
  fx.scoreSum = round1(fx.scoreSum);
  return fx;
}

// ---------------------------------------------------------------- civilian exposure (truth)

/**
 * Extra civilian safety lost on a mixed or adverse result because armed subjects are near
 * the target. Computed from truth and from space adjacency only, so a replay of the stored
 * band gives the same number.
 */
export function civilianRiskLoss(
  s: ScenarioDefinition,
  built: BuiltLocation,
  run: Dyn,
  action: ActionDefinition,
  band: 'favorable' | 'mixed' | 'adverse',
): number {
  if (band === 'favorable' || !s.people?.length) return 0;
  const subjects = relevantSubjects(subjectsFor('truth', s, built, run), built, action.targetId);
  const seated = [...subjects].sort((a, b) => threatLevel(b) - threatLevel(a)).reduce((sum, subj, i) => sum + threatLevel(subj) * seatWeight(i), 0);
  if (seated <= 0) return 0;
  const people = truthPeople(run, s);
  const civilians = (s.people ?? []).filter((p) => isCivilianRole(p.role) && !isFixed(run.flags, p.id));
  const near = civilians.some((p) => {
    const sp = people[p.id]?.spaceId ?? p.spaceId;
    return sp === action.targetId || adjacent(built, sp, action.targetId) || adjacent(built, action.targetId, sp);
  });
  const exposure = civilians.length === 0 ? THREAT_TUNING.noCivilianShare : near ? 1 : THREAT_TUNING.distantShare;
  const loss = THREAT_TUNING.civilian[action.check.kind] * seated * exposure * (band === 'mixed' ? THREAT_TUNING.mixedShare : 1);
  return round1(loss);
}

// ---------------------------------------------------------------- pressure dynamics (truth)

export interface PressureDynamics {
  /** Multiplier on the scenario's pressure per minute. */
  rateMult: number;
  /** Multiplier on civilian safety lost per minute above the threshold. */
  civilianMult: number;
  /** Civilian safety lost per minute while the action is a waiting game. */
  waitingCivilianPerMin: number;
  notes: string[];
}

export const NEUTRAL_DYNAMICS: PressureDynamics = { rateMult: 1, civilianMult: 1, waitingCivilianPerMin: 0, notes: [] };

/** How the incident itself moves pressure and civilian safety while time passes. */
export function pressureDynamics(s: ScenarioDefinition, flags: string[], action: Pick<ActionDefinition, 'tempo'> | null): PressureDynamics {
  const env = s.environment ?? null;
  if (!env && !s.people?.length) return NEUTRAL_DYNAMICS;
  const T = THREAT_TUNING;
  const waiting = action?.tempo === 'waiting';
  const active = (s.people ?? []).filter((p) => profileOf(p) && !isNeutralised(flags, p.id));
  const harm = active.filter((p) => profileOf(p)!.intent === 'harm_self' || profileOf(p)!.intent === 'harm_others');
  const barricaded = active.filter((p) => profileOf(p)!.intent === 'barricade');
  const notes: string[] = [];
  let rate = 1;
  if (harm.length > 0) {
    rate += Math.min(2, harm.length) * T.harmRate;
    notes.push('Someone may hurt themselves or others: pressure climbs faster');
  }
  if (env?.hazards.includes('fire_risk')) {
    rate *= ENV_TUNING.fire.rateMult;
    notes.push('Fire risk: pressure climbs faster');
  }
  if (env && env.crowd > 0) {
    rate += ENV_TUNING.crowd.rate * env.crowd;
    notes.push('Onlookers outside: pressure climbs faster');
  }
  if (waiting && harm.length === 0 && barricaded.length > 0) rate *= T.barricadeRate;
  const civilianMult = 1 + (env ? ENV_TUNING.crowd.civilian * env.crowd : 0);
  let waitingLoss = 0;
  if (waiting) for (const p of harm) waitingLoss += T.harmWaitCivilian[profileOf(p)!.intent as 'harm_self' | 'harm_others'];
  return { rateMult: round1(rate * 100) / 100, civilianMult, waitingCivilianPerMin: Math.min(1.6, waitingLoss), notes };
}

// ---------------------------------------------------------------- movement and observation

export interface MoveRecord {
  personId: Id;
  from: Id;
  to: Id;
  reason: string;
  /** Location facts that went stale ('confirmed' back to 'reported'), or were closed because the person was watched. */
  facts: { factId: Id; status: KnowledgeStatus }[];
}

/**
 * After a decision moves the run into `stage`, people who are not contained, with police
 * or gone take their scripted move for that stage. An unobserved move makes what the
 * player knew stale: confirmed location facts go back to 'reported' ("last seen in the
 * bedroom"), `lastSeen` keeps the old point and the person is flagged `stale:<id>`.
 * A watched person (`watched:<id>`) is followed: lastSeen moves with them and the room
 * they left is ruled out. Mutates `sim`; the replay in traceRun uses the same function.
 */
export function movePeople(sim: Dyn, s: ScenarioDefinition, stage: StageId): MoveRecord[] {
  if (!s.people?.length) return [];
  sim.people ??= initialPeople(s);
  const moves: MoveRecord[] = [];
  for (const p of s.people) {
    const mv = p.moves?.[stage];
    if (!mv || isFixed(sim.flags, p.id)) continue;
    const cur = sim.people[p.id] ?? { spaceId: p.spaceId, at: p.at };
    if (cur.spaceId === mv.spaceId && cur.at.x === mv.at.x && cur.at.y === mv.at.y) continue;
    sim.people[p.id] = { spaceId: mv.spaceId, at: { ...mv.at } };
    const rec: MoveRecord = { personId: p.id, from: cur.spaceId, to: mv.spaceId, reason: mv.reason, facts: [] };
    const locs = personFacts(s, p, FACT_PREFIX.location);
    if (sim.flags.includes(PERSON_FLAG.watched(p.id))) {
      if (sim.lastSeen) sim.lastSeen[p.id] = { spaceId: mv.spaceId, at: { ...mv.at }, revision: sim.revision ?? 0 };
      for (const f of locs) {
        if (statusOf(sim, f) === 'confirmed' && f.spaceId !== mv.spaceId) {
          sim.knowledge[f.id] = 'disproved';
          rec.facts.push({ factId: f.id, status: 'disproved' });
        }
      }
    } else {
      const known = Boolean(sim.lastSeen?.[p.id]) || locs.some((f) => statusOf(sim, f) === 'confirmed');
      if (known && !sim.flags.includes(STALE_FLAG(p.id))) sim.flags.push(STALE_FLAG(p.id));
      for (const f of locs) {
        if (statusOf(sim, f) === 'confirmed' && f.spaceId !== mv.spaceId) {
          sim.knowledge[f.id] = 'reported';
          rec.facts.push({ factId: f.id, status: 'reported' });
        }
      }
    }
    moves.push(rec);
  }
  return moves;
}

/** The spaces an action lets the squad see into. */
export function observedSpaces(a: ActionDefinition): Id[] {
  if (a.observes) return a.observes;
  return a.approach !== 'none' || a.spatial ? [a.targetId] : [];
}

const SEES_KINDS: CheckKind[] = ['observation', 'execution', 'medical'];

/**
 * A favourable observation settles what is actually in the space: people present update
 * `lastSeen` (and clear staleness), and their location, armament (unless concealed, and
 * only for sight, not voice) and demeanour facts resolve. People absent rule the location
 * facts of that space out. Mutates `sim`; returns the knowledge changes.
 */
export function observeSpaces(sim: Dyn, s: ScenarioDefinition, spaces: Id[], band: 'favorable' | 'mixed' | 'adverse', kind: CheckKind): { factId: Id; status: KnowledgeStatus }[] {
  const changes: { factId: Id; status: KnowledgeStatus }[] = [];
  if (!s.people?.length || band !== 'favorable' || spaces.length === 0) return changes;
  sim.people ??= initialPeople(s);
  const sight = SEES_KINDS.includes(kind);
  const set = (f: FactDefinition, status: KnowledgeStatus) => {
    const cur = statusOf(sim, f);
    if (cur === status || cur === 'confirmed' || cur === 'disproved') return;
    sim.knowledge[f.id] = status;
    changes.push({ factId: f.id, status });
  };
  for (const p of s.people) {
    if (sim.flags.includes(PERSON_FLAG.evacuated(p.id)) || sim.flags.includes(PERSON_FLAG.escaped(p.id))) continue;
    const at = sim.people[p.id] ?? { spaceId: p.spaceId, at: p.at };
    const locs = personFacts(s, p, FACT_PREFIX.location);
    if (!spaces.includes(at.spaceId)) {
      for (const f of locs) if (spaces.includes(f.spaceId)) set(f, 'disproved');
      continue;
    }
    if (sim.lastSeen) sim.lastSeen[p.id] = { spaceId: at.spaceId, at: { ...at.at }, revision: sim.revision ?? 0 };
    sim.flags = sim.flags.filter((x) => x !== STALE_FLAG(p.id));
    for (const f of locs) if (f.spaceId === at.spaceId) set(f, 'confirmed');
    for (const f of personFacts(s, p, FACT_PREFIX.condition)) set(f, f.truth ? 'confirmed' : 'disproved');
    const t = profileOf(p);
    const hidden = t && t.armament !== 'none' && t.readiness === 'concealed';
    if (sight && !hidden) for (const f of personFacts(s, p, FACT_PREFIX.armament)) set(f, f.truth ? 'confirmed' : 'disproved');
  }
  return changes;
}

/**
 * Keep lastSeen honest when an outcome (not an observation) settled a location fact:
 * a person confirmed in a space they really are in is "seen" there now.
 */
export function syncSeen(sim: Dyn, s: ScenarioDefinition): void {
  if (!s.people?.length || !sim.lastSeen) return;
  sim.people ??= initialPeople(s);
  for (const p of s.people) {
    const at = sim.people[p.id] ?? { spaceId: p.spaceId, at: p.at };
    const confirmedHere = personFacts(s, p, FACT_PREFIX.location).some((f) => statusOf(sim, f) === 'confirmed' && f.spaceId === at.spaceId);
    const seen = sim.lastSeen[p.id];
    if (confirmedHere && (!seen || seen.spaceId !== at.spaceId)) {
      sim.lastSeen[p.id] = { spaceId: at.spaceId, at: { ...at.at }, revision: sim.revision ?? 0 };
      sim.flags = sim.flags.filter((x) => x !== STALE_FLAG(p.id));
    }
  }
}

// ---------------------------------------------------------------- truth versus report

/** Debrief lines for what the truth did that the reports did not say. */
export function surprisesFor(s: ScenarioDefinition, built: BuiltLocation, truth: Subject[], belief: Subject[]): string[] {
  const out: string[] = [];
  const room = (id: Id) => spaceLabel(built, id).toLowerCase();
  const bel = new Map(belief.map((b) => [b.personId, b]));
  for (const t of truth) {
    if (threatLevel(t) <= 0 && t.role !== 'dangerous_dog') continue;
    const b = bel.get(t.personId);
    if (!b) {
      out.push(`${t.label} was close by and nobody had reported them.`);
      continue;
    }
    if (b.armament !== t.armament || (b.armSource !== 'confirmed' && t.readiness !== b.readiness && t.armament !== 'none')) {
      if (b.armSource === 'assumed' || b.armament === 'unknown') out.push(`${t.label}: armament was ${ARMAMENT_NAME[t.armament]}; it had not been known.`);
      else out.push(`${t.label}: armament was ${ARMAMENT_NAME[t.armament]}, not ${ARMAMENT_NAME[b.armament]} as reported.`);
    }
    if (b.disposition && t.disposition && b.disposition !== t.disposition) out.push(`${t.label} was ${DISPOSITION_PHRASE[t.disposition!]}, not ${DISPOSITION_PHRASE[b.disposition]} as reported.`);
    if (b.spaceId !== t.spaceId) out.push(`${t.label} was in the ${room(t.spaceId)}, not the ${room(b.spaceId)}.`);
  }
  for (const b of belief) {
    if (!truth.some((t) => t.personId === b.personId)) continue;
  }
  void s;
  return out;
}

export const SURPRISE_PREFIX = 'Different from the reports: ';

// ---------------------------------------------------------------- map marks and briefing helpers

const KIND_OF: Record<PersonRole, string> = {
  subject: 'subject',
  resident: 'civilian',
  child: 'child',
  elderly: 'civilian',
  staff: 'civilian',
  customer: 'civilian',
  held_person: 'civilian',
  patient: 'patient',
  dog: 'dog',
  dangerous_dog: 'dog',
};

export interface PersonMarkData {
  id: Id;
  personId: Id;
  spaceId: Id;
  at: Vec;
  floor: number;
  label: string;
  status: KnowledgeStatus;
  kind?: string;
  armament?: string | null;
}

/**
 * People as the player knows them. Seen and not since gone: exact point, 'confirmed'.
 * Stale: the last-seen point, 'reported' with "(last seen)?". Only reported: an approximate
 * point with '?'. Role glyph (`kind`) and armament only once the matching facts are confirmed.
 */
export function personMarks(s: ScenarioDefinition, built: BuiltLocation, run: Dyn): PersonMarkData[] {
  const out: PersonMarkData[] = [];
  for (const p of s.people ?? []) {
    if (run.flags.includes(PERSON_FLAG.evacuated(p.id)) || run.flags.includes(PERSON_FLAG.escaped(p.id))) continue;
    const pos = believedPosition(s, built, p, run);
    if (!pos) continue;
    const floor = floorOfSpace(built, pos.spaceId);
    const base = { id: `person_${p.id}`, personId: p.id, spaceId: pos.spaceId, at: pos.at, floor };
    if (pos.basis === 'reported') {
      const rep = personFacts(s, p, FACT_PREFIX.location).find((f) => f.spaceId === pos.spaceId && statusOf(run, f) === 'reported');
      out.push({ ...base, label: `${rep?.person?.label ?? p.label}?`, status: 'reported' });
      continue;
    }
    const armKnown = personFacts(s, p, FACT_PREFIX.armament).some((f) => ['confirmed', 'disproved'].includes(statusOf(run, f)));
    const t = profileOf(p);
    const mark: PersonMarkData = {
      ...base,
      label: pos.basis === 'last_seen' ? `${p.label} (last seen)?` : p.label,
      status: pos.basis === 'confirmed' ? 'confirmed' : 'reported',
      kind: pos.basis === 'confirmed' ? KIND_OF[p.role] : undefined,
    };
    if (armKnown && t && pos.basis === 'confirmed') mark.armament = t.armament;
    out.push(mark);
  }
  return out;
}

/** Player-language lines for the briefing's people and threats, only from what is known. */
export function knownPeopleLines(s: ScenarioDefinition, built: BuiltLocation, run: Dyn): { people: string[]; threats: string[] } {
  const people: string[] = [];
  const threats: string[] = [];
  const subjects = new Map(subjectsFor('belief', s, built, run).map((x) => [x.personId, x]));
  for (const p of s.people ?? []) {
    const pos = believedPosition(s, built, p, run);
    if (!pos) continue;
    const where = spaceLabel(built, pos.spaceId).toLowerCase();
    const how = pos.basis === 'confirmed' ? '' : pos.basis === 'last_seen' ? ' (last seen)' : ' (reported)';
    people.push(`${p.label} in the ${where}${how}`);
    const sub = subjects.get(p.id);
    if (!sub) continue;
    const arm = sub.armSource === 'assumed' ? 'armament unknown' : sub.armament === 'none' ? 'reported unarmed' : `${ARMAMENT_PHRASE[sub.armament]}, ${READINESS_PHRASE[sub.readiness]}`;
    const dem = sub.disposition ? `, ${DISPOSITION_PHRASE[sub.disposition]}` : '';
    const src = sub.armSource === 'reported' ? ' (as reported)' : '';
    threats.push(`${sub.label}: ${arm}${dem}${src}`);
  }
  return { people, threats };
}

export { ENV_TUNING };
void ENV_TUNING;
