import { describe, it, expect } from 'vitest';
import { ARMED_RETAIL, ARMED_SETTING_MODULES, type ArmedIncidentProse } from '../../content/setting-modules-armed';
import { bindSettingTemplate, locationSettings, selectSettingModule, type SettingModule } from '../../content/setting-modules';
import { GENERATED_FAMILIES_V11 } from '../../content/scenario-types-v11';
import { baseFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { validateStoryBindings } from '../../sim/story-bindings';
import { routeBetween } from '../../sim/spatial-factors';
import { createInitialState } from '../../sim/department';
import { actionViews, pendingDebrief, stageContinuations } from '../../sim/operation-selectors';
import { responseFailurePlan } from '../../sim/response-failure';
import { apply, NOW, startCmd, stockKit } from '../../sim/test-fixtures';
import { serialize, deserialize } from '../../sim/save';
import { scenarioActions, type IncidentSpec, type ScenarioDefinition } from '../../sim/scenario-types';
import { hashSeed } from '../../sim/rng';
import { generateIncident, incidentId, parseIncidentId } from './index';
import { settingModuleOf, settingTokens } from './stories-v6/setting-modules-v11';

/** v11 draws use the second building generation; v10 keeps `_g1`. */
const forVersion = (familyId: string, contentVersion: number) => contentVersion >= 11 && familyId.endsWith('_g1') ? `${familyId.slice(0, -3)}_g2` : familyId;
const armed = (familyId: string, buildingSeed: number, contentVersion = 11): IncidentSpec =>
  ({ type: 'active_armed_incident', familyId: forVersion(familyId, contentVersion), buildingSeed, seed: buildingSeed * 13 + 1, tier: 3, contentVersion });
const EXPECTED: Record<string, string> = {
  corner_store_flat_g1: 'armed_retail_till_count', bar_restaurant_g1: 'armed_retail_till_count', market_row: 'armed_retail_till_count',
  small_office_g1: 'armed_office_late_worker', warehouse_g1: 'armed_warehouse_night_picker', motel_row_g1: 'armed_motel_night_clerk',
};
const NEW_TYPES = ['small_office_g1', 'warehouse_g1', 'motel_row_g1'];
/** Every display string the player can read, joined (machine IDs excluded by shape). */
const prose = (s: ScenarioDefinition) => {
  const out: string[] = [];
  const visit = (v: unknown, key = '') => {
    if (typeof v === 'string') { if (v.includes(' ') || ['label', 'title'].includes(key)) out.push(v); }
    else if (Array.isArray(v)) v.forEach(x => visit(x, key));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) visit(x, k);
  };
  visit(s);
  return out.join('\n');
};
const hosted = (s: ScenarioDefinition, spec: IncidentSpec) => baseFamilyIdV7(s.locationFamilyId) === spec.familyId && s.locationSeed === spec.buildingSeed;

describe('setting module selection', () => {
  it('classifies buildings by their rooms and picks the matching armed module', () => {
    for (const [familyId, id] of Object.entries(EXPECTED)) for (const seed of [1, 2, 5, 9]) {
      const built = buildLocation(familyId === 'market_row' ? 'market_row__furnished_v7' : `${familyId}__furnished_v7`, seed);
      const selection = selectSettingModule(ARMED_SETTING_MODULES, built, built.location.entries[0], hashSeed(`${seed}:pick`));
      expect(selection?.module.id, `${familyId} ${seed} ${locationSettings(built.location)}`).toBe(id);
      const s = generateIncident(armed(familyId, seed));
      expect(settingModuleOf(s)?.id, `${familyId} ${seed}`).toBe(id);
      expect(s.story!.episode!.modules).toContain(`setting:${id}`);
    }
  }, 120000);
  it('keeps the retail module on the v10 room and text', () => {
    // Market Row is the retail building that is identical in v10 and v11.
    for (const familyId of ['market_row']) for (const seed of [3, 8, 21]) {
      const v10 = generateIncident(armed(familyId, seed, 10)), v11 = generateIncident(armed(familyId, seed));
      expect(v11.story!.bindings.rooms.scene, `${familyId} ${seed}`).toEqual(v10.story!.bindings.rooms.scene);
      expect(v11.story!.bindings.people, `${familyId} ${seed}`).toEqual(v10.story!.bindings.people);
      expect(v11.summary).toBe(v10.summary);
      expect(v11.briefing).toEqual(v10.briefing);
      expect(v11.endings).toEqual(v10.endings);
    }
  }, 120000);
  it('leaves v10 and earlier untouched: no module marks, and the new buildings stay out of v10', () => {
    for (const familyId of ['corner_store_flat_g1', 'bar_restaurant_g1']) {
      const s = generateIncident(armed(familyId, 4, 10));
      expect(s.story!.episode!.modules.some(m => m.startsWith('setting:'))).toBe(false);
    }
    for (const familyId of NEW_TYPES) {
      expect(parseIncidentId(incidentId(armed(familyId, 4, 10)))).toBeNull();
      expect(parseIncidentId(incidentId(armed(familyId, 4)))).not.toBeNull();
    }
  });
  it('hosts on each listed v11 building type at 30% or more of building seeds', () => {
    expect(GENERATED_FAMILIES_V11.active_armed_incident).toEqual(NEW_TYPES);
    for (const familyId of NEW_TYPES) {
      let ok = 0;
      for (let seed = 1; seed <= 20; seed++) { const spec = armed(familyId, seed); if (hosted(generateIncident(spec), spec)) ok++; }
      expect(ok / 20, familyId).toBeGreaterThanOrEqual(0.3);
    }
  }, 300000);
});

describe('setting module prose', () => {
  const RETAIL_WORDS = /\b(tills?|registers?|shops?|drawers?|shop worker|Market Row)\b/i;
  it.each(NEW_TYPES)('%s binds every module line to the real rooms and cast with no retail wording left', familyId => {
    for (const seed of [1, 4, 7, 12]) {
      const spec = armed(familyId, seed), s = generateIncident(spec);
      expect(hosted(s, spec), `${familyId} ${seed}`).toBe(true);
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      const module = settingModuleOf(s)! as SettingModule<ArmedIncidentProse>;
      const text = prose(s);
      expect(text, `${familyId} ${seed}`).not.toMatch(RETAIL_WORDS);
      // Each slot's bound line, renamed like the cast binder, is present: every source
      // sentence was found and replaced, and every token resolved to a real label.
      const cast = s.story!.cast!;
      const names = (line: string) => line.replace(/\bEli Tran\b/g, `${cast.eli.firstName} ${cast.eli.surname}`).replace(/\bEli\b/g, cast.eli.firstName).replace(/\bGrant\b/g, cast.grant.firstName);
      const tokens = settingTokens(s, built, module);
      const lines: string[] = [];
      const collect = (v: unknown) => typeof v === 'string' ? lines.push(v) : Array.isArray(v) ? v.forEach(collect) : v && typeof v === 'object' ? Object.values(v).forEach(collect) : undefined;
      collect(module.prose);
      for (const line of lines) expect(text, `${familyId} ${seed}: ${line}`).toContain(names(bindSettingTemplate(line, tokens)));
      const scene = built.location.rooms.find(r => r.id === s.story!.bindings.rooms.scene.spaceId)!;
      expect(text).toContain(scene.label.toLowerCase());
      expect(s.summary).toContain(built.location.name);
    }
  }, 120000);
  it('never names a hidden outcome in labels and stays free of meta-disclaimers', () => {
    const meta = /\b(invented|is claimed|are claimed|is implied|says nothing about|fictional)\b/i;
    for (const module of ARMED_SETTING_MODULES.filter(m => m !== ARMED_RETAIL)) {
      const lines: string[] = [];
      const collect = (v: unknown) => typeof v === 'string' ? lines.push(v) : Array.isArray(v) ? v.forEach(collect) : v && typeof v === 'object' ? Object.values(v).forEach(collect) : undefined;
      collect(module.prose);
      for (const line of lines) {
        expect(line, module.id).not.toMatch(meta);
        expect(line, module.id).not.toMatch(/stand(s)? down|stood down|puts? the weapon down|arrest|recover/i);
        expect(line, module.id).not.toMatch(RETAIL_WORDS);
        expect(line, module.id).not.toMatch(/colour|neighbour|centre|organis|favour/i);
      }
    }
  });
});

describe('setting module playability', () => {
  it.each(Object.keys(EXPECTED).filter(f => f !== 'market_row'))('%s: every story person starts where squads from the arrival can reach them', familyId => {
    for (const seed of [2, 6, 11, 17]) {
      const s = generateIncident(armed(familyId, seed));
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      expect(validateStoryBindings(s, built)).toEqual([]);
      const arrival = s.story!.bindings.exterior.arrival.spaceId;
      const people = Object.values(s.story!.bindings.people);
      for (const person of people) {
        const reachable = built.derived.stagingPoints.filter(point => point.spaceId === arrival)
          .some(start => routeBetween(built, arrival, start.at, person.initial.spaceId, person.initial.at, null).reachable);
        expect(reachable, `${familyId} ${seed}: ${person.id} in ${person.initial.spaceId}`).toBe(true);
      }
      const [eli, grant] = [s.story!.bindings.people.eli, s.story!.bindings.people.grant];
      const apart = ['small_office_g1', 'motel_row_g1'].includes(familyId);
      expect(eli.initial.spaceId === grant.initial.spaceId, `${familyId} ${seed}`).toBe(!apart);
      // Grant's report, map anchor and the firearm actions all follow his own room.
      expect(s.facts.find(f => f.id === grant.locationFactId)!.spaceId).toBe(grant.initial.spaceId);
      expect(scenarioActions(s).find(a => a.id === 'v7_check_grant')!.targetId).toBe(grant.initial.spaceId);
    }
  }, 120000);

  const journeys = Object.entries(EXPECTED).filter(([f]) => f !== 'market_row' && f !== 'bar_restaurant_g1').flatMap(([familyId]) => [0, 1].map(strategy => ({ familyId, strategy })));
  it.each(journeys)('$familyId (strategy $strategy) plays a full dispatch journey through save boundaries to debrief', ({ familyId, strategy }) => {
    const spec = armed(familyId, 3 + strategy * 5), s = generateIncident(spec);
    expect(hosted(s, spec)).toBe(true);
    const before = createInitialState(NOW, 719);
    before.incidents = [{ id: s.id, type: spec.type, familyId: spec.familyId, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
    const entry = s.story!.bindings.exterior.arrival.spaceId;
    const kit = stockKit(before, ['A']);
    const start = apply(kit.state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units }));
    expect(start.result, s.id).toEqual({ ok: true });
    let state = start.state;
    for (let step = 0; step < 60 && state.activeRun!.status === 'active'; step++) {
      const choices = actionViews(state, NOW, 'A').filter(a => a.eligible);
      const continuation = stageContinuations(state)[0];
      let result;
      if (choices.length) {
        // Strategy 0 takes the first eligible choice; strategy 1 a seeded one, so the two
        // journeys walk different branches of the same module.
        const action = choices[strategy ? hashSeed(`${s.id}:${step}`) % choices.length : 0];
        result = apply(state, { type: 'decide', actionId: action.id, actingSquadIds: action.actingSquadIds, supportSquadIds: action.supportSquadIds });
      } else if (continuation) result = apply(state, { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision });
      else {
        const plan = responseFailurePlan(state); expect(plan, s.id).not.toBeNull();
        result = apply(state, { type: 'endFailedResponse', runId: plan!.runId, revision: plan!.revision });
      }
      expect(result.result, s.id).toEqual({ ok: true });
      const restored = deserialize(serialize(result.state, NOW));
      expect(restored?.activeRun).toEqual(result.state.activeRun);
      state = restored!;
    }
    expect(state.activeRun!.status, s.id).toBe('debrief');
    expect(pendingDebrief(state)).not.toBeNull();
    const closed = apply(state, { type: 'closeDebrief' });
    expect(closed.result).toEqual({ ok: true });
    expect(closed.state.department.funding).toBe(state.department.funding + pendingDebrief(state)!.fundingReward);
    expect(apply(closed.state, { type: 'closeDebrief' }).result.ok).toBe(false);
  }, 60000);
});
