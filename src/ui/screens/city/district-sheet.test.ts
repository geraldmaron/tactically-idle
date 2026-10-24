// Review finding 12: the district sheet never offers a patrol step the engine would refuse. The home district
// only loses staff when another district takes them, so its step down is disabled; a district that is not
// home can always send its staff back.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createInitialState } from '../../../sim/department';
import { dispatch } from '../../../sim/game';
import type { GameState } from '../../../sim/types';

const holder: { state: GameState | null } = { state: null };
vi.mock('../../store', () => ({ useGame: () => holder.state }));
vi.mock('../../components/toast', () => ({ useToast: () => ({ act: () => ({ ok: true }) }) }));
vi.mock('../../components/nav', () => ({ useNav: () => ({ go: () => {} }) }));
vi.mock('../../components/Sheet', () => ({ Sheet: ({ open, children, footer }: { open: boolean; children: unknown; footer?: unknown }) => open ? createElement('section', null, children as never, footer as never) : null }));

import { DistrictSheet } from './DistrictSheet';
import { coverageRefusal } from '../../../sim/world/selectors';

const NOW = Date.UTC(2026, 9, 3);

function founded(districtId: 'pike' | 'harbor'): GameState {
  let s = createInitialState(NOW, 7);
  s.world.onboarding.stage = 'founding';
  s = dispatch(s, { type: 'foundDepartment', name: 'Night Unit', districtId }, { now: NOW }).state;
  s.department.level = 4;
  return s;
}

/** The disabled state of the "fewer patrol units" and "more patrol units" buttons in the rendered sheet. */
function stepper(state: GameState, id: 'pike' | 'harbor' | 'larkin') {
  holder.state = state;
  const html = renderToStaticMarkup(createElement(DistrictSheet, { id, onClose: () => {} }));
  const button = (label: string) => html.match(new RegExp(`<button[^>]*aria-label="${label} patrol units here"[^>]*>`))?.[0] ?? '';
  return { fewer: button('Fewer'), more: button('More') };
}

describe('the patrol stepper on the district sheet', () => {
  it('disables the step down where the engine would refuse it, in Pike Street and in any other home district', () => {
    for (const home of ['pike', 'harbor'] as const) {
      const s = founded(home);
      const refused = dispatch(s, { type: 'setDistrictCoverage', districtId: home, units: 3 }, { now: NOW });
      expect(refused.result.ok).toBe(false);
      expect(coverageRefusal(s, home, 3)).toMatch(/district that needs them/);
      expect(stepper(s, home).fewer, home).toContain('disabled');
    }
  });

  it('leaves the step down on for a district that is not home, where it sends staff back', () => {
    let s = founded('pike');
    s = dispatch(s, { type: 'openDistrict', districtId: 'larkin' }, { now: NOW }).state;
    s = dispatch(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 2 }, { now: NOW }).state;
    expect(coverageRefusal(s, 'larkin', 1)).toBeNull();
    expect(stepper(s, 'larkin').fewer).not.toContain('disabled');
    // Pike's own step down is still off, with two of the four now away.
    expect(stepper(s, 'pike').fewer).toContain('disabled');
    expect(dispatch(s, { type: 'setDistrictCoverage', districtId: 'larkin', units: 1 }, { now: NOW }).result.ok).toBe(true);
  });
});
