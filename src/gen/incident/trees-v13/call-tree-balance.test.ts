import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import type { IncidentType } from '../../../sim/scenario-types';
import { measure, type Distribution } from './balance';

// The balance gate (docs/call-trees-v13.md, "Balance"). Every call is played through the real
// engine with real dice and a different day-one squad each time, at tier 2, under four player
// styles. The dice and squads come from fixed seeds, so these numbers are exact for the content
// as written: a change that makes the game softer or crueler fails here and has to be argued.
//
// The target, per call, for an average player (the random style): about a third clean, a third
// resolved at a cost, the rest unresolved, hurt or dead. Someone dies in a few percent of calls,
// most of them armed incidents. Waiting is safe only when it should be, and so is rushing.

const tree = (type: IncidentType) => CALL_TREES[type]!;
const harm = (d: Distribution) => d.weights.hurt + d.weights.death;
const bad = (d: Distribution) => d.weights.unresolved + harm(d);
const CALLS = 60;

describe('call tree balance (tier 2, day-one squads)', () => {
  const bands: Record<string, { harm: [number, number]; death: [number, number] }> = {
    hostage_crisis: { harm: [0.03, 0.3], death: [0, 0.08] },
    barricaded: { harm: [0.01, 0.3], death: [0, 0.08] },
    active_armed_incident: { harm: [0.15, 0.55], death: [0.01, 0.16] },
    protected_rescue: { harm: [0.1, 0.5], death: [0, 0.12] },
  };
  for (const [type, band] of Object.entries(bands)) it(`${type}: an average player meets real consequences, not ruin`, () => {
    const d = measure(tree(type as IncidentType), 2, 'random', CALLS);
    expect(d.weights.clean, 'clean endings').toBeGreaterThanOrEqual(0.15);
    expect(d.weights.clean, 'clean endings').toBeLessThanOrEqual(0.6);
    expect(bad(d), 'unresolved, hurt or dead').toBeGreaterThanOrEqual(0.15);
    expect(bad(d), 'unresolved, hurt or dead').toBeLessThanOrEqual(0.65);
    expect(harm(d), 'someone hurt or killed').toBeGreaterThanOrEqual(band.harm[0]);
    expect(harm(d), 'someone hurt or killed').toBeLessThanOrEqual(band.harm[1]);
    expect(d.weights.death, 'someone killed').toBeGreaterThanOrEqual(band.death[0]);
    expect(d.weights.death, 'someone killed').toBeLessThanOrEqual(band.death[1]);
  }, 300000);

  it('rushing an armed man hurts officers; waiting him out does not', () => {
    const fast = measure(tree('active_armed_incident'), 2, 'fast', CALLS);
    const patient = measure(tree('active_armed_incident'), 2, 'patient', CALLS);
    expect(fast.officerHurtRate).toBeGreaterThanOrEqual(0.25);
    expect(patient.officerHurtRate).toBeLessThanOrEqual(0.05);
    // Waiting is not free either: when her door is splitting, the wait is what kills her.
    expect(harm(patient)).toBeGreaterThanOrEqual(0.05);
  }, 300000);

  it('waiting out a rescue costs the resident when their oxygen is short', () => {
    const patient = measure(tree('protected_rescue'), 2, 'patient', CALLS);
    expect(harm(patient)).toBeGreaterThanOrEqual(0.15);
  }, 300000);

  it('no style of play guarantees a clean ending', () => {
    for (const type of Object.keys(CALL_TREES) as IncidentType[]) {
      const careful = measure(tree(type), 2, 'best_odds', 40);
      expect(careful.weights.clean, type).toBeLessThanOrEqual(0.75);
    }
  }, 300000);
});
