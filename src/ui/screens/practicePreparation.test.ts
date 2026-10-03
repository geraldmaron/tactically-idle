import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SCENARIOS } from '../../content/scenarios';
import { INCIDENT_TYPES_V4 } from '../../gen/incident';
import { DECISION_EXERCISES } from '../../content/scenarios/decision-exercises';
import { briefing } from '../../sim/operation-selectors';
import { practiceUnits } from '../../sim/resolution';
import { makeState, NOW } from '../../sim/test-fixtures';
import { boardEntries, isReplayOnly, practiceEntries } from './helpers';
import { OpsPrepare } from './OpsPrepare';
import { OpsBoard, PracticeCardView } from './OpsBoard';

const state = makeState();
vi.mock('../store', () => ({ useGame: () => state, send: vi.fn() }));
vi.mock('../components/toast', () => ({ useToast: () => ({ act: vi.fn(), notify: vi.fn() }) }));
vi.mock('../blueprint/Blueprint', () => ({ Blueprint: () => createElement('div', null, 'Map preview') }));

afterEach(() => vi.restoreAllMocks());

describe('practice-only equipment exercises', () => {
  it('classifies every practiceOnly fixture as an exercise while preserving standing assignments', () => {
    const entries = practiceEntries(state, NOW);
    const exercises = Object.values(SCENARIOS).filter((scenario) => scenario.practiceOnly);
    expect(exercises.length).toBeGreaterThan(0);
    for (const scenario of exercises) {
      expect(entries.find((entry) => entry.card.id === scenario.id)?.kind).toBe('exercise');
      expect(isReplayOnly(state, scenario.id)).toBe(true);
    }
    expect(entries.find((entry) => entry.card.id === 'ms_occupancy')?.kind).toBe('standing');
    expect(isReplayOnly(state, 'ms_occupancy')).toBe(false);
  });

  it('features current decision exercises without resetting an existing campaign or inventing a live call', () => {
    const incidents = state.incidents;
    state.incidents = [];
    try {
      const html = renderToStaticMarkup(createElement(OpsBoard, { onPrepare: () => {} }));
      expect(html).toContain('No open incidents');
      expect(html).toContain('Decision practice');
      expect(html.indexOf('Decision practice')).toBeLessThan(html.indexOf('Standing and practice'));
      for (const exercise of DECISION_EXERCISES) expect(html).toContain(exercise.title);
      expect(boardEntries(state, NOW)).toEqual([]);
    } finally { state.incidents = incidents; }
  });

  it('uses the authored incident labels for every current exercise, including high-risk calls', () => {
    const entries = practiceEntries(state, NOW);
    for (const exercise of DECISION_EXERCISES) {
      const entry = entries.find((candidate) => candidate.card.id === exercise.id)!;
      const label = INCIDENT_TYPES_V4.find((kind) => kind.type === exercise.spec.type)!.label;
      expect(renderToStaticMarkup(createElement(PracticeCardView, { entry, onPrepare: () => {} }))).toContain(label);
    }
  });

  it('labels an exercise card as practice before preparation', () => {
    const entry = practiceEntries(state, NOW).find((candidate) => candidate.kind === 'exercise')!;
    const html = renderToStaticMarkup(createElement(PracticeCardView, { entry, onPrepare: () => {} }));
    expect(html).toContain('Exercise: practice only');
    expect(html).toContain('Prepare practice');
    expect(html).not.toContain('Past incident');
  });

  it('keeps fixtures off the live board even if a stale incident record references one', () => {
    const malformed = structuredClone(state);
    malformed.incidents = [{ id: 'practice_rescue_v2', expiresAt: NOW + 1000 } as typeof malformed.incidents[number]];
    expect(boardEntries(malformed, NOW)).toEqual([]);
  });

  it('forces the practice switch and launch wording for authored fixtures', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const html = renderToStaticMarkup(createElement(OpsPrepare, { scenarioId: 'practice_rescue_v2', onCancel: () => {} }));
    expect(html).toMatch(/<input type="checkbox" disabled="" checked=""/);
    expect(html).toContain('This equipment exercise is practice only');
    expect(html).toContain('Start practice');
    expect(html).not.toMatch(/>Deploy<\/button>/);
  });

  it('preserves the normal live launch default on a standing assignment', () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const html = renderToStaticMarkup(createElement(OpsPrepare, { scenarioId: 'ms_occupancy', onCancel: () => {} }));
    expect(html).toContain('<input type="checkbox"/>');
    expect(html).toMatch(/>Deploy<\/button>/);
  });

  it('includes capability equipment and companion supplies in a useful, supported practice kit', () => {
    const signals = briefing('practice_signals_v2').usefulItemIds;
    expect(signals).toEqual(expect.arrayContaining(['portable_light', 'radio_relay', 'command_van']));
    expect(signals).not.toContain('observation_binoculars');
    expect(signals).not.toContain('battery_pack');
    const virtual = new Set(practiceUnits(state, true).map((unit) => unit.itemId));
    for (const id of ['radio_relay', 'inspection_camera']) expect(virtual.has(id)).toBe(true);
    expect(virtual.has('command_van')).toBe(false);
    const ordinary = new Set(practiceUnits(state).map((unit) => unit.itemId));
    expect(ordinary.has('radio_relay')).toBe(false);
  });
});
