// Drawn consequences for v13 incidents (docs/incident-domain-model.md, M2 slice 2). An authored
// outcome can say that a subject fires at the team, or that the team uses force on a person. What
// that does is not written in advance: the engine settles it here when the decision commits, from
// the incident's people and the building, and applies the matching variant's authored effects.
//
// Game abstractions, not ballistics or procedure. Officers are hurt, never killed. A person the
// card may never show dying (a minor, or a subject the self-harm screen covers) is never killed, and
// nobody is killed when the team takes them by hand. Severity never reads identity; it reads the
// weapon, the hand holding it, distance and cover. Deadly force needs a threat to life an officer
// can see (sim/authorization.ts readForceThreat), read from what the team believes.
//
// A cascade (M2 slice 5) settles whether a group follows its leader when the leader gives up: each
// member by influence, rapport and agitation, never by group role, name or pronoun.
import { FORCE_REASONS } from '../content/incidents/lines';
import { peopleNear, readForceThreat } from './authorization';
import { cutFor, cutShares, FORCE_RISK_V1, forceCuts, qualifiedForceUnit, type ForceRiskProfile, type SampleCuts } from './force-risk';
import { cascadeCombos, cascadeKey, cascadeResult, type CascadeState } from '../gen/incident/drawn-model';
import { next } from './rng';
import { tunable } from './tuning';
import type { IncidentPersonDef, OutcomeEffect, ScenarioDefinition, SubjectMeters } from './scenario-types';
import type { GameState, Id, ItemUnit, OperationRun, SquadId } from './types';

type WeaponKind = NonNullable<IncidentPersonDef['weapon']>['kind'];
export type FireSeverity = 'none' | 'wounded' | 'serious';
/** Which force the team uses: the firearm, a less-lethal tool, or hands (FORCE_RISK_V1). */
export type ForceProfile = ForceRiskProfile;
export type ForceSeverity = 'none' | 'wounded' | 'serious' | 'fatal';

/** Versioned fictional balance for a subject firing at the team. Tunable (sim/tuning.ts). */
export const INCOMING_FIRE_V1 = tunable('INCOMING_FIRE_V1', {
  /** Chance someone on the team is hit, by weapon, for an ordinary hand at mid range. */
  hit: { handgun: 0.5, long_gun: 0.65, shotgun: 0.6, edged: 0.35, blunt: 0.3, improvised: 0.25, unknown: 0.45 } as Record<WeaponKind, number>,
  proficiency: { untrained: 0.7, some: 1, trained: 1.35 },
  /** Close to the door the team comes through, a shooter hits more; far across a room, less. */
  closeFt: 8, closeMult: 1.2, farFt: 24, farMult: 0.75,
  /** Firing from behind something the team has to close on. */
  fromCover: { hard: 1.15, concealment: 1.05 },
  /** Of the hits, the share that are serious. */
  serious: { handgun: 0.35, long_gun: 0.5, shotgun: 0.45, edged: 0.3, blunt: 0.2, improvised: 0.2, unknown: 0.35 } as Record<WeaponKind, number>,
  floor: 0.05, ceiling: 0.9,
}, { guard: next => next.floor < 0 || next.floor > next.ceiling || next.ceiling > 1 ? 'Hit chances need 0 ≤ floor ≤ ceiling ≤ 1.'
  : Object.values(next.serious).some(share => share < 0 || share > 1) ? 'Serious shares stay between 0 and 1.' : null });

/** The chance a subject's fire hits someone on the team, and of those hits the serious share. */
export function incomingFireOdds(person: IncidentPersonDef): { hit: number; serious: number } {
  const T = INCOMING_FIRE_V1;
  const kind = person.weapon?.kind ?? 'unknown';
  if (person.weapon?.real === 'replica') return { hit: 0, serious: 0 };
  let hit = T.hit[kind] * T.proficiency[person.proficiency ?? 'some'];
  if (person.doorFt !== undefined) hit *= person.doorFt <= T.closeFt ? T.closeMult : person.doorFt >= T.farFt ? T.farMult : 1;
  if (person.cover) hit *= T.fromCover[person.cover.grade];
  return { hit: Math.min(T.ceiling, Math.max(T.floor, hit)), serious: T.serious[kind] };
}

/** The cuts for one burst of fire: a hit below `hit`, and of the hits the serious share first. */
export function incomingFireCuts(hit: number, serious: number): SampleCuts<FireSeverity> {
  return { cuts: [['serious', hit * serious], ['wounded', hit]], rest: 'none' };
}

/** The chance of each result incomingFireSeverity gives for these odds (incomingFireOdds). */
export function incomingFireDistribution(hit: number, serious: number): Record<FireSeverity, number> {
  return { none: 0, wounded: 0, serious: 0, ...cutShares(incomingFireCuts(hit, serious)) };
}

export function incomingFireSeverity(person: IncidentPersonDef, sample: number): FireSeverity {
  const { hit, serious } = incomingFireOdds(person);
  return cutFor(incomingFireCuts(hit, serious), sample);
}

/** Versioned fictional rules for which force the team can use on a person. Whether deadly force is
 * allowed at all is AUTHORIZATION_V1.deadlyForce (sim/authorization.ts). Tunable (sim/tuning.ts). */
export const TEAM_FORCE_V1 = tunable('TEAM_FORCE_V1', {
  /** Feet from the door the team comes through within which each less-lethal option works. */
  rangeFt: { less_lethal_device: 15, less_lethal_impact: 60 },
  /** A held person, a hostage or a child this close to the person rules less-lethal out. */
  bystanderFt: 6,
});

/** `rule` is a short machine id: the profile, then what decided it ('firearm:gun', 'hands:cover'). */
export interface ForceChoice { profile: ForceProfile; rule: string; reason: string }

/** The firearm only on an imminent threat to life an officer can see (readForceThreat). Otherwise
 * less-lethal when the acting squads carry it with a trained officer, the person is in range and
 * nothing rules it out. Otherwise the team takes the person by hand. The reason, for the debrief,
 * says what the team could see and why that tool. */
export function teamForceProfile(state: GameState, run: OperationRun, scenario: ScenarioDefinition, acting: SquadId[], participantIds: Id[], personId: Id,
  unitsOf: (state: GameState, run: OperationRun, squad: SquadId) => ItemUnit[]): ForceChoice {
  const person = scenario.incidentPeople?.find(entry => entry.id === personId);
  if (!person) return { profile: 'hands', rule: 'hands:unseen', reason: FORCE_REASONS.threat.unseen.replace('{person}', 'anyone') };
  const fill = (line: string, near?: string) => line.replace('{person}', person.label).replace('{near}', near ?? '').replace('{cover}', person.cover?.label ?? '');
  const threat = readForceThreat(scenario, run, person);
  const units = acting.flatMap(squad => unitsOf(state, run, squad));
  const deadlyReason = threat.rule === 'force:gun'
    ? fill(FORCE_REASONS.deadly.gun).replace('{weapon}', person.weapon?.kind === 'long_gun' ? 'a rifle' : person.weapon?.kind === 'shotgun' ? 'a shotgun' : 'a handgun')
    : fill(FORCE_REASONS.deadly.reach, (threat.deadly ? threat.near?.label : undefined) ?? FORCE_REASONS.theTeam);
  if (threat.deadly && qualifiedForceUnit(state, 'firearm', units, participantIds)) return threat.rule === 'force:gun'
    ? { profile: 'firearm', rule: 'firearm:gun', reason: deadlyReason }
    : { profile: 'firearm', rule: 'firearm:reach', reason: deadlyReason };
  const seen = threat.deadly ? `${deadlyReason} ${FORCE_REASONS.no_firearm}` : fill(FORCE_REASONS.threat[threat.rule.slice('force:'.length) as keyof typeof FORCE_REASONS.threat]);
  const hands = (why: keyof typeof FORCE_REASONS.tool, near?: string): ForceChoice => ({ profile: 'hands', rule: `hands:${why}`, reason: `${seen} ${fill(FORCE_REASONS.tool[why], near)}` });
  if (person.cover?.grade === 'hard') return hands('cover');
  const close = peopleNear(scenario, run, person, TEAM_FORCE_V1.bystanderFt)[0];
  if (close) return hands('bystander', close.label);
  let carriedAny = false;
  for (const profile of ['less_lethal_impact', 'less_lethal_device'] as const) {
    const carried = qualifiedForceUnit(state, profile, units, participantIds);
    if (!carried) continue;
    carriedAny = true;
    if (person.doorFt !== undefined && person.doorFt > TEAM_FORCE_V1.rangeFt[profile]) continue;
    return { profile, rule: `${profile}:in_range`, reason: `${seen} ${fill(FORCE_REASONS.tool[profile])}` };
  }
  return hands(carriedAny ? 'out_of_range' : 'none_carried');
}

/** A person who is never killed (noFatal) is seriously hurt by a sample that would kill (forceCuts). */
export function teamForceSeverity(person: IncidentPersonDef | undefined, profile: ForceProfile, sample: number): ForceSeverity {
  return cutFor(forceCuts(profile, person?.noFatal ?? false), sample);
}

export const drawnKey = (model: 'incoming_fire' | 'team_force', severity: string, profile?: ForceProfile) => model === 'team_force' ? `${profile}:${severity}` : severity;

/** Versioned fictional balance for a group whose leader gives up. Each member still inside follows
 * by a chance from how strongly the leader holds them (influence, 0 to 1), how much they talk to the
 * team (rapport) and how worked up they are (agitation), 0 to 100 each, as their meters stand when
 * the decision commits. A member held at 0.7 with the template's starting meters (rapport 10,
 * agitation 60) follows about 6 times in 10; a loosely held, worked-up one (0.3, rapport 0,
 * agitation 80) about 3 in 10. Tunable (sim/tuning.ts). */
export const CASCADE_V1 = tunable('CASCADE_V1', {
  base: 0.25,
  /** Per unit of influence: a member held at 1 gains 0.5. */
  influence: 0.5,
  /** Per point of rapport: rapport 50 adds 0.2. */
  rapport: 0.004,
  /** Per point of agitation away from the pivot: agitation 80 takes 0.12 away, 20 adds 0.12. */
  agitation: 0.004, agitationPivot: 50,
  /** Someone with no group drawn is held halfway; someone with no meters reads as the pivot and no rapport. */
  influenceDefault: 0.5,
  floor: 0.05, ceiling: 0.95,
}, { guard: next => next.floor < 0 || next.floor > next.ceiling || next.ceiling > 1 ? 'Follow chances need 0 ≤ floor ≤ ceiling ≤ 1.' : null });


/** The chance a member follows a leader who gives up. */
export function cascadeChance(person: Pick<IncidentPersonDef, 'group' | 'meters'> | undefined, meters?: SubjectMeters): number {
  const T = CASCADE_V1;
  const influence = person?.group?.influence ?? T.influenceDefault;
  const { agitation, rapport } = meters ?? person?.meters ?? { agitation: T.agitationPivot, rapport: 0 };
  const chance = T.base + T.influence * influence + T.rapport * rapport - T.agitation * (agitation - T.agitationPivot);
  return Math.min(T.ceiling, Math.max(T.floor, chance));
}

/** One sample per member. The first is the cascade's saved sample; the rest come from a stream it
 * seeds, kept apart from the run's own stream, so each member has a sample of their own and the save
 * replay counts one draw per cascade (sim/external-support.ts). */
export function cascadeSamples(sample: number, count: number): number[] {
  const out: number[] = [];
  let state = (Math.floor(sample * 4294967296) ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < count; i++) {
    if (i === 0) { out.push(sample); continue; }
    const roll = next(state);
    state = roll.state;
    out.push(roll.value);
  }
  return out;
}

/** Each member's chance to follow, in the group's order, as their meters stand now; null for someone
 * already out, safe or hurt, who takes no part. What cascadeStates samples and the lab's odds read. */
export function cascadeChances(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'meters' | 'personCasualties'>, members: readonly Id[]): (number | null)[] {
  return members.map(id => {
    if (run.flags.includes(`out:${id}`) || run.flags.includes(`safe:${id}`) || run.personCasualties?.[id]) return null;
    const meters = run.meters?.[id];
    return cascadeChance(scenario.incidentPeople?.find(entry => entry.id === id), meters ? { agitation: meters.agitation, rapport: meters.rapport } : undefined);
  });
}

/** What each member does, in the group's order. Someone already out, safe or hurt takes no part. */
export function cascadeStates(scenario: ScenarioDefinition, run: Pick<OperationRun, 'flags' | 'meters' | 'personCasualties'>, members: readonly Id[], sample: number): CascadeState[] {
  return cascadeStatesFor(cascadeChances(scenario, run, members), sample);
}

function cascadeStatesFor(chances: readonly (number | null)[], sample: number): CascadeState[] {
  const samples = cascadeSamples(sample, chances.length);
  return chances.map((chance, i) => chance === null ? 'out' : samples[i] < chance ? 'follows' : 'stays');
}


/** The chance each combination happens, members still inside following independently by their
 * chance (cascadeChances; null for someone out). Only possible combinations are listed. */
export function cascadeComboDistribution(chances: readonly (number | null)[]): { states: CascadeState[]; p: number }[] {
  let combos: { states: CascadeState[]; p: number }[] = [{ states: [], p: 1 }];
  for (const chance of chances) {
    combos = chance === null ? combos.map(combo => ({ states: [...combo.states, 'out'], p: combo.p }))
      : combos.flatMap(combo => [{ states: [...combo.states, 'follows' as const], p: combo.p * chance }, { states: [...combo.states, 'stays' as const], p: combo.p * (1 - chance) }]);
  }
  return combos;
}

/** Where a cascade routes, by chance, for members still inside with these chances to follow
 * (members already out leave the list). Nobody left inside routes 'all', as cascadeResult does. */
export function cascadeDistribution(chances: readonly number[]): Record<'all' | 'some' | 'none', number> {
  if (!chances.length) return { all: 1, some: 0, none: 0 };
  const all = chances.reduce((p, chance) => p * chance, 1);
  const none = chances.reduce((p, chance) => p * (1 - chance), 1);
  return { all, some: chances.length < 2 ? 0 : Math.max(0, 1 - all - none), none };
}

/** Every key a drawn effect can resolve to: what its variants must cover. */
export function drawnKeys(effect: OutcomeEffect, scenario: ScenarioDefinition): string[] {
  if (!effect.drawn) return [];
  if (effect.drawn.model === 'incoming_fire') return ['none', 'wounded', 'serious'];
  if (effect.drawn.model === 'cascade') return cascadeCombos(effect.drawn.members.length).map(cascadeKey);
  const person = scenario.incidentPeople?.find(entry => entry.id === (effect.drawn as { on: Id }).on);
  // A profile that can't kill (hands), or a person who is never killed (noFatal), has no fatal key.
  return (Object.keys(FORCE_RISK_V1) as ForceProfile[]).flatMap(profile => (['none', 'wounded', 'serious', 'fatal'] as ForceSeverity[])
    .filter(severity => severity !== 'fatal' || (FORCE_RISK_V1[profile].fatal > 0 && !person?.noFatal))
    .map(severity => drawnKey('team_force', severity, profile)));
}


/** One settled drawn effect, saved on the commit. For a cascade, `personId` is the leader and `key`
 * every member's state in the group's order. */
export interface DrawnRecord { model: 'incoming_fire' | 'team_force' | 'cascade'; personId: Id; key: string; reason?: string }

/** What decide() hands the drawn effects: the state at the commit and who acts. */
export interface DrawnContext {
  state: GameState; run: OperationRun; scenario: ScenarioDefinition; acting: SquadId[]; participantIds: Id[];
  unitsOf: (state: GameState, run: OperationRun, squad: SquadId) => ItemUnit[];
}

/** What one drawn effect draws from at this state: the cuts for its one sample (fire, force), or
 * each member's chance to follow (cascade). resolveDrawn samples it; drawnDistribution reads its odds. */
type DrawPlan =
  | { model: 'incoming_fire'; personId: Id; draw: SampleCuts<FireSeverity> }
  | { model: 'team_force'; personId: Id; profile: ForceProfile; reason: string; draw: SampleCuts<ForceSeverity> }
  | { model: 'cascade'; personId: Id; chances: (number | null)[] };

function drawPlan(drawn: NonNullable<OutcomeEffect['drawn']>, ctx: DrawnContext): DrawPlan {
  if (drawn.model === 'incoming_fire') {
    const person = ctx.scenario.incidentPeople?.find(entry => entry.id === drawn.from);
    const { hit, serious } = person ? incomingFireOdds(person) : { hit: 0, serious: 0 };
    return { model: 'incoming_fire', personId: drawn.from, draw: incomingFireCuts(hit, serious) };
  }
  if (drawn.model === 'cascade') return { model: 'cascade', personId: drawn.on, chances: cascadeChances(ctx.scenario, ctx.run, drawn.members) };
  const choice = teamForceProfile(ctx.state, ctx.run, ctx.scenario, ctx.acting, ctx.participantIds, drawn.on, ctx.unitsOf);
  const noFatal = ctx.scenario.incidentPeople?.find(entry => entry.id === drawn.on)?.noFatal ?? false;
  return { model: 'team_force', personId: drawn.on, profile: choice.profile, reason: choice.reason, draw: forceCuts(choice.profile, noFatal) };
}

/** The variant key one sample settles a plan on. */
function planKey(plan: DrawPlan, sample: number): string {
  if (plan.model === 'incoming_fire') return cutFor(plan.draw, sample);
  if (plan.model === 'cascade') return cascadeKey(cascadeStatesFor(plan.chances, sample));
  return drawnKey('team_force', cutFor(plan.draw, sample), plan.profile);
}

/** Settle every drawn effect in the matched list, each with its own saved sample, in order. A list
 * with no drawn effect draws nothing, so earlier versions keep their one-draw sequence. A cascade
 * takes one saved sample and seeds each member's draw from it (cascadeSamples). */
export function resolveDrawn(effects: OutcomeEffect[], ctx: DrawnContext): { effects: OutcomeEffect[]; records: DrawnRecord[] } {
  if (!effects.some(effect => effect.drawn)) return { effects, records: [] };
  const out: OutcomeEffect[] = [];
  const records: DrawnRecord[] = [];
  for (const effect of effects) {
    if (!effect.drawn) { out.push(effect); continue; }
    const { drawn, variants, ...rest } = effect;
    const roll = next(ctx.run.rngState);
    ctx.run.rngState = roll.state;
    const plan = drawPlan(drawn, ctx);
    const key = planKey(plan, roll.value);
    records.push({ model: drawn.model, personId: plan.personId, key, ...(plan.model === 'team_force' && plan.reason ? { reason: plan.reason } : {}) });
    out.push(rest, ...(variants?.[key] ?? []));
  }
  return { effects: out, records };
}

// ---------------------------------------------------------------- odds (Scenario Lab)
// One copy of the drawn-result odds: the plans resolveDrawn samples, read as chances. The engine
// never shows these to the player; the lab does.

export interface DrawnResult { key: string; label: string; p: number }   // key = the compiled variant key
/** One drawn effect's results with their chances. `effect` is the effect's index in the list given. */
export interface DrawnDistribution { effect: number; model: 'incoming_fire' | 'team_force' | 'cascade'; results: DrawnResult[] }

const FIRE_LABEL: Record<FireSeverity, string> = { none: 'Nobody hit', wounded: 'An officer hurt', serious: 'An officer badly hurt' };
const FORCE_LABEL: Record<ForceProfile, string> = { firearm: 'Firearm', less_lethal_device: 'Less-lethal device', less_lethal_impact: 'Impact launcher', hands: 'By hand' };
const SEVERITY_LABEL: Record<ForceSeverity, string> = { none: 'not hurt', wounded: 'hurt', serious: 'badly hurt', fatal: 'killed' };

function planResults(plan: DrawPlan): DrawnResult[] {
  if (plan.model === 'incoming_fire') {
    const shares = cutShares(plan.draw);
    return (['none', 'wounded', 'serious'] as const).filter(key => (shares[key] ?? 0) > 0).map(key => ({ key, label: FIRE_LABEL[key], p: shares[key]! }));
  }
  if (plan.model === 'team_force') {
    const shares = cutShares(plan.draw);
    return (['none', 'wounded', 'serious', 'fatal'] as const).filter(key => (shares[key] ?? 0) > 0)
      .map(key => ({ key: drawnKey('team_force', key, plan.profile), label: `${FORCE_LABEL[plan.profile]}: ${SEVERITY_LABEL[key]}`, p: shares[key]! }));
  }
  return cascadeComboDistribution(plan.chances).filter(combo => combo.p > 0).map(({ states, p }) => {
    const inside = states.filter(state => state !== 'out').length, followed = states.filter(state => state === 'follows').length;
    const result = cascadeResult(states);
    return { key: cascadeKey(states), label: result === 'all' ? (inside ? 'All follow' : 'Nobody left to follow') : result === 'none' ? 'None follow' : `${followed} of ${inside} follow`, p };
  });
}

/** For each drawn effect in a matched list, every result it can settle on and its chance, from the
 * same plans resolveDrawn samples (the cascade's members treated as independent; their samples come
 * from one seeded stream). Nothing for a call before v13, which draws nothing. */
export function drawnDistribution(effects: readonly OutcomeEffect[], ctx: DrawnContext): DrawnDistribution[] {

  return effects.flatMap((effect, index) => effect.drawn ? [{ effect: index, model: effect.drawn.model, results: planResults(drawPlan(effect.drawn, ctx)) }] : []);
}
