import { decisionsOf } from '../../../sim/types';
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import type { CallTree } from '../../../content/call-trees/types';
import type { IncidentType } from '../../../sim/scenario-types';
import { startGateRun } from '../gates/engine-driver';
import { drawCalls, GATE_CATALOG, GATE_SUITE, gateJobs, gateMetric, gatePasses, measure, playCall, playCalls, playToEnd, runMetric, summarize, WEIGHTS,
  type CallResult, type Distribution, type GateMetric, type PlayStep, type Weight } from './balance';

const tree = (type: IncidentType) => CALL_TREES[type]!;
const TYPES = Object.keys(CALL_TREES) as IncidentType[];

describe('balance gate definition', () => {
  it('has the 24 checks of the gate, in 11 jobs, and runs those of the curated calls', () => {
    expect(GATE_CATALOG).toHaveLength(24);
    expect(new Set(GATE_CATALOG.map(check => check.id)).size).toBe(24);
    expect(gateJobs(GATE_CATALOG)).toHaveLength(11);
    expect(GATE_SUITE).toEqual(GATE_CATALOG.filter(check => TYPES.includes(check.type)));
    expect(gateJobs()).toEqual(gateJobs(GATE_SUITE));
    for (const check of GATE_CATALOG) expect(check.tier).toBe(2);
    expect(GATE_CATALOG.filter(check => check.style === 'best_odds').every(check => check.calls === 40 && check.metric === 'clean' && check.max === 0.75)).toBe(true);
  });

  it('holds the bands the gate has always held', () => {
    const band = (type: string, style: string, metric: GateMetric) => {
      const check = GATE_CATALOG.find(entry => entry.type === type && entry.style === style && entry.metric === metric)!;
      return [check.min, check.max];
    };
    for (const type of ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue']) {
      expect(band(type, 'random', 'clean')).toEqual([0.15, 0.6]);
      expect(band(type, 'random', 'bad')).toEqual([0.15, 0.65]);
    }
    expect(band('hostage_crisis', 'random', 'harm')).toEqual([0.03, 0.3]);
    expect(band('barricaded', 'random', 'harm')).toEqual([0.01, 0.3]);
    expect(band('active_armed_incident', 'random', 'harm')).toEqual([0.15, 0.55]);
    expect(band('protected_rescue', 'random', 'harm')).toEqual([0.1, 0.5]);
    expect(band('hostage_crisis', 'random', 'death')).toEqual([0, 0.08]);
    expect(band('barricaded', 'random', 'death')).toEqual([0, 0.08]);
    expect(band('active_armed_incident', 'random', 'death')).toEqual([0.01, 0.16]);
    expect(band('protected_rescue', 'random', 'death')).toEqual([0, 0.12]);
    expect(band('active_armed_incident', 'fast', 'officerHurt')).toEqual([0.25, undefined]);
    expect(band('active_armed_incident', 'patient', 'officerHurt')).toEqual([undefined, 0.05]);
    expect(band('active_armed_incident', 'patient', 'harm')).toEqual([0.05, undefined]);
    expect(band('protected_rescue', 'patient', 'harm')).toEqual([0.15, undefined]);
  });

  it('reads a metric from a distribution as the gate always added it, and per call the same way', () => {
    const d: Distribution = { calls: 60, weights: { death: 0.033, hurt: 0.1, unresolved: 0.2, costly: 0.3, clean: 0.367 }, endings: {}, officerHurtRate: 0.25, meanMinutes: 40 };
    expect(gateMetric(d, 'clean')).toBe(0.367);
    expect(gateMetric(d, 'harm')).toBe(0.1 + 0.033);
    expect(gateMetric(d, 'bad')).toBe(0.2 + (0.1 + 0.033));
    expect(gateMetric(d, 'death')).toBe(0.033);
    expect(gateMetric(d, 'officerHurt')).toBe(0.25);
    const run = (weight: Weight, officersHurt = 0): CallResult => ({ weight, ending: 'x', minutes: 10, officersHurt, peopleHurt: 0, deaths: 0, decisions: 3 });
    const results = [...WEIGHTS.map(weight => run(weight)), run('clean', 1), run('costly', 2)];
    const summary = summarize(results);
    for (const metric of ['clean', 'bad', 'harm', 'death', 'officerHurt'] as const) {
      const share = results.reduce((n, r) => n + runMetric(r, metric), 0) / results.length;
      expect(Math.abs(gateMetric(summary, metric) - share), metric).toBeLessThan(0.0015);
    }
    expect(gatePasses(GATE_SUITE[0], 0.15)).toBe(true);
    expect(gatePasses(GATE_SUITE[0], 0.61)).toBe(false);
  });
});

describe('balance play', () => {
  const calls = drawCalls(tree('hostage_crisis'), 2, 10, 1);

  it('plays the same call with and without options when the options say what the default does', () => {
    for (const { scenarioId, seed } of calls) for (const policy of ['random', 'best_odds'] as const) {
      const plain = playToEnd(scenarioId, policy, seed);
      const steps: PlayStep[] = [];
      const optioned = playToEnd(scenarioId, policy, seed, { start: startGateRun(scenarioId, seed), rollSeed: seed, maxSteps: 30, onStep: step => steps.push(step) });
      expect(JSON.stringify(optioned), `${scenarioId} ${policy}`).toBe(JSON.stringify(plain));
      expect(steps.map(step => step.choice.id)).toEqual(decisionsOf(plain.activeRun!.history).map(entry => entry.actionId));
      steps.forEach((step, i) => { expect(step.after).toBe(steps[i + 1]?.before ?? optioned); expect(step.views.some(view => view.id === step.choice.id)).toBe(true); });
    }
  }, 120000);

  it('takes the first choice it is given, and plays nothing when that choice is closed', () => {
    const { scenarioId, seed } = calls[0];
    const start = startGateRun(scenarioId, seed);
    const plain = playToEnd(scenarioId, 'random', seed);
    const first = decisionsOf(plain.activeRun!.history)[0].actionId;
    expect(JSON.stringify(playToEnd(scenarioId, 'random', seed, { start, firstChoice: first }))).toBe(JSON.stringify(plain));
    expect(playToEnd(scenarioId, 'random', seed, { start, firstChoice: 'not_a_choice' })).toBe(start);
    expect(decisionsOf(playToEnd(scenarioId, 'random', seed, { start, maxSteps: 1 }).activeRun!.history)).toHaveLength(1);
    expect(JSON.stringify(start)).toBe(JSON.stringify(startGateRun(scenarioId, seed)));
  });

  it('measures exactly what the gate measured before: playCall on each drawn call, shares rounded', () => {
    // The gate's own summary, written out (the shape measure had before playCalls and summarize).
    const reference = (t: CallTree, policy: 'random' | 'patient', n: number): Distribution => {
      const weights = Object.fromEntries(WEIGHTS.map(weight => [weight, 0])) as Record<Weight, number>;
      const endings: Record<string, number> = {};
      let officerCalls = 0, minutes = 0;
      for (const { scenarioId, seed } of drawCalls(t, 2, n, 1)) {
        const result = playCall(t, scenarioId, policy, seed);
        weights[result.weight]++; endings[result.ending] = (endings[result.ending] ?? 0) + 1;
        if (result.officersHurt) officerCalls++;
        minutes += result.minutes;
      }
      const share = (k: number) => Math.round(1000 * k / n) / 1000;
      return { calls: n, weights: Object.fromEntries(WEIGHTS.map(weight => [weight, share(weights[weight])])) as Record<Weight, number>,
        endings: Object.fromEntries(Object.entries(endings).map(([ending, k]) => [ending, share(k)])), officerHurtRate: share(officerCalls), meanMinutes: Math.round(minutes / n) };
    };
    for (const type of TYPES) {
      expect(measure(tree(type), 2, 'random', 8)).toEqual(reference(tree(type), 'random', 8));
      expect(summarize(playCalls(tree(type), 'patient', drawCalls(tree(type), 2, 8, 1)))).toEqual(reference(tree(type), 'patient', 8));
    }
    const seen: number[] = [];
    const results = playCalls(tree('hostage_crisis'), 'random', drawCalls(tree('hostage_crisis'), 2, 4, 1), (result, steps, index) => {
      seen.push(index);
      expect(steps).toHaveLength(result.decisions);
    });
    expect(seen).toEqual([0, 1, 2, 3]);
    expect(results).toHaveLength(4);
  }, 120000);

  it('draws the 40 best-odds calls as the first 40 of the 60', () => {
    expect(drawCalls(tree('hostage_crisis'), 2, 40, 1)).toEqual(drawCalls(tree('hostage_crisis'), 2, 60, 1).slice(0, 40));
    for (const type of TYPES) expect(drawCalls(tree(type), 2, 4, 1)).toEqual(drawCalls(tree(type), 2, 6, 1).slice(0, 4));
  }, 120000);
});
