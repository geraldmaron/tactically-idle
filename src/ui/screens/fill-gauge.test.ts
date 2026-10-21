// Gauges that fill on the live screen (docs/call-pressure.md, plan "Rising pressures", step 3): the
// bar, its cue ticks, its state and effect line, which choices stop or slow it, and that the
// engine's debrief and commit lines for it render. No authored call has one yet, so these run on a
// fixture scenario.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { fillViews } from '../../sim/clocks';
import { stableFlag } from '../../sim/conditions';
import type { ClockDef, ScenarioDefinition } from '../../sim/scenario-types';
import { NOW } from '../../sim/test-fixtures';
import type { ActionView } from '../../sim/types';
import { liveDecisions } from './live-model';
import { DecisionList } from './DecisionList';
import { fillEffectLine, fillMinutesToBite, gaugeReach, gaugeReachTag, leadingPressure, pressureUrgency } from './fill-gauge';
import { FillGauge } from './LiveView';
import { DebriefScore } from '../components/DebriefResults';

const crowd = (over: Partial<ClockDef> = {}): ClockDef => ({
  id: 'crowd', label: 'The crowd with phones', kind: 'crowd', direction: 'fill', start: 10, ratePerMin: 5, rateKnown: true,
  rateFlags: [{ flag: 'perimeter_back', ratePerMin: 1 }],
  cues: [{ at: 30, text: 'Phones come out.' }, { at: 60, text: 'Someone is streaming.' }], ...over,
});
const view = (state: { value: number; cued: number }, flags: string[] = [], def = crowd()) =>
  fillViews({ clocks: [def] } as ScenarioDefinition, { clocks: { crowd: state }, flags, fillPeak: state.value })[0];
const html = (v: ReturnType<typeof view>) => renderToStaticMarkup(createElement(FillGauge, { view: v }));

describe('the fill gauge', () => {
  it('shows the label, a bar at its value and a tick at each cue, with the heard ones marked', () => {
    const out = html(view({ value: 40, cued: 1 }));
    expect(out).toContain('The crowd with phones');
    expect(out).toContain('width:40%');
    expect(out.match(/class="fill-gauge-tick/g)).toHaveLength(2);
    expect(out.match(/fill-gauge-heard/g)).toHaveLength(1);
    expect(out).toContain('left:30%');
    expect(out).toContain('left:60%');
    expect(out).toContain('aria-valuenow="40"');
    expect(out).toContain('1 of 2 warnings heard');
  });

  it('names no effect before the first cue, and names every effect after it in plain words', () => {
    expect(html(view({ value: 20, cued: 0 }))).not.toContain('fill-gauge-effect');
    const heard = view({ value: 50, cued: 1 });
    const out = html(heard);
    expect(out).toContain('fill-gauge-effect');
    expect(fillEffectLine(heard.effect!)).toBe(`Officers strained +${heard.effect!.strainPercent}% · trust swings ${heard.effect!.trustPercent}% bigger · pressure +${heard.effect!.pressurePerMinute} a minute`);
    expect(out).toContain(`Officers strained +${heard.effect!.strainPercent}%`);
    expect(out).toContain(`trust swings ${heard.effect!.trustPercent}% bigger`);
  });

  it('says Stopped, Slowed or Full, and nothing when it runs at its authored rate', () => {
    expect(html(view({ value: 40, cued: 1 }))).not.toMatch(/fill-gauge-state/);
    expect(html(view({ value: 40, cued: 1 }, [stableFlag('crowd')]))).toContain('>Stopped<');
    expect(html(view({ value: 40, cued: 1 }, ['perimeter_back']))).toContain('>Slowed<');
    expect(html(view({ value: 100, cued: 2 }))).toContain('>Full<');
  });
});

describe('choices that stop or slow a gauge', () => {
  const scenario = {
    clocks: [crowd()],
    stages: { assess: { actions: [
      { id: 'clear', outcomes: { favorable: [{ setFlags: [stableFlag('crowd')] }], mixed: [{ setFlags: ['perimeter_back'] }], adverse: [] } },
      { id: 'push', outcomes: { favorable: [{ setFlags: ['perimeter_back'] }], mixed: [{ setFlags: ['perimeter_back'] }], adverse: [{ setFlags: ['perimeter_back'] }] } },
      { id: 'talk', outcomes: { favorable: [], mixed: [], adverse: [] } },
    ] }, adapt: { actions: [] }, resolve: { actions: [] } },
  } as unknown as ScenarioDefinition;

  it('finds the results that stop it and the ones that only slow it', () => {
    expect(gaugeReach(scenario, [], 'clear')).toEqual([
      { label: 'The crowd with phones', effect: 'stops', bands: ['favorable'] },
      { label: 'The crowd with phones', effect: 'slows', bands: ['mixed'] },
    ]);
    expect(gaugeReach(scenario, [], 'push')).toEqual([{ label: 'The crowd with phones', effect: 'slows', bands: ['favorable', 'mixed', 'adverse'] }]);
    expect(gaugeReach(scenario, [], 'talk')).toEqual([]);
    expect(gaugeReach(scenario, [], 'missing')).toEqual([]);
  });

  it('does not call it a slow when the gauge already runs that slow', () => {
    expect(gaugeReach(scenario, ['perimeter_back'], 'push')).toEqual([]);
  });

  it('words the tag for all results, or only some', () => {
    expect(gaugeReachTag({ label: 'The crowd', effect: 'slows', bands: ['favorable', 'mixed', 'adverse'] })).toBe('Slows: The crowd');
    expect(gaugeReachTag({ label: 'The crowd', effect: 'stops', bands: ['favorable'] })).toBe('Can stop: The crowd');
  });

  it('shows the tag on the choice card in the live list', () => {
    const run = startGateRun('gen:hostage_crisis:market_row:3035903061:1492309763:1:13');
    const action = liveDecisions(run, NOW, 'A').find((a) => a.eligible)! as ActionView;
    const out = renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', actions: [action], selectedId: null, expanded: false, officers: run.officers, reach: { [action.id]: [{ label: 'The crowd with phones', effect: 'stops', bands: ['favorable'] }] }, onSelect: () => {}, onExpand: () => {} }));
    expect(out).toContain('Can stop: The crowd with phones');
    expect(renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', actions: [action], selectedId: null, expanded: false, officers: run.officers, onSelect: () => {}, onExpand: () => {} }))).not.toContain('callbtn-gauge');
  });
});

describe('what the engine says about a gauge afterwards', () => {
  it('the debrief lists the audience line among its score lines', () => {
    const lines = [
      { key: 'result', text: 'The call ended with everyone out.', trust: 4, strain: 0 },
      { key: 'audience', text: 'Cameras on the scene made the result count for 40% more.', trust: 2, strain: 0 },
    ];
    const out = renderToStaticMarkup(createElement(DebriefScore, { debrief: { scoreLines: lines, trustDelta: 6, strainDelta: 0, disposition: 'resolved' } as never }));
    expect(out).toContain('Cameras on the scene made the result count for 40% more.');
  });
});

describe('the strip shows one pressure', () => {
  const threat = { label: 'The table goes against the door', minutes: 8 };
  it('picks whichever bites soonest in game minutes, the threat on a tie', () => {
    // 10 to the first cue at 5 a minute: 4 minutes.
    expect(fillMinutesToBite(view({ value: 10, cued: 0 }))).toBe(4);
    expect(leadingPressure(threat, 0, [view({ value: 10, cued: 0 })])).toMatchObject({ kind: 'fill', left: 4 });
    expect(leadingPressure(threat, 5, [view({ value: 10, cued: 0 })])).toMatchObject({ kind: 'threat', left: 3 });
    expect(leadingPressure({ ...threat, minutes: 4 }, 0, [view({ value: 10, cued: 0 })])).toMatchObject({ kind: 'threat' });
  });
  it('never puts a stopped gauge ahead of a threat, and shows it alone when nothing else is open', () => {
    const stopped = view({ value: 50, cued: 1 }, [stableFlag('crowd')]);
    expect(leadingPressure(threat, 7.5, [stopped])).toMatchObject({ kind: 'threat' });
    expect(leadingPressure(null, 0, [stopped])).toMatchObject({ kind: 'fill' });
    expect(leadingPressure(null, 0, [])).toBeNull();
  });
  it('reads louder as the window closes', () => {
    const at = (left: number) => pressureUrgency({ kind: 'threat', label: threat.label, minutes: 8, left });
    expect([at(8), at(4), at(2), at(0)]).toEqual(['calm', 'warn', 'critical', 'critical']);
    expect(pressureUrgency({ kind: 'fill', view: view({ value: 80, cued: 2 }), left: 4 })).toBe('critical');
  });
});
