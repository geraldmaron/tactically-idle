import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DebriefResult } from '../../sim/types';
import { Settlement } from './Settlement';

const debrief = { fundingReward: 2600, trustDelta: 3, serviceEarned: 45, officerCondition: [] } as unknown as DebriefResult;

describe('Settlement', () => {
  it('shows the end state on the first frame when it is still, with the payout and the service gained', () => {
    const html = renderToStaticMarkup(createElement(Settlement, { debrief, department: { funding: 12400, level: 1, service: 5 }, still: true }));
    expect(html).toContain('$15,000');
    expect(html).toContain('+$2,600 funding');
    expect(html).toContain('+45');
    expect(html).toContain('result-settlement-still');
    expect(html).toContain('class="result-rewards"');
  });
  it('starts a moving beat from the balance before the payout', () => {
    const html = renderToStaticMarkup(createElement(Settlement, { debrief, department: { funding: 12400, level: 1, service: 5 } }));
    expect(html).toContain('$12,400');
    expect(html).not.toContain('result-settlement-still');
  });
  it('says so when nothing changed', () => {
    const none = { fundingReward: 0, trustDelta: 0, officerCondition: [] } as unknown as DebriefResult;
    expect(renderToStaticMarkup(createElement(Settlement, { debrief: none, still: true }))).toContain('No funding or trust change');
  });
});
