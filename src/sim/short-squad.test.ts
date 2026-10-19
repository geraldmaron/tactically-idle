// short-squad-deploys (journey `short-squad`): a squad with at least one ready officer deploys, and
// the officers who aren't ready stay home. Deploy, the squad card and the board agree on it; the
// officer left home never acts, takes strain or shows in the debrief; and the odds use who goes, so
// a squad short its injured officer reads exactly as the same squad without that officer.
import { describe, expect, it } from 'vitest';
import { squadReadiness } from './department-selectors';
import { actionViews, prepCheck, scenarioCards } from './operation-selectors';
import { autoLoadout } from './auto-equip';
import { builtFor, evaluateAction } from './resolution';
import { runRoster } from './squads';
import { getScenario } from './scenario-registry';
import { apply, makeState, NOW, playPolicy, startCmd, startRun, unitId } from './test-fixtures';
import type { GameState, StageId } from './types';

const HOME = 'off_vale';

/** Squad A with one officer hurt for a day; that officer is the squad's best at everything, so the
 * odds can't hide whether they went. */
function shortA(): GameState {
  const s = makeState();
  const o = s.officers[HOME];
  o.injury = { label: 'Sprained wrist', until: NOW + 24 * 3600_000 };
  for (const key of Object.keys(o.ratings) as (keyof typeof o.ratings)[]) o.ratings[key] = 100;
  return s;
}

/** The margin of every action in the run's current stage, for squad A acting alone. */
function margins(state: GameState): number[] {
  const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
  const built = builtFor(run.locationFamilyId, run.locationSeed, run.flags);
  return scenario.stages[run.stage as StageId].actions.map(action => evaluateAction({ state, run, scenario, action, built, acting: ['A'], support: [] }).margin);
}

describe('journey short-squad: a squad short an injured officer deploys without them (short-squad-deploys)', () => {
  it('the squad card, the board and Deploy agree that it deploys, and say who stays home', () => {
    const s = shortA();
    const card = squadReadiness(s, 'A', NOW);
    expect(card).toMatchObject({ ready: 3, total: 4, deployable: true });
    expect(card.staysHome).toEqual([{ officerId: HOME, reason: 'Vale is injured (Sprained wrist)' }]);
    expect(scenarioCards(s, NOW)[0].eligibleSquadIds).toContain('A');
    const r = apply(s, startCmd('ms_occupancy', ['A']));
    expect(r.result.ok).toBe(true);
    expect(runRoster(r.state, r.state.activeRun!, 'A')).toEqual(['off_chen', 'off_brooks', 'off_ortiz']);
    expect(r.state.officers[HOME].assignment).toBeNull();
  });

  it('the officer left home never acts, takes strain or shows in the debrief', () => {
    const s = shortA();
    const stress = s.officers[HOME].stress;
    const done = playPolicy(startRun(s, 'ms_occupancy', ['A']), {});
    expect(done.debrief.officerCondition.map(entry => entry.officerId)).not.toContain(HOME);
    expect(done.debrief.officerCondition.length).toBe(3);
    expect(done.state.officers[HOME].stress).toBe(stress);
    expect(done.state.officers[HOME].career.operations).toBe(0);
    expect(done.state.officers[HOME].xp).toBe(s.officers[HOME].xp);
  });

  it('every decision on the run leaves the officer at home out', () => {
    let state = startRun(shortA(), 'ms_occupancy', ['A']);
    for (let guard = 0; guard < 20 && state.activeRun!.status === 'active' && state.activeRun!.stage !== 'debrief'; guard++) {
      const pick = actionViews(state, NOW, 'A').find(view => view.eligible)!;
      const r = apply(state, { type: 'decide', actionId: pick.id, actingSquadIds: pick.actingSquadIds, supportSquadIds: pick.supportSquadIds });
      expect(r.result.ok).toBe(true);
      state = r.state;
    }
    const history = state.activeRun!.history;
    expect(history.length).toBeGreaterThan(0);
    for (const decision of history) {
      expect(decision.officerIds).not.toContain(HOME);
      expect(Object.keys(decision.stressDeltas)).not.toContain(HOME);
    }
  });

  it('the odds use who goes: a squad short an officer reads as the squad without them', () => {
    // In mandatory recovery rather than hurt: before, only injuries were kept out of the odds.
    const tiredA = () => { const s = shortA(); s.officers[HOME].injury = null; s.officers[HOME].stress = 85; return s; };
    const short = startRun(tiredA(), 'ms_occupancy', ['A']);
    const without = tiredA();
    const a = without.squads.find(squad => squad.id === 'A')!;
    a.officerIds = a.officerIds.filter(id => id !== HOME);
    without.officers[HOME].squadId = null;
    expect(margins(short)).toEqual(margins(startRun(without, 'ms_occupancy', ['A'])));
    const rested = tiredA();
    rested.officers[HOME].stress = 0;
    expect(margins(short)).not.toEqual(margins(startRun(rested, 'ms_occupancy', ['A'])));
  });

  it('a squad with nobody ready stays off the call, on the card, the board and Deploy alike', () => {
    const s = shortA();
    for (const id of s.squads.find(squad => squad.id === 'A')!.officerIds) s.officers[id].injury = { label: 'Sprained wrist', until: NOW + 3600_000 };
    expect(squadReadiness(s, 'A', NOW)).toMatchObject({ ready: 0, deployable: false });
    expect(scenarioCards(s, NOW)[0].eligibleSquadIds).not.toContain('A');
    expect(apply(s, startCmd('ms_occupancy', ['A'])).result.ok).toBe(false);
  });

  // Deploy-time consumers read who goes too (the Codex review's reproductions).
  it('the deploy preview carries the gear the squad carries: its probe is mid-run like the run it previews', () => {
    const warnings = prepCheck(makeState(), NOW, startCmd('ms_occupancy', ['A'], { loadouts: { A: { throw_phone: 1, loud_hailer: 1 } } })).warnings;
    expect(warnings.filter(line => line.includes('throw phone or loud hailer'))).toEqual([]);
  });

  it('Auto-equip equips a short squad for the officers who go', () => {
    const plan = autoLoadout(shortA(), 'ms_occupancy', ['A'], NOW);
    expect(plan.warnings.filter(line => line.includes('no equipment added'))).toEqual([]);
    expect(plan.loadouts.A?.radio_kit).toBe(3);
  });

  it('takes one radio for each officer who goes, so three radios send a squad of three', () => {
    const s = shortA();
    const r = apply(s, startCmd('ms_occupancy', ['A'], { loadouts: { A: { radio_kit: 3 } } }));
    expect(r.result.ok).toBe(true);
    expect(r.state.reservations.filter(entry => entry.itemId === 'radio_kit')).toHaveLength(3);
  });

  it('a support vehicle needs a qualified driver who goes', () => {
    const withDriver = (hurt: boolean) => {
      const s = makeState({ inventory: { support_van: 1 } });
      s.officers.off_brooks.certs.push('vehicle_operations');
      if (hurt) s.officers.off_brooks.injury = { label: 'Sprained wrist', until: NOW + 3600_000 };
      return apply(s, { ...startCmd('ms_occupancy', ['A'], { loadouts: { A: {} } }), supportUnitIds: [unitId('support_van')] }).result;
    };
    expect(withDriver(false)).toEqual({ ok: true });
    expect(withDriver(true)).toMatchObject({ ok: false, reason: expect.stringContaining('vehicle operations') });
  });
});
