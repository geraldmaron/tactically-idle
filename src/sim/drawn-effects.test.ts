import { describe, expect, it } from 'vitest';
import { drawIncidentSpec, generateIncident } from '../gen/incident';
import { applyNaturalMove, NOW, startGateRun } from '../gen/incident/gates/engine-driver';
import { FORCE_REASONS } from '../content/incidents/lines';
import { AUTHORIZATION_V1 } from './authorization';
import { CASCADE_V1, cascadeChance, cascadeCombos, cascadeKey, cascadeResult, cascadeSamples, cascadeStates, drawnKeys, incomingFireOdds, incomingFireSeverity, teamForceProfile, teamForceSeverity } from './drawn-effects';
import { validIncidentConsequences, validPersonConsequences } from './incident-consequences';
import { actionViews } from './operation-selectors';
import { availableUnits } from './resolution';
import { getScenario } from './scenario-registry';
import type { IncidentPersonDef, ScenarioDefinition } from './scenario-types';
import type { GameState } from './types';

const shooter = (patch: Partial<IncidentPersonDef> = {}): IncidentPersonDef => ({
  id: 'shooter', kind: 'subject', label: 'Ash', minor: false, spaceId: 'r1', at: { x: 10, y: 10 },
  threat: { armament: 'handgun', readiness: 'brandished', disposition: 'agitated', intent: 'harm_others', awareness: 'aware' },
  weapon: { kind: 'handgun', real: 'real' }, proficiency: 'some', doorFt: 15, ...patch,
});

describe('incoming fire (INCOMING_FIRE_V1)', () => {
  it('hits more from a trained hand, at close range and from cover, and never from a replica', () => {
    const base = incomingFireOdds(shooter()).hit;
    expect(incomingFireOdds(shooter({ proficiency: 'trained' })).hit).toBeGreaterThan(base);
    expect(incomingFireOdds(shooter({ proficiency: 'untrained' })).hit).toBeLessThan(base);
    expect(incomingFireOdds(shooter({ doorFt: 5 })).hit).toBeGreaterThan(base);
    expect(incomingFireOdds(shooter({ doorFt: 30 })).hit).toBeLessThan(base);
    expect(incomingFireOdds(shooter({ cover: { objectId: 'o', label: 'counter', grade: 'hard' } })).hit).toBeGreaterThan(base);
    expect(incomingFireOdds(shooter({ weapon: { kind: 'long_gun', real: 'real' } })).serious).toBeGreaterThan(incomingFireOdds(shooter()).serious);
    expect(incomingFireOdds(shooter({ weapon: { kind: 'handgun', real: 'replica' } })).hit).toBe(0);
  });
  it('maps one sample to none, wounded or serious, in that order of rarity', () => {
    expect(incomingFireSeverity(shooter(), 0.01)).toBe('serious');
    expect(incomingFireSeverity(shooter(), 0.4)).toBe('wounded');
    expect(incomingFireSeverity(shooter(), 0.99)).toBe('none');
  });
});

describe('team force (TEAM_FORCE_V1)', () => {
  // A department with every item and every cert, so only the person and the place decide.
  const state = { officers: { o1: { certs: ['less_lethal', 'advanced_less_lethal', 'entry_team'] } } } as unknown as GameState;
  const run = {} as GameState['activeRun'] & object;
  const units = () => [{ id: 'u1', itemId: 'impact_launcher' }, { id: 'u2', itemId: 'conducted_energy_device' }] as ReturnType<typeof availableUnits>;
  const scenario = (people: IncidentPersonDef[]) => ({ incidentPeople: people } as ScenarioDefinition);
  const pick = (people: IncidentPersonDef[], knowledge: Record<string, string> = {}, flags: string[] = []) =>
    teamForceProfile(state, { knowledge, flags } as unknown as typeof run, scenario(people), ['A'], ['o1'], 'shooter', units);
  const choose = (people: IncidentPersonDef[], knowledge?: Record<string, string>, flags?: string[]) => pick(people, knowledge, flags).profile;
  const threat = (armament: NonNullable<IncidentPersonDef['threat']>['armament'], readiness: NonNullable<IncidentPersonDef['threat']>['readiness'] = 'brandished') =>
    ({ armament, readiness, disposition: 'agitated', intent: 'harm_others', awareness: 'aware' }) as const;
  const knife = shooter({ threat: threat('edged'), weapon: { kind: 'edged', real: 'real' } });
  const empty = shooter({ threat: threat('none', 'concealed'), weapon: undefined });

  it('uses the firearm only against a gun in hand the team believes is there', () => {
    expect(choose([shooter()])).toBe('firearm');
    const told = shooter({ armamentFactId: 'f_gun' });
    expect(choose([told], { f_gun: 'reported' })).toBe('firearm');
    expect(choose([told], { f_gun: 'confirmed' })).toBe('firearm');
    // Not believed: the claim was never heard, or the team found it false.
    expect(choose([told], { f_gun: 'unknown' })).toBe('less_lethal_impact');
    expect(choose([told], { f_gun: 'disproved' })).toBe('less_lethal_impact');
    // A gun that is carried, not in hand, is no imminent threat on its own.
    expect(choose([shooter({ threat: threat('handgun', 'carried') })])).toBe('less_lethal_impact');
    // A replica in hand looks like a gun, and the team acts on what it sees.
    expect(choose([shooter({ weapon: { kind: 'handgun', real: 'replica' } })])).toBe('firearm');
  });

  it('uses the firearm against a blade or a bat in hand only within reach of someone', () => {
    const reach = AUTHORIZATION_V1.deadlyForce.reachFt;
    expect(choose([{ ...knife, doorFt: reach + 5 }])).toBe('less_lethal_impact');
    expect(choose([{ ...knife, doorFt: reach }])).toBe('firearm');
    expect(choose([{ ...knife, threat: threat('blunt'), doorFt: reach - 2 }])).toBe('firearm');
    // Within reach of a held person in the same room, until that person is out.
    const held: IncidentPersonDef = { id: 'held', kind: 'hostage', label: 'Sam', minor: false, spaceId: 'r1', at: { x: 10, y: 18 } };
    expect(choose([knife, held])).toBe('firearm');
    expect(choose([knife, held], {}, ['safe:held'])).toBe('less_lethal_impact');
    expect(choose([knife, { ...held, spaceId: 'r2' }])).toBe('less_lethal_impact');
    expect(choose([knife, { ...held, at: { x: 10, y: 10 + reach + 1 } }])).toBe('less_lethal_impact');
  });

  it('uses less-lethal when it is carried by a trained officer, in range and clear, and otherwise the team’s hands', () => {
    expect(choose([empty])).toBe('less_lethal_impact');
    expect(choose([{ ...empty, doorFt: 80 }])).toBe('hands');
    expect(choose([{ ...empty, cover: { objectId: 'o', label: 'counter', grade: 'hard' } }])).toBe('hands');
    const child: IncidentPersonDef = { id: 'kid', kind: 'victim', label: 'Sam', minor: true, spaceId: 'r1', at: { x: 13, y: 10 } };
    expect(choose([empty, child])).toBe('hands');
    expect(teamForceProfile({ officers: { o1: { certs: [] } } } as unknown as GameState, run, scenario([empty]), ['A'], ['o1'], 'shooter', units).profile).toBe('hands');
    // Out of the launcher's range only the device remains, and it reaches 15 feet.
    const deviceOnly = () => [{ id: 'u2', itemId: 'conducted_energy_device' }] as ReturnType<typeof availableUnits>;
    expect(teamForceProfile(state, run, scenario([{ ...empty, doorFt: 12 }]), ['A'], ['o1'], 'shooter', deviceOnly).profile).toBe('less_lethal_device');
    expect(teamForceProfile(state, run, scenario([{ ...empty, doorFt: 20 }]), ['A'], ['o1'], 'shooter', deviceOnly).profile).toBe('hands');
  });

  it('says what the team could see and why that tool, in plain sentences', () => {
    const reasons = {
      gun: pick([shooter()]),
      reach: pick([{ ...knife, doorFt: 6 }]),
      unseen: pick([shooter({ armamentFactId: 'f_gun' })], { f_gun: 'unknown' }),
      outOfReach: pick([knife]),
      cover: pick([{ ...empty, cover: { objectId: 'o', label: 'counter', grade: 'hard' } }]),
      none: teamForceProfile({ officers: { o1: { certs: [] } } } as unknown as GameState, run, scenario([empty]), ['A'], ['o1'], 'shooter', units),
    };
    expect(reasons.gun).toMatchObject({ rule: 'firearm:gun', reason: 'Ash is holding a handgun.' });
    expect(reasons.reach).toMatchObject({ rule: 'firearm:reach', reason: 'Ash has a weapon in hand, a few steps from the team.' });
    expect(reasons.unseen).toMatchObject({ rule: 'less_lethal_impact:in_range', reason: 'The team hasn’t seen Ash with a weapon. The impact launcher reaches from the door.' });
    expect(reasons.outOfReach.reason).toBe('Ash is holding a weapon, but nobody is within reach. The impact launcher reaches from the door.');
    expect(reasons.cover).toMatchObject({ rule: 'hands:cover', reason: 'Ash has nothing in hand. The counter is in the way of the less-lethal tools.' });
    expect(reasons.none).toMatchObject({ rule: 'hands:none_carried', reason: 'Ash has nothing in hand. The team has no less-lethal tool it can use.' });
    const lines = [...Object.values(FORCE_REASONS.deadly), ...Object.values(FORCE_REASONS.threat), ...Object.values(FORCE_REASONS.tool)];
    for (const line of lines) expect(line, 'colon or dash').not.toMatch(/[:–—]| - /);
  });

  it('never kills a minor, a subject the self-harm screen covers, or anyone taken by hand', () => {
    for (let sample = 0; sample < 0.3; sample += 0.001) {
      expect(teamForceSeverity(shooter({ noFatal: true }), 'firearm', sample)).not.toBe('fatal');
      expect(teamForceSeverity(shooter(), 'hands', sample)).not.toBe('fatal');
    }
    expect(teamForceSeverity(shooter(), 'firearm', 0.001)).toBe('fatal');
    expect(teamForceSeverity(shooter(), 'hands', 0.001)).toBe('serious');
  });

  it('asks every force outcome for a hands variant, and a fatal one only where force can kill', () => {
    const effect = { drawn: { model: 'team_force' as const, on: 'shooter' } };
    const keys = drawnKeys(effect, scenario([shooter()]));
    expect(keys).toEqual(expect.arrayContaining(['hands:none', 'hands:wounded', 'hands:serious', 'firearm:fatal']));
    expect(keys).not.toContain('hands:fatal');
    expect(drawnKeys(effect, scenario([shooter({ noFatal: true })])).some(key => key.endsWith(':fatal'))).toBe(false);
  });
});

describe('cascade (CASCADE_V1)', () => {
  const member = (id: string, influence: number, meters = { agitation: 60, rapport: 10 }): IncidentPersonDef => ({
    id, kind: 'subject', label: id, minor: false, spaceId: 'r1', at: { x: 10, y: 10 }, meters, volatility: 'shifting', group: { id: 'subjects', role: 'follower', influence },
  });
  const scenario = (people: IncidentPersonDef[]) => ({ version: 13, incidentPeople: people } as ScenarioDefinition);
  const share = (people: IncidentPersonDef[], run: Parameters<typeof cascadeStates>[1], trials = 4000) => {
    let follows = 0;
    for (let i = 0; i < trials; i++) follows += cascadeStates(scenario(people), run, [people[0].id], (i + 0.5) / trials)[0] === 'follows' ? 1 : 0;
    return follows / trials;
  };
  const still = { flags: [] as string[] };

  it('follows more the more strongly the leader holds them, the more they talk to the team and the calmer they are', () => {
    expect(cascadeChance(member('a', 0.9))).toBeGreaterThan(cascadeChance(member('a', 0.3)));
    expect(cascadeChance(member('a', 0.5), { agitation: 60, rapport: 50 })).toBeGreaterThan(cascadeChance(member('a', 0.5), { agitation: 60, rapport: 10 }));
    expect(cascadeChance(member('a', 0.5), { agitation: 30, rapport: 10 })).toBeGreaterThan(cascadeChance(member('a', 0.5), { agitation: 85, rapport: 10 }));
    // The documented anchors: held at 0.7 from the starting meters, and a loose, worked-up member.
    expect(cascadeChance(member('a', 0.7))).toBeCloseTo(0.6, 5);
    expect(cascadeChance(member('a', 0.3, { agitation: 80, rapport: 0 }))).toBeCloseTo(0.28, 5);
    expect(cascadeChance(member('a', 1, { agitation: 0, rapport: 100 }))).toBe(CASCADE_V1.ceiling);
    expect(cascadeChance(member('a', 0, { agitation: 100, rapport: 0 }))).toBe(CASCADE_V1.floor);
  });

  it('reads the run’s meters over the starting ones, and draws to the chance', () => {
    const held = [member('a', 0.9)], loose = [member('a', 0.2)];
    expect(share(held, still)).toBeGreaterThan(share(loose, still) + 0.2);
    expect(Math.abs(share(held, still) - cascadeChance(held[0]))).toBeLessThan(0.02);
    const heard = { flags: [], meters: { a: { agitation: 30, rapport: 60, moved: { heard: { agitation: -30, rapport: 50 } } } } };
    expect(share(loose, heard)).toBeGreaterThan(share(loose, still) + 0.2);
  });

  it('gives each member a sample of their own, and leaves out anyone already out or hurt', () => {
    const samples = cascadeSamples(0.42, 4);
    expect(samples[0]).toBe(0.42);
    expect(new Set(samples).size).toBe(4);
    expect(cascadeSamples(0.42, 4)).toEqual(samples);
    const people = [member('a', 1, { agitation: 0, rapport: 100 }), member('b', 1, { agitation: 0, rapport: 100 }), member('c', 0, { agitation: 100, rapport: 0 })];
    expect(cascadeStates(scenario(people), { flags: ['out:b'] }, ['a', 'b', 'c'], 0.5)).toEqual(['follows', 'out', 'stays']);
    expect(cascadeStates(scenario(people), { flags: [], personCasualties: { a: {} as never } }, ['a', 'b', 'c'], 0.5)[0]).toBe('out');
  });

  it('routes all, some or none of those still inside, and all when nobody is left to follow', () => {
    expect(cascadeResult(['follows', 'follows'])).toBe('all');
    expect(cascadeResult(['follows', 'stays'])).toBe('some');
    expect(cascadeResult(['stays', 'out'])).toBe('none');
    expect(cascadeResult(['out', 'follows'])).toBe('all');
    expect(cascadeResult(['out'])).toBe('all');
    expect(cascadeResult([])).toBe('all');
  });

  it('asks a cascade for a variant for every combination of what its members do', () => {
    expect(cascadeCombos(0)).toEqual([[]]);
    expect(cascadeCombos(2).map(cascadeKey)).toEqual(['follows+follows', 'follows+stays', 'follows+out', 'stays+follows', 'stays+stays', 'stays+out', 'out+follows', 'out+stays', 'out+out']);
    const effect = { drawn: { model: 'cascade' as const, on: 'taker', members: ['a', 'b', 'c'] } };
    expect(drawnKeys(effect, scenario([]))).toHaveLength(27);
  });
});

describe('drawn consequences in play', () => {
  it('keep every save valid while calls with gunfire and force are played', () => {
    let seen = 0;
    for (const type of ['active_armed_incident', 'barricaded'] as const) {
      let rng = 2718;
      for (let i = 0; i < 12; i++) {
        const drawn = drawIncidentSpec(rng, { level: 10, trust: 90, contentVersion: 13, unlockedTypes: [type] });
        rng = drawn.state;
        const s = generateIncident(drawn.spec);
        let state: GameState | null = startGateRun(s.id, 300 + i);
        for (let step = 0; step < 8 && state?.activeRun?.status === 'active' && state.activeRun.stage !== 'debrief'; step++) {
          // The fastest eligible choice: the style that meets gunfire most.
          const views = actionViews(state, NOW, 'A').filter(view => view.eligible).sort((a, b) => a.timeCost - b.timeCost);
          if (!views.length) break;
          state = applyNaturalMove(state, { kind: 'decide', actionId: views[0].id });
          if (!state?.activeRun) break;
          const run = state.activeRun, scenario = getScenario(run.scenarioId)!;
          expect(validIncidentConsequences(run, scenario, state.officers, state.squads, state.department.clockHighWater), `${s.id} officer records`).toBe(true);
          expect(validPersonConsequences(run, scenario, state), `${s.id} person records`).toBe(true);
          seen += Object.keys(run.officerCasualties ?? {}).length;
        }
      }
    }
    expect(seen, 'some officer was hit along the way').toBeGreaterThan(0);
  }, 300000);
});
