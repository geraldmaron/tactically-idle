// A gauge that fills reaches its end by filling: the Lab's dependency graph and its xray harm
// preview read its `onFull` as they read a drain's `onOut`. Fixtures the tooling tests own.
import { describe, expect, it } from 'vitest';
import type { Clock } from '../../content/incidents/types';
import { clockOutHarm } from '../../dev/lab/model/xray';
import type { ClockDef, OutcomeEffect, ScenarioDefinition } from '../../sim/scenario-types';
import type { OperationRun } from '../../sim/types';
import { CLOCK_FIXTURE_CLOCK, CLOCK_FIXTURE_IDS, clockFixtureTemplate } from './gates/clock-fixture';
import { dependencyIndex, lintTree, requirementTree, templateClockRoutes } from './trees-v13/dependencies';

const { outMark, node, owner } = CLOCK_FIXTURE_IDS;
const { onOut, ...drain } = CLOCK_FIXTURE_CLOCK;
const FILL: Clock = { ...drain, direction: 'fill', start: 0, ratePerMin: 5, cues: [{ at: 25, text: 'The courier keeps looking at the door.', mark: CLOCK_FIXTURE_IDS.cueMark }], onFull: onOut };
const fill = clockFixtureTemplate(FILL), drained = clockFixtureTemplate();

describe('the dependency graph reads a gauge’s onFull', () => {
  it('routes the call to its target, and the requirement is the gauge full', () => {
    expect(templateClockRoutes(fill)).toEqual(templateClockRoutes(drained));
    expect(templateClockRoutes(fill)).toEqual([{ clock: CLOCK_FIXTURE_IDS.clock, next: { node } }]);
    expect(requirementTree(fill.tree, { node }, templateClockRoutes(fill))).toEqual({ any: [{ all: [{ leaf: { kind: 'clock', clock: CLOCK_FIXTURE_IDS.clock, when: 'out', is: true } }] }] });
    expect(lintTree(fill).filter(finding => finding.code === 'unreachable_node')).toEqual([]);
  });

  it('lists what filling writes: its mark and the owner’s harm, under onFull fields', () => {
    const keys = dependencyIndex(fill).keys;
    expect(keys.get(`mark:${outMark}`)?.writers.map(site => site.field)).toContain('clock.onFull.mark');
    expect(keys.get(`harm:${owner}`)?.writers.map(site => site.field)).toContain('clock.onFull.harm');
    expect(dependencyIndex(drained).keys.get(`mark:${outMark}`)?.writers.map(site => site.field)).toContain('clock.onOut.mark');
    expect(lintTree(fill).some(finding => finding.code === 'clock_writer' && finding.message.includes('fills'))).toBe(true);
  });
});

describe('the xray harm preview reads a gauge’s onFull', () => {
  const def: ClockDef = { id: 'crowd', label: 'The crowd', kind: 'crowd', direction: 'fill', owner: 'p', start: 0, ratePerMin: 10, rateKnown: true,
    cues: [{ at: 25, text: 'Phones.' }], onFull: { harm: 'serious' } };
  const scenario = { clocks: [def], story: { bindings: { people: { p: { id: 'p', label: 'Pat Doe' } } } } } as unknown as ScenarioDefinition;
  const run = (value: number) => ({ clocks: { crowd: { value, cued: 1 } }, flags: [] as string[] }) as unknown as OperationRun;
  const none: readonly OutcomeEffect[] = [];

  it('says the owner is harmed when the gauge fills inside the decision, and not before or if it stays short', () => {
    expect(clockOutHarm(scenario, run(50), [6, 6], none, []).sure.join()).toContain('badly hurt');
    expect(clockOutHarm(scenario, run(50), [2, 2], none, [])).toEqual({ sure: [], maybe: [] });
    expect(clockOutHarm(scenario, run(100), [6, 6], none, [])).toEqual({ sure: [], maybe: [] });
    expect(clockOutHarm(scenario, run(50), [2, 6], none, []).maybe.join()).toContain('badly hurt');
  });

  it('a drain still reads onOut at zero', () => {
    const drains = { ...scenario, clocks: [{ ...def, direction: undefined, start: 50, onFull: undefined, onOut: { harm: 'serious' as const } }] } as unknown as ScenarioDefinition;
    expect(clockOutHarm(drains, run(30), [6, 6], none, []).sure.join()).toContain('badly hurt');
  });
});
