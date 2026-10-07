import { describe, it, expect } from 'vitest';
import type { IncidentFramework } from '../../content/incident-frameworks-v9';
import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import { SCENARIO_TYPES_V11 } from '../../content/scenario-types-v11';
import { buildLocation } from '../../sim/location';
import { generateIncident, incidentId } from './index';
import { withAdditionalFramework } from './frameworks-v9';
import { gateFrameworks, specForSituation, VARIANTS } from './gates/catalog';
import { collisions, fingerprintById, fingerprintDraft, firstDifference } from './gates/distinctness';
import type { RecipeFingerprint } from './gates/distinctness';
import { lintFrameworkData, lintScenario, pronounIssues } from './gates/prose-lint';
import { thinStages } from './gates/choices';
import { isProceduralFamily } from '../building';

/** Content gates for every typed framework (docs/content-pipeline.md). A new package must
 * pass all of them before a human reviews it on the story sheet (story.html). */
const FRAMEWORKS = gateFrameworks();
const NEW = FRAMEWORKS.filter(entry => entry.since >= 11);

describe('content gate: prose lint', () => {
  it.each(FRAMEWORKS.map(entry => ({ type: entry.framework.type, entry })))('$type package data passes, with the longest drawable names', ({ entry }) => {
    expect(lintFrameworkData(entry.framework)).toEqual([]);
  });
  it.each(FRAMEWORKS.map(entry => ({ type: entry.framework.type, entry })))('$type compiled calls pass on every building type, situation and pacing', ({ entry }) => {
    for (const familyId of entry.families) for (const variant of VARIANTS) for (const characteristic of ['ordinary', 'deliberate_answers'] as const) {
      const s = generateIncident(specForSituation(entry.framework.type, familyId, variant, 7, characteristic));
      expect(lintScenario(s, entry.framework), `${familyId}/${variant}/${characteristic}`).toEqual([]);
    }
  }, 120000);

  it('catches each kind of problem it claims to catch', () => {
    const spec = specForSituation('water_leak', 'harbour_court', 0), s = generateIncident(spec), framework = ADDITIONAL_FRAMEWORK_BY_TYPE.water_leak!;
    const name = s.story!.cast!.owen.firstName;
    const rules = (mutate: (copy: typeof s) => void) => { const copy = structuredClone(s); mutate(copy); return [...new Set(lintScenario(copy, framework).map(issue => issue.rule))]; };
    expect(rules(() => undefined)).toEqual([]);
    expect(rules(c => { c.briefing.known[0] = 'The neighbour saw the colour of the water.'; })).toEqual(['american']);
    expect(rules(c => { c.summary = 'No arrest is claimed in this scenario.'; })).toContain('meta');
    expect(rules(c => { c.briefing.known.push(framework.variants[0]); })).toEqual(['spoiler']);
    expect(rules(c => { c.stages.assess.actions[0].summary = framework.disproved.replace('Owen', name); })).toEqual(['spoiler']);
    expect(rules(c => { c.stages.assess.actions[0].title = `Hear ${name}’s account of the leak, the stain, the tenant upstairs and the lease`; })).toEqual(['length']);
    expect(rules(c => { c.briefing.known[0] = `${name} says she has the master key.`; })).toEqual(['pronouns']);
    expect(rules(c => { c.briefing.known[0] = 'Owen Hale is waiting downstairs.'; })).toContain('names');
    expect(rules(c => { c.briefing.known[0] = 'Sora is waiting downstairs.'; })).toContain('names');
    expect(rules(c => { c.briefing.known[0] = 'There is blood on the stairs.'; })).toEqual(['safety']);
    expect(rules(c => { c.briefing.known[0] = 'The tenant upstairs stole the water heater.'; })).toEqual(['allegation']);
    expect(rules(c => { c.briefing.known[0] = 'A tenant says the man upstairs stole the water heater.'; })).toEqual([]);
    expect(rules(c => { c.endings.handed_over.summary = 'The tenant is arrested.'; })).toEqual(['allegation']);
    // A gendered relative licenses the other pronoun in the same sentence.
    expect(pronounIssues([{ where: 'x', text: 'Theo calls the man their uncle, and he agrees.' }], [{ firstName: 'Theo', pronouns: 'they' }])).toEqual([]);
    expect(pronounIssues([{ where: 'x', text: 'Theo says he is lost.' }], [{ firstName: 'Theo', pronouns: 'they' }])).toHaveLength(1);
  });
});

describe('content gate: distinctness', () => {
  // Recipe = framework x situation. Pacing changes time, not decisions, so it is not a recipe.
  const prints: RecipeFingerprint[] = FRAMEWORKS.flatMap(({ framework, families }) => VARIANTS.map(variant =>
    fingerprintById(incidentId(specForSituation(framework.type, families[0], variant)), `${framework.type}/${variant}`)));
  // The six hand-authored stories are existing recipes too; new packages must differ from them.
  const authored: RecipeFingerprint[] = SCENARIO_TYPES_V11.filter(info => !ADDITIONAL_FRAMEWORK_BY_TYPE[info.type]).flatMap(info => VARIANTS.map(variant =>
    fingerprintById(incidentId(specForSituation(info.type, info.families[0], variant)), `${info.type}/${variant}`)));
  const all = [...prints, ...authored];

  it('explores every path without truncation', () => {
    for (const print of prints) expect(print.truncated, print.key).toBe(false);
    for (const print of prints) expect(print.paths.length, print.key).toBeGreaterThan(4);
    // From v12 the hand-authored stories offer a second choice at every stage, and the number
    // of orderings grows past the cap in the largest ones (barricade has over 100,000). A
    // capped fingerprint is still deterministic, which is all collision checks against new
    // packages need; typed frameworks above stay exact. This list records which ones cap.
    expect(authored.filter(print => print.truncated).map(print => print.key)).toEqual(['barricaded/0', 'barricaded/1', 'barricaded/2', 'hostage_crisis/0', 'hostage_crisis/2', 'protected_rescue/1', 'protected_rescue/2']);
  });
  it('every recipe added in v11 or later differs from every other recipe in a decision or an ending', () => {
    const fresh = new Set(NEW.flatMap(entry => VARIANTS.map(variant => `${entry.framework.type}/${variant}`)));
    expect(fresh.size).toBe(NEW.length * 3);
    expect(collisions(all).filter(pair => fresh.has(pair.a) || fresh.has(pair.b))).toEqual([]);
  });
  it('records the existing recipes that play identically (known debt, never re-baseline silently)', () => {
    // In v9-v11 the eight v9 frameworks collapsed to six shapes (24 recipes, 6 fingerprints);
    // v12 decision depth makes every typed recipe distinct. What remains is a hand-authored
    // story. A new entry here means new content collided; a missing one means a fix landed.
    const groups = new Map<string, string[]>();
    for (const print of all) groups.set(print.hash, [...groups.get(print.hash) ?? [], print.key]);
    const shared = [...groups.values()].filter(keys => keys.length > 1).map(keys => keys.sort().join(' = ')).sort();
    expect(shared).toEqual([
      'welfare_check/1 = welfare_check/2',
    ]);
  });
  it('fingerprints do not depend on the building, cast or placement', () => {
    for (const { framework, families } of NEW) for (const variant of VARIANTS) {
      const base = prints.find(print => print.key === `${framework.type}/${variant}`)!;
      for (const [familyId, buildingSeed] of [[families.at(-1)!, 19], [families[0], 23]] as const) {
        const other = fingerprintById(incidentId(specForSituation(framework.type, familyId, variant, buildingSeed)), `${framework.type}/${variant}@${familyId}`);
        expect(other.hash, `${other.key}: ${firstDifference(base, other)}`).toBe(base.hash);
      }
    }
  }, 60000);

  it('rejects a deliberate reskin: new prose on an existing decision structure', () => {
    // The package as it compiles at the gated version, decision depth included.
    const original = gateFrameworks().find(entry => entry.framework.type === 'burglary')!.framework;
    const reskin: IncidentFramework = { ...original, title: 'The Gym After Hours', personId: 'casey', name: 'Casey Bell', role: 'Gym manager',
      dispatch: 'A door sensor at the gym tripped overnight. Check it with the manager before calling it a break-in.',
      opening: 'The gym’s door sensor tripped after closing, and Casey Bell, the manager, is here. A sensor on its own doesn’t mean anyone got in.',
      question: 'Did someone get in, or did the sensor fault?', factLabel: 'Signs someone got in',
      approaches: ['Go over the sensor log with Casey', 'Compare the patrol walk-around with the log'],
      approachResults: ['Casey gives the closing time and which doors tripped.', 'Patrol separates what they saw from the automated message.'],
      verify: 'Check the side door with Casey', claim: 'The side door has fresh marks that need recording.',
      confirmed: 'There are fresh marks on the side door. Nobody is inside.', disproved: 'The sensor is loose, and the door is fine.',
      resolutions: ['Record the marks and hand the gym to Casey', 'Report the loose sensor with Casey'],
      results: ['The marks are recorded for investigators, and Casey takes charge of the gym.', 'The alarm company gets a fault report, and Casey locks up.'],
      variants: ['Fresh marks after closing', 'A loose sensor again', 'Marks the automated message missed'] };
    const spec = specForSituation('burglary', 'market_row', 0), issued = generateIncident(spec);
    const draft = withAdditionalFramework(issued, buildLocation(issued.locationFamilyId, issued.locationSeed), reskin);
    expect(draft.title).toBe('The Gym After Hours');
    const print = fingerprintDraft(draft, 'gym_reskin/0');
    const clashes = collisions([...all, print]).filter(pair => pair.a === 'gym_reskin/0' || pair.b === 'gym_reskin/0');
    expect(clashes.map(pair => pair.a === 'gym_reskin/0' ? pair.b : pair.a)).toContain('burglary/0');
    // Changing which report the team can act on is a real decision, but this one copies
    // Water Through the Ceiling's structure exactly (act on the report that the claim holds,
    // early step needed when it does), so it fails too.
    const built = buildLocation(issued.locationFamilyId, issued.locationSeed);
    const precaution = { title: 'Ask Casey to lock the other doors', summary: 'Secures the building now, but takes a few minutes.', result: 'Casey locks the other doors.',
      lateTitle: 'Have Casey lock the other doors now', lateSummary: 'It takes longer now.' };
    const actsOnAlarm = { ...reskin.actOnReport!, assume: 'confirmed' as const };
    const copied = fingerprintDraft(withAdditionalFramework(issued, built, { ...reskin, actOnReport: actsOnAlarm, precaution: { ...precaution, requiredFor: 'confirmed' } }), 'gym_copied/0');
    expect(collisions([...all, copied]).filter(pair => pair.b === 'gym_copied/0').map(pair => pair.a)).toEqual(['water_leak/0']);
    // Early step needed when the claim is wrong, and both accounts needed before acting on
    // it when it holds: a decision no existing recipe has.
    const deeper = fingerprintDraft(withAdditionalFramework(issued, built, { ...reskin, actOnReport: actsOnAlarm, precaution: { ...precaution, requiredFor: 'disproved' },
      corroborate: { for: 'confirmed', summary: 'Before recording the marks, hear Casey and patrol. This takes a few more minutes.' } }), 'gym_deeper/0');
    expect(collisions([...all, deeper]).filter(pair => pair.a === 'gym_deeper/0' || pair.b === 'gym_deeper/0')).toEqual([]);
  });
});

describe('content gate: choices', () => {
  // A stage that opens with one button the player can press is not a decision.
  it.each(FRAMEWORKS.map(entry => ({ type: entry.framework.type, entry })))('$type opens every stage with at least two choices, on every building type', ({ entry }) => {
    for (const familyId of entry.families) for (const variant of VARIANTS) {
      const thin = thinStages(incidentId(specForSituation(entry.framework.type, familyId, variant)));
      expect(thin.map(stage => `${stage.stage} [${stage.choices.join(', ')}] after ${stage.path}`), `${familyId}/${variant}`).toEqual([]);
    }
  }, 300000);

  it('catches the single-button stages the typed frameworks had before v12', () => {
    for (const type of ['burglary', 'water_leak'] as const) {
      const issued = { ...specForSituation(type, FRAMEWORKS.find(entry => entry.framework.type === type)!.families[0], 0), contentVersion: 11 };
      expect(thinStages(incidentId(issued)).length, type).toBeGreaterThan(0);
    }
    // The issued v11 hostage call opened with a single choice.
    const hostage = { ...specForSituation('hostage_crisis', 'market_row', 0), contentVersion: 11 };
    expect(thinStages(incidentId(hostage)).some(stage => stage.path === 'start')).toBe(true);
  });

  // The six hand-authored stories have their own structures; v12 gives each thin stage a
  // second real choice (decisions-v8/choices-v12.ts). Their decision graphs are larger, so
  // the suite checks one authored and one generated building type for each.
  const AUTHORED = SCENARIO_TYPES_V11.filter(info => !ADDITIONAL_FRAMEWORK_BY_TYPE[info.type]);
  it.each(AUTHORED.map(info => ({ type: info.type, info })))('$type (hand-authored) opens every stage with at least two choices', ({ info }) => {
    const families = [...new Set([info.families[0], info.families.find(isProceduralFamily)].filter((id): id is string => !!id))];
    for (const familyId of families) for (const variant of VARIANTS) {
      const thin = thinStages(incidentId(specForSituation(info.type, familyId, variant)));
      expect(thin.map(stage => `${stage.stage} [${stage.choices.join(', ')}] after ${stage.path}`), `${familyId}/${variant}`).toEqual([]);
    }
  }, 600000);
});
