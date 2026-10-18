import { describe, expect, it } from 'vitest';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';
import { runtimeImports, SOURCES } from '../../import-graph';
import { parseLabUrl } from '../url';
import { compareInstances, instanceUrl, pairRows } from './compare';
import { currentFrame, openSession, stepSession } from './session';
import type { Session } from './session';
import { xrayChoices } from './xray';
import type { ChoiceXray } from './xray';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';

function openCall(query: string): { s: Session; u: ReturnType<typeof parseLabUrl>['url'] } {
  const u = parseLabUrl(`?${query}`).url;
  const s = openSession(u, null);
  if (!('frames' in s)) throw new Error(`could not open ${query}: ${s.message}`);
  return { s, u };
}

describe('compareInstances', () => {
  it('reads zero deltas when B changes nothing', () => {
    const { s, u } = openCall(REFERENCE);
    const c = compareInstances(s, u, {}, 0, dependencyIndex(s.template));
    expect(c.error).toBeNull();
    expect(c.divergence).toBeNull();
    expect(c.changed).toEqual([]);
    expect(c.rows.length).toBeGreaterThan(0);
    for (const row of c.rows) {
      expect(row.delta).toEqual({ likelihood: { favorable: 0, mixed: 0, adverse: 0 }, margin: 0 });
      expect(row.groups).toEqual([]);
    }
  });

  it("subtracts the engine's own numbers: each side is that instance's card odds and margin", () => {
    const { s, u } = openCall(REFERENCE);
    const deps = dependencyIndex(s.template);
    const vs = { tier: 4 };
    const c = compareInstances(s, u, vs, 0, deps);
    const b = openSession(instanceUrl(u, vs), null);
    if (!('frames' in b)) throw new Error(b.message);
    const views = new Map(currentFrame(b).views.map(view => [view.id, view]));
    const xb = new Map(xrayChoices(b, b.frames[0], deps).map(x => [x.actionId, x]));
    expect(c.changed).toEqual(['tier 4']);
    for (const row of c.rows) {
      expect(row.b!.likelihood).toEqual(views.get(row.actionId)!.likelihood);
      expect(row.b!.margin).toBe(xb.get(row.actionId)!.margin);
      expect(row.delta!.likelihood.favorable).toBeCloseTo(row.b!.likelihood.favorable - row.a!.likelihood.favorable, 3);
    }
    // A harder tier lowers every opening choice's chance of going well, through difficulty.
    expect(c.rows.every(row => row.delta!.likelihood.favorable < 0 && row.groups.some(group => group.id === 'difficulty'))).toBe(true);
  });

  it('shows a squad change in the rating groups', () => {
    const { s, u } = openCall(REFERENCE);
    const c = compareInstances(s, u, { squad: 42 }, 0, dependencyIndex(s.template));
    expect(c.rows.some(row => row.groups.some(group => group.id === 'rating'))).toBe(true);
  });

  it('marks a choice B locks and gives no delta for it', () => {
    const { s, u } = openCall('type=protected_rescue&certs=vehicle_operations');
    const c = compareInstances(s, u, { certs: [] }, 0, dependencyIndex(s.template));
    const vehicle = c.rows.find(row => row.actionId.endsWith('_vehicle'))!;
    expect(vehicle.a!.eligible).toBe(true);
    expect(vehicle.b!.eligible).toBe(false);
    expect(vehicle.b!.reason).toMatch(/vehicle operator/);
    expect(vehicle.delta).toBeNull();
  });

  it("stops at the step B refuses, with the engine's reason, and pairs no rows", () => {
    const opened = openCall('type=protected_rescue&certs=vehicle_operations');
    const u = opened.u;
    let s = opened.s;
    const vehicle = currentFrame(s).views.find(view => view.id.endsWith('_vehicle'))!;
    const next = stepSession(s, { kind: 'decide', actionId: vehicle.id, band: 'favorable' });
    if ('refused' in next) throw new Error(next.refused);
    s = next;
    const c = compareInstances(s, u, { certs: [] }, 1, dependencyIndex(s.template));
    expect(c.divergence).toMatchObject({ kind: 'stopped', step: 1 });
    expect(c.divergence!.kind === 'stopped' && c.divergence!.why).toMatch(/vehicle operator/);
    expect(c.rows).toEqual([]);
  });

  it('refuses a call from the game, which keeps its own draw', () => {
    const { s, u } = openCall(REFERENCE);
    const c = compareInstances({ ...s, squad: { kind: 'game', at: 0 } }, u, { tier: 3 }, 0, null);
    expect(c.error).toMatch(/keeps its own draw/);
  });
});

describe('pairRows', () => {
  const x = (actionId: string, favorable: number): ChoiceXray => ({
    actionId, title: actionId, margin: favorable * 10, groups: [{ id: 'rating', label: 'Rating', total: favorable * 10, items: [] }],
    view: { eligible: true, likelihood: { favorable, mixed: 0, adverse: 1 - favorable } },
  }) as unknown as ChoiceXray;

  it('pairs by action id, never by position', () => {
    const a = [x('one', 0.5), x('two', 0.6), x('only_a', 0.4)];
    const b = [x('two', 0.7), x('only_b', 0.3), x('one', 0.5)];
    const rows = pairRows(a, b);
    expect(rows.map(row => row.actionId)).toEqual(['one', 'two', 'only_a', 'only_b']);
    expect(rows[0].delta!.likelihood.favorable).toBe(0);
    expect(rows[1].delta!.likelihood.favorable).toBeCloseTo(0.1, 9);
    expect(rows[1].groups).toEqual([{ id: 'rating', label: 'Rating', a: 6, b: 7, delta: 1 }]);
    expect(rows[2]).toMatchObject({ b: null, delta: null });
    expect(rows[3]).toMatchObject({ a: null, delta: null });
  });
});

describe('where compare reads its numbers', () => {
  // The view only subtracts what the engine reports: ActionView.likelihood through each session's
  // frames, and margins and contributor groups through xrayChoices. A runtime import of anything
  // else (the resolution tables, the operation, the selectors, balance weights) could compute odds of
  // its own, so it fails here. Type-only imports are erased and allowed.
  it('imports nothing at runtime but the lab models that carry the engine numbers', () => {
    const imports = runtimeImports(SOURCES['/src/dev/lab/model/compare.ts'], '/src/dev/lab/model/compare.ts');
    expect(imports.sort()).toEqual(['./call', './session', './xray']);
  });

  it('takes only labels from ./call', () => {
    const source = SOURCES['/src/dev/lab/model/compare.ts'];
    expect(source.match(/^import \{([^}]*)\} from '\.\/call';$/m)?.[1].trim()).toBe('familyLabel');
  });
});
