// The cross-system journeys from journeys.ts, played headless through the real dispatcher.
import { decisionsOf } from '../sim/types';
import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { ITEMS } from '../content/items';
import { TACTICAL_FRAMEWORKS } from '../content/unlocks';
import { availableMoves, applyMove, startGateRun } from '../gen/incident/gates/engine-driver';
import { drawCalls, playToEnd } from '../gen/incident/trees-v13/balance';
import { parseIncidentId } from '../gen/incident';
import { createInitialState } from '../sim/department';
import { actionViews } from '../sim/operation-selectors';
import { deserialize, serialize } from '../sim/save';
import { dispatch } from '../sim/game';
import { getScenario } from '../sim/scenario-registry';
import { buildLocation } from '../sim/location';
import { NOW, startWithKit } from '../sim/test-fixtures';
import type { Command } from '../sim/types';
import type { IncidentType } from '../sim/scenario-types';
import type { GameState } from '../sim/types';
import { JOURNEYS } from './journeys';
import { computeDebrief } from '../sim/operation';
import { ROLE_MAIN_RATING, rankOf } from '../sim/ranks';
import { RANK_IDS, rankXp } from '../content/ranks';
import { serviceForLevel } from '../sim/department-level';

const trees = Object.values(CALL_TREES).map(tree => tree!);
// Vite leaves the importing file out of its own glob, so this file counts itself.
const TESTS = new Set([...Object.keys(import.meta.glob(['/src/**/*.test.ts', '/src/**/*.test.tsx'])), '/src/architecture/journeys.test.ts']);
const send = (state: GameState, cmd: Command) => dispatch(state, cmd, { now: NOW });

describe('journeys', () => {
  it('names a test file that exists for every journey', () => {
    for (const journey of JOURNEYS) expect(TESTS.has(`/${journey.test}`), `${journey.id}: ${journey.test}`).toBe(true);
  });

  it('answer-a-call: a new department answers a tactical call on a generated building to its debrief', () => {
    const fresh = createInitialState(NOW, 4242);
    expect(fresh.incidents.length, 'a new board has calls').toBeGreaterThan(0);
    for (const card of fresh.incidents) expect(TACTICAL_FRAMEWORKS.has(card.type as IncidentType), `${card.type} is a SWAT call`).toBe(true);
    const card = fresh.incidents[0];
    expect(parseIncidentId(card.id), 'the card names a generated call').not.toBeNull();
    const scenario = getScenario(card.id)!;
    const entry = buildLocation(scenario.locationFamilyId, scenario.locationSeed).location.entries[0];
    const started = startWithKit(fresh, card.id, ['A'], { positions: { A: entry } });
    expect(started.activeRun?.status).toBe('active');
    const ended = playToEnd(card.id, 'random', 4242, { start: started });
    expect(ended.activeRun?.stage, 'the call reached its debrief').toBe('debrief');
    const closed = send(ended, { type: 'closeDebrief' });
    expect(closed.result).toEqual({ ok: true });
    expect(closed.state.activeRun).toBeNull();
    expect(closed.state.debriefs.length).toBe(fresh.debriefs.length + 1);
  });

  it('chance-not-script: on every tree, some opening pick leads to different next decisions by its band', () => {
    for (const tree of trees) {
      const { scenarioId } = drawCalls(tree, 3, 1)[0];
      const start = startGateRun(scenarioId);
      const views = actionViews(start, NOW, 'A');
      const branching = views.filter(view => view.eligible).some(view => {
        const nexts = availableMoves(start, [view]).filter(move => move.actionId === view.id)
          .map(move => applyMove(start, move, [view])).filter((s): s is GameState => !!s)
          .map(s => actionViews(s, NOW, 'A').map(v => v.id).sort().join(','));
        return new Set(nexts).size > 1;
      });
      expect(branching, `${tree.type}: some opening choice's band changes the next decisions offered`).toBe(true);
    }
  });

  it('chance-not-script: natural rolls land favorable as often as the odds the player is shown', () => {
    const ROLLS = 400;
    for (const tree of trees) {
      const { scenarioId } = drawCalls(tree, 3, 1)[0];
      const start = startGateRun(scenarioId);
      const view = actionViews(start, NOW, 'A').find(v => v.eligible && v.likelihood.favorable > 0.15 && v.likelihood.favorable < 0.85)
        ?? actionViews(start, NOW, 'A').find(v => v.eligible)!;
      let favorable = 0;
      for (let k = 0; k < ROLLS; k++) {
        const draft = structuredClone(start);
        draft.activeRun!.rngState = (Math.imul(k + 1, 2654435761) >>> 0) || 1;
        const out = send(draft, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds });
        expect(out.result, `${tree.type}: ${view.id}`).toEqual({ ok: true });
        if (decisionsOf(out.state.activeRun!.history).at(-1)!.band === 'favorable') favorable++;
      }
      // Four standard errors at p = 0.5 and n = 400 is 0.1.
      expect(Math.abs(favorable / ROLLS - view.likelihood.favorable), `${tree.type}: ${view.id} shown ${view.likelihood.favorable.toFixed(3)}, rolled ${(favorable / ROLLS).toFixed(3)}`).toBeLessThan(0.1);
    }
  });

  it('hire-and-equip: hiring and buying spend department money and land on the roster and shelf', () => {
    const fresh = createInitialState(NOW, 4242);
    const candidate = fresh.candidates[0];
    expect(candidate, 'a new department has candidates').toBeDefined();
    const hired = send(fresh, { type: 'hire', candidateId: candidate.id });
    expect(hired.result).toEqual({ ok: true });
    expect(Object.keys(hired.state.officers).length).toBe(Object.keys(fresh.officers).length + 1);
    expect(hired.state.department.funding).toBe(fresh.department.funding - candidate.signingCost);
    const buyable = Object.values(ITEMS).filter(item => item.cost > 0 && item.cost <= hired.state.department.funding);
    const bought = buyable.map(item => ({ item, out: send(hired.state, { type: 'buyItem', itemId: item.id, qty: 1 }) })).find(entry => entry.out.result.ok);
    expect(bought, 'something on the shelf is affordable and buyable').toBeDefined();
    expect(bought!.out.state.department.funding).toBe(hired.state.department.funding - bought!.item.cost);
    expect(Object.keys(bought!.out.state.units).length).toBe(Object.keys(hired.state.units).length + 1);
  });

  it('officer-promotes: closing a call promotes an officer one XP short, raising their main rating and wage', () => {
    const { scenarioId } = drawCalls(trees[0], 3, 1)[0];
    const ended = playToEnd(scenarioId, 'random', 7);
    const preview = computeDebrief(ended, ended.activeRun!)!;
    const earner = preview.officerCondition.find(c => c.xpGained > 0 && rankOf(ended.officers[c.officerId]) !== 'lieutenant')!;
    expect(earner, 'someone on the call earns XP').toBeDefined();
    const o = ended.officers[earner.officerId];
    const next = RANK_IDS[RANK_IDS.indexOf(rankOf(o)) + 1];
    o.xp = rankXp(next) - 1;
    const key = ROLE_MAIN_RATING[o.role];
    const before = { rating: o.ratings[key], wage: o.wage };
    const debrief = computeDebrief(ended, ended.activeRun!)!;
    expect(debrief.officerCondition.find(c => c.officerId === o.id)!.promotions?.map(p => p.rank)).toEqual([next]);
    const closed = send(ended, { type: 'closeDebrief' });
    const after = closed.state.officers[o.id];
    expect(rankOf(after)).toBe(next);
    expect(after.ratings[key]).toBeGreaterThan(before.rating);
    expect(after.wage).toBeGreaterThan(before.wage);
    expect(after.promotions?.at(-1)).toMatchObject({ rank: next });
    expect(closed.state.report!.personnel.some(p => p.event === 'promoted' && p.officerId === o.id)).toBe(true);
  });

  it('milestone-grants: a call that lifts the department to level 2 grants the level 2 developments free', () => {
    const { scenarioId } = drawCalls(trees[0], 3, 1)[0];
    const ended = playToEnd(scenarioId, 'random', 7);
    ended.department.service = serviceForLevel(2) - 1;
    const funding = ended.department.funding;
    const payout = computeDebrief(ended, ended.activeRun!)!.fundingReward;
    const closed = send(ended, { type: 'closeDebrief' });
    expect(closed.state.department.level).toBeGreaterThanOrEqual(2);
    const granted = closed.state.department.grants.map(grant => grant.nodeId);
    expect(granted).toEqual(expect.arrayContaining(['personnel_recruiting', 'field_entry_course', 'wellbeing_peer_support']));
    expect(closed.state.department.funding).toBe(funding + payout);
    expect(closed.state.report!.grants?.length).toBe(granted.length);
  });

  it('debrief-explains: every committed decision in the debrief names its result and why', () => {
    for (const tree of trees) {
      const { scenarioId } = drawCalls(tree, 3, 1)[0];
      const ended = playToEnd(scenarioId, 'random', 7);
      const closed = send(ended, { type: 'closeDebrief' });
      expect(closed.result, tree.type).toEqual({ ok: true });
      const decisions = closed.state.debriefs[0]?.decisions ?? [];
      expect(ended.activeRun!.history.length, `${tree.type} committed decisions`).toBeGreaterThan(0);
      expect(decisions.length, `${tree.type} debrief lists its decisions`).toBe(ended.activeRun!.history.length);
      for (const decision of decisions) {
        expect(decision.band, `${tree.type}: ${decision.actionId}`).toMatch(/favorable|mixed|adverse/);
        expect(decision.explanation.join(' ').trim().length, `${tree.type}: ${decision.actionId} explains itself`).toBeGreaterThan(0);
      }
    }
  });

  it('save-round-trip: a campaign mid-call, after a committed decision, saves and loads to the same state', () => {
    const { scenarioId } = drawCalls(trees[0], 3, 1)[0];
    const mid = playToEnd(scenarioId, 'random', 7, { maxSteps: 1 });
    expect(mid.activeRun!.history.length).toBe(1);
    expect(mid.activeRun!.stage).not.toBe('debrief');
    const loaded = deserialize(serialize(mid, NOW));
    expect(loaded).toEqual(mid);
  });
});
