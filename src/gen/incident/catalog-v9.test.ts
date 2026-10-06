import { describe, it, expect } from 'vitest';
import { SCENARIO_RECIPES_V9, SCENARIO_TYPES_V9, specForRecipe, scenarioRecipe } from '../../content/scenario-recipes';
import { ADDITIONAL_FRAMEWORK_BY_TYPE } from '../../content/incident-frameworks-v9';
import { SCENARIO_FIRST_NAMES, SCENARIO_SURNAMES } from '../../content/scenario-names';
import { generateIncident, parseIncidentId, drawIncidentSpec } from './index';
import { bindScenarioText } from './stories-v6/episode-plan';
import { drawScenarioCast, SCENARIO_CAST } from './cast-v9';
import { AMERICAN_ENGLISH } from '../../content/american-english';
import fingerprints from './issued-v6-v8-fingerprints.json';
import { buildLocation } from '../../sim/location';
import { validateStoryBindings } from '../../sim/story-bindings';
import { createInitialState } from '../../sim/department';
import { actionViews, pendingDebrief, stageContinuations } from '../../sim/operation-selectors';
import { responseFailurePlan } from '../../sim/response-failure';
import { apply, NOW, startCmd } from '../../sim/test-fixtures';
import { serialize, deserialize } from '../../sim/save';
import { scenarioActions } from '../../sim/scenario-types';

const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
describe('version 9 catalog contract', () => {
  it('has 100 distinct recipes across 14 frameworks, with coverage of all families and variants', () => {
    expect(SCENARIO_RECIPES_V9).toHaveLength(100);
    expect(new Set(SCENARIO_RECIPES_V9.map(r => r.id)).size).toBe(100);
    expect(SCENARIO_TYPES_V9).toHaveLength(14);
    for (const type of SCENARIO_TYPES_V9) {
      const recipes = SCENARIO_RECIPES_V9.filter(r => r.type === type.type);
      expect(new Set(recipes.map(r => r.familyId))).toEqual(new Set(type.families));
      expect(new Set(recipes.map(r => r.variant))).toEqual(new Set([0, 1, 2]));
      expect(new Set(recipes.map(r => r.characteristic))).toEqual(new Set(['ordinary', 'deliberate_answers']));
    }
  });
  it('preserves every captured issued v6–v8 definition byte for byte', async () => {
    for (const [id, expected] of Object.entries(fingerprints)) {
      const {type, familyId, seed, buildingSeed, tier, contentVersion} = parseIncidentId(id)!;
      expect(await digest(generateIncident({type, familyId, seed, buildingSeed, tier, contentVersion})), id).toBe(expected);
    }
  }, 120000);
  it.each(SCENARIO_RECIPES_V9)('$id builds valid, repeatable real geometry and a coherent cast', recipe => {
    for (const buildingSeed of [7, 19]) {
      const spec = specForRecipe(recipe, buildingSeed), s = generateIncident(spec);
      expect(s.story?.recipeId).toBe(recipe.id); expect(s.version).toBe(9);
      expect(parseIncidentId(s.id)).toEqual(spec);
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      expect(built.issues.filter(i => i.severity === 'error')).toEqual([]);
      expect(validateStoryBindings(s, built)).toEqual([]);
      expect(generateIncident(spec)).toEqual(s);
      const names = Object.values(s.story!.cast!);
      expect(new Set(names.map(p => p.firstName)).size).toBe(names.length);
      const raw = JSON.stringify(s);
      for (const slot of SCENARIO_CAST[spec.type]!) {
        // A generated identity can legitimately equal an authored name.
        const original = slot.authoredName;
        if (!names.some(p => `${p.firstName} ${p.surname}` === original) && original.includes(' ')) expect(raw, recipe.id).not.toContain(original);
      }
      if (recipe.characteristic === 'deliberate_answers') {
        expect(s.story!.characteristics).toHaveLength(1);
        expect(scenarioActions(s).some(a => a.summary.includes('Allow extra time'))).toBe(true);
      }
    }
  }, 30000);
  it('display binding cannot alter names that also happen to be IDs, flags, enums or object selectors', () => {
    const s = generateIncident(specForRecipe(SCENARIO_RECIPES_V9[0]));
    const a = s.stages.assess.actions[0];
    a.id = 'Grant'; a.requires.flags = [{ flag: 'Grant', reason: 'Ask Grant' }];
    a.outcomes.favorable.push({ setFlags: ['Grant'], text: 'Grant answered.' });
    a.summary = 'Grant asked Grant. Granton is different.';
    const bound = bindScenarioText(s, { Grant: 'Morgan' });
    expect(bound.stages.assess.actions[0]).toMatchObject({ id: 'Grant', summary: 'Morgan asked Morgan. Granton is different.', requires: { flags: [{flag: 'Grant', reason:'Ask Morgan'}] } });
    expect(bound.stages.assess.actions[0].outcomes.favorable.at(-1)).toEqual({ setFlags: ['Grant'], text:'Morgan answered.' });
    expect(a.summary).toContain('Grant');
  });
  it('uses American spelling in generated display fields without changing names or machine keys', () => {
    for (const recipe of SCENARIO_RECIPES_V9) {
      const s = generateIncident(specForRecipe(recipe));
      expect(bindScenarioText(s, AMERICAN_ENGLISH), recipe.id).toEqual(s);
    }
    const s = generateIncident(specForRecipe(SCENARIO_RECIPES_V9[0]));
    s.title = 'Neighbour cancelled a labelled licence';
    s.id = 'neighbour';
    expect(bindScenarioText(s, AMERICAN_ENGLISH)).toMatchObject({id:'neighbour', title:'Neighbor canceled a labeled license'});
  });
  it('fresh variations preserve the recipe while changing the seeded cast and building', () => {
    for (const recipe of SCENARIO_RECIPES_V9) {
      const first = generateIncident(specForRecipe(recipe, 7));
      const next = generateIncident(specForRecipe(recipe, 8));
      expect(first.story!.recipeId).toBe(next.story!.recipeId);
      expect(first.story!.cast).not.toEqual(next.story!.cast);
      expect(first.locationSeed).not.toBe(next.locationSeed);
    }
  });
  it('draws names independently, respects surname relationships and offers broad cast variation', () => {
    const spec = specForRecipe(SCENARIO_RECIPES_V9.find(r => r.type === 'barricaded')!);
    const casts = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const cast = drawScenarioCast({...spec, seed});
      expect(cast.mina.surname).toBe(cast.cal.surname); expect(cast.mina.firstName).not.toBe(cast.cal.firstName);
      casts.add(JSON.stringify(cast));
    }
    expect(casts.size).toBeGreaterThan(190);
    expect(SCENARIO_SURNAMES.length).toBe(100);
    expect(Object.values(SCENARIO_FIRST_NAMES).every(pool => pool.length > 10)).toBe(true);
  });
  it('new board draws cover all frameworks and favor ordinary calls over high-risk calls', () => {
    let rng = 5142; const seen = new Set<string>(); let highRisk = 0;
    for (let i = 0; i < 3000; i++) {
      const result = drawIncidentSpec(rng, { level: 6, trust: 80, contentVersion: 9 }); rng = result.state;
      seen.add(result.spec.type); expect(scenarioRecipe(result.spec)).toBeDefined();
      if (['active_armed_incident', 'hostage_crisis', 'protected_rescue'].includes(result.spec.type)) highRisk++;
    }
    expect(seen.size).toBe(14); expect(highRisk).toBeLessThan(500);
  });
});

describe('complete catalog journeys through real dispatch and save boundaries', () => {
  it.each(SCENARIO_RECIPES_V9)('$id can finish or honestly report an exhausted response, then close exactly once', recipe => {
    const spec = specForRecipe(recipe), s = generateIncident(spec);
    const before = createInitialState(NOW, 719);
    before.incidents = [{ id:s.id, type:spec.type, familyId:spec.familyId, tier:spec.tier, arrivedAt:NOW, expiresAt:NOW+3600000, seen:false }];
    const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
    const start = apply(before, startCmd(s.id, ['A'], { positions:{A:entry}, loadouts:{A:{}}, practice:true }));
    expect(start.result, s.id).toEqual({ok:true}); let state = start.state;
    for (let step=0; step<60 && state.activeRun!.status === 'active'; step++) {
      const choices = actionViews(state, NOW, 'A').filter(a => a.eligible);
      const continuation = stageContinuations(state)[0];
      let result;
      if (choices.length) {
        const action = choices[0];
        result = apply(state, {type:'decide', actionId:action.id, actingSquadIds:action.actingSquadIds, supportSquadIds:action.supportSquadIds});
      } else if (continuation) result = apply(state, {type:'continueStage',actionId:continuation.actionId,revision:continuation.revision});
      else {
        const plan = responseFailurePlan(state); expect(plan, recipe.id).not.toBeNull();
        result = apply(state, {type:'endFailedResponse',runId:plan!.runId,revision:plan!.revision});
      }
      expect(result.result,recipe.id).toEqual({ok:true});
      const restored = deserialize(serialize(result.state,NOW));
      expect(restored?.activeRun).toEqual(result.state.activeRun); state = restored!;
    }
    expect(state.activeRun!.status,recipe.id).toBe('debrief');
    const report = pendingDebrief(state)!; expect(report).not.toBeNull();
    expect(report.fundingReward).toBe(0); expect(report.devPointReward).toBe(0);
    if (ADDITIONAL_FRAMEWORK_BY_TYPE[spec.type] && report.completionAchieved) expect(state.activeRun!.flags).toContain(`v9_${spec.type}_completed`);
    const closed = apply(state,{type:'closeDebrief'}); expect(closed.result).toEqual({ok:true});
    expect(closed.state.units).toEqual(before.units); expect(closed.state.department.trust).toBe(before.department.trust);
    expect(apply(closed.state,{type:'closeDebrief'}).result.ok).toBe(false);
  }, 30000);
});
