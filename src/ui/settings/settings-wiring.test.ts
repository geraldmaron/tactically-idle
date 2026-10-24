// The saved settings reach the game: avoided themes leave the draw and clear the board, the timer
// setting is the one dither reads (Off adds none), a card names its situation's themes and says it
// can be left alone, and the threat bar drains with the stall.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { callTreeAt } from '../../content/call-trees';
import { scenarioRecipe } from '../../content/scenario-recipes';
import { incidentId, parseIncidentId } from '../../gen/incident';
import { CampaignSlots } from '../../sim/campaign-slots';
import { createInitialState } from '../../sim/department';
import { dispatch } from '../../sim/game';
import { cardFits, type ContentExclusion } from '../../sim/incidents';
import { ThreatPill } from '../screens/LiveView';
import { blockedAlone } from './avoidable';
import { CardWarning, cardDescriptors } from './CardWarning';
import { CARD_THEME_WORDS, CARD_WARNING_TEXT, THEME_ORDER, joinThemes } from './labels';
import { DebriefSupport, debriefNeedsSupport } from './DebriefSupport';
import { resetSettingsMemory, updateSettings } from './prefs';
import { timerSetting } from '../timer';

const THEMES = ['suicide_self_harm', 'child_at_risk', 'domestic_violence'] as const;
const NOW = Date.UTC(2026, 0, 5, 12, 0, 0);
const AVOID_SELF_HARM: ContentExclusion = { avoid: ['suicide_self_harm'] };
const descriptorsOf = (id: string) => {
  const spec = parseIncidentId(id)!;
  return callTreeAt(spec.type)?.situations[scenarioRecipe(spec).variant]?.descriptors ?? [];
};
const storage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
};
beforeEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: storage(), configurable: true }); resetSettingsMemory(); });
afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; resetSettingsMemory(); });

/** A seeded campaign whose unfiltered board holds a call that carries suicide and self-harm. */
function stateWithAvoidableCard() {
  for (let seed = 1; seed < 400; seed++) {
    const state = createInitialState(NOW, seed);
    if (state.incidents.some((card) => descriptorsOf(card.id).includes('suicide_self_harm'))) return state;
  }
  throw new Error('no seed put a self-harm call on the board');
}

describe('avoided themes reach the board', () => {
  it('a tick with the exclusion clears the cards that no longer fit, and keeps the rest', () => {
    const state = stateWithAvoidableCard();
    const kept = state.incidents.filter((card) => !descriptorsOf(card.id).includes('suicide_self_harm')).map((card) => card.id);
    expect(state.incidents.length).toBeGreaterThan(kept.length);
    const next = dispatch(state, { type: 'tick' }, { now: NOW + 1000, exclusion: AVOID_SELF_HARM }).state;
    expect(next.incidents.some((card) => descriptorsOf(card.id).includes('suicide_self_harm'))).toBe(false);
    for (const id of kept) expect(next.incidents.some((card) => card.id === id)).toBe(true);
    expect(next.incidents.every((card) => cardFits(card, AVOID_SELF_HARM))).toBe(true);
  });

  it('later arrivals never carry an avoided theme, and the board still fills', () => {
    const avoid = THEMES.filter((theme) => !blockedAlone(theme));
    expect(avoid.length).toBeGreaterThan(0);
    let state = createInitialState(NOW, 7, { avoid });
    let seen = state.incidents.length;
    for (let hour = 1; hour <= 24 * 6; hour++) {
      state = dispatch(state, { type: 'tick' }, { now: NOW + hour * 3_600_000, exclusion: { avoid } }).state;
      seen += state.incidents.length;
      for (const card of state.incidents) for (const theme of avoid) expect(descriptorsOf(card.id)).not.toContain(theme);
    }
    expect(seen, 'the exclusion left calls to draw, so the board has them').toBeGreaterThan(0);
  });

  it('an exclusion that leaves the board nothing to draw leaves it empty and never throws', () => {
    // Warrants come only from the world, so they cannot keep a board alive: with a theme off that every
    // board call carries, nothing is drawn (the PRNG does not move) instead of drawing a call the board never offers.
    const avoid = [...THEMES];
    expect(avoid.some((theme) => blockedAlone(theme))).toBe(true);
    let state = createInitialState(NOW, 7, { avoid });
    expect(state.incidents).toEqual([]);
    for (let hour = 1; hour <= 24 * 6; hour++) {
      state = dispatch(state, { type: 'tick' }, { now: NOW + hour * 3_600_000, exclusion: { avoid } }).state;
      expect(state.incidents).toEqual([]);
    }
  });

  it('the campaign store passes its exclusion to ticks and to a new game', () => {
    const slots = new CampaignSlots(null, NOW, () => 3);
    slots.exclusion = AVOID_SELF_HARM;
    slots.send({ type: 'tick' }, NOW + 1000, false);
    expect(slots.getSnapshot().state.incidents.every((card) => cardFits(card, AVOID_SELF_HARM))).toBe(true);
  });
});

describe('the saved timer is the one dither reads', () => {
  it('follows the preference', () => {
    expect(timerSetting()).toBe('relaxed');
    updateSettings({ timer: 'off' });
    expect(timerSetting()).toBe('off');
    updateSettings({ timer: 'standard' });
    expect(timerSetting()).toBe('standard');
  });
});

describe('the call card warning', () => {
  it('names the situation themes in plain words and says leaving costs nothing', () => {
    const state = stateWithAvoidableCard();
    const card = state.incidents.find((c) => descriptorsOf(c.id).includes('suicide_self_harm'))!;
    const descriptors = cardDescriptors(card.id);
    expect(descriptors).toContain('suicide_self_harm');
    const html = renderToStaticMarkup(createElement(CardWarning, { descriptors }));
    expect(html).toContain(CARD_WARNING_TEXT.involves);
    for (const d of descriptors) expect(html).toContain(CARD_THEME_WORDS[d]);
    expect(html).toContain(CARD_WARNING_TEXT.leaveIt);
    expect(html).toContain('No penalty for skipping this call.');
  });

  it('is gone when the player turns warnings off, and has no theme line for a call without any', () => {
    updateSettings({ cardWarnings: 'none' });
    expect(renderToStaticMarkup(createElement(CardWarning, { descriptors: ['death'] }))).toBe('');
    updateSettings({ cardWarnings: 'all' });
    expect(renderToStaticMarkup(createElement(CardWarning, { descriptors: [] }))).not.toContain(CARD_WARNING_TEXT.involves);
  });

  it('shows the same warning for every situation of a call, in the avoidable-first order', () => {
    const spec = parseIncidentId(stateWithAvoidableCard().incidents[0].id)!;
    const byVariant = new Map<number, string>();
    for (let seed = 1; seed < 600 && byVariant.size < 2; seed++) {
      const id = incidentId({ ...spec, seed });
      const variant = scenarioRecipe({ ...spec, seed }).variant;
      if (!byVariant.has(variant)) byVariant.set(variant, renderToStaticMarkup(createElement(CardWarning, { descriptors: cardDescriptors(id) })));
    }
    expect(byVariant.size).toBeGreaterThan(1);
    expect(new Set(byVariant.values()).size).toBe(1);
    const all = cardDescriptors(incidentId(spec));
    expect(all).toEqual([...all].sort((a, b) => THEME_ORDER.indexOf(a) - THEME_ORDER.indexOf(b)));
  });

  it('joins the themes with commas and a last "and", no serial comma, and names a call\'s own set', () => {
    expect(joinThemes(['death'])).toBe('death');
    expect(joinThemes(['injury', 'death'])).toBe('injury and death');
    expect(joinThemes(['a', 'b', 'c'])).toBe('a, b and c');
    const barricade = cardDescriptors(incidentId({ ...parseIncidentId(stateWithAvoidableCard().incidents.find((c) => c.type === 'barricaded')?.id ?? stateWithAvoidableCard().incidents[0].id)! }));
    expect(joinThemes(barricade.map((d) => CARD_THEME_WORDS[d]))).toMatch(/^suicide risk/);
  });

  it('a call with no theme to name shows nothing, not even the leave line', () => {
    expect(renderToStaticMarkup(createElement(CardWarning, { descriptors: [] }))).toBe('');
  });

  it('an id that is not a generated call has no themes', () => {
    expect(cardDescriptors('maple_street')).toEqual([]);
  });
});

describe('the debrief support line', () => {
  it('shows on a situation with suicide or self-harm, whatever the warning setting, and not on one without', () => {
    const state = stateWithAvoidableCard();
    const withIt = state.incidents.find((c) => descriptorsOf(c.id).includes('suicide_self_harm'))!;
    updateSettings({ cardWarnings: 'none' });
    expect(debriefNeedsSupport(withIt.id)).toBe(true);
    expect(renderToStaticMarkup(createElement(DebriefSupport, { scenarioId: withIt.id }))).toContain('call or text 988 in the US');
    expect(debriefNeedsSupport('maple_street')).toBe(false);
    expect(renderToStaticMarkup(createElement(DebriefSupport, { scenarioId: 'maple_street' }))).toBe('');
  });
});

describe('the threat bar', () => {
  const bar = (dither?: number) => renderToStaticMarkup(createElement(ThreatPill, { label: 'The count reaches zero', minutes: 8, dither }));
  it('shows the minutes left after the stall, in the text and the bar', () => {
    expect(bar()).toContain('8 min');
    expect(bar()).toMatch(/--ring-fill:100[;"]/);
    const half = bar(4);
    expect(half).toContain('4 min');
    expect(half).toMatch(/--ring-fill:50[;"]/);
    expect(half).toContain('aria-valuenow="4"');
    expect(half).toContain('Threat: The count reaches zero in 4 minutes');
  });
  it('is empty at the cap and never negative', () => {
    expect(bar(8)).toMatch(/--ring-fill:0[;"]/);
    // Past the cap the pill says the threat landed, and never shows negative minutes.
    expect(bar(20)).toContain('threat-pill-landed');
    expect(bar(20)).not.toMatch(/-\d+ min/);
  });
});
