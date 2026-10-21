import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../content/call-trees';
import { drawCalls, playToEnd, POLICIES, type Policy } from '../gen/incident/trees-v13/balance';
import { serviceEarned } from './department-level';
import { completionEvidence } from './external-support';
import { apply } from './test-fixtures';
import { computeDebrief, outcomeFactor, traceRun } from './operation';
import { dispositionOf, endStates, forceLines, OUTCOME_SCORE_V1, scoreCall, scoreFrom, type PersonEnd, type ScoreInputs } from './outcome-score';
import { deserialize, serialize } from './save';
import { getScenario } from './scenario-registry';
import type { IncidentType } from './scenario-types';
import type { CompletionDisposition, GameState } from './types';
import { INCIDENT_TEMPLATES } from '../content/incidents';

// The score is measured on the calls with no gauge that fills: the audience shift is recorded apart
// (fill-clocks.test.ts). Left out here before anything compiles, so every run below plays without them.
for (const template of Object.values(INCIDENT_TEMPLATES)) for (const situation of template!.situations) {
  if (situation.clocks) situation.clocks = situation.clocks.filter((clock) => clock.direction !== 'fill');
}

// M2 slice 4 (docs/incident-domain-model.md §9): a v13 call is scored from people's end states in
// priority-of-life order, the force used, commitments and time. The weights replaced hand-set
// numbers on the four call trees' endings; those numbers are kept here as the fixture the weights
// were calibrated against. The gate below plays real calls and checks the score still ranks the
// endings the way the hand-set numbers did (see "ranks the endings").

/** The hand-set [trust, strain, disposition] each ending carried before OUTCOME_SCORE_V1, as authored
 * in content/call-trees on 2026-10-07. The trust and strain are retired from the trees; the
 * disposition is still authored there and must agree with the scored one. */
const AUTHORED: Partial<Record<IncidentType, Record<string, [trust: number, strain: number, disposition: CompletionDisposition]>>> = {
  hostage_crisis: { everyone_out: [3, -2, 'resolved'], out_the_back: [3, -2, 'resolved'], out_by_dawn: [2, 1, 'resolved'], entry_clean: [0, 2, 'resolved'], entry_hurt: [-2, 4, 'resolved'], owner_collapsed: [-2, 4, 'relief_partial'], owner_beaten: [-4, 6, 'relief_partial'], owner_killed: [-6, 9, 'relief_partial'], taker_held: [1, 1, 'relief_partial'], held_inside: [-2, 3, 'relief_partial'], held_both: [-3, 4, 'relief_partial'], handed_over: [-2, 3, 'unresolved'],
    // Endings the slice 5 pilot added never had hand-set numbers (docs/calls/hostage-signature-design.md).
    // Each row is the closest retired ending's: the group's ends are the surrender's, the collapsed
    // owner's entries are entry_hurt's and the barricade's subject_shot, the owner left down is held
    // inside with the owner hurt (held_both_down is held_both with the owner hurt), and a death with
    // the taker hurt is owner_killed's.
    group_out: [3, -2, 'resolved'], group_out_dawn: [2, 1, 'resolved'], stayers_held: [1, 1, 'relief_partial'],
    went_in_for_owner: [-2, 4, 'resolved'], went_in_taker_hurt: [-4, 7, 'resolved'], owner_left_down: [-3, 5, 'relief_partial'], held_both_down: [-4, 6, 'relief_partial'], owner_killed_taker_hurt: [-6, 9, 'relief_partial'] },
  // Everything Goes Back (docs/calls/barricade-design.md) replaced Behind the Bathroom Door; each row is
  // the closest retired barricade ending's: the walk-outs are everyone_out's, out after a long night is
  // out_by_morning's, the mover out and the subject inside is son_out_held's, the mover held (in the
  // closet or found in the room) is held_with_son's, the mover hurt in the entry is entry_son_hurt's,
  // and the subject hurt by force is subject_shot's.
  barricaded: { everyone_out: [3, -2, 'resolved'], walked_them_out: [3, -2, 'resolved'], out_after_dark: [2, 1, 'resolved'], mover_out_held: [1, 1, 'relief_partial'], held_with_mover: [-3, 4, 'relief_partial'], held_found: [-3, 4, 'relief_partial'], entry_clean: [0, 2, 'resolved'], entry_subject_hurt: [-2, 4, 'resolved'], entry_mover_hurt: [-3, 5, 'resolved'], subject_hurt_force: [-4, 7, 'resolved'], handed_over: [-2, 3, 'unresolved'] },
  active_armed_incident: { everyone_out: [3, -1, 'resolved'], out_by_morning: [2, 1, 'resolved'], taken: [1, 2, 'resolved'], subject_shot: [-2, 4, 'resolved'], subject_killed: [-4, 7, 'resolved'], worker_hurt: [-2, 4, 'resolved'], worker_killed: [-6, 9, 'relief_partial'], held_inside: [-3, 5, 'relief_partial'], alone_inside: [1, 2, 'relief_partial'], handed_over: [-2, 3, 'unresolved'] },
  protected_rescue: { out_together: [3, -1, 'resolved'], slow_out: [2, 1, 'resolved'], out_carried: [1, 2, 'resolved'], out_without_chair: [0, 2, 'resolved'], resident_hurt: [-2, 4, 'resolved'], resident_killed: [-6, 9, 'relief_partial'], tank_ran_out: [-6, 9, 'relief_partial'], still_inside: [-1, 3, 'relief_partial'], handed_over: [-2, 3, 'unresolved'] },
};

/** Endings whose scored disposition may differ from the authored one, each with the reason. None today. */
const DISPOSITION_EXCEPTIONS: Record<string, string> = {};

const person = (group: PersonEnd['group'], state: PersonEnd['state'], severity?: PersonEnd['severity'], id = `${group}_${state}`): PersonEnd =>
  ({ id, label: id, group, state, ...(severity ? { severity } : {}) });
const inputs = (patch: Partial<ScoreInputs>): ScoreInputs => ({ people: [], force: [], entries: 0, commitments: [], minutes: 20, objective: 60, ranOut: false, ...patch });
const sum = (values: number[]) => Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;

describe('the weights (OUTCOME_SCORE_V1)', () => {
  const W = OUTCOME_SCORE_V1;
  it('put lives in priority order, however many civilians the call has', () => {
    for (let civilians = 1; civilians <= 8; civilians++) {
      // A civilian hurt or killed loses their share of the everyone-out credit and costs their own weight.
      const lost = (weight: number) => W.everyoneOut[0] / civilians - weight;
      for (const severity of ['wounded', 'serious'] as const) {
        for (const group of ['held', 'trapped', 'bystander'] as const) expect(lost(W.civilian[group][severity][0]), `${group} ${severity}, ${civilians} civilians`).toBeGreaterThan(-W.officer[severity][0]);
        expect(-W.officer[severity][0], severity).toBeGreaterThan(-W.subject[severity][0]);
      }
      for (const group of ['held', 'trapped', 'bystander'] as const) expect(lost(W.civilian[group].killed[0])).toBeGreaterThan(-W.subject.killed[0]);
    }
    for (const key of ['inside', 'wounded', 'serious', 'killed'] as const) {
      expect(W.civilian.held[key][0]).toBeLessThanOrEqual(W.civilian.trapped[key][0]);
      expect(W.civilian.trapped[key][0]).toBeLessThanOrEqual(W.civilian.bystander[key][0]);
    }
  });

  it('cost every life, a subject’s included, and cost a death more than an injury', () => {
    for (const group of ['held', 'trapped', 'bystander'] as const) {
      const w = W.civilian[group];
      expect(w.killed[0]).toBeLessThan(w.serious[0]);
      expect(w.serious[0]).toBeLessThan(w.wounded[0]);
      expect(w.wounded[0]).toBeLessThan(0);
    }
    expect(W.subject.killed[0]).toBeLessThan(W.subject.serious[0]);
    expect(W.subject.serious[0]).toBeLessThan(W.subject.wounded[0]);
    expect(W.subject.wounded[0]).toBeLessThan(0);
    expect(W.subject.in_hand).toEqual([0, 0]);
  });

  it('charge an entry once, and every firearm use whether or not it hit', () => {
    const base = scoreFrom(inputs({ people: [person('trapped', 'safe'), person('subject', 'in_hand')] }), 6);
    const entered = scoreFrom(inputs({ people: [person('trapped', 'safe'), person('subject', 'in_hand')], entries: 2 }), 6);
    expect(entered.lines.filter(line => line.key === 'force:entry')).toHaveLength(1);
    expect(entered.points).toBe(base.points + W.force.entry[0]);
    const missed = scoreFrom(inputs({ people: [person('trapped', 'safe'), person('subject', 'in_hand')],
      force: [{ personId: 'subject', label: 'Ash', profile: 'firearm', severity: 'none', revision: 1 }] }), 6);
    expect(missed.points).toBe(base.points + W.force.firearm[0]);
    expect(missed.lines.find(line => line.key.endsWith(':firearm'))!.text).toBe('The use of force on Ash goes to review.');
  });

  it('add up: the lines are the trust change and the strain at close', () => {
    const cases: ScoreInputs[] = [
      inputs({ people: [person('held', 'safe', undefined, 'a'), person('held', 'killed', undefined, 'b'), person('subject', 'in_hand'), person('officer', 'hurt', 'serious')], entries: 1, minutes: 80, objective: 15 }),
      inputs({ people: [person('trapped', 'inside'), person('subject', 'inside')], commitments: [{ personId: 's', label: 'Ash', status: 'broken' }] }),
      inputs({ people: [person('trapped', 'released'), person('subject', 'hurt', 'wounded')], commitments: [{ personId: 's', label: 'Ash', status: 'kept' }], objective: 100 }),
    ];
    for (const c of cases) for (const rewardsTrust of [4, 8, 13]) {
      const score = scoreFrom(c, rewardsTrust);
      expect(score.lines[0].key).toBe('result');
      expect(sum(score.lines.map(line => line.trust))).toBe(score.trust);
      expect(sum(score.lines.slice(1).map(line => line.trust))).toBe(score.points);
      expect(sum(score.lines.map(line => line.strain))).toBe(score.strain);
      expect(Number.isInteger(score.trust)).toBe(true);
    }
  });

  it('weigh a lie apart from a kept word: one found out costs more than a broken promise, one that held earns nothing', () => {
    const W = OUTCOME_SCORE_V1;
    const base = [person('trapped', 'safe'), person('subject', 'in_hand')];
    const found = scoreFrom(inputs({ people: base, commitments: [{ personId: 's', label: 'Ash', kind: 'lie', status: 'broken' }] }), 8);
    const held = scoreFrom(inputs({ people: base, commitments: [{ personId: 's', label: 'Ash', kind: 'lie', status: 'kept' }] }), 8);
    const kept = scoreFrom(inputs({ people: base, commitments: [{ personId: 's', label: 'Ash', status: 'kept' }] }), 8);
    expect(found.lines.find(line => line.key.endsWith('lie-found'))?.text).toBe('Ash found out the team lied.');
    expect(held.lines.find(line => line.key.endsWith('lie-held'))?.text).toBe('The lie told to Ash held.');
    expect(W.commitments.lieFound[0]).toBeLessThan(W.commitments.broken[0]);
    expect(found.points).toBeLessThan(held.points);
    expect(held.points).toBeLessThan(kept.points);
  });

  it('set the disposition from end states, never from the ending', () => {
    expect(dispositionOf({ people: [person('held', 'safe'), person('subject', 'in_hand')], ranOut: false })).toBe('resolved');
    expect(dispositionOf({ people: [person('held', 'hurt', 'serious'), person('subject', 'killed')], ranOut: false })).toBe('resolved');
    expect(dispositionOf({ people: [person('held', 'killed'), person('subject', 'in_hand')], ranOut: false })).toBe('relief_partial');
    expect(dispositionOf({ people: [person('trapped', 'inside'), person('subject', 'in_hand')], ranOut: false })).toBe('relief_partial');
    expect(dispositionOf({ people: [person('trapped', 'safe'), person('subject', 'inside')], ranOut: false })).toBe('relief_partial');
    expect(dispositionOf({ people: [person('trapped', 'safe'), person('subject', 'fled')], ranOut: false })).toBe('relief_partial');
    expect(dispositionOf({ people: [person('trapped', 'safe'), person('officer', 'hurt', 'serious')], ranOut: false })).toBe('resolved');
    expect(dispositionOf({ people: [person('trapped', 'safe')], ranOut: true })).toBe('unresolved');
  });

  it('keep the rewards factor between 0 and 1, and below full settlement while the call is unfinished', () => {
    const best = scoreFrom(inputs({ people: [person('trapped', 'safe'), person('subject', 'in_hand')], objective: 100, commitments: [{ personId: 's', label: 'Ash', status: 'kept' }] }), 8);
    expect(best.factor).toBeLessThanOrEqual(1);
    const worst = scoreFrom(inputs({ people: [person('held', 'killed', undefined, 'a'), person('held', 'killed', undefined, 'b'), person('officer', 'hurt', 'serious'), person('subject', 'killed')], entries: 1, minutes: 200, objective: 0 }), 8);
    expect(worst.factor).toBeGreaterThanOrEqual(0);
    const partial = scoreFrom(inputs({ people: [person('trapped', 'safe'), person('subject', 'inside')], objective: 100 }), 8);
    expect(partial.factor).toBeLessThanOrEqual(OUTCOME_SCORE_V1.factor.unfinishedMax);
  });
});

/** Play `calls` drawn calls of every tree under every style, at tier 2, to their ends. */
function played(calls: number): { type: IncidentType; policy: Policy; state: GameState }[] {
  const out: { type: IncidentType; policy: Policy; state: GameState }[] = [];
  for (const type of Object.keys(CALL_TREES) as IncidentType[])
    for (const { scenarioId, seed } of drawCalls(CALL_TREES[type]!, 2, calls))
      for (const policy of POLICIES) out.push({ type, policy, state: playToEnd(scenarioId, policy, seed) });
  return out;
}

describe('scoring real calls', () => {
  const runs = played(12).filter(entry => entry.state.activeRun?.endingId);

  it('reads each person’s end state from the run: civilians, subjects inside, officers hurt; nobody outside from the start', () => {
    for (const { state } of runs) {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      const ends = endStates(scenario, run, { officers: state.officers });
      const ids = ends.map(end => end.id);
      for (const civilian of scenario.civilianOutcomes ?? []) expect(ids).toContain(civilian.id);
      for (const subject of (scenario.incidentPeople ?? []).filter(entry => entry.kind === 'subject')) expect(ids).toContain(subject.id);
      // A reporting party with patrol, and a subject offsite, are never scored.
      for (const id of ['ex', 'neighbor']) expect(ids).not.toContain(id);
      if (scenario.incident?.type === 'protected_rescue') expect(ids).not.toContain('shooter');
      for (const end of ends) {
        const casualty = run.personCasualties?.[end.id];
        const out = run.flags.includes(`out:${end.id}`) || run.flags.includes(`safe:${end.id}`);
        if (end.group === 'officer') { expect(run.officerCasualties?.[end.id]?.severity).toBe(end.severity); continue; }
        if (casualty?.severity === 'fatal') expect(end.state).toBe('killed');
        else if (casualty && out) expect(end).toMatchObject({ state: 'hurt', severity: casualty.severity });
        else if (out) expect(['safe', 'released', 'in_hand']).toContain(end.state);
        else expect(end.state).toBe('inside');
      }
    }
  });

  it('writes plain lines: no dashes, no colons, curly apostrophes', () => {
    for (const { state } of runs) {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      const texts = [...scoreCall(scenario, run, { officers: state.officers }).lines.map(line => line.text), ...forceLines(scenario, run).map(line => line.text)];
      for (const text of texts) {
        expect(text, text).not.toMatch(/[—–:']|\s-\s|\{|\}/);
        expect(text, text).toMatch(/^[A-Z].*\.$/);
      }
    }
  });

  it('is deterministic', () => {
    for (const { state } of runs.slice(0, 20)) {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      expect(scoreCall(scenario, structuredClone(run), { officers: state.officers })).toEqual(scoreCall(scenario, run, { officers: state.officers }));
    }
  });
});

describe('calibration against the retired hand-set numbers', () => {
  const runs = played(15).filter(entry => entry.state.activeRun?.endingId);
  const rows = runs.map(({ type, state }) => {
    const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
    const score = scoreCall(scenario, run, { officers: state.officers, steps: traceRun(scenario, run).steps });
    // Commitments are new with the score, so the hand-set numbers never saw them.
    const commitments = score.lines.filter(line => line.key.startsWith('commitment:'));
    return { type, ending: run.endingId!, authored: AUTHORED[type]![run.endingId!], score, state, scenario,
      points: score.points - sum(commitments.map(line => line.trust)), strain: score.strain - sum(commitments.map(line => line.strain)) };
  });

  // The calibration is measured at zero dither: the shift at each timer setting is recorded apart,
  // in dither-balance.test.ts.
  it('plays at zero dither', () => {
    for (const row of rows) expect(row.state.activeRun!.history.filter(decision => decision.ditherMinutes), row.type).toEqual([]);
    // ...and with no gauge that fills (fill-clocks.test.ts records the audience shift apart).
    for (const row of rows) expect(row.state.activeRun!.fillPeak, row.type).toBeUndefined();
  });

  it('every ending a call reaches is in the fixture', () => {
    for (const row of rows) expect(row.authored, `${row.type} ${row.ending}`).toBeDefined();
  });

  it('every scored disposition agrees with the authored one, or is listed with a reason', () => {
    const disagree = rows.filter(row => row.score.disposition !== row.authored[2] && !DISPOSITION_EXCEPTIONS[`${row.type}:${row.ending}`]);
    expect(disagree.map(row => `${row.type}:${row.ending} scored ${row.score.disposition}, authored ${row.authored[2]}`)).toEqual([]);
  });

  // The hand-set numbers are one value per ending, set on 2026-10-07 for content that has since been
  // rewritten; the score reads each run's own end states, force and minutes, so one ending reached by
  // different paths scores differently, as it should. A distance from those values (the old trust MAE
  // gate, fit at 0.48) measures how far the content has moved, not whether the score is right: it rose
  // past its ceiling on content changes alone (sidearms, the depth pilot, the conflict rebuild) while
  // the weights stood still. What the hand-set numbers do carry is the designer's ranking of outcomes,
  // so that is what holds the score. The weights' own direction (lives in order, a death above an
  // injury, force and lies priced) is pinned above, and the economy test below pins the overall level.
  //
  // Endings the fixture puts close together are not ranked. Its values are whole points set per ending,
  // and the pilot's rows were copied from the nearest retired ending, so a gap of one or two points
  // records no judgment between those two endings. Measured 2026-10-20 with this sample: every pair
  // three or more apart agrees, and every disagreement is one or two apart on one to three plays.
  const SEPARATED = 3;
  it('ranks the endings the way the hand-set numbers did, wherever those numbers clearly separate them', () => {
    const misranked: string[] = [];
    for (const type of new Set(rows.map(row => row.type))) {
      const byEnding = new Map<string, { authored: (typeof rows)[number]['authored']; trust: number[]; strain: number[] }>();
      for (const row of rows.filter(entry => entry.type === type)) {
        const entry = byEnding.get(row.ending) ?? byEnding.set(row.ending, { authored: row.authored, trust: [], strain: [] }).get(row.ending)!;
        entry.trust.push(row.points);
        entry.strain.push(row.strain);
      }
      const ends = [...byEnding].map(([ending, entry]) => ({ ending, authored: entry.authored, trust: sum(entry.trust) / entry.trust.length, strain: sum(entry.strain) / entry.strain.length }));
      for (const [i, a] of ends.entries()) for (const b of ends.slice(i + 1)) {
        // Trust: higher is better. Strain: higher is heavier. Either way the order must hold.
        for (const [axis, at, scored] of [['trust', 0, 'trust'], ['strain', 1, 'strain']] as const) {
          const gap = a.authored[at] - b.authored[at];
          if (Math.abs(gap) < SEPARATED) continue;
          if (Math.sign(a[scored] - b[scored]) !== Math.sign(gap))
            misranked.push(`${type} ${axis}: ${a.ending} (set ${a.authored[at]}, scored ${a[scored].toFixed(2)}) vs ${b.ending} (set ${b.authored[at]}, scored ${b[scored].toFixed(2)})`);
        }
      }
    }
    expect(misranked).toEqual([]);
  });

  it('keeps the department economy where the hand-set numbers had it', () => {
    let oldTrust = 0, newTrust = 0, oldFunding = 0, newFunding = 0;
    for (const row of rows) {
      const run = row.state.activeRun!, rewards = row.scenario.rewards;
      const ending = row.scenario.endings[row.ending];
      const evidence = completionEvidence(row.scenario, run, ending);
      const factor = evidence.completionAchieved ? outcomeFactor(run) : Math.min(0.65, outcomeFactor(run));
      oldTrust += Math.round(rewards.trust * (2 * factor - 1)) + row.authored[0];
      newTrust += row.score.trust;
      oldFunding += Math.round(rewards.funding * (0.4 + 0.6 * factor));
      newFunding += Math.round(rewards.funding * (0.4 + 0.6 * row.score.factor));
    }
    expect(Math.abs(newTrust - oldTrust) / rows.length, 'mean trust per call').toBeLessThanOrEqual(1);
    expect(Math.abs(newFunding / oldFunding - 1), 'funding').toBeLessThanOrEqual(0.05);
  });
});

describe('the v13 debrief', () => {
  const runs = played(4).filter(entry => entry.state.activeRun?.endingId);

  it('takes its disposition, trust, strain and rewards from the score, and shows every line', () => {
    for (const { state } of runs) {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      const score = scoreCall(scenario, run, { officers: state.officers, steps: traceRun(scenario, run).steps });
      const debrief = computeDebrief(state, run)!;
      expect(debrief.disposition).toBe(score.disposition);
      expect(debrief.completionAchieved).toBe(score.disposition === 'resolved');
      expect(debrief.scoreLines).toEqual(score.lines);
      expect(debrief.trustDelta).toBe(Math.max(0, Math.min(100, state.department.trust + score.trust)) - state.department.trust);
      expect(debrief.fundingReward).toBe(Math.round(scenario.rewards.funding * (0.4 + 0.6 * score.factor)));
      for (const officer of debrief.officerCondition)
        expect(officer.stressAfter).toBe(Math.max(0, Math.min(100, Math.round((state.officers[officer.officerId].stress + score.strain) * 10) / 10)));
      if (debrief.serviceEarned !== undefined) expect(debrief.serviceEarned).toBe(serviceEarned({ completed: score.disposition === 'resolved', failed: false }, scenario.incident?.tier ?? 1));
    }
  });

  it('says which force the team used, on whom, and why', () => {
    const forced = played(10).filter(({ state }) => state.activeRun?.history.some(decision => decision.committed?.drawn?.some(record => record.model === 'team_force')));
    expect(forced.length).toBeGreaterThan(0);
    for (const { state } of forced) {
      const run = state.activeRun!, scenario = getScenario(run.scenarioId)!;
      const records = run.history.flatMap(decision => decision.committed?.drawn ?? []).filter(record => record.model === 'team_force');
      const lines = computeDebrief(state, run)!.forceLines!;
      expect(lines).toHaveLength(records.length);
      records.forEach((record, index) => {
        expect(lines[index].text).toContain(scenario.story!.bindings.people[record.personId].label);
        expect(lines[index].reason).toBe(record.reason);
      });
    }
  }, 60_000);

  it('saves and loads with the score and force lines', () => {
    for (const { state } of runs.slice(0, 12)) {
      const closed = apply(state, { type: 'closeDebrief' }).state;
      expect(closed.activeRun).toBeNull();
      const loaded = deserialize(serialize(closed, 1));
      expect(loaded, closed.debriefs[0].scenarioId).not.toBeNull();
      expect(loaded!.debriefs[0].scoreLines).toEqual(closed.debriefs[0].scoreLines);
    }
  });
});
