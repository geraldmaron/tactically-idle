import { describe, it, expect } from 'vitest';
import { GENERATED_FAMILIES_V10 } from '../../content/scenario-types-v10';
import { baseFamilyIdV7 } from '../building';
import { buildLocation } from '../../sim/location';
import { validateStoryBindings } from '../../sim/story-bindings';
import { createInitialState } from '../../sim/department';
import { actionViews, pendingDebrief, stageContinuations } from '../../sim/operation-selectors';
import { responseFailurePlan } from '../../sim/response-failure';
import { apply, NOW, startCmd, stockKit } from '../../sim/test-fixtures';
import { serialize, deserialize } from '../../sim/save';
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { generateIncident } from './index';
import { roomPhraseV10 } from './stories-v6/hosts-v10';

/** The six authored stories that v10 hosts on generated buildings by location requirements. */
const LEGACY: IncidentType[] = ['welfare_check', 'barricaded', 'medical_complication', 'active_armed_incident', 'hostage_crisis', 'protected_rescue'];
const PAIRS = LEGACY.flatMap(type => (GENERATED_FAMILIES_V10[type] ?? []).map(familyId => ({ type, familyId })));
const SEEDS = [3, 1001, 2024, 4099, 7919, 12345, 31337, 65537, 99991, 123457];
const specFor = (type: IncidentType, familyId: string, buildingSeed: number): IncidentSpec => ({ type, familyId, buildingSeed, seed: buildingSeed * 13 + 7, tier: 2, contentVersion: 10 });
/** generateIncident falls back to other seeds, then authored buildings; this is the drawn seed's own answer. */
const hostedAtDrawnSeed = (spec: IncidentSpec, s: ScenarioDefinition) => baseFamilyIdV7(s.locationFamilyId) === spec.familyId && s.locationSeed === spec.buildingSeed;
const displayText = (s: ScenarioDefinition) => {
  const out: string[] = [];
  const visit = (value: unknown, key = ''): void => {
    if (typeof value === 'string') { if (['title', 'summary', 'label', 'text', 'prompt', 'claim', 'description', 'reason', 'task', 'favorable', 'mixed', 'adverse', 'confirmed', 'disproved', 'uncertainty', 'note', 'reportedText', 'dispatchReason'].includes(key) || /^\d+$/.test(key)) out.push(value); }
    else if (Array.isArray(value)) value.forEach(item => visit(item, key === 'known' || key === 'unknown' || key === 'teamResponsibilities' || key === 'remainingTasks' || key === 'publicContext' ? '0' : ''));
    else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) visit(v, k);
  };
  visit(s);
  return out.join('\n');
};

describe('v10 authored stories on generated buildings', () => {
  it('lists every legacy framework somewhere, and only on generated types of the matching setting', () => {
    for (const type of LEGACY) expect(GENERATED_FAMILIES_V10[type]?.length, type).toBeGreaterThan(0);
    for (const { type, familyId } of PAIRS) {
      const business = ['medical_complication', 'active_armed_incident', 'hostage_crisis'].includes(type);
      expect(buildLocation(familyId, 1).location.setting === 'business', `${type} on ${familyId}`).toBe(business);
    }
  });

  it.each(PAIRS)('$type on $familyId hosts at the drawn seed often, with valid, deterministic, playable stories', ({ type, familyId }) => {
    let hosted = 0;
    for (const buildingSeed of SEEDS) {
      const spec = specFor(type, familyId, buildingSeed), s = generateIncident(spec);
      expect(generateIncident(spec)).toEqual(s);
      if (!hostedAtDrawnSeed(spec, s)) continue;
      hosted++;
      expect(s.version).toBe(10); expect(s.incident).toEqual(spec);
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      expect(built.issues.filter(issue => issue.severity === 'error')).toEqual([]);
      expect(validateStoryBindings(s, built), s.id).toEqual([]);
      // Building identity comes from the real location: no authored building or room names remain.
      // The location's own name and labels may say "shop" ("Shop floor"); remove them first.
      let prose = displayText(s).toLowerCase();
      for (const own of [built.location.name, ...built.location.rooms.map(r => r.label), ...built.location.zones.map(z => z.label)].sort((a, b) => b.length - a.length)) prose = prose.split(own.toLowerCase()).join('');
      expect(prose.match(/.{0,60}(market row|print[- ]shop|\bshop\b).{0,30}/g), s.id).toBeNull();
      const scene = built.location.rooms.find(room => room.id === s.story!.bindings.rooms.scene.spaceId)!;
      if (type === 'protected_rescue') {
        expect(scene).toMatchObject({ type: 'living', floor: 0 });
        expect(s.summary).toContain(`waiting in the ${roomPhraseV10(scene)}`);
        expect(s.story!.bindings.routes.chair_exit.profile).toBe('chair');
      }
      if (type === 'active_armed_incident') expect(built.location.objects.find(o => o.id === (s.story!.bindings.props.register as { objectId?: string }).objectId)).toMatchObject({ type: 'register', in: scene.id });
      if (['medical_complication', 'active_armed_incident', 'hostage_crisis'].includes(type)) expect(s.summary, s.id).toContain(built.location.name);
      const state = createInitialState(NOW, 719);
      state.incidents = [{ id: s.id, type, familyId, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
      const entry = built.location.entries[0];
      expect(apply(state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: { A: {} } })).result, s.id).toEqual({ ok: true });
    }
    // The listing threshold: at least 30% of building seeds host the story themselves.
    expect(hosted, `${type} on ${familyId}`).toBeGreaterThanOrEqual(3);
  }, 120000);
});

describe('v10 authored story journeys on generated buildings', () => {
  const JOURNEYS = LEGACY.map(type => ({ type, familyId: GENERATED_FAMILIES_V10[type]![0] }));
  it.each(JOURNEYS)('$type on $familyId finishes or honestly reports an exhausted response, through saves', ({ type, familyId }) => {
    const spec = SEEDS.map(seed => specFor(type, familyId, seed)).find(candidate => hostedAtDrawnSeed(candidate, generateIncident(candidate)))!;
    const s = generateIncident(spec);
    const before = createInitialState(NOW, 719);
    before.incidents = [{ id: s.id, type, familyId, tier: spec.tier, arrivedAt: NOW, expiresAt: NOW + 3600000, seen: false }];
    const entry = buildLocation(s.locationFamilyId, s.locationSeed).location.entries[0];
    const kit = stockKit(before, ['A']);
    const start = apply(kit.state, startCmd(s.id, ['A'], { positions: { A: entry }, loadouts: kit.loadouts, units: kit.units }));
    expect(start.result, s.id).toEqual({ ok: true }); let state = start.state;
    for (let step = 0; step < 60 && state.activeRun!.status === 'active'; step++) {
      const choices = actionViews(state, NOW, 'A').filter(a => a.eligible);
      const continuation = stageContinuations(state)[0];
      let result;
      if (choices.length) {
        const action = choices[0];
        result = apply(state, { type: 'decide', actionId: action.id, actingSquadIds: action.actingSquadIds, supportSquadIds: action.supportSquadIds });
      } else if (continuation) result = apply(state, { type: 'continueStage', actionId: continuation.actionId, revision: continuation.revision });
      else {
        const plan = responseFailurePlan(state); expect(plan, s.id).not.toBeNull();
        result = apply(state, { type: 'endFailedResponse', runId: plan!.runId, revision: plan!.revision });
      }
      expect(result.result, s.id).toEqual({ ok: true });
      const restored = deserialize(serialize(result.state, NOW));
      expect(restored?.activeRun).toEqual(result.state.activeRun); state = restored!;
    }
    expect(state.activeRun!.status, s.id).toBe('debrief');
    expect(pendingDebrief(state)).not.toBeNull();
    const closed = apply(state, { type: 'closeDebrief' }); expect(closed.result).toEqual({ ok: true });
    expect(closed.state.department.funding).toBe(state.department.funding + pendingDebrief(state)!.fundingReward);
    expect(apply(closed.state, { type: 'closeDebrief' }).result.ok).toBe(false);
  }, 60000);
});
