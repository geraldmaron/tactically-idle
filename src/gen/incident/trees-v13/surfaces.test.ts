// Call surfaces and deception (docs/scenario-depth.md, call-surfaces and deception-commitments): a
// transcript on a decision and on a result, an epilogue on an ending and a lie the team can tell,
// compiled on the group fixture with every token bound, and the authoring errors that keep a lie
// from going unfound.
import { describe, expect, it } from 'vitest';
import { GROUP_TEMPLATE, GROUP_TREE } from './group-fixture';
import { generateIncident } from '../index';
import { compileIncident, drawInstance, hostedSpec } from '../instance';
import { callStringRows } from './strings';
import { choiceActionId, deceptionErrors, memberCounts } from './compile';
import { buildLocation } from '../../../sim/location';
import { validateScenario } from '../../../sim/operation';
import { currentStoryExchange } from '../../../sim/story-context';
import type { CallTree, TreeChoice } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { ScenarioDefinition } from '../../../sim/scenario-types';

const same = (text: string) => ({ favorable: text, mixed: text, adverse: text });
const LIE: TreeChoice = {
  id: 'lie', title: 'Tell him the courier can sign', summary: 'Command can’t promise that. {taker.first} may let {courier.first} go now, and ask for the page later.',
  preview: same('{taker.first} believes you, for now.'), icon: 'radio', check: { kind: 'contact', ratings: [{ key: 'communication', weight: 1 }] }, minutes: 2, deceives: true,
  outcomes: {
    favorable: [{ text: '{taker.first} says {courier.first} can go once the page is signed.', promise: { id: 'signs', to: 'taker', kind: 'lie' }, next: { node: 'final' } }],
    mixed: [{ text: '{taker.first} wants to hear it from {courier.first}.', promise: { id: 'signs', to: 'taker', kind: 'lie' }, next: { node: 'final' } }],
    adverse: [{ text: '{taker.first} doesn’t believe a word.', next: { node: 'final' } }],
  },
};

/** The fixture with a transcript at the first decision and on a result, a lie at the second, the
 * discovery at the third, and an epilogue on the best ending. */
const TREE: CallTree = {
  ...GROUP_TREE,
  nodes: GROUP_TREE.nodes.map(node => {
    if (node.id === 'open') return { ...node,
      exchange: [{ by: 'taker', line: 'Who is this?' }, { by: 'negotiator', line: 'My name’s on the card I left at the door.' }],
      promptIf: node.promptIf?.map((entry, i) => i === 0 ? { ...entry, exchange: [{ by: 'radio', line: 'Two by the till. Nobody moves yet.' }] } : entry),
      choices: node.choices.map(choice => choice.id !== 'call' ? choice : { ...choice, outcomes: { ...choice.outcomes,
        favorable: choice.outcomes.favorable.map((outcome, i) => i === 0 ? { ...outcome, exchange: [{ by: 'courier', line: 'I only came in with a parcel.' }] } : outcome) } }) };
    if (node.id === 'talk') return { ...node, choices: [...node.choices, LIE] };
    if (node.id === 'final') return { ...node, choices: node.choices.map(choice => choice.id !== 'end_talk' ? choice : { ...choice, outcomes: { ...choice.outcomes,
      adverse: [{ text: '{taker.first} asks to see the signed page, and there is none.', breaks: ['signs'], next: { ending: 'handed_over' } }] } }) };
    return node;
  }),
  endings: { ...GROUP_TREE.endings, all_out: { ...GROUP_TREE.endings.all_out, epilogue: '{courier.first} still has the parcel. Nobody ever signed for it.',
    epilogueIf: [{ when: { marks: ['heard_out'] }, epilogue: '{taker.first} asked after the courier twice.' }] } },
};
const TEMPLATE: IncidentTemplate = { ...GROUP_TEMPLATE, tree: TREE };

function call(members: number): ScenarioDefinition {
  for (let seed = 1; seed < 600; seed++) {
    const { clocks: _clocks, incidentPeople: _people, threats: _threats, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
    const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
    try {
      if ((memberCounts(drawInstance(TEMPLATE, built, spec).placed).others ?? 0) !== members) continue;
      const s = compileIncident({ ...base, id: `surfaces-${members}-${seed}`, incident: spec }, built, TEMPLATE);
      expect(validateScenario(s, built)).toEqual([]);
      return s;
    } catch (error) { if (error instanceof Error && /transcript|speaks|lie|deceives|breaks/.test(error.message)) throw error; }
  }
  throw new Error(`No seed draws ${members} others`);
}
const action = (s: ScenarioDefinition, node: string, choice: string) =>
  Object.values(s.stages).flatMap(stage => stage.actions).find(entry => entry.id === choiceActionId('hostage_crisis', node, choice))!;
const unbound = (value: unknown) => JSON.stringify(value).match(/\{(?!lead\})[a-z0-9_.]+\}/g);

describe('call surfaces compile with every name bound', () => {
  const lone = call(0), crowd = call(2);

  it('a decision carries its transcript, speakers named, and a prompt variant its own', () => {
    const first = (s: ScenarioDefinition) => currentStoryExchange(s, { stage: 'assess', flags: [], knowledge: {}, pressure: 0 });
    const lines = first(lone);
    expect(lines.map(line => line.line)).toEqual(['Who is this?', 'My name’s on the card I left at the door.']);
    expect(lines[1].speaker).toBe('{lead}'); // the lead officer's surname, filled by the selectors
    expect(lines[0].speaker).toMatch(/^[A-Z][a-z]+$/);
    expect(first(crowd)).toEqual([{ speaker: 'Radio', line: 'Two by the till. Nobody moves yet.' }]);
    expect(unbound(lone.stages)).toBeNull();
  });

  it('a result carries its transcript, an ending its epilogue, a lie its marker', () => {
    const said = action(lone, 'open', 'call').outcomes.favorable.flatMap(effect => effect.exchange ?? []);
    expect(said).toHaveLength(1);
    expect(said[0].speaker).not.toContain('{');
    expect(lone.endings.all_out.epilogue).toMatch(/^[A-Z][a-z]+ still has the parcel\. Nobody ever signed for it\.$/);
    // A variant keyed to a mark the call can't set is pruned; one it can set keeps its condition.
    expect(lone.endings.all_out.epilogueIf ?? []).toEqual([]);
    const lie = action(lone, 'talk', 'lie');
    expect(lie.deceives).toBe(true);
    expect(lie.outcomes.favorable.find(effect => effect.promise)?.promise).toMatchObject({ id: 'signs', kind: 'lie' });
    expect(action(lone, 'final', 'end_talk').outcomes.adverse.find(effect => effect.breaks)?.breaks).toEqual(['signs']);
  });

  it('every new line reaches the string checker on its own surface', () => {
    const rows = callStringRows(TREE, text => text);
    expect(rows.filter(row => row.surface === 'exchange').map(row => row.where)).toEqual(['open.exchange[0]', 'open.exchange[1]', 'open.promptIf[0].exchange[0]']);
    expect(rows.find(row => row.surface === 'exchange_result')?.where).toBe('open.call.favorable[0].exchange[0]');
    expect(rows.find(row => row.surface === 'epilogue')?.where).toBe('ending.all_out.epilogue');
  });
});

describe('a lie is always findable', () => {
  const nodesWith = (patch: (choice: TreeChoice) => TreeChoice): CallTree => ({ ...TREE, nodes: TREE.nodes.map(node => ({ ...node, choices: node.choices.map(patch) })) });
  it('passes the fixture', () => expect(deceptionErrors(TREE)).toEqual([]));
  it('fails a lie nobody finds out', () => {
    const never = nodesWith(choice => choice.id !== 'end_talk' ? choice : { ...choice, outcomes: { ...choice.outcomes, adverse: [{ text: 'Nobody comes out.', next: { ending: 'handed_over' } }] } });
    expect(deceptionErrors(never)).toEqual(['hostage_crisis: the lie signs is never found out; add an outcome that breaks it']);
  });
  it('fails a lie told by a choice not marked deceives, and a marked choice that tells none', () => {
    expect(deceptionErrors(nodesWith(choice => choice.id === 'lie' ? { ...choice, deceives: undefined } : choice))).toContain('hostage_crisis: talk.lie tells a lie (signs) but is not marked deceives');
    expect(deceptionErrors(nodesWith(choice => choice.id === 'hold' ? { ...choice, deceives: true } : choice))).toContain('hostage_crisis: talk.hold is marked deceives but makes no lie promise');
  });
  it('fails a break of a promise nobody made, and a silent break', () => {
    const silent = nodesWith(choice => choice.id !== 'leave' ? choice : { ...choice, outcomes: { ...choice.outcomes, favorable: [{ text: ' ', breaks: ['nothing'], next: { ending: 'handed_over' } }] } });
    const errors = deceptionErrors(silent);
    expect(errors).toContain('hostage_crisis: an outcome breaks nothing, which no outcome promises');
    expect(errors).toContain('hostage_crisis: final.leave favorable: breaking nothing needs text that says the person found out');
  });
});

describe('Going Live carries its reframe into the after', () => {
  it('keeps both out_on_camera epilogue variants, each behind the mark that sets it', () => {
    const s = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 });
    const variants = s.endings.out_on_camera?.epilogueIf ?? [];
    expect(variants).toHaveLength(2);
    expect(variants.map(entry => entry.when.flags)).toEqual([[expect.stringContaining('admitted')], [expect.stringContaining('exposed')]]);
    expect(unbound(variants)).toBeNull();
  });
});

describe('the crew opens choices (the officer-driven layer)', () => {
  it('sets a flag for every trait and experience band the deployed officers have', async () => {
    const { startGateRun } = await import('../gates/engine-driver');
    const s = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 });
    const state = startGateRun(s.id);
    const flags = state.activeRun!.flags.filter(flag => flag.startsWith('crew:'));
    expect(flags.some(flag => flag.startsWith('crew:band_'))).toBe(true);
    expect(flags).toEqual([...flags].sort());
  });
  it('compiles a crew condition to its flag, and refuses a mark the engine never sets', () => {
    const crewTree: CallTree = { ...TREE, nodes: TREE.nodes.map(node => node.id !== 'open' ? node : { ...node, choices: node.choices.map(choice => choice.id !== 'watch' ? choice : { ...choice, onlyIf: { crew: ['observant'] } }) }) };
    const s = (() => { for (let seed = 1; seed < 600; seed++) {
      const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: 13 });
      try { return compileIncident({ ...base, id: `crew-${seed}`, incident: hostedSpec(base) }, buildLocation(base.locationFamilyId, base.locationSeed), { ...TEMPLATE, tree: crewTree }); } catch { continue; } }
      throw new Error('no seed'); })();
    expect(action(s, 'open', 'watch').visibleWhen?.flags).toContain('crew:observant');
    const bad: CallTree = { ...crewTree, nodes: crewTree.nodes.map(node => node.id !== 'open' ? node : { ...node, choices: node.choices.map(choice => choice.id !== 'watch' ? choice : { ...choice, onlyIf: { crew: ['psychic'] } }) }) };
    const { clocks: _c, incidentPeople: _p, threats: _t, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed: 3, tier: 2, contentVersion: 13 });
    expect(() => compileIncident({ ...base, id: 'crew-bad', incident: hostedSpec(base) }, buildLocation(base.locationFamilyId, base.locationSeed), { ...TEMPLATE, tree: bad })).toThrow(/psychic/);
  });
});
