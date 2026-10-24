// Review finding 10: patrol quotes and affordability checks read the same rates settlement pays, so the
// Department Charter (a multiplier on patrol gross) is in every figure the player is shown or refused on.
import { describe, expect, it } from 'vitest';
import { ALLOCATION } from '../content/city/tuning';
import { createInitialState } from './department';
import { dispatch } from './game';
import { HOUR_MS, ratesAt } from './economy';
import { PATROL_GRADES, PATROL_HIRE_COST, employedPatrol, patrolBoostQuote, patrolCandidates, patrolDismissQuote, patrolHireQuote, patrolTrainingQuote } from './patrol';
import type { Command, GameState } from './types';

const T0 = Date.UTC(2026, 0, 5, 12);
const ok = (state: GameState, cmd: Command): GameState => {
  const out = dispatch(state, cmd, { now: T0 });
  expect(out.result, JSON.stringify(cmd)).toMatchObject({ ok: true });
  return out.state;
};
function chartered(): GameState {
  const s = createInitialState(T0);
  s.department.entitlements = { charter: true, nightWatch: false };
  s.department.funding = 50_000;
  return s;
}
const sustainable = (s: GameState, t = T0) => ratesAt(s, t, false);

describe('patrol quotes with the Department Charter', () => {
  it('is a real multiplier in this build', () => {
    expect(ALLOCATION.charterFactor).toBeGreaterThan(1);
  });

  it('quotes a hire at what the hire adds to hourly net, Charter included', () => {
    const s = chartered();
    const quote = patrolHireQuote(s, patrolCandidates(s)[0].id);
    const g = PATROL_GRADES[1];
    expect(quote.ok).toBe(true);
    const bought = ok(s, { type: 'hirePatrol', profileId: patrolCandidates(s)[0].id });
    const actual = sustainable(bought).net - sustainable(s).net;
    expect(actual).toBeCloseTo(g.gross * ALLOCATION.charterFactor - g.wage - g.operating, 6);
    expect(quote.netDelta).toBeCloseTo(actual, 6);
    expect(quote.grossDelta).toBeCloseTo(g.gross * ALLOCATION.charterFactor, 6);
    expect(quote.paybackHours).toBeCloseTo(PATROL_HIRE_COST / actual, 6);
  });

  it('leaves the figures alone without the Charter', () => {
    const s = createInitialState(T0);
    const quote = patrolHireQuote(s, patrolCandidates(s)[0].id);
    const g = PATROL_GRADES[1];
    expect(quote.netDelta).toBeCloseTo(g.gross - g.wage - g.operating, 6);
  });

  it('quotes a dismissal at what leaving removes', () => {
    const s = chartered();
    const id = employedPatrol(s)[0].id;
    const quote = patrolDismissQuote(s, id);
    const gone = ok(s, { type: 'dismissPatrol', employeeId: id });
    expect(quote.netDelta).toBeCloseTo(sustainable(gone).net - sustainable(s).net, 6);
  });

  it('quotes training at the step up when it lands and the downtime while the person is off the street', () => {
    const s = chartered();
    s.department.level = 3;
    const person = employedPatrol(s)[0];
    person.serviceHours = 100;
    const quote = patrolTrainingQuote(s, person.id);
    expect(quote.ok, quote.reason ?? '').toBe(true);
    const trained = ok(s, { type: 'startPatrolTraining', employeeId: person.id });
    // During training: this person earns nothing, and the quote's trainingNet says so.
    expect(quote.trainingNet).toBeCloseTo(sustainable(trained).net, 6);
    // When it lands: the lift is the difference the settled books show then.
    const landed = quote.endsAt!;
    expect(quote.netDelta).toBeCloseTo(sustainable(trained, landed).net - sustainable(s, landed).net, 6);
    const lift = (PATROL_GRADES[2].gross - PATROL_GRADES[1].gross) * ALLOCATION.charterFactor - (PATROL_GRADES[2].wage - PATROL_GRADES[1].wage) - (PATROL_GRADES[2].operating - PATROL_GRADES[1].operating);
    expect(quote.netDelta).toBeCloseTo(lift, 6);
    expect(quote.paybackHours).toBeCloseTo((quote.upfront + PATROL_GRADES[1].gross * ALLOCATION.charterFactor * PATROL_GRADES[2].trainingHours) / lift, 6);
  });

  it('counts the Charter in a boost: its real return clears its cost where the plain figure would not', () => {
    const s = chartered();
    const quote = patrolBoostQuote(s, 'community-grant');
    // Four officers at 210 gross, half again for four hours: 1,680 plain, 2,100 with the Charter.
    expect(quote.incrementalReturn).toBeCloseTo(840 * 0.5 * 4 * ALLOCATION.charterFactor, 6);
    expect(quote.ok, quote.reason ?? '').toBe(true);
    const boosted = ok(s, { type: 'activatePatrolBoost', boostId: 'community-grant' });
    // What it adds per hour at the moment it starts is what the quote says.
    expect(quote.netDelta).toBeCloseTo(ratesAt(boosted, T0).net - ratesAt(s, T0).net, 6);
    expect(quote.netDelta).toBeCloseTo(840 * 0.5 * ALLOCATION.charterFactor, 6);
    // Over the boost it returns more than it cost.
    let gained = 0;
    for (let h = 0; h < 4; h++) gained += (ratesAt(boosted, T0 + h * HOUR_MS).net - ratesAt({ ...boosted, patrol: { ...boosted.patrol, boosts: [] } }, T0 + h * HOUR_MS).net);
    expect(gained).toBeCloseTo(quote.incrementalReturn, 6);
  });
});
