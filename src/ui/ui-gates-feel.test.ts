// Unit tests for the layout gates' logic on fixture boxes (scripts/ui-gates/feel-layout.mjs): each rule
// passes the good shape and fails the bad one, so a detector cannot go blind without a test failing.
import { describe, expect, it } from 'vitest';
import { judgeLists, judgeMarkers, judgePills, rowOverlaps } from '../../scripts/ui-gates/feel-layout.mjs';
import { enforced } from '../../scripts/ui-gates/feel.mjs';

const stacked = [{ label: 'Alpha', top: 0, bottom: 72 }, { label: 'Bravo', top: 72, bottom: 144 }, { label: 'Charlie', top: 144, bottom: 216 }];
const twoUp = [{ label: 'Alpha', top: 0, bottom: 180 }, { label: 'Bravo', top: 0, bottom: 180 }, { label: 'Charlie', top: 188, bottom: 368 }];
const pill = (id: string, h = 32, extra = {}) => ({ id, h, fontSize: '16px', fontWeight: '700', images: [], ...extra });

describe('F7.list: items of a marked list never share a row', () => {
  it('passes items stacked one to a row, even with a 1px overlap from rounding', () => {
    expect(judgeLists([{ id: 'ul#0', items: stacked }])).toEqual([]);
    expect(rowOverlaps([{ label: 'a', top: 0, bottom: 72 }, { label: 'b', top: 71, bottom: 140 }])).toEqual([]);
  });
  it('fails two items side by side, naming both', () => {
    const found = judgeLists([{ id: 'div.hq-duties#0', items: twoUp }]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ rule: 'F7.list', id: 'div.hq-duties#0' });
    expect(found[0].detail).toContain('"Alpha"');
    expect(found[0].detail).toContain('"Bravo"');
  });
  it('fails an odd third item only if it also shares a row, and a single item never fails', () => {
    expect(judgeLists([{ id: 'x', items: [stacked[0]] }])).toEqual([]);
    expect(rowOverlaps(twoUp)).toHaveLength(1);
  });
});

describe('F7.marker: a surface with items must be marked', () => {
  it('fails two or more items with no marker, passes marked, one item, or none', () => {
    expect(judgeMarkers([{ key: 'hq-squads', label: 'HQ squads', count: 3, marked: false }])).toHaveLength(1);
    expect(judgeMarkers([{ key: 'hq-squads', label: 'HQ squads', count: 3, marked: true }])).toEqual([]);
    expect(judgeMarkers([{ key: 'hq-squads', label: 'HQ squads', count: 1, marked: false }])).toEqual([]);
    expect(judgeMarkers([{ key: 'hq-timers', label: 'HQ timers', count: 0, marked: false }])).toEqual([]);
  });
});

describe('F8.pill: the resource bar is uniform', () => {
  const bar = (pills: ReturnType<typeof pill>[], menu: { h: number } | null = { h: 32 }) => ({ pills, menu });
  it('passes three equal 32px pills, a matching menu button and one value type', () => {
    expect(judgePills(bar([pill('stat-cash'), pill('stat-trust'), pill('stat-level')]))).toEqual([]);
  });
  it('fails a 44px cash pill, on equality and on the 32px size', () => {
    const found = judgePills(bar([pill('stat-cash', 44), pill('stat-trust'), pill('stat-level')]));
    expect(found.map((f) => f.id)).toEqual(expect.arrayContaining(['height', 'height-32']));
  });
  it('fails fewer than three pills, a mismatched menu, a different value type and an oversized image', () => {
    expect(judgePills(bar([pill('a'), pill('b')])).map((f) => f.id)).toEqual(['count']);
    expect(judgePills(bar([pill('a'), pill('b'), pill('c')], { h: 44 })).map((f) => f.id)).toEqual(['menu']);
    expect(judgePills(bar([pill('a'), pill('b', 32, { fontSize: '14px' }), pill('c')])).map((f) => f.id)).toEqual(['type']);
    expect(judgePills(bar([pill('a', 32, { images: [{ w: 96, h: 40 }] }), pill('b'), pill('c')])).map((f) => f.id)).toEqual(['image:a']);
    expect(judgePills(bar([pill('a', 32, { images: [{ w: 20, h: 20, wellW: 24, wellH: 24 }] }), pill('b'), pill('c')]))).toEqual([]);
  });
  it('tolerates half a pixel of difference and fails more', () => {
    expect(judgePills(bar([pill('a', 32.4), pill('b'), pill('c')]))).toEqual([]);
    expect(judgePills(bar([pill('a', 33.2), pill('b'), pill('c')])).map((f) => f.id)).toContain('height');
  });
  it('misses no menu button', () => {
    expect(judgePills(bar([pill('a'), pill('b'), pill('c')], null)).map((f) => f.id)).toEqual(['menu']);
  });
});

describe('the layout rules are opt-in', () => {
  it('a wildcard switch-on does not enforce them; naming them does', () => {
    expect(enforced('F7.list', 'hq', { hq: ['*'] })).toBe(false);
    expect(enforced('F8.pill', 'hq', { hq: ['*'] })).toBe(false);
    expect(enforced('F8.pill', 'hq', { hq: ['F8.pill'] })).toBe(true);
    expect(enforced('F1.primary', 'hq', { hq: ['*'] })).toBe(true);
  });
});
