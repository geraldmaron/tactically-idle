// "Player reads after" and "next step" against the engine: a forced preview lands where a forced step
// lands and reads the lines the frame shows after it; the exact next-step mix of each choice sums to
// one; the path chance is the product of the frames' natural chances, forced or not.
import { describe, expect, it } from 'vitest';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import { lastDecisionView } from '../../../sim/operation-selectors';
import type { OutcomeBand } from '../../../sim/types';
import { parseLabUrl } from '../url';
import { explore } from './explore';
import { aimsDrawn, compareSituations, nextStep, previewBand, sessionAt } from './next-step';
import { currentFrame, openSession, replayTokens, stepSession } from './session';
import type { Session } from './session';
import { BANDS, pathChance, whereIs, xrayChoices } from './xray';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
const TYPES = ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'] as const;

function openCall(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(`could not open ${query}: ${opened.message}`);
  return opened;
}

describe('nextStep', () => {
  for (const type of TYPES) {
    it(`sums to 1 for every root choice of ${type}`, () => {
      const s = openCall(`type=${type}`);
      for (const x of xrayChoices(s, s.frames[0], dependencyIndex(s.template))) {
        const mix = nextStep(x);
        expect(mix.length).toBeGreaterThan(0);
        expect(mix.reduce((sum, entry) => sum + entry.p, 0)).toBeCloseTo(1, 9);
        // Largest first, one entry per target.
        expect(mix.map(entry => entry.p)).toEqual([...mix.map(entry => entry.p)].sort((a, b) => b - a));
      }
    });
  }

  it('sums to 1 at hostage talking, where drawn results split some bands', () => {
    const s0 = openCall(REFERENCE);
    const s = replayTokens(s0, explore(s0.frames[0].state, { node: 'talking' }).path!);
    for (const x of xrayChoices(s, currentFrame(s), dependencyIndex(s.template)))
      expect(nextStep(x).reduce((sum, entry) => sum + entry.p, 0)).toBeCloseTo(1, 9);
  });
});

describe('previewBand', () => {
  const s = openCall(REFERENCE);
  const frame = s.frames[0];
  const rows = xrayChoices(s, frame, dependencyIndex(s.template));

  it('lands where a forced step lands and reads what the frame shows after it', () => {
    let checked = 0;
    for (const x of rows) for (const band of BANDS) {
      if (!x.bands[band].possible) continue;
      const preview = previewBand(s, frame, x.actionId, band)!;
      const stepped = stepSession(s, { kind: 'decide', actionId: x.actionId, band });
      if ('refused' in stepped) throw new Error(stepped.refused);
      const after = currentFrame(stepped).state;
      expect(preview.to).toEqual(whereIs(s, after));
      expect(preview.reads).toEqual(lastDecisionView(after)!.consequences);
      expect(preview.pBand).toBeCloseTo(x.view.likelihood[band], 12);
      if (!preview.ended) expect(preview.reads.some(line => line.startsWith('Next: '))).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('is null for a band the engine can\'t produce and for a choice not offered', () => {
    expect(previewBand(s, frame, 'not_a_choice', 'favorable')).toBeNull();
    const locked = rows.find(x => !x.view.eligible);
    if (locked) expect(previewBand(s, frame, locked.actionId, 'favorable')).toBeNull();
  });

  it('says which drawn result a forced band settled on, with the natural odds of each', () => {
    const t = openCall(REFERENCE);
    const talking = replayTokens(t, explore(t.frames[0].state, { node: 'talking' }).path!);
    const at = currentFrame(talking);
    const drawnRow = xrayChoices(talking, at, dependencyIndex(talking.template)).flatMap(x => BANDS.map(band => ({ x, band })))
      .find(({ x, band }) => x.bands[band].possible && x.bands[band].drawn.length > 0);
    if (!drawnRow) return;
    const preview = previewBand(talking, at, drawnRow.x.actionId, drawnRow.band as OutcomeBand)!;
    expect(preview.drawnFixed).not.toBeNull();
    expect(preview.drawnFixed!.natural.reduce((sum, result) => sum + result.p, 0)).toBeCloseTo(1, 6);
    expect(preview.drawnFixed!.natural.some(result => result.key === preview.drawnFixed!.key)).toBe(true);
  });

  it('steps from an earlier frame of the path, not only the last', () => {
    const view = frame.views.find(entry => entry.eligible)!;
    const one = stepSession(s, { kind: 'roll', actionId: view.id });
    if ('refused' in one) throw new Error(one.refused);
    expect(sessionAt(one, one.frames[0]).frames).toHaveLength(1);
    expect(previewBand(one, one.frames[0], view.id, 'favorable')?.to).toEqual(previewBand(s, frame, view.id, 'favorable')?.to);
  });

  it('reports whether the session aims drawn results (a boolean, never a throw)', () => {
    expect(typeof aimsDrawn()).toBe('boolean');
  });
});

describe('pathChance over a played path', () => {
  it('multiplies natural band chances, using the natural chance for forced bands', () => {
    let s = openCall(REFERENCE);
    const factors: number[] = [];
    for (const band of ['favorable', 'adverse'] as const) {
      const view = currentFrame(s).views.find(entry => entry.eligible)!;
      factors.push(view.likelihood[band]);
      const next = stepSession(s, { kind: 'decide', actionId: view.id, band });
      if ('refused' in next) throw new Error(next.refused);
      s = next;
    }
    const chance = pathChance(s);
    expect(chance.steps.map(step => step.pBand)).toEqual(factors);
    expect(chance.steps.every(step => step.forced)).toBe(true);
    expect(chance.p).toBeCloseTo(factors[0] * factors[1] * chance.steps[0].pDrawn * chance.steps[1].pDrawn, 12);
  });
});

describe('compareSituations', () => {
  it('replays the picks under the two other situations, keeping turns and group sizes', () => {
    const u = parseLabUrl(`?${REFERENCE}`).url;
    let s = openCall(REFERENCE);
    for (const band of ['favorable', 'favorable'] as const) {
      const view = currentFrame(s).views.find(entry => entry.eligible)!;
      const next = stepSession(s, { kind: 'decide', actionId: view.id, band });
      if ('refused' in next) throw new Error(next.refused);
      s = next;
    }
    const runs = compareSituations(s, u);
    expect(runs.map(run => run.situation)).toEqual([0, 2]);
    for (const run of runs) {
      expect(run.error).toBeNull();
      expect(run.call).not.toBeNull();
      expect(run.steps).toBe(2);
      expect(run.sameUntil).toBeGreaterThanOrEqual(0);
      expect(run.sameUntil).toBeLessThanOrEqual(2);
      const other = openSession({ ...u, call: { ...u.call!, call: run.call, id: null } }, null);
      if (!('frames' in other)) throw new Error(other.message);
      expect(other.situation).toBe(run.situation);
      // Group sizes are kept; the call's other compile-time facts (callCounts) may differ by seed.
      const sizes = (counts: Record<string, number>) => Object.fromEntries(Object.keys(s.tree.groups ?? {}).map(group => [group, counts[group]]));
      expect(sizes(other.counts)).toEqual(sizes(s.counts));
      expect(other.turnDrawn).toEqual(s.turnDrawn);
    }
  });
});
