// Board filtering by content settings (docs/content-rating.md, "Filtering the board"): a pure
// engine input. The walk over every combination of avoided themes records what stays drawable and
// holds that each leaves the board drawable; the draw tests check the filter holds on a real board,
// and that avoiding nothing leaves the draw exactly as it was.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVOIDABLE_THEMES } from '../content/content-descriptors';
import { callTreeAt } from '../content/call-trees';
import { scenarioRecipe } from '../content/scenario-recipes';
import { SCENARIO_TYPES } from '../content/scenario-types';
import { drawIncidentSpec, parseIncidentId } from '../gen/incident';
import { createInitialState } from './department';
import { applyIncidentsDue, drawableKinds, drawableSituations, excludedDescriptors, seedIncidentBoard, type ContentExclusion } from './incidents';
import type { GameState } from './types';

// Every kind unlocked, as in incidents.test.ts, so a filter is tested against all four kinds.
vi.mock('../gen/incident', async (importOriginal) => {
  const m = await importOriginal<typeof import('../gen/incident')>();
  return { ...m, drawIncidentSpec: vi.fn(m.drawIncidentSpec) };
});
const draw = vi.mocked(drawIncidentSpec);
const realDraw = draw.getMockImplementation()!;
const EVERY_TYPE = SCENARIO_TYPES.map((info) => info.type);
beforeEach(() => {
  draw.mockReset();
  draw.mockImplementation((rng, ctx) => realDraw(rng, { ...ctx, unlockedTypes: EVERY_TYPE }));
});

const T0 = Date.UTC(2026, 0, 5, 12, 0, 0);
const HOUR = 3_600_000;

/** Every subset of the avoidable themes, in list order. */
const COMBOS: ContentExclusion[] = Array.from({ length: 1 << AVOIDABLE_THEMES.length }, (_, mask) => ({ avoid: AVOIDABLE_THEMES.filter((_, i) => mask & (1 << i)) }));
const label = (e: ContentExclusion) => (e.avoid.length ? `avoid ${e.avoid.join(', ')}` : 'avoid nothing');

/** Every card a campaign's board shows over `days`, as (type, situation) pairs. */
function boardDraws(campaignSeed: number, exclusion: ContentExclusion | undefined, days = 4): { cards: { type: string; situation: number }[]; state: GameState } {
  const state = createInitialState(T0, campaignSeed);
  seedIncidentBoard(state, T0, undefined, exclusion);
  const seen = new Map<string, { type: string; situation: number }>();
  const note = () => { for (const card of state.incidents) seen.set(card.id, { type: card.type, situation: scenarioRecipe(parseIncidentId(card.id)!).variant }); };
  note();
  for (let t = T0; t < T0 + days * 24 * HOUR; t += 3 * HOUR) { applyIncidentsDue(state, t, t + 3 * HOUR, exclusion); note(); }
  return { cards: [...seen.values()], state };
}

describe('content exclusion', () => {
  it('rules out exactly the avoided themes', () => {
    expect([...excludedDescriptors({ avoid: [] })]).toEqual([]);
    expect([...excludedDescriptors({ avoid: ['child_at_risk'] })]).toEqual(['child_at_risk']);
  });

  it('with nothing ruled out, every situation of every kind stays drawable', () => {
    expect(drawableSituations({ avoid: [] })).toEqual(Object.fromEntries(EVERY_TYPE.map((type) => [type, [0, 1, 2]])));
  });

  it('walks every combination of avoided themes: a kept situation carries nothing avoided, and avoiding more never keeps more', () => {
    const table: Record<string, Record<string, number[]>> = {};
    for (const exclusion of COMBOS) {
      const kept = drawableSituations(exclusion);
      const out = excludedDescriptors(exclusion);
      for (const type of EVERY_TYPE) {
        const tree = callTreeAt(type)!;
        for (const index of [0, 1, 2] as const) {
          const carries = (tree.situations[index].descriptors ?? []).some((d) => out.has(d));
          expect(kept[type].includes(index), `${label(exclusion)} ${type} ${index}`).toBe(!carries);
        }
        for (const more of AVOIDABLE_THEMES) {
          const wider = drawableSituations({ avoid: [...exclusion.avoid, more] })[type];
          expect(wider.every((index) => kept[type].includes(index))).toBe(true);
        }
      }
      expect(drawableKinds(exclusion)).toEqual(EVERY_TYPE.filter((type) => kept[type].length));
      table[label(exclusion)] = kept;
    }
    // The record of what each combination leaves on the board. A change here is a content change:
    // re-tagging a call or adding a call per kind (calls-per-kind) moves it, deliberately.
    expect(table).toMatchSnapshot();
  });

  it('leaves at least two kinds drawable whatever the player avoids', () => {
    for (const exclusion of COMBOS) expect(drawableKinds(exclusion).length, label(exclusion)).toBeGreaterThanOrEqual(2);
  });
});

describe('a filtered board', () => {
  const AVOID_ALL: ContentExclusion = { avoid: [...AVOIDABLE_THEMES] };

  it('draws only situations the exclusion keeps, and never a kind left with none', () => {
    const kept = drawableSituations(AVOID_ALL);
    let total = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { cards } = boardDraws(seed, AVOID_ALL);
      total += cards.length;
      for (const card of cards) expect(kept[card.type as keyof typeof kept], `${card.type} ${card.situation}`).toContain(card.situation);
    }
    expect(total).toBeGreaterThan(0);
  });

  it('avoiding nothing draws exactly what the unfiltered board draws', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plain = boardDraws(seed, undefined), open = boardDraws(seed, { avoid: [] });
      expect(open.state.incidents).toEqual(plain.state.incidents);
      expect(open.state.rngState).toBe(plain.state.rngState);
    }
  });

});
