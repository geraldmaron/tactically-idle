// The lab reads TreeState.armed as the compiled call does (backlog lab-armed-counts): its counts are
// callCounts, so a line behind `armed` shows in the lab only where the compiled call keeps it. The
// group fixture gets an armed line, as src/gen/incident/armed-condition.test.ts gives it, and is
// compiled on real draws; the lab's readers (Script rows, the palette's rows, the Why clause) then
// read that draw's counts. memberCounts, what the lab used before, is the negative control: with no
// armed key the line reads as holding everywhere.
import { describe, expect, it } from 'vitest';
import type { CallTree } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import { generateIncident } from '../../../gen/incident';
import { compileIncident, drawInstance, hostedSpec } from '../../../gen/incident/instance';
import { armedKey, callCounts, memberCounts } from '../../../gen/incident/trees-v13/compile';
import type { ReqLeaf } from '../../../gen/incident/trees-v13/dependencies';
import { GROUP_TEMPLATE, GROUP_TREE } from '../../../gen/incident/trees-v13/group-fixture';
import { callStringRows } from '../../../gen/incident/trees-v13/strings';
import { buildLocation } from '../../../sim/location';
import type { GameState } from '../../../sim/types';
import { parseLabUrl } from '../url';
import { variantKey, variantRows, variantRowsKey } from './script';
import { openSession } from './session';
import { leafLabel, leafNow, stateContext } from './why';
import type { ReqContext } from './why';

const ARMED_LINE = 'Through the glass the team sees what {others.first} has in {others.his} hand.';

/** The fixture with a favorable look into the counter room that sets `seen`, and an armed line behind it. */
function armedTemplate(): IncidentTemplate {
  const tree: CallTree = structuredClone(GROUP_TREE);
  const open = tree.nodes.find(node => node.id === 'open')!;
  const watch = open.choices.find(choice => choice.id === 'watch')!;
  watch.team = { to: { vantage: 'taker' }, signal: { channel: 'visual', to: 'taker' } };
  watch.outcomes.favorable[0].mark = ['seen'];
  const hold = tree.nodes.find(node => node.id === 'talk')!.choices.find(choice => choice.id === 'hold')!;
  hold.outcomes.favorable.push({ when: { armed: { role: 'others' }, marks: ['seen'] }, text: ARMED_LINE });
  return { ...GROUP_TEMPLATE, tree };
}

/** The first call seed that draws `members` others, its placed cast and its compiled scenario's JSON. */
function draw(template: IncidentTemplate, members: number) {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    let instance;
    try { instance = drawInstance(template, built, spec); } catch { continue; }
    if ((memberCounts(instance.placed).others ?? 0) !== members) continue;
    return { placed: instance.placed, compiled: JSON.stringify(compileIncident({ ...base, id: `lab-armed-${members}-${seed}`, incident: spec }, built, template)) };
  }
  throw new Error(`No seed draws ${members} others`);
}

const template = armedTemplate();
const tree = template.tree;
const inScript = (counts: Record<string, number>) => variantRows(tree, { counts, situation: 0, turns: {} }).some(row => row.text === ARMED_LINE);
const inPalette = (counts: Record<string, number>) => callStringRows(tree, text => text, counts).some(row => row.text === ARMED_LINE);
const ctx = (counts: Record<string, number>) => ({ tree, counts }) as unknown as ReqContext;
const RUNNING = { activeRun: {} } as unknown as GameState;
// The leaf the requirement tree will carry for TreeState.armed (shape decided 2026-10-18).
const ARMED = { kind: 'armed', role: 'others' } as unknown as ReqLeaf;

describe('the lab shows an armed line only where the compiled call keeps it', () => {
  const none = draw(template, 0), two = draw(template, 2);

  it('the compiled calls: dropped with nobody armed, kept with two', () => {
    expect(none.placed.armed).toEqual({ others: 0 });
    expect(none.compiled).not.toContain('Through the glass the team sees what');
    expect(two.placed.armed).toEqual({ others: 2 });
    expect(two.compiled).toContain('Through the glass the team sees what');
  });

  it('reads the call’s own counts, armed key included', () => {
    expect(callCounts(none.placed)).toEqual({ others: 0, [armedKey('others')]: 0 });
    expect(callCounts(two.placed)).toEqual({ others: 2, [armedKey('others')]: 2 });
  });

  it('hides it in Script and the palette on the draw that drops it, and shows it on the one that keeps it', () => {
    expect(inScript(callCounts(none.placed))).toBe(false);
    expect(inPalette(callCounts(none.placed))).toBe(false);
    expect(inScript(callCounts(two.placed))).toBe(true);
    expect(inPalette(callCounts(two.placed))).toBe(true);
  });

  it('negative control: group sizes alone (memberCounts) show it on the draw that drops it', () => {
    expect(inPalette(memberCounts(none.placed))).toBe(true);
    // The Script surface at a group size the call didn't draw: no armed key, so the line shows.
    expect(inScript({ others: 2 })).toBe(true);
  });

  it('caps the armed count at the size Script shows: shrinking the group hides the line', () => {
    expect(inScript({ ...callCounts(two.placed), others: 0 })).toBe(false);
    expect(inScript({ ...callCounts(two.placed), others: 1 })).toBe(true);
  });

  it('reads the Why clause for the armed leaf from the same counts', () => {
    expect(leafNow(ARMED, RUNNING, ctx(callCounts(none.placed)))).toBe('fail');
    expect(leafNow(ARMED, RUNNING, ctx(callCounts(two.placed)))).toBe('pass');
    expect(leafNow({ ...ARMED, min: 3 } as unknown as ReqLeaf, RUNNING, ctx(callCounts(two.placed)))).toBe('fail');
    expect(leafLabel(ARMED, tree, null)).toBe('Armed: At least 1 of the others armed');
  });
});

describe('the lab’s sessions carry the call’s own counts', () => {
  it('a session and a bare state both read callCounts, armed keys included', () => {
    const s = openSession(parseLabUrl('?type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1').url, null);
    if (!('frames' in s)) throw new Error(s.message);
    expect(s.counts).toEqual(callCounts(s.instance.placed));
    expect(stateContext(s.frames[0].state)!.counts).toEqual(callCounts(s.instance.placed));
    for (const group of Object.keys(s.tree.groups ?? {})) expect(s.counts[armedKey(group)]).toBeTypeOf('number');
  });
});

describe('Script variant keys with an armed count', () => {
  it('the call’s own variant matches its sweep entry, and its rows key still tells them apart', () => {
    const call = { pronouns: 'drawn' as const, counts: { others: 2, [armedKey('others')]: 0 }, situation: 0 as const, turns: {}, cast: 0 };
    const sweep = { ...call, counts: { others: 2 } };
    expect(variantKey(call)).toBe(variantKey(sweep));
    expect(variantRowsKey(call)).not.toBe(variantRowsKey(sweep));
  });
});
