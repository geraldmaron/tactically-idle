import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HqStatTiles } from './HQ';

const noop = () => {};
const render = (props: Partial<Parameters<typeof HqStatTiles>[0]> = {}) => renderToStaticMarkup(createElement(HqStatTiles, {
  training: { inCourses: 1, places: 2 },
  board: { count: 4, newCount: 2, expiringSoon: 1, max: 5 },
  onTraining: noop,
  onCalls: noop,
  ...props,
}));
const bars = (html: string) => [...html.matchAll(/role="img" aria-label="([^"]+)">(.*?)<\/span>/g)].map(([, label, inner]) => ({
  label,
  segments: [...inner.matchAll(/data-state="(\w+)" style="flex-grow:(\d+)"/g)].map(([, state, grow]) => `${state}:${grow}`),
}));

describe('HQ stat tiles', () => {
  it('states the exact counts in each bar label', () => {
    expect(bars(render()).map((bar) => bar.label)).toEqual([
      '1 of 2 training places in use',
      '4 of 5 calls on the board, 2 unseen, 1 closing soon',
    ]);
  });

  it('draws each bar against capacity, leaving the free part empty', () => {
    expect(bars(render()).map((bar) => bar.segments)).toEqual([
      ['training:1', 'empty:1'],
      ['strained:1', 'live:3', 'empty:1'],
    ]);
  });

  it('leaves out empty segments and shows a full board without a gap', () => {
    const html = render({ training: { inCourses: 0, places: 1 }, board: { count: 5, newCount: 0, expiringSoon: 0, max: 5 } });
    expect(bars(html).map((bar) => bar.segments)).toEqual([['empty:1'], ['live:5']]);
    expect(bars(html).map((bar) => bar.label)).toEqual([
      '0 of 1 training places in use',
      '5 of 5 calls on the board, 0 unseen, 0 closing soon',
    ]);
  });
});
