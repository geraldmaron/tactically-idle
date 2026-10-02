import { describe, expect, it } from 'vitest';
import { planAuto } from './autoPlan';
import type { AutoLoadout } from '../../sim/auto-equip';

const item: Record<string, string> = { u1: 'thermal', u2: 'thermal', u3: 'radio', u4: 'radio' };
const res: AutoLoadout = {
  loadouts: { A: { thermal: 1, radio: 1, medkit: 0 }, B: { thermal: 1, radio: 1 } },
  units: { A: ['u1', 'u3'], B: ['u2', 'u4'] },
  rationale: { A: ['Thermal imager to Alpha'], B: [] },
  warnings: [],
  added: 4,
};
const itemOf = (id: string) => item[id];

describe('planAuto', () => {
  it('adapts the complete engine plan without dropping manual zero choices or exact units', () => {
    const p = planAuto({ res, targets: ['A', 'B'], itemOf });
    expect(p.loadouts).toEqual(res.loadouts);
    expect(p.explicit).toEqual({ A: { thermal: ['u1'], radio: ['u3'] }, B: { thermal: ['u2'], radio: ['u4'] } });
    expect(p.notes.A).toEqual({ lines: ['Thermal imager to Alpha'], edited: false });
    expect(p.total).toBe(4);
  });

  it('updates only the requested squad, once', () => {
    const p = planAuto({ res, targets: ['B', 'B'], itemOf });
    expect(p.loadouts).toEqual({ B: res.loadouts.B });
    expect(p.explicit).toEqual({ B: { thermal: ['u2'], radio: ['u4'] } });
    expect(p.total).toBe(2);
  });

  it('does not reduce a retained manual quantity whose shortage is reported by the engine', () => {
    const p = planAuto({ res: { ...res, loadouts: { A: { thermal: 3 } }, units: { A: ['u1'] }, warnings: ['Only 1 of 3 usable thermal imagers'], added: 0 }, targets: ['A'], itemOf });
    expect(p.loadouts.A).toEqual({ thermal: 3 });
    expect(p.explicit.A).toEqual({ thermal: ['u1'] });
  });

  it('skips absent target results and never aliases input objects', () => {
    const p = planAuto({ res, targets: ['A', 'C'], itemOf });
    expect(p.loadouts.C).toBeUndefined();
    p.loadouts.A!.radio = 9;
    p.notes.A!.lines.push('edited');
    expect(res.loadouts.A!.radio).toBe(1);
    expect(res.rationale.A).toHaveLength(1);
  });
});
