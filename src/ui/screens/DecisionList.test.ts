// DecisionList is the one list of choice cards the player and the Scenario Lab see: every card
// carries its action id, at most five show until Show all, and the reviewed choice is never hidden.
// Each card is one button that opens its review, and What matters now carries what they all share.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../../gen/incident/gates/engine-driver';
import { NOW } from '../../sim/test-fixtures';
import type { ActionView } from '../../sim/types';
import { DecisionList, WhatMattersNow } from './DecisionList';
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
/** Each choice card: one button, weighed or not. */
const cards = (html: string) => [...html.matchAll(/<button[^>]*class="callbtn(?: [^"]*)?"[^>]*>/g)].map(match => match[0]);
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
    expect(short).toContain('Your call<span>6 open · 3 locked</span>');
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

  it('makes every card, weighed or not, one button that opens its review and names its forecast', () => {
    const weighed: ActionView = { ...NINE[0], id: 'weighed', weighing: { pull: 'One person is out in two minutes.', cost: 'The owner stays alone with him.' } };
    const html = render([weighed, ...NINE.slice(1, 3), NINE[7]]);
    expect(html).not.toMatch(/callbtn-expand|callbtn-review|<div[^>]*class="callbtn/);
    for (const card of cards(html)) expect(card).toMatch(/aria-label="Review [^"]+"/);
    const open = cards(html).find(card => card.includes('data-action-id="weighed"'))!;
    expect(open).toContain('aria-label="Review Choice 1"');
    expect(open).toContain('aria-describedby="choice-forecast-weighed"');
    expect(html).toMatch(/id="choice-forecast-weighed">[^]*possible harm: /);
    expect(cards(html).find(card => card.includes('choice_8'))).not.toContain('aria-describedby');
  });

  it('puts What matters now above the cards, with the threat and the strongest pull', () => {
    const guidance = createElement(WhatMattersNow, { threat: { label: 'He fires at the door', left: 6.2 }, factor: { source: 'The stream', pull: 4, effect: 'Talking is harder' } });
    const html = renderToStaticMarkup(createElement(DecisionList, { prompt: 'What now?', actions: NINE, selectedId: null, expanded: false, guidance, onSelect: noop, onExpand: noop }));
    expect(html.indexOf('What matters now')).toBeLessThan(html.indexOf('data-action-id'));
    expect(html).toContain('He fires at the door</span><b class="matters-now-num">\u20077 min</b>');
    expect(html).toContain('<b class="matters-now-count">The stream</b> <span class="matters-now-sub">Talking is harder</span></span><b class="matters-now-num">−4</b>');
    // The count lives in the ticker only, so the block never shows a second, different number.
    expect(html).not.toMatch(/matters-now-count">[\d,]+/);
    const landed = renderToStaticMarkup(createElement(WhatMattersNow, { threat: { label: 'He fires', left: 0 }, factor: null }));
    expect(landed).toContain('<b class="matters-now-num">\u2007\u2007\u2007Now</b>');
    expect(renderToStaticMarkup(createElement(WhatMattersNow, { threat: null, factor: null }))).toBe('');
  });
});
