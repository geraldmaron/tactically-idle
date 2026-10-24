// A cue from a clock the outcome stops reads before the outcome's own words: the stream was
// reposted while the team talked, then the feed went down (sim/operation.ts, the result texts).
import { describe, expect, it } from 'vitest';
import { generateIncident } from '../gen/incident';
import { specForSituation } from '../content/scenario-recipes';
import { applyMove, startGateRun } from '../gen/incident/gates/engine-driver';
import { choiceActionId } from '../gen/incident/trees-v13/compile';
import { getScenario } from './scenario-registry';
import { openThreat, stalledRun, stallFeed } from './clocks';
import { sourceOdds } from './pressure-sources';

describe('cue order in a decision result', () => {
  it('puts the stream\'s last cue before the cut that ends it', () => {
    const s = generateIncident(specForSituation('hostage_crisis', 'market_row', { variant: 0, characteristic: 'ordinary' }));
    let state = applyMove(startGateRun(s.id, 719), { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'going_live', 'on_stream'), band: 'favorable' })!;
    const stream = getScenario(s.id)!.clocks!.find(def => def.id === 'stream')!;
    const last = stream.cues.at(-1)!;
    // Just short of the last cue, with every earlier one heard.
    state.activeRun!.clocks = { ...state.activeRun!.clocks, stream: { ...state.activeRun!.clocks!.stream, value: last.at - 0.5, cued: stream.cues.length - 1 } };
    state = applyMove(state, { kind: 'decide', actionId: choiceActionId('hostage_crisis', 'on_air', 'cut_feed'), band: 'favorable' })!;
    const said = state.activeRun!.history.at(-1)!.committed!.consequences;
    const cue = said.indexOf(last.text), cut = said.findIndex(line => /^The stream (drops|cuts out)/.test(line));
    expect(cue, said.join('\n')).toBeGreaterThanOrEqual(0);
    expect(cut).toBeGreaterThan(cue);
  });

  it('hears a cue a bump carries the gauge past while the decision is open', () => {
    const s = generateIncident(specForSituation('hostage_crisis', 'market_row', { variant: 0, characteristic: 'ordinary' }));
    const scenario = getScenario(s.id)!;
    const run = startGateRun(s.id, 719).activeRun!;
    const stream = scenario.clocks!.find(def => def.id === 'stream')!;
    // Time alone wouldn't reach the first cue before the threat; the beats' and landing's bumps do. The
    // gauge starts just short of what time alone would carry it to the cue, whatever the call opens at.
    const minutes = openThreat(scenario, run)!.minutes;
    run.clocks = { ...run.clocks, stream: { ...run.clocks!.stream, value: stream.cues[0].at - stream.ratePerMin * minutes - 1 } };
    expect(run.clocks!.stream.value + stream.ratePerMin * minutes).toBeLessThan(stream.cues[0].at);
    const stalled = stalledRun(scenario, run, minutes);
    expect(stalled.clocks!.stream.value).toBeGreaterThanOrEqual(stream.cues[0].at);
    expect(stalled.clocks!.stream.cued).toBeGreaterThan(0);
    expect(sourceOdds(scenario, stalled, 'contact').map(line => line.clockId)).toContain('stream');
    expect(stallFeed(scenario, run, minutes).some(line => line.id === 'cue:stream:0')).toBe(true);
  });
});
