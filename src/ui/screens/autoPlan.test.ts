import { describe, expect, it } from 'vitest';
import { planAuto } from './autoPlan';
import type { AutoLoadout } from '../../sim/auto-equip';

const item: Record<string, string> = { u1: 'thermal', u2: 'thermal', u3: 'radio', u4: 'radio' };
const res: AutoLoadout = {
  loadouts: { A: { thermal: 1, radio: 1 }, B: { thermal: 1, radio: 2 } },
  units: { A: ['u1', 'u3'], B: ['u2', 'u4', 'u3'] },
  rationale: { A: ['Thermal imager to Alpha'], B: [] },
  warnings: [],
};
const base = { chosen: ['A', 'B'] as ('A' | 'B')[], itemOf: (id: string) => item[id] };

describe('planAuto', () => {
  it('fills all chosen squads and keeps explicit unit picks', () => {
    const p = planAuto({ ...base, res, targets: ['A', 'B'], loadouts: {}, takenBy: {}, ready: (i) => (i === 'thermal' ? 2 : 2) });
    expect(p.loadouts.A).toEqual({ thermal: 1, radio: 1 });
    // radio is short: only 2 ready, A took 1, so B gets 1 of the 2 it asked for
    expect(p.loadouts.B).toEqual({ thermal: 1, radio: 1 });
    expect(p.explicit.A).toEqual({ thermal: ['u1'], radio: ['u3'] });
    expect(p.explicit.B?.thermal).toEqual(['u2']);
    expect(p.explicit.B?.radio).toEqual(['u4', 'u3'].slice(0, 1));
    expect(p.notes.A?.lines).toEqual(['Thermal imager to Alpha']);
    expect(p.notes.A?.edited).toBe(false);
    expect(p.total).toBe(4);
  });

  it('never gives one squad a unit another squad already holds (single-squad auto)', () => {
    const p = planAuto({
      ...base,
      res,
      targets: ['A'],
      loadouts: { B: { thermal: 1, radio: 0 } },
      takenBy: { B: ['u1'] },
      ready: () => 2,
    });
    // B holds 1 of 2 thermals, so A may take 1; but u1 is B's, so A's explicit pick is dropped (engine fills with u2)
    expect(p.loadouts.A?.thermal).toBe(1);
    expect(p.explicit.A?.thermal).toBeUndefined();
    expect(p.explicit.A?.radio).toEqual(['u3']);
  });

  it('gives nothing when stock is already spoken for', () => {
    const p = planAuto({ ...base, res, targets: ['A'], loadouts: { B: { thermal: 2, radio: 2 } }, takenBy: { B: ['u1', 'u2', 'u3', 'u4'] }, ready: () => 2 });
    expect(p.loadouts.A).toEqual({});
    expect(p.total).toBe(0);
  });
});
