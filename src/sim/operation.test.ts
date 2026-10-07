import { describe, expect, it } from 'vitest';
import type { GameState, Id, OutcomeBand, SquadId } from './types';
import { dispatch } from './game';
import { SCENARIOS } from '../content/scenarios';
import {
  actionViews,
  briefing,
  lastResolution,
  pendingDebrief,
  prepCheck,
  previewAction,
  scenarioCards,
  spaceViews,
  spaceViewsForScenario,
  stageProgress,
} from './operation-selectors';
import { traceRun } from './operation';
import { openingFlag } from './resolution';
import { apply, makeState, NOW, playPolicy, setRun, startCmd, startRun, unitId, type Policy } from './test-fixtures';

const view = (s: GameState, id: Id, focus: SquadId | null = 'A') => actionViews(s, NOW, focus).find((v) => v.id === id)!;
const decideView = (s: GameState, id: Id, focus: SquadId | null = 'A') => {
  const v = view(s, id, focus);
  return apply(s, { type: 'decide', actionId: id, actingSquadIds: v.actingSquadIds, supportSquadIds: v.supportSquadIds });
};

/** Find a department rng seed for which `action` lands in `band` when decided first. */
function seedFor(scenario: Id, squads: SquadId[], action: Id, band: OutcomeBand, prep?: (s: GameState) => GameState): GameState {
  for (let i = 0; i < 400; i++) {
    let s = startRun(makeState({ rngState: 500 + i * 131, squadC: squads.includes('C') }), scenario, squads);
    if (prep) s = prep(s);
    const r = decideView(s, action);
    if (r.result.ok && r.state.activeRun!.history[0].band === band) return s;
  }
  throw new Error(`no seed gives ${band} for ${action}`);
}

const swapChenForReyes = (s: GameState): GameState => {
  const c = structuredClone(s);
  c.squads[0].officerIds = ['off_reyes', 'off_brooks', 'off_ortiz', 'off_vale'];
  c.squads[1].officerIds = ['off_okafor', 'off_lindqvist', 'off_chen', 'off_park'];
  c.officers.off_reyes.squadId = 'A';
  c.officers.off_chen.squadId = 'B';
  return c;
};

describe('scenario content and selectors', () => {
  it('lists the two standing assignments in their original order', () => {
    const cards = scenarioCards(makeState(), NOW);
    expect(cards.map((c) => c.code)).toEqual(['OP 0141', 'OP 0142']);
    expect(cards[0].variantLabel).toBe('Uncertain occupancy');
    expect(cards[1].variantLabel).toBe('Time pressure');
    expect(cards[0].eligibleSquadIds).toEqual(['A', 'B']);
    expect(cards[0].issues).toEqual([]);
    const map = spaceViewsForScenario('ms_occupancy');
    expect(map.find((v) => v.id === 'bedroom_e')).toMatchObject({ status: 'unknown', marker: { text: 'UNKNOWN', tone: 'amber' } });
    const b = briefing('ms_occupancy');
    expect(b.entries.map((e) => e.id)).toEqual(['front_yard', 'side_yard_e']);
    expect(b.usefulItemIds).toContain('throw_phone');
    expect(b.objectives.length).toBeGreaterThan(0);
  });

  it('prepCheck mirrors startOperation without mutating', () => {
    const s = makeState();
    const bad = prepCheck(s, NOW, { ...startCmd('ms_occupancy', ['A']), positions: {} });
    expect(bad.ok).toBe(false);
    expect(bad.issues.join(' ')).toMatch(/starting point/);
    const noItems = prepCheck(s, NOW, startCmd('ms_occupancy', ['A'], { loadouts: { A: { throw_phone: 3 } } }));
    expect(noItems.ok).toBe(false);
    expect(noItems.issues[0]).toMatch(/Only 1 usable Throw phone/);
    const good = prepCheck(s, NOW, startCmd('ms_occupancy', ['A', 'B']));
    expect(good.ok).toBe(true);
    expect(s.reservations).toEqual([]);
    // A squad with no way to make contact is a warning, not a block.
    const weak = prepCheck(s, NOW, startCmd('ms_occupancy', ['B']));
    expect(weak.ok).toBe(true);
    expect(weak.warnings.join(' ')).toMatch(/Make contact: Needs a crisis negotiator/);
  });

  it('refuses invalid starts: duplicate squads, shared officers, bad positions, a second run', () => {
    const s = makeState();
    expect(apply(s, startCmd('ms_occupancy', ['A', 'A'])).result.ok).toBe(false);
    expect(apply(s, startCmd('ms_occupancy', [])).result.ok).toBe(false);
    expect(apply(s, startCmd('ms_occupancy', ['A'], { positions: { A: 'kitchen' } })).result.ok).toBe(false);
    const shared = structuredClone(s);
    shared.squads[1].officerIds[0] = 'off_chen';
    const r = apply(shared, startCmd('ms_occupancy', ['A', 'B']));
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.reason).toMatch(/Chen is in both/);
    const empty = structuredClone(s);
    empty.squads[1].officerIds = [];
    expect(apply(empty, startCmd('ms_occupancy', ['B'])).result.ok).toBe(false);
    const running = startRun(s, 'ms_occupancy', ['A']);
    expect(apply(running, startCmd('ms_urgent', ['B'])).result.ok).toBe(false);
    expect(apply(s, startCmd('nope', ['A'])).result.ok).toBe(false);
    expect(apply(s, startCmd('ms_occupancy', ['A'], { loadouts: { A: { throw_phone: 99 } } })).result.ok).toBe(false);
  });

  it('starting reserves loadouts, assigns officers and shows staging tasks', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A', 'B']);
    const run = s.activeRun!;
    expect(run.id).toBe('run_1');
    expect(run.status).toBe('active');
    expect(run.squadTasks).toMatchObject([
      { squadId: 'A', positionId: 'front_yard', task: 'Staging', stagingId: 'sp_w_kitchen_s_front_yard' },
      { squadId: 'B', positionId: 'side_yard_e', task: 'Staging', stagingId: 'sp_d_back_side_yard_e' },
    ]);
    // Default staging is the nearest door point to the position (else the nearest point of any kind), and the token stands on it.
    expect(run.squadTasks[1].at).toEqual({ x: 45.5, y: 27.5 });
    expect(s.officers.off_chen.assignment).toEqual({ kind: 'operation', runId: run.id });
    expect(s.units[unitId('throw_phone')].status).toBe('reserved');
    expect(s.reservations.length).toBeGreaterThan(0);
    expect(s.reservations.every((r) => s.units[r.unitId].status === 'reserved')).toBe(true);
    expect(stageProgress(s).stages.map((x) => x.state)).toEqual(['current', 'todo', 'todo']);
    expect(spaceViews(s).find((v) => v.id === 'front_yard')!.squadsHere).toEqual(['A']);
    expect(spaceViews(s).find((v) => v.id === 'side_yard_e')!.squadsHere).toEqual(['B']);
  });
});

describe('capability dependency (acceptance 3)', () => {
  it('without a qualified communicator, Make contact is ineligible for that reason', () => {
    const s = startRun(swapChenForReyes(makeState()), 'ms_occupancy', ['A']);
    const v = view(s, 'ms_contact');
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe('Needs a crisis negotiator — Squad A has none');
    expect(v.summary).toBe('Needs a crisis negotiator');
    expect(apply(s, { type: 'decide', actionId: 'ms_contact', actingSquadIds: ['A'], supportSquadIds: [] }).result.ok).toBe(false);
  });

  it('with Chen but no throw phone or hailer, it is ineligible for a different reason', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: { radio_kit: 1, trauma_kit: 1 } } });
    const v = view(s, 'ms_contact');
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe("No throw phone or loud hailer in Squad A's loadout");
    expect(v.reason).not.toMatch(/negotiator/);
  });

  it('with both, it is ready and names the negotiator; the throw phone beats the hailer', () => {
    const withPhone = startRun(makeState(), 'ms_occupancy', ['A']);
    const v = view(withPhone, 'ms_contact');
    expect(v.eligible).toBe(true);
    expect(v.summary).toBe('Chen ready');
    expect(v.requirementLine).toBe('Crisis negotiator + throw phone or loud hailer');
    const hailerOnly = startRun(makeState(), 'ms_occupancy', ['A'], { loadouts: { A: { loud_hailer: 1 } } });
    const equip = (s: GameState) => view(s, 'ms_contact').contributors.find((c) => c.source === 'equipment')!;
    expect(equip(withPhone).value).toBeGreaterThan(equip(hailerOnly).value);
    expect(view(withPhone, 'ms_gather').summary).toBe('Takes more time');
  });

  it('shows the focus squad reason and which squad can, with no silent disabling', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A', 'B']);
    const v = view(s, 'ms_contact', 'B');
    expect(v.eligible).toBe(false);
    expect(v.reason).toBe('Needs a crisis negotiator — Squad B has none. Squad A can.');
    expect(view(s, 'ms_contact', 'A').eligible).toBe(true);
    // No focus: the best eligible deployed squad is chosen.
    expect(view(s, 'ms_contact', null).actingSquadIds).toEqual(['A']);
    // Explicit preview for a chosen squad.
    expect(previewAction(s, NOW, 'ms_contact', ['B'], [])!.eligible).toBe(false);
    expect(previewAction(s, NOW, 'ms_contact', ['A'], [])!.eligible).toBe(true);
  });

  it('thermal needs its reusable imager with integrated power', () => {
    const adapt = (s: GameState) => setRun(s, { stage: 'adapt' });
    const none = adapt(startRun(makeState(), 'ms_occupancy', ['A']));
    expect(view(none, 'ms_thermal').reason).toBe("No thermal imager in Squad A's loadout");
    const inv = { thermal_imager: 1 };
    const noBattery = adapt(startRun(makeState({ inventory: inv }), 'ms_occupancy', ['A'], { loadouts: { A: { thermal_imager: 1 } } }));
    expect(view(noBattery, 'ms_thermal').eligible).toBe(true);
    const ok = adapt(startRun(makeState({ inventory: inv }), 'ms_occupancy', ['A'], { loadouts: { A: { thermal_imager: 1 } } }));
    expect(view(ok, 'ms_thermal').eligible).toBe(true);
    expect(view(ok, 'ms_thermal').requirementLine).toBe('Thermal imager');
  });
});

describe('wrong initial report (urgent scenario)', () => {
  const s0 = () => startRun(makeState(), 'ms_urgent', ['A']);

  it('shows the reported marker on the kitchen and nothing on the real room', () => {
    const map = spaceViews(s0());
    // The marker names the claim ('PATIENT?'); the source rides underneath.
    expect(map.find((v) => v.id === 'kitchen')).toMatchObject({ status: 'reported', marker: { text: 'PATIENT?', tone: 'amber', subtext: 'per caller' } });
    const real = map.find((v) => v.id === 'bedroom_e')!;
    expect(real.status).toBe('none');
    expect(real.marker).toBeNull();
    expect(real.actionIds).toEqual([]);
  });

  it('does not reveal the truth through action targets or reasons before discovery', () => {
    const s = setRun(s0(), { stage: 'resolve' });
    const aid = view(s, 'mu_targeted_aid');
    expect(aid.eligible).toBe(false);
    expect(aid.targetId).toBeNull();
    expect(aid.reason).toBe("The patient's location is not known yet");
    expect(spaceViews(s).find((v) => v.id === 'bedroom_e')!.actionIds).toEqual([]);
    const views = actionViews(s0(), NOW, 'A');
    expect(views.some((v) => v.targetId === 'bedroom_e')).toBe(false);
  });

  it('an unsuccessful discovery changes nothing on the map', () => {
    const s = seedFor('ms_urgent', ['A'], 'mu_check_reported', 'adverse');
    const after = decideView(s, 'mu_check_reported').state;
    expect(spaceViews(after).find((v) => v.id === 'bedroom_e')!.marker).toBeNull();
    expect(spaceViews(after).find((v) => v.id === 'kitchen')!.status).toBe('reported');
    expect(after.activeRun!.knowledge).toEqual(s.activeRun!.knowledge);
  });

  it('a successful discovery moves the markers: kitchen clears, bedroom confirms', () => {
    const s = seedFor('ms_urgent', ['A'], 'mu_check_reported', 'favorable');
    const after = decideView(s, 'mu_check_reported').state;
    const map = spaceViews(after);
    expect(map.find((v) => v.id === 'kitchen')).toMatchObject({ status: 'disproved', marker: { text: 'CLEAR', tone: 'mint' } });
    expect(map.find((v) => v.id === 'bedroom_e')).toMatchObject({ status: 'confirmed', marker: { text: 'PATIENT', tone: 'mint' } });
    const res = lastResolution(after)!;
    expect(res.knowledgeChanges).toEqual([
      { factId: 'f_kitchen', status: 'disproved' },
      { factId: 'f_patient_e', status: 'confirmed' },
    ]);
    // The squad looked from outside, at the kitchen window, and never went into the room.
    expect(spaceViews(after).find((v) => v.id === 'kitchen')!.squadsHere).toEqual([]);
    expect(after.activeRun!.squadTasks[0]).toMatchObject({ positionId: 'front_yard', stagingId: 'sp_w_kitchen_s_front_yard' });
    // Now the aid action targets the real room and is eligible.
    const resolve = setRun(after, { stage: 'resolve' });
    expect(view(resolve, 'mu_targeted_aid')).toMatchObject({ eligible: true, targetId: 'bedroom_e' });
  });
});

describe('time pressure versus uncertainty (acceptance 4)', () => {
  it('same start, different decisions give different knowledge, flags and debrief causes', () => {
    const start = seedFor('ms_occupancy', ['A'], 'ms_contact', 'favorable');
    const talk = playPolicy(start, { assess: ['ms_contact'], adapt: ['ms_perimeter_watch'], resolve: ['ms_negotiated_exit'] });
    const rush = playPolicy(start, { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_controlled_entry'] });
    expect(talk.steps).not.toEqual(rush.steps);
    expect(talk.debrief.causes).not.toEqual(rush.debrief.causes);
    expect(talk.debrief.endingId).not.toBe(rush.debrief.endingId);
    // The first decision alone already branches the saved state.
    const a = decideView(start, 'ms_contact').state.activeRun!;
    const b = decideView(start, 'ms_gather').state.activeRun!;
    expect(a.flags).not.toEqual(b.flags);
  });

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const outcome = (scenario: Id, policy: Policy, n = 200) => {
    const scores: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = startRun(makeState({ rngState: 2000 + i * 7919 }), scenario, ['A']);
      const d = playPolicy(s, policy).debrief;
      scores.push((d.objective.score + d.civilianSafety.score) / 2);
    }
    return mean(scores);
  };

  it('careful contact beats rushing on the uncertain-occupancy scenario', () => {
    const cautious = outcome('ms_occupancy', { assess: ['ms_contact', 'ms_gather'], adapt: ['ms_perimeter_watch', 'ms_preserve_time'], resolve: ['ms_negotiated_exit', 'ms_handover'] });
    const direct = outcome('ms_occupancy', { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_controlled_entry'] });
    expect(cautious).toBeGreaterThan(direct + 10);
  });

  it('a direct response beats slow information gathering on the time-pressure scenario', () => {
    const cautious = outcome('ms_urgent', { assess: ['mu_survey_house'], adapt: ['mu_stage_medic'], resolve: ['mu_targeted_aid', 'mu_sweep_and_aid'] });
    const direct = outcome('ms_urgent', { assess: ['mu_check_reported'], adapt: ['mu_go_now'], resolve: ['mu_targeted_aid', 'mu_sweep_and_aid'] });
    expect(direct).toBeGreaterThan(cautious + 5);
  });

  it('pressure rises with operation minutes and civilian safety falls only past the threshold', () => {
    const s = startRun(makeState(), 'ms_urgent', ['A']);
    const r = decideView(s, 'mu_survey_house').state.activeRun!;
    const res = r.history[0];
    expect(r.clock).toBe(res.timeCost);
    expect(r.pressure).toBeCloseTo(SCENARIOS.ms_urgent.pressure.start + SCENARIOS.ms_urgent.pressure.perMinute * res.timeCost, 0);
    expect(res.timeCost).toBeGreaterThan(15);
    expect(r.civilianSafety).toBeLessThan(100);
    const calm = startRun(makeState(), 'ms_occupancy', ['A']);
    const c = decideView(calm, 'ms_gather').state.activeRun!;
    expect(c.civilianSafety).toBe(100);
  });

  it('time cost and risk are visible before committing, and gathering is slower than contact', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    expect(view(s, 'ms_gather').timeCost).toBeGreaterThan(view(s, 'ms_contact').timeCost);
    const urgent = startRun(makeState(), 'ms_urgent', ['A']);
    expect(view(urgent, 'mu_survey_house').timeCost).toBeGreaterThan(view(urgent, 'mu_check_reported').timeCost * 2);
  });

  it('replaying stored bands reproduces the live run exactly', () => {
    for (const [scn, pol] of [
      ['ms_occupancy', { assess: ['ms_contact'], adapt: ['ms_perimeter_watch'], resolve: ['ms_controlled_entry'] }],
      ['ms_urgent', { assess: ['mu_check_reported'], adapt: ['mu_go_now'], resolve: ['mu_targeted_aid'] }],
    ] as [Id, Policy][]) {
      let s = startRun(makeState({ rngState: 77 }), scn, ['A']);
      for (let i = 0; i < 5 && s.activeRun?.status === 'active'; i++) {
        const prefs = pol[s.activeRun.stage as 'assess'] ?? [];
        const v = actionViews(s, NOW, 'A').find((x) => prefs.includes(x.id) && x.eligible) ?? actionViews(s, NOW, 'A').find((x) => x.eligible)!;
        s = apply(s, { type: 'decide', actionId: v.id, actingSquadIds: v.actingSquadIds, supportSquadIds: v.supportSquadIds }).state;
      }
      const run = s.activeRun!;
      const { end } = traceRun(SCENARIOS[scn], run);
      expect(end.objective).toBeCloseTo(run.objective, 5);
      expect(end.civilianSafety).toBeCloseTo(run.civilianSafety, 5);
      expect(end.pressure).toBeCloseTo(run.pressure, 5);
      expect(end.knowledge).toEqual(run.knowledge);
      expect(end.flags).toEqual(run.flags);
    }
  });
});

describe('joint operations (acceptance 18)', () => {
  const play = (squads: SquadId[], policy: Policy) => {
    const before = makeState({ squadC: squads.includes('C') });
    const start = startRun(before, 'ms_occupancy', squads);
    const done = playPolicy(start, policy, squads[0]);
    return { before, start, ...done };
  };
  const policy: Policy = { assess: ['ms_gather'], adapt: ['ms_perimeter_watch'], resolve: ['ms_handover'] };

  it('completes with one, two and three squads and applies shared rewards exactly once', () => {
    for (const squads of [['A'], ['A', 'B'], ['A', 'B', 'C']] as SquadId[][]) {
      const r = play(squads, policy);
      expect(r.state.debriefs).toHaveLength(1);
      expect(r.state.activeRun).toBeNull();
      expect(r.state.department.funding - r.before.department.funding).toBe(r.debrief.fundingReward);
      expect(r.state.department.devPoints - r.before.department.devPoints).toBe(r.debrief.devPointReward);
      expect(r.state.department.trust - r.before.department.trust).toBe(r.debrief.trustDelta);
      const ids = r.debrief.officerCondition.map((o) => o.officerId);
      expect(ids).toHaveLength(squads.length * 4);
      expect(new Set(ids).size).toBe(ids.length);
      for (const o of Object.values(r.state.officers)) expect(o.assignment).toBeNull();
      expect(r.state.reservations).toEqual([]);
      for (const u of Object.values(r.state.units)) expect(u.status).not.toBe('reserved');
    }
  });

  it('a larger deployment spreads exposure and gear without multiplying the reward', () => {
    const one = play(['A'], policy);
    const three = play(['A', 'B', 'C'], policy);
    // Same scenario, same reward scale: no per-squad reward multiplication.
    expect(three.debrief.fundingReward).toBeLessThanOrEqual(1800);
    expect(one.debrief.fundingReward).toBeLessThanOrEqual(1800);
    const strained = (r: ReturnType<typeof play>) => Object.values(r.state.officers).filter((o) => o.stress > 0).length;
    expect(strained(three)).toBeGreaterThan(strained(one));
    // Each squad holds its own distinct reservation.
    const items = (r: ReturnType<typeof play>, sq: SquadId) => r.start.reservations.filter((x) => x.squadId === sq).map((x) => x.itemId).sort();
    expect(items(three, 'A')).not.toEqual(items(three, 'C'));
    // Twelve officers carry twelve distinct physical radios.
    const radios = three.start.reservations.filter((x) => x.itemId === 'radio_kit').map((x) => x.unitId);
    expect(radios).toHaveLength(12);
    expect(new Set(radios).size).toBe(12);
  });

  it('three squads give wider cover and more strain exposure, not automatic success', () => {
    const start3 = setRun(startRun(makeState({ squadC: true }), 'ms_occupancy', ['A', 'B', 'C']), { stage: 'adapt' });
    const start1 = setRun(startRun(makeState({ squadC: true }), 'ms_occupancy', ['A']), { stage: 'adapt' });
    const wide = previewAction(start3, NOW, 'ms_perimeter_watch', ['A', 'B', 'C'], [])!;
    const solo = previewAction(start1, NOW, 'ms_perimeter_watch', ['A'], [])!;
    expect(wide.contributors.some((c) => /Wider cover/.test(c.label))).toBe(true);
    expect(wide.officerIds.length).toBeGreaterThan(solo.officerIds.length);
    expect(wide.risk).not.toBe('severe');
    const run3 = apply(start3, { type: 'decide', actionId: 'ms_perimeter_watch', actingSquadIds: ['A', 'B', 'C'], supportSquadIds: [] });
    expect(run3.result.ok).toBe(true);
    const r = run3.state.activeRun!;
    // Three distinct vantage squads end up in different places, each with its own task label.
    expect(new Set(r.squadTasks.map((t) => t.positionId)).size).toBeGreaterThan(1);
    expect(r.squadTasks.every((t) => t.task === 'Watch')).toBe(true);
    const strain = r.history[0].stressDeltas;
    expect(Object.keys(strain)).toHaveLength(12);
    const solo2 = apply(start1, { type: 'decide', actionId: 'ms_perimeter_watch', actingSquadIds: ['A'], supportSquadIds: [] }).state.activeRun!.history[0].stressDeltas;
    const total = (d: Record<Id, number>) => Object.values(d).reduce((a, b) => a + b, 0);
    expect(total(strain)).toBeGreaterThan(total(solo2));
  });

  it('a joint action needs two squads, is eligible with two, and its support depends on the back door', () => {
    const one = setRun(startRun(makeState(), 'ms_urgent', ['A']), { stage: 'adapt' });
    expect(view(one, 'mu_two_point').eligible).toBe(false);
    expect(view(one, 'mu_two_point').reason).toBe('Needs a second squad to cover the back door');

    const two = setRun(startRun(makeState(), 'ms_urgent', ['A', 'B']), { stage: 'adapt' });
    const ok = view(two, 'mu_two_point');
    expect(ok.eligible).toBe(true);
    expect(ok.supportSquadIds).toEqual(['B']);
    expect(ok.contributors.some((c) => c.source === 'support' && c.ref === 'B')).toBe(true);

    // Blocked: ineligible with a specific reason.
    const blocked = setRun(two, { flags: [openingFlag('d_back', 'blocked')] });
    const bv = view(blocked, 'mu_two_point');
    expect(bv.eligible).toBe(false);
    expect(bv.reason).toBe('Back door is blocked: there is no second route');
    expect(apply(blocked, { type: 'decide', actionId: 'mu_two_point', actingSquadIds: ['A'], supportSquadIds: ['B'] }).result.ok).toBe(false);

    // Locked: slower without an entry tool, quicker with one (and the tool is recorded as used).
    const lockedFlag = [openingFlag('d_back', 'locked')];
    const noRam = setRun(startRun(makeState(), 'ms_urgent', ['A', 'B'], { loadouts: { B: { radio_kit: 1, trauma_kit: 1 } } }), { stage: 'adapt', flags: lockedFlag });
    const withRam = setRun(two, { flags: lockedFlag });
    const slow = view(noRam, 'mu_two_point');
    const fast = view(withRam, 'mu_two_point');
    expect(slow.eligible && fast.eligible).toBe(true);
    expect(slow.timeCost).toBeGreaterThan(fast.timeCost);
    expect(slow.details.join(' ')).toMatch(/locked/i);
    expect(fast.contributors.some((c) => c.source === 'equipment' && c.ref === 'door_ram')).toBe(true);
  });

  it('a committed joint action opens the route, moves both squads and charges both', () => {
    const start = setRun(startRun(makeState(), 'ms_urgent', ['A', 'B']), { stage: 'adapt' });
    let after: GameState | null = null;
    for (let i = 0; i < 100 && !after; i++) {
      const s = { ...start, rngState: start.rngState };
      const c = structuredClone(s);
      c.activeRun!.rngState = 40 + i * 977;
      const r = apply(c, { type: 'decide', actionId: 'mu_two_point', actingSquadIds: ['A'], supportSquadIds: ['B'] });
      if (r.result.ok && r.state.activeRun!.history[0].band === 'favorable') after = r.state;
    }
    expect(after).not.toBeNull();
    const run = after!.activeRun!;
    expect(run.flags).toContain('two_point_set');
    expect(run.flags).toContain(openingFlag('d_back', 'open'));
    expect(run.squadTasks.find((t) => t.squadId === 'B')).toMatchObject({ positionId: 'kitchen', task: 'Back door' });
    const strain = run.history[0].stressDeltas;
    expect(Object.keys(strain)).toHaveLength(8);
    expect(strain.off_okafor).toBeGreaterThan(0);
    expect(run.stage).toBe('resolve');
    expect(run.history[0].supportSquadIds).toEqual(['B']);
  });
});

describe('integrity (acceptance 11)', () => {
  it('cancel before the first decision releases reservations and assignments, and grants nothing', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A', 'B']);
    expect(s.reservations.length).toBeGreaterThan(0);
    const c = apply(s, { type: 'cancelOperation' });
    expect(c.result.ok).toBe(true);
    expect(c.state.activeRun).toBeNull();
    expect(c.state.reservations).toEqual([]);
    for (const u of Object.values(c.state.units)) expect(u.status).toBe('ready');
    expect(c.state.units).toEqual(makeState().units);
    for (const o of Object.values(c.state.officers)) expect(o.assignment).toBeNull();
    expect(c.state.department).toEqual(makeState().department);
    expect(c.state.debriefs).toEqual([]);
    // After a decision, cancelling is refused.
    const d = decideView(s, 'ms_gather').state;
    const refused = apply(d, { type: 'cancelOperation' });
    expect(refused.result.ok).toBe(false);
    expect(refused.state).toBe(d);
  });

  it('settlement charges only what was used, returns reusable gear once, and closing twice grants nothing more', () => {
    const start = startRun(makeState(), 'ms_urgent', ['A']);
    const done = playPolicy(start, { assess: ['mu_check_reported'], adapt: ['mu_go_now'], resolve: ['mu_targeted_aid', 'mu_sweep_and_aid'] });
    const kit = done.debrief.resources.find((r) => r.itemId === 'trauma_kit')!;
    const count = (st: GameState, itemId: Id) => Object.values(st.units).filter((u) => u.itemId === itemId).length;
    expect(kit.used).toBeLessThanOrEqual(1);
    expect(count(done.state, 'trauma_kit')).toBe(6 - kit.used);
    expect(count(done.state, 'battery_pack')).toBe(0); // power is integrated
    expect(count(done.state, 'throw_phone')).toBe(1);
    expect(Object.values(done.state.units).every((u) => u.status === 'ready')).toBe(true);
    // Wear lands only on units the decisions actually used, and the debrief says which.
    const usedUnits = new Set(done.state.debriefs[0].unitWear.map((w) => w.unitId));
    for (const u of Object.values(done.state.units)) {
      const before = start.units[u.id];
      if (!usedUnits.has(u.id)) expect(u.condition).toBe(before.condition);
      else expect(u.condition).toBeLessThan(before.condition);
    }
    expect(done.debrief.resources.find((r) => r.itemId === 'battery_pack')).toBeUndefined();
    // The same close again changes nothing.
    const twice = apply(done.state, { type: 'closeDebrief' });
    expect(twice.result.ok).toBe(false);
    expect(twice.state).toBe(done.state);
    expect(done.state.debriefs).toHaveLength(1);
  });

  it('closing refuses while the run is active and guards a settled run', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    expect(apply(s, { type: 'closeDebrief' }).result.ok).toBe(false);
    const done = playPolicy(s, { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_handover'] });
    // Hand-craft a settled debrief run: the guard refuses rather than double-granting.
    const lingering = structuredClone(done.state);
    lingering.activeRun = { ...structuredClone(s.activeRun!), status: 'debrief', stage: 'debrief', endingId: 'handed_over', settled: true };
    expect(apply(lingering, { type: 'closeDebrief' }).result.ok).toBe(false);
  });

  it('refuses a decision already made this stage and actions that do not belong to the stage', () => {
    const s = seedFor('ms_occupancy', ['A'], 'ms_contact', 'adverse');
    const first = decideView(s, 'ms_contact');
    expect(first.result.ok).toBe(true);
    expect(first.state.activeRun!.stage).toBe('assess'); // an adverse result leaves the stage open
    expect(view(first.state, 'ms_contact').reason).toBe('Already tried this stage');
    const again = apply(first.state, { type: 'decide', actionId: 'ms_contact', actingSquadIds: ['A'], supportSquadIds: [] });
    expect(again.result.ok).toBe(false);
    expect(again.state).toBe(first.state);
    expect(apply(s, { type: 'decide', actionId: 'ms_controlled_entry', actingSquadIds: ['A'], supportSquadIds: [] }).result.ok).toBe(false);
    expect(apply(s, { type: 'decide', actionId: 'ms_gather', actingSquadIds: ['B'], supportSquadIds: [] }).result.ok).toBe(false); // B not deployed
    expect(apply(s, { type: 'decide', actionId: 'ms_gather', actingSquadIds: ['A'], supportSquadIds: ['A'] }).result.ok).toBe(false);
  });

  it('an adverse result costs time and strain but does not end the operation', () => {
    const s = seedFor('ms_occupancy', ['A'], 'ms_gather', 'adverse');
    const r = decideView(s, 'ms_gather').state.activeRun!;
    expect(r.status).toBe('active');
    expect(r.history[0].timeCost).toBeGreaterThan(0);
    expect(r.history[0].knowledgeChanges).toEqual([]);
    expect(r.stage).toBe('assess');
  });

  it('a stage that runs out of options moves on instead of dead-ending', () => {
    // With no phone or hailer both contact options are ineligible, so one adverse gather leaves nothing to try.
    const loadouts = { A: { radio_kit: 1, trauma_kit: 1 } };
    let hit: GameState | null = null;
    for (let i = 0; i < 400 && !hit; i++) {
      const s = startRun(makeState({ rngState: 900 + i * 131 }), 'ms_occupancy', ['A'], { loadouts });
      const b = decideView(s, 'ms_gather');
      if (b.result.ok && b.state.activeRun!.history[0].band === 'adverse') hit = b.state;
    }
    expect(hit).not.toBeNull();
    const run = hit!.activeRun!;
    expect(run.stage).toBe('adapt');
    expect(run.history[0].explanation.join(' ')).toMatch(/moved on/);
  });

  it('a JSON round trip mid-run then deciding gives the same result as deciding directly (no reroll)', () => {
    const s0 = startRun(makeState({ rngState: 31337 }), 'ms_occupancy', ['A', 'B']);
    const first = decideView(s0, 'ms_gather').state;
    const reloaded = JSON.parse(JSON.stringify(first)) as GameState;
    expect(reloaded).toEqual(first);
    const act = (s: GameState) => {
      const run = s.activeRun!;
      const id = run.stage === 'assess' ? 'ms_contact' : 'ms_perimeter_watch';
      return decideView(s, id).state;
    };
    const direct = act(first);
    const viaSave = act(reloaded);
    expect(viaSave).toEqual(direct);
    const a = direct.activeRun!.history;
    expect(a[a.length - 1].sample).toBe(viaSave.activeRun!.history[a.length - 1].sample);
    // The first decision's stored sample and band are untouched by later play.
    expect(direct.activeRun!.history[0]).toEqual(first.activeRun!.history[0]);
    // Reading views never consumes randomness.
    const rng = first.activeRun!.rngState;
    actionViews(first, NOW, 'A');
    previewAction(first, NOW, 'ms_contact', ['A'], []);
    expect(first.activeRun!.rngState).toBe(rng);
  });

  it('every decision stores its inputs, sample, band and explanation, and bumps the revision', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    const r = decideView(s, 'ms_contact').state.activeRun!;
    const h = r.history[0];
    expect(r.revision).toBe(1);
    expect(h.revision).toBe(0);
    expect(h.sample).toBeGreaterThanOrEqual(0);
    expect(h.sample).toBeLessThan(1);
    expect(h.inputs.length).toBeGreaterThan(3);
    expect(h.inputs.reduce((t, c) => t + c.value, 0)).toBeCloseTo(h.score - h.difficulty, 0);
    expect(h.explanation.length).toBeGreaterThan(2);
    expect(h.officerIds).toContain('off_chen');
    expect(h.targetId).toBe('bedroom_e');
    expect(Object.keys(h.stressDeltas)).toHaveLength(4);
    expect(h.itemsConsumed.some((c) => c.itemId === 'throw_phone')).toBe(true);
    expect(h.explanation.join(' ')).not.toMatch(/f_occ_e|ms_contact/); // player language, no internal ids
  });
});

describe('recovery (acceptance 10)', () => {
  const tired = (): GameState => {
    const s = makeState();
    s.officers.off_ortiz.stress = 85;
    return s;
  };

  it('an officer in mandatory recovery blocks a real deployment with a reason', () => {
    const s = tired();
    const r = apply(s, startCmd('ms_occupancy', ['A']));
    expect(r.result.ok).toBe(false);
    if (!r.result.ok) expect(r.result.reason).toBe('Squad A: Ortiz is in mandatory recovery');
    const card = scenarioCards(s, NOW)[0];
    expect(card.eligibleSquadIds).toEqual(['B']);
    expect(prepCheck(s, NOW, startCmd('ms_occupancy', ['A'])).issues[0]).toMatch(/mandatory recovery/);
    // Squad B can still deploy.
    expect(apply(s, startCmd('ms_occupancy', ['B'])).result.ok).toBe(true);
  });

  it('does not take an officer who is in training', () => {
    const s = makeState();
    s.officers.off_park.assignment = { kind: 'training', courseId: 'c1', startedAt: NOW, endsAt: NOW + 1000 };
    const r = apply(s, startCmd('ms_occupancy', ['B']));
    expect(r.result.ok).toBe(false);
    expect(s.officers.off_park.assignment?.kind).toBe('training');
  });

  it('strain from play accumulates onto officers and survives the debrief', () => {
    const start = startRun(makeState(), 'ms_occupancy', ['A']);
    const done = playPolicy(start, { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_handover'] });
    const stressed = Object.values(done.state.officers).filter((o) => o.stress > 0);
    expect(stressed.length).toBeGreaterThan(0);
    for (const oc of done.debrief.officerCondition) {
      expect(done.state.officers[oc.officerId].stress).toBe(oc.stressAfter);
      expect(oc.stressAfter).toBeGreaterThanOrEqual(oc.stressBefore - 3);
      expect(done.state.officers[oc.officerId].xp).toBe(oc.xpGained);
    }
  });
});

describe('debrief', () => {
  it('has separate results for objective, civilian safety, officers, information, resources, trust and causes', () => {
    const start = startRun(makeState(), 'ms_occupancy', ['A']);
    const s = playPolicy(start, { assess: ['ms_gather'], adapt: ['ms_preserve_time'], resolve: ['ms_controlled_entry'] }, 'A');
    const d = s.debrief;
    expect(d.objective.label).toBeTruthy();
    expect(d.civilianSafety.label).toBeTruthy();
    expect(d.officerCondition).toHaveLength(4);
    expect(d.informationPreserved.map((f) => f.factId)).toEqual(['f_occ_e', 'f_second']);
    expect(d.resources.length).toBeGreaterThan(0);
    expect(typeof d.trustDelta).toBe('number');
    expect(d.causes.length).toBeGreaterThan(0);
    expect(d.causes.join(' ')).not.toMatch(/ms_|f_occ|f_second/);
  });

  it('is available as pendingDebrief only while the run is in debrief, and does not mutate', () => {
    const s = startRun(makeState(), 'ms_occupancy', ['A']);
    expect(pendingDebrief(s)).toBeNull();
    let cur = s;
    for (let i = 0; i < 6 && cur.activeRun!.status === 'active'; i++) {
      const v = actionViews(cur, NOW, 'A').find((x) => x.eligible)!;
      cur = apply(cur, { type: 'decide', actionId: v.id, actingSquadIds: v.actingSquadIds, supportSquadIds: v.supportSquadIds }).state;
    }
    const snapshot = JSON.stringify(cur);
    const d = pendingDebrief(cur)!;
    expect(d.runId).toBe(cur.activeRun!.id);
    expect(JSON.stringify(cur)).toBe(snapshot);
    expect(actionViews(cur, NOW, 'A')).toEqual([]);
    expect(stageProgress(cur).stage).toBe('debrief');
  });

  it('restraint pays: a calm exit outranks a forced entry on trust and civilian safety', () => {
    const start = seedFor('ms_occupancy', ['A'], 'ms_contact', 'favorable');
    const talk = playPolicy(start, { assess: ['ms_contact'], adapt: ['ms_perimeter_watch', 'ms_preserve_time'], resolve: ['ms_negotiated_exit', 'ms_handover'] });
    const force = playPolicy(start, { assess: ['ms_contact'], adapt: ['ms_perimeter_watch', 'ms_preserve_time'], resolve: ['ms_controlled_entry'] });
    expect(talk.debrief.civilianSafety.score).toBeGreaterThanOrEqual(force.debrief.civilianSafety.score);
    expect(talk.debrief.trustDelta).toBeGreaterThanOrEqual(force.debrief.trustDelta);
  });
});

describe('through dispatch', () => {
  it('start, decide, finish and close work through the real dispatcher', () => {
    let s = makeState();
    const run = (cmd: Parameters<typeof dispatch>[1]) => {
      const r = dispatch(s, cmd, { now: NOW });
      expect(r.result).toEqual({ ok: true });
      s = r.state;
    };
    run(startCmd('ms_occupancy', ['A']));
    expect(s.activeRun).not.toBeNull();
    for (let i = 0; i < 6 && s.activeRun!.status === 'active'; i++) {
      const v = actionViews(s, NOW, 'A').find((x) => x.eligible)!;
      run({ type: 'decide', actionId: v.id, actingSquadIds: v.actingSquadIds, supportSquadIds: v.supportSquadIds });
    }
    expect(s.activeRun!.status).toBe('debrief');
    run({ type: 'closeDebrief' });
    expect(s.activeRun).toBeNull();
    expect(s.debriefs).toHaveLength(1);
  });
});
