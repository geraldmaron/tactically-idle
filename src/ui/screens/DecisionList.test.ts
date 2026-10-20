// DecisionList is the one list of choice cards the player and the Scenario Lab see: every card
// carries its action id, at most five show until Show all, and the reviewed choice is never hidden.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { NOW } from '../../sim/test-fixtures';
import type { ActionView } from '../../sim/types';
import { DecisionList } from './DecisionList';
import { liveDecisions } from './live-model';

/** A real v13 hostage call (the Ops board's first card for the QA department on 2026-10-08). */
const HOSTAGE = 'gen:hostage_crisis:market_row:3035903061:1492309763:1:13';
const real = liveDecisions(startGateRun(HOSTAGE), NOW, 'A');
/** Nine choices shaped like the real first one: six available, three locked. */
const NINE: ActionView[] = Array.from({ length: 9 }, (_, i) => ({ ...real[0], id: `choice_${i + 1}`, title: `Choice ${i + 1}`,
  ...(i >= 6 ? { eligible: false, reason: `Needs thing ${i + 1}` } : {}) }));
const noop = () => {};
const render = (actions: ActionView[], selectedId: string | null = null, expanded = false) =>
  renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', actions, selectedId, expanded, onSelect: noop, onExpand: noop }));
/** Each choice card: a plain card is a button, a weighed one (pull and cost) a div holding two. */
const cards = (html: string) => [...html.matchAll(/<(?:button|div)[^>]*class="callbtn(?: [^"]*)?"[^>]*>/g)].map(match => match[0]);
const ids = (html: string) => cards(html).map(card => /data-action-id="([^"]+)"/.exec(card)?.[1] ?? null);

describe('DecisionList', () => {
  it('puts data-action-id on every card of a real call', () => {
    expect(real.length).toBeGreaterThan(0);
    const html = render(real);
    expect(ids(html)).toEqual(real.filter(a => a.eligible).concat(real.filter(a => !a.eligible)).slice(0, 5).map(a => a.id));
    expect(html).toContain('<p class="operation-stage-prompt">What now?</p>');
  });

  it('shows five of nine cards with Show all, then all nine', () => {
    const short = render(NINE);
    expect(cards(short)).toHaveLength(5);
    expect(ids(short).every(id => id !== null)).toBe(true);
    expect(short).toContain('Show all 9 choices');
    expect(short).toContain('6 available · 3 unavailable.');
    const all = render(NINE, null, true);
    expect(ids(all)).toEqual(NINE.map(a => a.id));
    expect(all).toContain('Show fewer choices');
    expect(all).toContain('Unavailable now');
    expect(all).toContain('Needs thing 9');
  });

  it('keeps the reviewed choice in view when it sits past the first five', () => {
    const html = render(NINE, 'choice_8');
    expect(ids(html)).toEqual(['choice_1', 'choice_2', 'choice_3', 'choice_4', 'choice_8']);
    expect(cards(html).find(card => card.includes('choice_8'))).toContain('callbtn callbtn-on callbtn-off');
  });

  it('says so when there is nothing to choose', () => {
    const html = render([]);
    expect(html).toContain('No decisions available right now.');
    expect(cards(html)).toHaveLength(0);
  });
});
