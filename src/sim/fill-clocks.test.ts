// Gauges that fill (docs: plan "Rising pressures"): ClockDef.direction 'fill'. A fill rises by its
// rate, cues fire as it reaches them, it never fills before a cue is heard, a flag stops or slows it,
// and while its first cue is heard it adds strain at a commit, call pressure each minute, and makes
// the trust result count for more either way. A clock that drains runs byte for byte as before.
import { decisionsOf } from './types';
import { describe, expect, it } from 'vitest';
import { compileFixtureCall } from '../gen/incident/gates/fixture-call';
import { startGateRun, withDraftScenario } from '../gen/incident/gates/engine-driver';
import { GROUP_TEMPLATE } from '../gen/incident/trees-v13/group-fixture';
import { validExternalSupportState } from './external-support';
import { initialMeters } from './meters';
import type { OutcomeEffect } from './scenario-types';
import { CALL_TREES } from '../content/call-trees';
import { drawCalls, playToEnd } from '../gen/incident/trees-v13/balance';
import { advanceClocks, audienceFactor, CLOCK_RULES_V1, clockErrors, clockOutEffects, clockViews, ditherCap, effectiveRate, fillGauge, fillViews, initialClocks, stepClock } from './clocks';
import { advanceTime, applyClockCues, traceRun } from './operation';
import { actionViews } from './operation-selectors';
import { scoreCall, scoreFrom, type ScoreInputs } from './outcome-score';
import { deserialize, serialize } from './save';
import type { ClockDef, ScenarioDefinition } from './scenario-types';
import { getScenario } from './scenario-registry';
import { stableFlag } from './conditions';
import { apply, NOW } from './test-fixtures';
import type { GameState } from './types';

const fill = (over: Partial<ClockDef> = {}): ClockDef => ({ id: 'crowd', label: 'The crowd with phones', kind: 'crowd', direction: 'fill', start: 10, ratePerMin: 5, rateKnown: true,
  cues: [{ at: 30, text: 'Phones come up along the tape.' }, { at: 60, text: 'Someone is narrating.' }, { at: 90, text: 'It is trending.' }], ...over });
const drain = (over: Partial<ClockDef> = {}): ClockDef => ({ id: 'tank', label: 'The tank', kind: 'supply', start: 80, ratePerMin: 4, rateKnown: true,
  cues: [{ at: 50, text: 'Half.' }, { at: 20, text: 'Low.' }], ...over });

describe('a clock that drains runs as it always did', () => {
  // The drain formula before `direction` existed, copied here as the reference.
  const was = (def: ClockDef, state: { value: number; cued: number }, minutes: number) => {
    let value = Math.round(Math.max(0, state.value - def.ratePerMin * minutes) * 10) / 10;
    if (value <= 0 && state.cued === 0) value = CLOCK_RULES_V1.floor;
    return { value, cued: Math.max(state.cued, def.cues.filter(cue => value <= cue.at).length) };
  };

  it('steps exactly the same over every start, rate and span', () => {
    for (const start of [100, 80, 55, 20, 5]) for (const ratePerMin of [0, 0.3, 1, 4, 12.5]) for (const minutes of [0, 0.5, 3.3, 9, 60]) {
      const def = drain({ start, ratePerMin });
      const state = initialClocks({ clocks: [def] } as ScenarioDefinition)!.tank;
      expect(stepClock(def, state, minutes, []), `${start} ${ratePerMin} ${minutes}`).toEqual(minutes <= 0 ? state : was(def, state, minutes));
    }
  });

  it('reads the rate it has, whatever flags are set, when it has no rate flags', () => {
    expect(effectiveRate(drain(), ['anything'])).toBe(4);
    expect(advanceTime({ clock: 0, pressure: 0, civilianSafety: 100, clocks: { tank: { value: 80, cued: 0 } }, flags: [] },
      { pressure: { start: 0, perMinute: 0, threshold: 100, civilianPerMinute: 0 }, clocks: [drain()] } as unknown as ScenarioDefinition, 8).cues.map(cue => cue.text)).toEqual(['Half.']);
  });
});

describe('a gauge that fills', () => {
  const at = (def: ClockDef, minutes: number, flags: string[] = [], state?: { value: number; cued: number }) =>
    stepClock(def, state ?? initialClocks({ clocks: [def] } as ScenarioDefinition)!.crowd, minutes, flags);

  it('rises by its rate and fires cues as it reaches them, never twice', () => {
    expect(at(fill(), 3)).toEqual({ value: 25, cued: 0 });
    expect(at(fill(), 5)).toEqual({ value: 35, cued: 1 });
    expect(at(fill(), 12)).toEqual({ value: 70, cued: 2 });
    const def = fill();
    const state = { crowd: { value: 10, cued: 0 } };
    const fired = advanceClocks({ clocks: state, flags: [] }, { clocks: [def] } as ScenarioDefinition, 12);
    expect(fired.map(effect => effect.text)).toEqual(['Phones come up along the tape.', 'Someone is narrating.']);
    expect(advanceClocks({ clocks: { crowd: { value: 70, cued: 2 } }, flags: [] }, { clocks: [def] } as ScenarioDefinition, 1)).toEqual([]);
  });

  it('starts with the cues its start has already passed', () => {
    expect(initialClocks({ clocks: [fill({ start: 65 })] } as ScenarioDefinition)!.crowd.cued).toBe(2);
    expect(initialClocks({ clocks: [fill({ start: 0 })] } as ScenarioDefinition)!.crowd.cued).toBe(0);
  });

  it('never fills before a cue is heard, and fills once one has', () => {
    const def = fill({ start: 50, ratePerMin: 100, cues: [{ at: 95, text: 'Everyone is filming.' }] });
    expect(at(def, 2)).toEqual({ value: 100 - CLOCK_RULES_V1.floor, cued: 1 });
    expect(at(def, 2, [], { value: 50, cued: 1 }).value).toBe(100);
  });

  it('stops on its stable flag and slows on a rate flag, the slowest winning', () => {
    expect(at(fill(), 4, [stableFlag('crowd')]).value).toBe(10);
    const slowed = fill({ rateFlags: [{ flag: 'perimeter_back', ratePerMin: 2 }, { flag: 'phones_down', ratePerMin: 1 }] });
    expect(effectiveRate(slowed, [])).toBe(5);
    expect(effectiveRate(slowed, ['perimeter_back'])).toBe(2);
    expect(effectiveRate(slowed, ['perimeter_back', 'phones_down'])).toBe(1);
    expect(at(slowed, 4, ['perimeter_back']).value).toBe(18);
    expect(effectiveRate(fill({ rateFlags: [{ flag: 'x', ratePerMin: 9 }] }), ['x'])).toBe(5);
  });

  it('reads as low once its first cue is heard, and out when full', () => {
    const scenario = { clocks: [fill()] } as ScenarioDefinition;
    const view = (clocks: { value: number; cued: number }) => clockViews(scenario, { clocks: { crowd: clocks }, flags: [] })[0];
    expect(view({ value: 20, cued: 0 })).toMatchObject({ direction: 'fill', low: false, out: false, minutesLeft: null });
    expect(view({ value: 40, cued: 1 })).toMatchObject({ low: true, out: false, latest: 'Phones come up along the tape.' });
    expect(view({ value: 100, cued: 3 })).toMatchObject({ low: true, out: true });
  });

  it('is checked: cues lowest first, a cue below 100, a start under 100, onFull and not onOut', () => {
    const errors = (...defs: ClockDef[]) => clockErrors({ id: 's', clocks: defs, facts: [] } as unknown as ScenarioDefinition);
    expect(errors(fill())).toEqual([]);
    expect(errors(fill({ cues: [{ at: 60, text: 'a' }, { at: 30, text: 'b' }] })).join()).toContain('lowest first');
    expect(errors(fill({ cues: [{ at: 100, text: 'a' }] })).join()).toContain('needs a cue before it fills');
    expect(errors(fill({ start: 100 })).join()).toContain('under 100');
    expect(errors(fill({ onOut: { mark: 'x' } })).join()).toContain('onFull');
    expect(errors(drain({ onFull: { mark: 'x' } })).join()).toContain('onFull');
  });

  it('shows what it does: cues heard, the effect once the first is heard, and slowing', () => {
    const scenario = { clocks: [fill({ rateFlags: [{ flag: 'slow', ratePerMin: 1 }] })] } as ScenarioDefinition;
    const quiet = fillViews(scenario, { clocks: { crowd: { value: 20, cued: 0 } }, flags: [] })[0];
    expect(quiet).toMatchObject({ direction: 'fill', value: 20, full: false, slowed: false, ratePerMin: 5, minutesToFull: 16, latest: null, effect: null });
    expect(quiet.cues.map(cue => [cue.at, cue.heard])).toEqual([[30, false], [60, false], [90, false]]);
    const loud = fillViews(scenario, { clocks: { crowd: { value: 70, cued: 2 } }, flags: ['slow'], fillPeak: 70 })[0];
    expect(loud).toMatchObject({ slowed: true, ratePerMin: 1, latest: 'Someone is narrating.' });
    expect(loud.cues.map(cue => cue.heard)).toEqual([true, true, false]);
    expect(loud.effect).toEqual({ strainPercent: Math.round(CLOCK_RULES_V1.fill.strain * 70), trustPercent: Math.round(CLOCK_RULES_V1.fill.audienceGain * 70), pressurePerMinute: Math.round(CLOCK_RULES_V1.fill.pressurePerMinute * 70) / 100 });
    expect(fillViews({ clocks: [drain()] } as ScenarioDefinition, { clocks: { tank: { value: 80, cued: 0 } }, flags: [] })).toEqual([]);
    expect(fillGauge(scenario, { crowd: { value: 20, cued: 0 } })).toBe(0);
    expect(fillGauge(scenario, { crowd: { value: 70, cued: 2 } })).toBe(0.7);
  });
});

/** The group fixture compiled on a real building with these clocks. */
function hosted(clocks: ClockDef[]): ScenarioDefinition {
  const base = compileFixtureCall(GROUP_TEMPLATE, 0);
  return { ...base, id: `${base.id}-fill-${clocks.map(clock => clock.id).join('')}`, clocks };
}
const decide = (state: GameState, ditherMinutes = 0): GameState => {
  const view = actionViews(state, NOW, 'A').find(entry => entry.eligible)!;
  return apply(state, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds, ...(ditherMinutes ? { ditherMinutes } : {}) }).state;
};

describe('what a gauge does in a call', () => {
  // The crowd is half full with two cues heard when the call starts; the other call has no gauge.
  const loud = fill({ start: 65, ratePerMin: 0.5 });

  it('adds strain at a commit, scaled by the gauge, and says so', () => {
    const withGauge = withDraftScenario(hosted([loud]), id => decide(startGateRun(id, 719)));
    const without = withDraftScenario(hosted([]), id => decide(startGateRun(id, 719)));
    const a = decisionsOf(withGauge.activeRun!.history)[0], b = decisionsOf(without.activeRun!.history)[0];
    expect(a.band).toBe(b.band);
    for (const id of Object.keys(b.stressDeltas)) expect(a.stressDeltas[id], id).toBeGreaterThanOrEqual(b.stressDeltas[id]);
    expect(Object.keys(b.stressDeltas).some(id => a.stressDeltas[id] > b.stressDeltas[id])).toBe(true);
    expect(a.explanation.join(' ')).toMatch(/Cameras on the scene \(The crowd with phones at 65\) added 26% to everyone's strain/);
    expect(b.explanation.join(' ')).not.toContain('Cameras');
  });

  it('adds no strain before the first cue is heard', () => {
    const quiet = withDraftScenario(hosted([fill({ start: 5, ratePerMin: 0.1 })]), id => decide(startGateRun(id, 719)));
    const without = withDraftScenario(hosted([]), id => decide(startGateRun(id, 719)));
    expect(decisionsOf(quiet.activeRun!.history)[0].stressDeltas).toEqual(decisionsOf(without.activeRun!.history)[0].stressDeltas);
  });

  it('feeds call pressure each minute, and keeps the peak', () => {
    const withGauge = withDraftScenario(hosted([loud]), id => decide(startGateRun(id, 719))).activeRun!;
    const without = withDraftScenario(hosted([]), id => decide(startGateRun(id, 719))).activeRun!;
    expect(withGauge.pressure).toBeGreaterThan(without.pressure);
    expect(withGauge.fillPeak).toBeGreaterThanOrEqual(65);
    expect(without.fillPeak).toBeUndefined();
  });

  it('a stall fills it faster, through the same minutes', () => {
    const fast = withDraftScenario(hosted([fill({ start: 0 })]), id => decide(startGateRun(id, 719), 4)).activeRun!;
    const slow = withDraftScenario(hosted([fill({ start: 0 })]), id => decide(startGateRun(id, 719))).activeRun!;
    expect(fast.clocks!.crowd.value).toBeGreaterThan(slow.clocks!.crowd.value);
  });

  it('caps a stall at the next cue when nothing else is open', () => {
    withDraftScenario(hosted([fill({ start: 10, ratePerMin: 5 })]), id => {
      const state = startGateRun(id, 719), scenario = getScenario(id)!;
      expect(ditherCap(scenario, state.activeRun!)).toBe(Math.floor((30 - 10) / 5 * 10) / 10);
    });
  });

  it('replays the same: the trace ends where the commit did, and the save reloads', () => {
    withDraftScenario(hosted([loud]), id => {
      const after = decide(startGateRun(id, 719), 3), scenario = getScenario(id)!, run = after.activeRun!;
      expect(traceRun(scenario, run).end.clock).toBe(run.clock);
      expect([...traceRun(scenario, run).end.flags].sort()).toEqual([...run.flags].sort());
      const copy = structuredClone(after);
      copy.incidents = [];
      delete copy.activeRun!.sourceIncident;
      const back = deserialize(serialize(copy, NOW))!;
      expect(back).not.toBeNull();
      expect(back.activeRun!.fillPeak).toBe(run.fillPeak);
      const bad = structuredClone(copy);
      bad.activeRun!.fillPeak = 101;
      expect(deserialize(serialize(bad, NOW))).toBeNull();
    });
  });
});

describe('the audience at the debrief', () => {
  const inputs = (over: Partial<ScoreInputs> = {}): ScoreInputs => ({ people: [], force: [], entries: 0, commitments: [], minutes: 20, objective: 60, ranOut: false, ...over });
  const harmed: ScoreInputs['people'] = [{ id: 'a', label: 'Ana', group: 'held', state: 'killed' }, { id: 'b', label: 'Bo', group: 'held', state: 'killed' }];

  it('multiplies the trust result either way, keeps its sign, and shows it as a line', () => {
    const well = scoreFrom(inputs(), 10), welled = scoreFrom(inputs({ audience: 80 }), 10);
    const badly = scoreFrom(inputs({ people: harmed, objective: 10 }), 10), badlied = scoreFrom(inputs({ people: harmed, objective: 10, audience: 80 }), 10);
    expect(well.trust).toBeGreaterThan(0);
    expect(welled.trust).toBe(Math.round(well.trust * audienceFactor(80)));
    expect(welled.trust).toBeGreaterThan(well.trust);
    expect(badly.trust).toBeLessThan(0);
    expect(badlied.trust).toBe(Math.round(badly.trust * audienceFactor(80)));
    expect(badlied.trust).toBeLessThan(badly.trust);
    for (const score of [welled, badlied]) {
      expect(score.lines.find(line => line.key === 'audience')?.text).toMatch(/^Cameras on the scene made the result count for 40% more\.$/);
      expect(Math.round(score.lines.reduce((sum, line) => sum + line.trust, 0))).toBe(score.trust);
    }
    expect(well.lines.some(line => line.key === 'audience')).toBe(false);
    expect(scoreFrom(inputs({ audience: 0 }), 10)).toEqual(well);
  });
});

describe('what a full gauge and a cue can do', () => {
  it('a gauge reaching 100 does what onFull says, once, and a drain never reads onFull', () => {
    const def = fill({ onFull: { mark: 'went_viral' } });
    const scenario = { clocks: [def] } as ScenarioDefinition;
    const run = { flags: [] as string[] };
    expect(clockOutEffects(scenario, { crowd: { value: 90, cued: 3 } }, { crowd: { value: 100, cued: 3 } }, run, []).map(effect => effect.setFlags)).toEqual([['mark:went_viral']]);
    expect(clockOutEffects(scenario, { crowd: { value: 40, cued: 1 } }, { crowd: { value: 90, cued: 3 } }, run, [])).toEqual([]);
    expect(clockOutEffects({ clocks: [drain({ onFull: { mark: 'nope' } })] } as ScenarioDefinition, { tank: { value: 5, cued: 2 } }, { tank: { value: 0, cued: 2 } }, run, [])).toEqual([]);
  });

  it('a cue moves a subject by a meter event, and `watched` winds them up', () => {
    const base = compileFixtureCall(GROUP_TEMPLATE, 0);
    const person = base.incidentPeople?.find(entry => entry.meters);
    expect(person, 'the fixture has a subject with meters').toBeDefined();
    const def = fill({ start: 20, ratePerMin: 10, cues: [{ at: 30, text: 'Phones come up.', moves: [{ personId: person!.id, event: 'watched' }] }] });
    const scenario = { ...base, id: `${base.id}-watched`, clocks: [def] };
    withDraftScenario(scenario, id => {
      const start = startGateRun(id, 719);
      const before = start.activeRun!.meters![person!.id];
      const after = decide(start).activeRun!;
      expect(after.clocks!.crowd.cued).toBe(1);
      expect(after.meters![person!.id].moved.watched, 'the cue moved them').toBeDefined();
      expect(after.meters![person!.id].agitation).toBeGreaterThan(before.agitation);
    });
  });
});

describe('the audience shift on real calls (recorded for tuning)', () => {
  it('rescoring played calls at a peak gauge moves trust by a bounded, signed share', () => {
    const tree = CALL_TREES.hostage_crisis!;
    const plays = drawCalls(tree, 2, 10).map(({ scenarioId, seed }) => playToEnd(scenarioId, 'best_odds', seed)).filter(state => state.activeRun?.endingId);
    expect(plays.length).toBeGreaterThan(5);
    const trustAt = (peak: number) => plays.map(state => {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      return scoreCall(scenario, { ...run, ...(peak ? { fillPeak: peak } : {}) }, { officers: state.officers, steps: traceRun(scenario, run).steps }).trust;
    });
    const base = trustAt(0);
    const rows = [0, 30, 60, 100].map(peak => {
      const trust = trustAt(peak);
      return { peak, meanTrust: Math.round(trust.reduce((a, b) => a + b, 0) / trust.length * 100) / 100, meanShift: Math.round(trust.reduce((a, b, i) => a + b - base[i], 0) / trust.length * 100) / 100,
        grew: trust.filter((t, i) => Math.abs(t) > Math.abs(base[i])).length, signsKept: trust.every((t, i) => Math.sign(t) === Math.sign(base[i]) || t === 0 || base[i] === 0) };
    });
    console.table(rows);
    expect(rows[0].meanShift).toBe(0);
    for (const row of rows) expect(row.signsKept).toBe(true);
    // At the largest peak, no call's trust moves by more than the gain allows.
    const gain = CLOCK_RULES_V1.fill.audienceGain;
    trustAt(100).forEach((t, i) => expect(Math.abs(t - base[i])).toBeLessThanOrEqual(Math.ceil(Math.abs(base[i]) * gain) + 1));
  });
});

describe('gaps the review found', () => {
  const scenarioWith = (def: ClockDef) => ({ pressure: { start: 0, perMinute: 0, threshold: 50, civilianPerMinute: 1 }, clocks: [def] }) as unknown as ScenarioDefinition;

  it('a gauge’s pressure counts toward civilian loss across the threshold', () => {
    const def = fill({ start: 80, ratePerMin: 0, cues: [{ at: 50, text: 'Phones.' }] });
    const run = { clock: 0, pressure: 49, civilianSafety: 100, clocks: { crowd: { value: 80, cued: 1 } }, flags: [] as string[] };
    const timed = advanceTime(run, scenarioWith(def), 10);
    expect(run.pressure).toBe(53);
    // 0.4 a minute from 49 reaches 50 after 2.5 minutes: 7.5 minutes over.
    expect(timed.civilianLoss).toBe(7.5);
    expect(timed.crossed).toBe(true);
  });

  it('a gauge nobody has been warned of changes neither the peak nor the debrief', () => {
    const def = fill({ start: 80, ratePerMin: 0, cues: [{ at: 90, text: 'Phones.' }] });
    const run: Parameters<typeof advanceTime>[0] = { clock: 0, pressure: 0, civilianSafety: 100, clocks: { crowd: { value: 80, cued: 0 } }, flags: [] };
    advanceTime(run, scenarioWith(def), 5);
    expect(run.fillPeak).toBeUndefined();
    expect(run.pressure).toBe(0);
  });

  it('a cue’s meter moves apply wherever time passes, once', () => {
    const scenario = { facts: [], incidentPeople: [{ id: 'p', volatility: 'shifting' }] } as unknown as ScenarioDefinition;
    const run = { knowledge: {}, flags: [] as string[], pressure: 0, objective: 0, civilianSafety: 100, meters: { p: { agitation: 20, rapport: 20, moved: {} as Record<string, { agitation: number; rapport: number }> } } };
    applyClockCues(run, scenario, [{ text: 'Phones.', moves: [{ personId: 'p', event: 'watched' }] }]);
    expect(run.meters.p.moved.watched).toBeDefined();
    expect(run.meters.p.agitation).toBe(26);
  });

  it('a fill whose first cue sits just under 100 still gets there', () => {
    const def = fill({ start: 50, ratePerMin: 100, cues: [{ at: 99.5, text: 'Everyone is filming.' }] });
    const first = stepClock(def, initialClocks({ clocks: [def] } as ScenarioDefinition)!.crowd, 2, []);
    expect(first).toEqual({ value: 99.5, cued: 1 });
    expect(stepClock(def, first, 2, []).value).toBe(100);
  });
});

describe('the save check replays a cue’s meter moves', () => {
  it('a later consequence gated on the agitation a cue raised still reloads', () => {
    const base = compileFixtureCall(GROUP_TEMPLATE, 0);
    const person = base.incidentPeople!.find(entry => entry.meters)!;
    const def = fill({ start: 20, ratePerMin: 10, cues: [{ at: 30, text: 'Phones come up.', moves: [{ personId: person.id, event: 'watched' }] }] });
    // Every choice after the first: an officer is hurt only where the subject is already wound up
    // past what the call starts at, which only the cue's move reaches.
    const need = initialMeters(base)![person.id].agitation + 1;
    const gated: OutcomeEffect = { text: 'A shot goes wide.', meters: [{ personId: person.id, agitationAtLeast: need, is: true }], officerHarm: { severity: 'wounded', label: 'Wounded on the call at {place}' } };
    const stages = Object.fromEntries(Object.entries(base.stages).map(([stage, value]) => [stage, { ...value, actions: value.actions.map(action => ({ ...action,
      outcomes: Object.fromEntries(Object.entries(action.outcomes).map(([band, list]) => [band, [...list, gated]])) as typeof action.outcomes })) }])) as ScenarioDefinition['stages'];
    const scenario = { ...base, id: `${base.id}-gated`, clocks: [def], stages };
    withDraftScenario(scenario, id => {
      const second = decide(decide(startGateRun(id, 719)));
      const run = second.activeRun!;
      expect(run.meters![person.id].moved.watched).toBeDefined();
      expect(validExternalSupportState(run, getScenario(id)!), 'the replay agrees').toBe(true);
    });
  });
});
