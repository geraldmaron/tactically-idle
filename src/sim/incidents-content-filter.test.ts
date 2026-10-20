// Board filtering by content settings (docs/content-rating.md, "Filtering the board"): a pure
// engine input. The walk over every tier and topic combination records what stays drawable, for the
// Settings warning; the draw tests check the filter holds on a real board, and that no exclusion
// leaves the draw exactly as it was.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT_DESCRIPTORS, CONTENT_TIERS, MATURE_ONLY, type ContentDescriptor } from '../content/content-descriptors';
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

/** Every subset of the six topics, as lists in descriptor order. */
const SUBSETS: ContentDescriptor[][] = Array.from({ length: 1 << CONTENT_DESCRIPTORS.length }, (_, mask) => CONTENT_DESCRIPTORS.filter((_, i) => mask & (1 << i)));
const COMBOS: ContentExclusion[] = CONTENT_TIERS.flatMap((tier) => SUBSETS.map((off) => ({ tier, off })));
const label = (e: ContentExclusion) => `${e.tier}${e.off.length ? ` −${e.off.join(' −')}` : ''}`;

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
  it('Core rules out the mature-only descriptors, and topics add to either tier', () => {
    const mature = CONTENT_DESCRIPTORS.filter((d) => MATURE_ONLY[d]);
    expect([...excludedDescriptors({ tier: 'core', off: [] })].sort()).toEqual([...mature].sort());
    expect([...excludedDescriptors({ tier: 'mature', off: [] })]).toEqual([]);
    expect([...excludedDescriptors({ tier: 'mature', off: ['injury'] })]).toEqual(['injury']);
  });

  it('with nothing ruled out, every situation of every kind stays drawable', () => {
    expect(drawableSituations({ tier: 'mature', off: [] })).toEqual(Object.fromEntries(EVERY_TYPE.map((type) => [type, [0, 1, 2]])));
  });

  it('walks every tier and topic combination: a kept situation carries nothing excluded, and turning more off never keeps more', () => {
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
        for (const more of CONTENT_DESCRIPTORS) {
          const wider = drawableSituations({ ...exclusion, off: [...exclusion.off, more] })[type];
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
});

describe('a filtered board', () => {
  const NO_DEATHS: ContentExclusion = { tier: 'mature', off: ['death'] };

  it('draws only situations the exclusion keeps, and never a kind left with none', () => {
    const kept = drawableSituations(NO_DEATHS);
    let total = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { cards } = boardDraws(seed, NO_DEATHS);
      total += cards.length;
      for (const card of cards) expect(kept[card.type as keyof typeof kept], `${card.type} ${card.situation}`).toContain(card.situation);
    }
    expect(total).toBeGreaterThan(0);
  });

  it('draws nothing, and leaves the stream alone, when no kind is left', () => {
    const none: ContentExclusion = { tier: 'mature', off: ['injury'] };
    expect(drawableKinds(none)).toEqual([]);
    const state = createInitialState(T0, 7);
    const before = state.rngState;
    state.incidents = [];
    seedIncidentBoard(state, T0, undefined, none);
    expect(state.incidents).toEqual([]);
    // The schedule still draws its gap: only card draws are skipped.
    const scheduleOnly = createInitialState(T0, 7);
    scheduleOnly.rngState = before;
    seedIncidentBoard(scheduleOnly, T0, 0);
    expect(state.rngState).toBe(scheduleOnly.rngState);
  });

  it('with nothing ruled out, draws exactly what the unfiltered board draws', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const plain = boardDraws(seed, undefined), open = boardDraws(seed, { tier: 'mature', off: [] });
      expect(open.state.incidents).toEqual(plain.state.incidents);
      expect(open.state.rngState).toBe(plain.state.rngState);
    }
  });

});
