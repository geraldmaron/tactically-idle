import { describe, expect, it } from 'vitest';
import * as operation from './operation';
import { CAREER_TUNING, debriefBand } from './career';
import { METERS_V1, stanceOf, type RunMeters } from './meters';
import { OUTCOME_SCORE_V1 } from './outcome-score';
import { builtFor, evaluateAction, RESOLUTION_TUNING, riskBand, strainFor } from './resolution';
import { scenarioActions } from './scenario-types';
import { SCENARIOS } from '../content/scenarios';
import { apply, makeState, setRun, startRun } from './test-fixtures';
import { withTuning } from './tuning';
import type { GameState, SquadId } from './types';

// Spec 7.3: numbers that lived as literals moved into tuning tables, behavior unchanged. Each table
// holds the old literal, and each reader both matches the old code and follows a patch.

describe('riskBand thresholds (RESOLUTION_TUNING.riskBands)', () => {
  const before = (p: number) => p >= 0.62 ? 'low' : p >= 0.42 ? 'moderate' : p >= 0.22 ? 'high' : 'severe';
  it('hold the old literals and label every chance as before', () => {
    expect(RESOLUTION_TUNING.riskBands).toEqual({ lowAt: 0.62, moderateAt: 0.42, highAt: 0.22 });
    for (let i = 0; i <= 1000; i++) expect(riskBand(i / 1000)).toBe(before(i / 1000));
  });
  it('follow a patch', () => {
    withTuning({ RESOLUTION_TUNING: { riskBands: { lowAt: 0.9 } } }, () => expect(riskBand(0.8)).toBe('moderate'));
    expect(riskBand(0.8)).toBe('low');
  });
});

describe('stance thresholds (METERS_V1.stance)', () => {
  const before = (m: RunMeters) => !Object.keys(m.moved).length ? 'unheard' : m.agitation >= 80 ? 'breaking'
    : m.rapport >= 50 && m.agitation < 50 ? 'yielding' : m.agitation >= 60 ? 'volatile' : m.agitation >= 30 ? 'tense' : 'calm';
  it('hold the old literals and read every meter as before', () => {
    expect(METERS_V1.stance).toEqual({ breakingAgitation: 80, yieldingRapport: 50, yieldingAgitationBelow: 50, volatileAgitation: 60, tenseAgitation: 30 });
    for (let agitation = 0; agitation <= 100; agitation += 2.5) for (let rapport = 0; rapport <= 100; rapport += 2.5) for (const moved of [{}, { heard: { agitation: -6, rapport: 10 } }]) {
      const meters = { agitation, rapport, moved };
      expect(stanceOf(meters)).toBe(before(meters));
    }
  });
  it('follow a patch', () => {
    const meters = { agitation: 70, rapport: 0, moved: { provoked: { agitation: 10, rapport: -8 } } };
    expect(stanceOf(meters)).toBe('volatile');
    withTuning({ METERS_V1: { stance: { breakingAgitation: 70 } } }, () => expect(stanceOf(meters)).toBe('breaking'));
  });
});

describe('strain weights (RESOLUTION_TUNING.strain)', () => {
  it('hold the old literals', () => {
    expect(RESOLUTION_TUNING.strain).toEqual({ participant: 1, lead: 1.5, actingSquad: 0.5, supportSquad: 0.6, bystander: 0.25, pressureComposure: 1.2, steadyTrait: 0.75, rookieWithMentor: 0.85 });
  });
  it('are what strainFor reads', () => {
    const occ = SCENARIOS.ms_occupancy;
    const s = setRun(startRun(makeState(), 'ms_occupancy', ['A', 'B']), { stage: 'assess', pressure: 70 });
    const run = s.activeRun!;
    const action = scenarioActions(occ).find(entry => entry.id === 'ms_gather')!;
    const input = { state: s, run, scenario: occ, action, built: builtFor(run.locationFamilyId, run.locationSeed, run.flags), acting: ['A'] as SquadId[], support: [] as SquadId[] };
    const ev = evaluateAction(input);
    const strain = (patch = {}) => withTuning(patch, () => strainFor(input, ev, 'mixed'));
    const base = strain();
    const squadB = s.squads.find(squad => squad.id === 'B')!.officerIds;
    // Squad B neither acts nor supports: its officers are bystanders.
    expect(squadB.every(id => base[id] > 0)).toBe(true);
    const none = strain({ RESOLUTION_TUNING: { strain: { bystander: 0 } } });
    expect(squadB.every(id => none[id] === 0)).toBe(true);
    // The lead carries the lead share; everyone else taking part carries the participant share.
    const [lead, ...rest] = ev.participantIds;
    const doubled = strain({ RESOLUTION_TUNING: { strain: { participant: 2 } } });
    for (const id of rest) expect(doubled[id]).toBeCloseTo(2 * base[id], 0);
    const leadDoubled = strain({ RESOLUTION_TUNING: { strain: { lead: 3 } } });
    expect(leadDoubled[lead]).toBeCloseTo(2 * base[lead], 0);
    const calm = strain({ RESOLUTION_TUNING: { strain: { pressureComposure: 0 } } });
    for (const id of ev.participantIds) expect(calm[id]).toBeLessThan(base[id]);
  });
});

describe('debrief weights (CAREER_TUNING.debriefWeights)', () => {
  const debrief = (objective: number, civilianSafety: number) => ({ objective: { score: objective }, civilianSafety: { score: civilianSafety } }) as Parameters<typeof debriefBand>[0];
  it('hold the old literals, and band debriefs and blend the outcome factor as before', () => {
    expect(CAREER_TUNING.debriefWeights).toEqual({ objective: 0.55, civilianSafety: 0.45 });
    for (let objective = 0; objective <= 100; objective += 5) for (let civilianSafety = 0; civilianSafety <= 100; civilianSafety += 5) {
      const f = (0.55 * objective + 0.45 * civilianSafety) / 100;
      expect(debriefBand(debrief(objective, civilianSafety))).toBe(f >= 0.6 ? 'favorable' : f < 0.4 ? 'adverse' : 'mixed');
      expect(operation.outcomeFactor({ objective, civilianSafety })).toBe(Math.max(0, Math.min(1, f)));
    }
  });
  it('follow a patch', () => {
    withTuning({ CAREER_TUNING: { debriefWeights: { objective: 1, civilianSafety: 0 } } }, () => {
      expect(debriefBand(debrief(90, 0))).toBe('favorable');
      expect(operation.outcomeFactor({ objective: 90, civilianSafety: 0 })).toBe(0.9);
    });
    expect(debriefBand(debrief(90, 0))).toBe('mixed');
  });
});

describe('career thresholds (CAREER_TUNING.favorableAt, adverseBelow)', () => {
  it('hold the old literals, and operation.ts no longer keeps its own copy', () => {
    expect(CAREER_TUNING.favorableAt).toBe(0.6);
    expect(CAREER_TUNING.adverseBelow).toBe(0.4);
    expect(operation).not.toHaveProperty('CAREER_FAVORABLE_AT');
    expect(operation).not.toHaveProperty('CAREER_ADVERSE_BELOW');
  });
  it('are what closing a debrief counts officers\' careers by', () => {
    // An authored call (v1) ending half done: factor 0.5, between the thresholds.
    const started = startRun(makeState(), 'ms_occupancy', ['A']);
    const ended: GameState = structuredClone(started);
    Object.assign(ended.activeRun!, { status: 'debrief', stage: 'debrief', endingId: 'peaceful_exit', objective: 50, civilianSafety: 50 });
    const officer = ended.squads.find(squad => squad.id === 'A')!.officerIds[0];
    const career = (patch = {}) => withTuning(patch, () => {
      const closed = apply(ended, { type: 'closeDebrief' });
      expect(closed.result).toEqual({ ok: true });
      const after = closed.state.officers[officer].career, before = ended.officers[officer].career;
      return { favorable: after.favorable - before.favorable, adverse: after.adverse - before.adverse };
    });
    expect(career()).toEqual({ favorable: 0, adverse: 0 });
    expect(career({ CAREER_TUNING: { favorableAt: 0.45 } })).toEqual({ favorable: 1, adverse: 0 });
    expect(career({ CAREER_TUNING: { adverseBelow: 0.55 } })).toEqual({ favorable: 0, adverse: 1 });
  });
});

describe('unfinished cap (OUTCOME_SCORE_V1.factor.unfinishedMax)', () => {
  it('holds the old literal, and operation.ts no longer keeps its own copy', () => {
    expect(OUTCOME_SCORE_V1.factor.unfinishedMax).toBe(0.65);
    expect(operation).not.toHaveProperty('INCOMPLETE_SERVICE_FACTOR_MAX');
  });
});
