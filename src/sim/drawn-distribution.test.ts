import { describe, expect, it } from 'vitest';
import { drawIncidentSpec, generateIncident } from '../gen/incident';
import { applyMove, availableMoves, NOW, startGateRun } from '../gen/incident/gates/engine-driver';
import { cascadeChance, cascadeDistribution, drawnDistribution, incomingFireDistribution, incomingFireOdds, resolveDrawn, type DrawnContext } from './drawn-effects';
import { FORCE_RISK_V1, forceDistribution, type ForceRiskProfile } from './force-risk';
import { actionViews, drawnDistributionAt } from './operation-selectors';
import { makeUnit } from './test-fixtures';
import { getScenario } from './scenario-registry';
import type { IncidentPersonDef, OutcomeEffect, ScenarioDefinition } from './scenario-types';
import type { GameState, OperationRun, OutcomeBand, StageId } from './types';

// The drawn-result odds the lab shows come from the same plans resolveDrawn samples
// (sim/drawn-effects.ts drawPlan). Each distribution is checked against resolveDrawn itself, run on
// 20,000 rng states, to within one point.
const SAMPLES = 20_000;

const subject = (patch: Partial<IncidentPersonDef> = {}): IncidentPersonDef => ({
  id: 'p', kind: 'subject', label: 'Ash', minor: false, spaceId: 'r1', at: { x: 10, y: 10 },
  threat: { armament: 'handgun', readiness: 'brandished', disposition: 'agitated', intent: 'harm_others', awareness: 'aware' },
  weapon: { kind: 'handgun', real: 'real' }, proficiency: 'some', doorFt: 15, ...patch,
});
const member = (id: string, influence: number, meters = { agitation: 60, rapport: 10 }): IncidentPersonDef => ({
  id, kind: 'subject', label: id, minor: false, spaceId: 'r9', at: { x: 90, y: 90 }, meters, volatility: 'shifting', group: { id: 'g', role: 'follower', influence },
});
// A department where every officer carries every cert, so only the person and the place choose the tool.
const STATE = { department: { clockHighWater: NOW, developmentTiers: {} }, officers: { o1: { certs: ['less_lethal', 'advanced_less_lethal', 'entry_team'] } } } as unknown as GameState;
const UNITS = () => [makeUnit('impact_launcher', 1), makeUnit('conducted_energy_device', 2), makeUnit('service_sidearm', 3), makeUnit('impact_supply', 4), makeUnit('energy_cartridge', 5)];

function context(people: IncidentPersonDef[], run: Partial<OperationRun> = {}): DrawnContext {
  return { state: STATE, run: { flags: [], knowledge: {}, rngState: 1, ...run } as unknown as OperationRun,
    scenario: { version: 13, incidentPeople: people } as unknown as ScenarioDefinition, acting: ['A'], participantIds: ['o1'], unitsOf: UNITS };
}

/** How often resolveDrawn settles each key of the first drawn effect, over SAMPLES rng states. */
function empirical(effect: OutcomeEffect, ctx: DrawnContext): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let k = 1; k <= SAMPLES; k++) {
    ctx.run.rngState = k * 2654435761 >>> 0;
    const key = resolveDrawn([effect], ctx).records[0].key;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([key, n]) => [key, n / SAMPLES]));
}

function expectMatches(effect: OutcomeEffect, ctx: DrawnContext) {
  const [odds] = drawnDistribution([effect], ctx);
  const seen = empirical(effect, ctx);
  const shown = Object.fromEntries(odds.results.map(result => [result.key, result.p]));
  expect(odds.results.reduce((sum, result) => sum + result.p, 0)).toBeCloseTo(1, 9);
  // Every key resolveDrawn settled on is listed, and every listed chance is within a point.
  for (const key of Object.keys(seen)) expect(shown, `listed ${key}`).toHaveProperty([key]);
  for (const [key, p] of Object.entries(shown)) expect(Math.abs((seen[key] ?? 0) - p), `${key}: shown ${p}, drawn ${seen[key] ?? 0}`).toBeLessThan(0.01);
  return odds;
}

describe('incoming fire odds', () => {
  it.each([
    ['a handgun at mid range', subject()],
    ['a trained rifle at the door from hard cover', subject({ weapon: { kind: 'long_gun', real: 'real' }, proficiency: 'trained', doorFt: 4, cover: { objectId: 'o', label: 'counter', grade: 'hard' } })],
    ['an untrained blade across the room', subject({ weapon: { kind: 'edged', real: 'real' }, proficiency: 'untrained', doorFt: 30 })],
    ['a replica', subject({ weapon: { kind: 'handgun', real: 'replica' } })],
  ])('match resolveDrawn for %s', (_name, person) => {
    const odds = expectMatches({ drawn: { model: 'incoming_fire', from: 'p' } }, context([person]));
    const { hit, serious } = incomingFireOdds(person);
    expect(Object.fromEntries(odds.results.map(result => [result.key, result.p]))).toEqual(
      Object.fromEntries(Object.entries(incomingFireDistribution(hit, serious)).filter(([, p]) => p > 0)));
  });

  it('split the hits by the serious share', () => {
    expect(incomingFireDistribution(0.5, 0.3)).toEqual({ none: 0.5, wounded: 0.35, serious: 0.15 });
    expect(incomingFireDistribution(0, 0)).toEqual({ none: 1, wounded: 0, serious: 0 });
  });
});

describe('team force odds', () => {
  const knife = (patch: Partial<IncidentPersonDef> = {}) => subject({ threat: { armament: 'edged', readiness: 'brandished', disposition: 'agitated', intent: 'harm_others', awareness: 'aware' }, weapon: { kind: 'edged', real: 'real' }, ...patch });
  const deviceOnly = () => [makeUnit('conducted_energy_device', 2), makeUnit('energy_cartridge', 5)];
  it.each([
    ['firearm', subject(), UNITS],
    ['firearm', subject({ noFatal: true }), UNITS],
    ['less_lethal_impact', knife({ doorFt: 40 }), UNITS],
    ['less_lethal_device', knife({ doorFt: 12 }), deviceOnly],
    ['hands', knife({ doorFt: 40, cover: { objectId: 'o', label: 'counter', grade: 'hard' } }), UNITS],
  ] as const)('match resolveDrawn for the %s', (profile, person, unitsOf) => {
    const odds = expectMatches({ drawn: { model: 'team_force', on: 'p' } }, { ...context([person]), unitsOf });
    expect(new Set(odds.results.map(result => result.key.split(':')[0]))).toEqual(new Set([profile]));
    const shares = forceDistribution(profile as ForceRiskProfile, person.noFatal);
    for (const result of odds.results) expect(result.p).toBe(shares[result.key.split(':')[1] as keyof typeof shares]);
    if (person.noFatal) expect(odds.results.some(result => result.key.endsWith(':fatal'))).toBe(false);
  });

  it('give each severity the gap between its thresholds, and fold fatal into serious when asked', () => {
    for (const profile of ['firearm', 'less_lethal_device', 'less_lethal_impact', 'hands'] as const) {
      const risk = FORCE_RISK_V1[profile], shares = forceDistribution(profile);
      expect(shares.fatal).toBeCloseTo(risk.fatal, 12);
      expect(shares.serious).toBeCloseTo(risk.serious - risk.fatal, 12);
      expect(shares.wounded).toBeCloseTo(risk.wounded - risk.serious, 12);
      expect(shares.none).toBeCloseTo(1 - risk.wounded, 12);
      expect(forceDistribution(profile, true)).toMatchObject({ fatal: 0, serious: risk.serious });
    }
    expect(forceDistribution('hands').fatal).toBe(0);
  });
});

describe('cascade odds', () => {
  it.each([
    ['one member', [member('a', 0.7)], {}],
    ['three members, one already out', [member('a', 0.9), member('b', 0.3, { agitation: 80, rapport: 0 }), member('c', 0.5)], { flags: ['out:b'] }],
    ['three members as their meters stand now', [member('a', 0.9), member('b', 0.3), member('c', 0.5)],
      { meters: { b: { agitation: 20, rapport: 70, moved: { heard: { agitation: -40, rapport: 60 } } } } }],
  ])('match resolveDrawn for %s', (_name, people, run) => {
    const effect: OutcomeEffect = { drawn: { model: 'cascade', on: 'leader', members: people.map(person => person.id) } };
    const ctx = context(people, run as Partial<OperationRun>);
    const odds = expectMatches(effect, ctx);
    // The routes add up the same way: all, some or none of those still inside.
    const chances = people.filter(person => !ctx.run.flags.includes(`out:${person.id}`)).map(person => {
      const meters = ctx.run.meters?.[person.id];
      return cascadeChance(person, meters && { agitation: meters.agitation, rapport: meters.rapport });
    });
    const routes = cascadeDistribution(chances);
    const byRoute = { all: 0, some: 0, none: 0 };
    for (const result of odds.results) {
      const states = result.key.split('+').filter(state => state !== 'out');
      const followed = states.filter(state => state === 'follows').length;
      byRoute[followed === states.length ? 'all' : followed === 0 ? 'none' : 'some'] += result.p;
    }
    for (const route of ['all', 'some', 'none'] as const) expect(byRoute[route]).toBeCloseTo(routes[route], 12);
  });

  it('sums to 1, and routes all when nobody is left inside', () => {
    for (const chances of [[], [0.4], [0.2, 0.9], [0.05, 0.5, 0.95], [0.3, 0.3, 0.3, 0.3]]) {
      const routes = cascadeDistribution(chances);
      expect(routes.all + routes.some + routes.none).toBeCloseTo(1, 12);
      expect(Math.min(routes.all, routes.some, routes.none)).toBeGreaterThanOrEqual(0);
    }
    expect(cascadeDistribution([])).toEqual({ all: 1, some: 0, none: 0 });
    expect(cascadeDistribution([0.4])).toEqual({ all: 0.4, some: 0, none: 0.6 });
  });
});

describe('drawnDistributionAt', () => {
  it('lists, for real calls, every drawn result a commit then records', () => {
    let checked = 0;
    for (const type of ['active_armed_incident', 'hostage_crisis'] as const) {
      let rng = 99;
      for (let i = 0; i < 3; i++) {
        const drawn = drawIncidentSpec(rng, { level: 10, trust: 90, unlockedTypes: [type] });
        rng = drawn.state;
        let frontier: GameState[] = [startGateRun(generateIncident(drawn.spec).id, 719)];
        for (let depth = 0; depth < 3 && frontier.length; depth++) {
          const next: GameState[] = [];
          for (const state of frontier.slice(0, 2)) {
            const views = actionViews(state, NOW, 'A');
            for (const move of availableMoves(state, views)) {
              if (move.kind !== 'decide') continue;
              const view = views.find(entry => entry.id === move.actionId)!;
              const odds = drawnDistributionAt(state, move.actionId, move.band!, view.actingSquadIds);
              const after = applyMove(state, move, views);
              if (!after) continue;
              const records = after.activeRun!.history.at(-1)!.committed?.drawn ?? [];
              expect(records.map(record => record.model)).toEqual(odds.map(entry => entry.model));
              records.forEach((record, k) => {
                expect(odds[k].results.find(result => result.key === record.key)?.p ?? 0, `${move.actionId} ${move.band} ${record.key}`).toBeGreaterThan(0);
                // `effect` points at the authored outcome that drew it.
                expect(authoredOutcome(state, move.actionId, move.band!, odds[k].effect)?.drawn?.model).toBe(record.model);
                checked++;
              });
              if (after.activeRun?.status === 'active') next.push(after);
            }
          }
          frontier = next;
        }
      }
    }
    expect(checked, 'some drawn result was committed along the way').toBeGreaterThan(10);
  }, 120_000);

  it('is empty with no call running, for an action not at this stage, and for a band with nothing drawn', () => {
    const state = startGateRun(generateIncident(drawIncidentSpec(99, { level: 10, trust: 90, unlockedTypes: ['barricaded'] }).spec).id, 719);
    expect(drawnDistributionAt({ ...state, activeRun: null }, 'x', 'favorable')).toEqual([]);
    expect(drawnDistributionAt(state, 'not_an_action', 'favorable')).toEqual([]);
  });
});

/** The authored outcome a drawn distribution's `effect` index points at. */
function authoredOutcome(state: GameState, actionId: string, band: OutcomeBand, index: number): OutcomeEffect | undefined {
  const run = state.activeRun!;
  return getScenario(run.scenarioId)?.stages[run.stage as StageId].actions.find(action => action.id === actionId)?.outcomes[band][index];
}
