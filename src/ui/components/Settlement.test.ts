import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DebriefResult } from '../../sim/types';
import { Settlement } from './Settlement';

const debrief = { fundingReward: 2600, trustDelta: 3, serviceEarned: 45, officerCondition: [] } as unknown as DebriefResult;

describe('Settlement', () => {
  it('shows the end state on the first frame when it is still, with the payout and the service gained', () => {
    const html = renderToStaticMarkup(createElement(Settlement, { debrief, department: { funding: 12400, level: 1, service: 5 }, still: true }));
    // The funding tile counts the change, not the balance: the payout is there from the first frame.
    expect(html).toMatch(/class="settle-tile" data-tone="good">.*?<\/svg>\+2,600<span class="sr-only"> funding/);
    expect(html).toContain('Funding +2,600');
    expect(html).toContain('+45');
    expect(html).toContain('result-settlement-still');
    expect(html).toContain('aria-label="Rewards"');
    expect(html).toContain('style="width:100%"');
  });
  it('starts a moving beat from nothing and from the service bar as it stood, and still says the end state aloud', () => {
    const html = renderToStaticMarkup(createElement(Settlement, { debrief, department: { funding: 12400, level: 1, service: 5 } }));
    expect(html).toMatch(/class="settle-tile" data-tone="good">.*?<\/svg>0<span class="sr-only"> funding/);
    expect(html).toContain('Funding +2,600');
    expect(html).not.toContain('result-settlement-still');
    const fill = Number(/class="meter-fill meter-mid" style="width:([\d.]+)%/.exec(html)?.[1]);
    expect(fill).toBeGreaterThan(0);
    expect(fill).toBeLessThan(100);
  });
  it('says so when nothing changed', () => {
    const none = { fundingReward: 0, trustDelta: 0, officerCondition: [] } as unknown as DebriefResult;
    expect(renderToStaticMarkup(createElement(Settlement, { debrief: none, still: true }))).toContain('No funding or trust change');
  });
});
