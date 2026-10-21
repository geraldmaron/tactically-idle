// The population Flow and Outcomes count (spec 5 rule 11): defaults per scope, the words every
// simulated number carries, and the reach job each population plays.
import { describe, expect, it } from 'vitest';
import { applyTuningPatch } from '../../../../sim/tuning';
import { RUN_DEFAULTS } from '../../jobs/budgets';
import { openSession, stepSession } from '../../model/session';
import type { Session } from '../../model/session';
import type { LabUrl } from '../../types';
import { parseLabUrl } from '../../url';
import { probText } from '../../model/label';
import { wilson } from '../../model/stats';
import { countedText, populationKey, populationOf, populationText, reachPlan, TYPE_CALLS, whoOf } from './reach';

const REF = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
const urlOf = (query: string): LabUrl => parseLabUrl(`?${query}`).url;
function open(query: string): Session {
  const opened = openSession(urlOf(query), null);
  if (!('frames' in opened)) throw new Error(opened.message);
  return opened;
}

describe('populationOf', () => {
  it('defaults to this call with the measured run count, and to 60 calls for this type', () => {
    expect(populationOf(urlOf(REF))).toEqual({ scope: 'call', style: 'random', runs: RUN_DEFAULTS.call });
    expect(populationOf(urlOf(`${REF}&scope=type`))).toEqual({ scope: 'type', style: 'random', runs: TYPE_CALLS });
    expect(populationOf(urlOf(`${REF}&scope=call&runs=400&style=best_odds`))).toEqual({ scope: 'call', style: 'best_odds', runs: 400 });
  });
  it('falls back when the run count does not fit the scope', () => {
    expect(populationOf(urlOf(`${REF}&scope=type&runs=5000`)).runs).toBe(TYPE_CALLS);
    expect(populationOf(urlOf(`${REF}&scope=call&runs=10`)).runs).toBe(RUN_DEFAULTS.call);
  });
});

describe('populationText', () => {
  it('says scope, style and count, and names the squad in the header', () => {
    const t = populationText({ scope: 'call', style: 'random', runs: 400 }, 'squad A (719)', 2);
    expect(t.plain).toBe('this call · random style · 400 runs');
    expect(t.header).toBe('this call · random style · 400 runs · squad A (719)');
    expect(t.prov).toEqual({ face: 'sim', scope: 'this call', style: 'random', runs: 400 });
    const type = populationText({ scope: 'type', style: 'patient', runs: 60 }, 'day-one squads vary per call', 2);
    expect(type.plain).toBe('this type · patient · 60 calls');
    expect(type.header).toBe('this type · patient · 60 calls · tier 2 · day-one squads vary per call');
  });
});

describe('reachPlan and whoOf', () => {
  const s = open(REF);
  it('this call: a fresh start of this exact call for the reference squad', () => {
    const plan = reachPlan(urlOf(REF), s);
    if (!('job' in plan)) throw new Error(plan.reason);
    expect(plan.contentKey).toBe(s.contentKey);
    expect(plan.job).toEqual({ kind: 'reach-call', start: { kind: 'fresh', scenarioId: s.scenario.id, kit: 'day1', squad: { seed: 719, certs: [] } }, style: 'random', runs: [0, RUN_DEFAULTS.call] });
    expect(whoOf(s, 'call')).toBe('squad A (719)');
    expect(whoOf(s, 'type')).toBe('day-one squads vary per call');
  });
  it('this type: the drawn population at the call’s tier, keyed by the type’s content', () => {
    const plan = reachPlan(urlOf(`${REF}&scope=type&style=fast&runs=200`), s);
    if (!('job' in plan)) throw new Error(plan.reason);
    expect(plan.job).toEqual({ kind: 'reach-type', type: 'hostage_crisis', tier: 2, style: 'fast', calls: 200 });
  });
  it('from this step: the same start with the path replayed; nothing to play once the call has ended', () => {
    const view = s.frames[0].views.find(v => v.eligible)!;
    const stepped = stepSession(s, { kind: 'decide', actionId: view.id, band: 'favorable' });
    if ('refused' in stepped) throw new Error(stepped.refused);
    const plan = reachPlan(urlOf(`${REF}&scope=step`), stepped);
    if (!('job' in plan) || plan.job.kind !== 'reach-call') throw new Error('expected a this-call job');
    expect(plan.job.start).toMatchObject({ kind: 'fresh', path: `${view.id}~favorable` });
    const ended = { ...stepped, frames: [...stepped.frames.slice(0, -1), { ...stepped.frames[stepped.frames.length - 1], state: { ...stepped.frames[1].state, activeRun: { ...stepped.frames[1].state.activeRun!, status: 'debrief' as const } } }] };
    expect(reachPlan(urlOf(`${REF}&scope=step`), ended)).toHaveProperty('reason');
  });
  it('names lab grants with the squad', () => {
    const granted = open(`type=hostage_crisis&certs=vehicle_operations`);
    expect(whoOf(granted, 'call')).toBe('squad A (719) + vehicle operations (lab grant)');
  });
});

describe('populationKey', () => {
  // Review finding baseline-pairs-across-calls: a baseline pairs with now run by run only when both
  // play the same starts with the same dice, so the key names the call, squad, kit, handoff, replayed
  // game moves and step, not just "this call · random style · 400 runs".
  const key = (query: string, s: Session = open(query)) => populationKey(urlOf(query), s, populationOf(urlOf(query)));
  const base = `${REF}&scope=call&runs=400`;
  it('differs when the call, squad, grants, kit, step, game moves, style or count differ', () => {
    const at = key(base);
    const others = [
      base.replace('variant=1', 'variant=3'), `${base}&call=13`, `${base}&squad=4242`, `${base}&certs=vehicle_operations`, `${base}&kit=full`,
      base.replace('runs=400', 'runs=1000'), `${base}&style=fast`, `${base}&hist=t13_hostage_crisis_offer_hear_him~mixed`,
    ];
    for (const query of others) expect(key(query), query).not.toBe(at);
    expect(key(base.replace('family=market_row&seed=7&tier=2&variant=1', 'id=gen:hostage_crisis:market_row:7:2:2:13')))
      .not.toBe(key(base.replace('family=market_row&seed=7&tier=2&variant=1', 'id=gen:hostage_crisis:market_row:7:13:2:13')));
    // From this step: the step itself is part of the population.
    const s = open(base);
    const [a, b] = s.frames[0].views.filter(v => v.eligible);
    const stepped = (id: string) => { const next = stepSession(s, { kind: 'decide', actionId: id, band: 'favorable' }); if ('refused' in next) throw new Error(next.refused); return next; };
    const step = `${base.replace('scope=call', 'scope=step')}`;
    expect(key(step, stepped(a.id))).not.toBe(key(step, stepped(b.id)));
    expect(key(step, stepped(a.id))).not.toBe(at);
  });
  it('is the same for the same population under another tuning patch or content, and ignores the view', () => {
    const at = key(base);
    expect(key(`${base}&tab=outcomes&sel=node:talking&xray=0`)).toBe(at);
    expect(applyTuningPatch({ RESOLUTION_TUNING: { favorableAt: 20 } })).toEqual([]);
    try { expect(key(base)).toBe(at); } finally { applyTuningPatch({}); }
    // This type: type, tier, style and calls only; the call in focus doesn't matter.
    const type = (query: string) => key(`${query}&scope=type`);
    expect(type(REF)).toBe(type(REF.replace('variant=1', 'variant=3')));
    expect(type(REF)).not.toBe(type(`${REF}&style=fast`));
    expect(type(REF)).not.toBe(type(REF.replace('tier=2', 'tier=3')));
  });
});

describe('countedText', () => {
  // Review finding partial-tally-labelled-with-requested-runs: a share counted over a partial tally
  // (runs streaming, or Stop) carries the runs counted, not the runs asked for.
  const asked = populationText({ scope: 'call', style: 'random', runs: 400 }, 'squad A (719)', 2);
  it('labels a stopped tally with the runs it holds, counting below the threshold', () => {
    const stopped = countedText(asked, { runs: 20 });
    expect(stopped.prov.runs).toBe(20);
    expect(stopped.plain).toBe(asked.plain);
    expect(stopped.header).toBe(asked.header);
    expect(probText(3 / 20, stopped.prov, wilson(3, 20), 3).plain).toBe('3 of 20 runs · this call · random style · few runs');
    expect(probText(3 / 20, asked.prov, wilson(3, 20), 3).plain).toMatch(/400 runs/);
    const partial = countedText(asked, { runs: 150 });
    expect(probText(30 / 150, partial.prov, wilson(30, 150), 30).pill).toContain('150 runs');
  });
  it('leaves a full tally, or no tally, as asked', () => {
    expect(countedText(asked, { runs: 400 })).toBe(asked);
    expect(countedText(asked, null)).toBe(asked);
  });
});
