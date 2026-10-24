import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CostTag, Segments } from './build-parts';

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

describe('CostTag renders the quote, never cash alone', () => {
  it('names the non-cash blocker beside a locked price', () => {
    const out = html(createElement(CostTag, { quote: { state: 'locked', price: 5400, blocker: 'Needs Recruiting office' } }));
    expect(out).toContain('data-state="locked"');
    expect(out).toContain('5,400');
    expect(out).toContain('Needs Recruiting office');
  });

  it('shows the milestone free route with its progress, and a bar', () => {
    const out = html(createElement(CostTag, { quote: { state: 'ready', price: 4900, free: { label: 'Level 3', met: false, have: 1, need: 3 } } }));
    expect(out).toContain('Free at Level 3 · 1/3');
    expect(out).toContain('width:33%');
  });

  it('says funding is short when that is the only blocker', () => {
    expect(html(createElement(CostTag, { quote: { state: 'short', price: 900, blocker: 'Needs funding' } }))).toContain('Needs funding');
  });

  it('drops the price once owned and the free route with it', () => {
    const out = html(createElement(CostTag, { quote: { state: 'owned', done: 'Max', free: { label: 'Level 3', met: true, have: 3, need: 3 } } }));
    expect(out).toContain('Max');
    expect(out).not.toContain('Free at');
  });

  it('splits into a trail value and a detail note', () => {
    const quote = { state: 'locked' as const, price: 1600, blocker: 'Needs Training academy' };
    const value = html(createElement(CostTag, { quote, part: 'value' }));
    const note = html(createElement(CostTag, { quote, part: 'note' }));
    expect(value).toContain('1,600');
    expect(value).not.toContain('Needs Training academy');
    expect(note).toContain('Needs Training academy');
    expect(note).not.toContain('1,600');
  });
});

describe('Segments', () => {
  it('draws owned out of total as separate segments', () => {
    const out = html(createElement(Segments, { done: 2, total: 5, label: '2 of 5 owned' }));
    expect(out.match(/<i[ >]/g)).toHaveLength(5);
    expect(out.match(/data-on="yes"/g)).toHaveLength(2);
    expect(out).toContain('aria-label="2 of 5 owned"');
  });
});
