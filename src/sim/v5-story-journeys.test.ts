import { describe, expect, it } from 'vitest';
import { COURSES } from '../content/courses';
import { ITEMS } from '../content/items';
import { INCIDENT_TYPES_V5, incidentId } from '../gen/incident';
import { initializePersonnel } from './personnel';
import { buildLocation } from './location';
import { actionViews } from './operation-selectors';
import { computeDebrief, validateScenario } from './operation';
import { planActionResupply } from './equipment-resupply';
import { responseFailurePlan } from './response-failure';
import { getScenario } from './scenario-registry';
import { deserialize, serialize } from './save';
import { apply, makeState, NOW, startCmd, unitId } from './test-fixtures';

describe('finite story journeys preserve progress and end honestly', () => {
  it.each(INCIDENT_TYPES_V5)('$type survives natural choices, sparse equipment and save/reload', info => {
    const conclusions = new Set<string>();
    let completed = 0;
    for (const equipped of [false, true]) for (let seed = 0; seed < 8; seed++) {
      const familyId = info.families[seed % info.families.length];
      const scenarioId = incidentId({ type: info.type, familyId, buildingSeed: 7, seed, tier: 2, contentVersion: 5 });
      const scenario = getScenario(scenarioId);
      expect(scenario, scenarioId).not.toBeNull();
      const built = buildLocation(familyId, 7);
      expect(validateScenario(scenario!, built), scenarioId).toEqual([]);
      const inventory = equipped ? Object.fromEntries(Object.values(ITEMS).map(item => [item.id, item.id === 'radio_kit' ? 8 : item.kind === 'consumable' ? 6 : 2])) : {};
      let state = makeState({ rngState: seed + 93, inventory });
      state.saveVersion = 5; state.contentVersion = 5; initializePersonnel(state);
      if (equipped) for (const officer of Object.values(state.officers)) officer.certs = [...new Set([...officer.certs, ...Object.values(COURSES).flatMap(course => course.grants.cert ? [course.grants.cert] : [])])];
      state.incidents = [{ id: scenarioId, type: info.type, familyId, tier: 2, arrivedAt: NOW, expiresAt: NOW + 3_600_000, seen: false }];
      const loadout = equipped ? Object.fromEntries(Object.values(ITEMS).filter(item => !item.supportOnly && item.id !== 'radio_kit').map(item => [item.id, item.kind === 'consumable' ? 4 : 1])) : {};
      const start = apply(state, { ...startCmd(scenarioId, ['A'], { positions: { A: built.location.entries[0] }, loadouts: { A: loadout } }), ...(equipped ? { supportUnitIds: [unitId('armored_rescue_vehicle')] } : {}) });
      expect(start.result, scenarioId).toEqual({ ok: true }); state = start.state;
      for (let step = 0; state.activeRun!.status === 'active' && step < 45; step++) {
        const before = structuredClone(state.activeRun!.history);
        const visible = actionViews(state, NOW, 'A');
        const options = visible.filter(view => view.eligible);
        if (!options.length) {
          // A missing item is recoverable when stores can deliver it; only a genuine dead end may fail.
          const delivery = visible.find(view => planActionResupply(state, NOW, view.id, view.actingSquadIds, view.supportSquadIds).ok);
          if (delivery) {
            expect(responseFailurePlan(state)).toBeNull();
            const supplied = apply(state, { type: 'resupplyAction', actionId: delivery.id, actingSquadIds: delivery.actingSquadIds, supportSquadIds: delivery.supportSquadIds });
            expect(supplied.result).toEqual({ ok: true });
            const restored = deserialize(serialize(supplied.state, NOW));
            expect(restored?.activeRun).toEqual(supplied.state.activeRun);
            expect(restored!.activeRun!.history).toEqual(before);
            state = restored!;
            continue;
          }
          const plan = responseFailurePlan(state);
          expect(plan, `${scenarioId} step ${step}: exhausted response needs an explicit failure report`).not.toBeNull();
          const beforeFailure = structuredClone(state);
          const failed = apply(state, { type: 'endFailedResponse', runId: plan!.runId, revision: plan!.revision });
          expect(failed.result).toEqual({ ok: true });
          const { runId: _runId, consequence: _consequence, ...record } = plan!;
          Object.assign(beforeFailure.activeRun!, { stage: 'debrief', status: 'debrief', endingId: 'handed_over', responseFailure: record });
          // Reporting failure cannot invent time, RNG, progress, accepted care, or squad movement.
          expect(failed.state).toEqual(beforeFailure);
          const restored = deserialize(serialize(failed.state, NOW));
          expect(restored?.activeRun).toEqual(failed.state.activeRun);
          state = restored!;
          break;
        }
        const onward = options.filter(view => !/partial|withdraw|record.*pending|record.*unfinished/i.test(view.id + ' ' + view.title));
        const choices = onward.length ? onward : options;
        const chosen = choices[(seed + step) % choices.length];
        const next = apply(state, { type: 'decide', actionId: chosen.id, actingSquadIds: chosen.actingSquadIds, supportSquadIds: chosen.supportSquadIds });
        expect(next.result, `${scenarioId}: ${chosen.id}`).toEqual({ ok: true });
        state = next.state;
        expect(state.activeRun!.history.slice(0, before.length)).toEqual(before);
        const loaded = deserialize(serialize(state, NOW));
        expect(loaded, `${scenarioId}: reload after ${chosen.id}`).not.toBeNull();
        expect(loaded!.activeRun).toEqual(state.activeRun);
        expect(loaded!.rngState).toBe(state.rngState);
        state = loaded!;
        const duplicate = apply(state, { type: 'decide', actionId: chosen.id, actingSquadIds: chosen.actingSquadIds, supportSquadIds: chosen.supportSquadIds });
        expect(duplicate.result.ok).toBe(false);
        expect(duplicate.state).toBe(state);
      }
      expect(state.activeRun!.status, `${scenarioId}: finite story did not end`).toBe('debrief');
      const report = computeDebrief(state, state.activeRun!)!;
      expect(report).not.toBeNull();
      conclusions.add(report.disposition ?? 'unknown');
      if (report.completionAchieved) completed++;
      expect(state.activeRun!.history.length).toBeGreaterThanOrEqual(state.activeRun!.responseFailure ? 1 : 2);
      if (report.completionAchieved) expect(['resolved', 'care_accepted', 'followup_agreed']).toContain(report.disposition);
      if (state.activeRun!.responseFailure) {
        expect(report).toMatchObject({ completionAchieved: false, disposition: 'unresolved', fundingReward: 0, devPointReward: 0, trustDelta: -2 });
        expect(report.officerCondition.every(officer => officer.xpGained === 0)).toBe(true);
        expect(report.remainingTasks!.length).toBeGreaterThan(0);
      }
      const closed = apply(state, { type: 'closeDebrief' }); expect(closed.result).toEqual({ ok: true });
      if (state.activeRun!.responseFailure) {
        expect(closed.state.department.funding).toBe(state.department.funding);
        expect(closed.state.department.devPoints).toBe(state.department.devPoints);
        expect(closed.state.department.trust).toBe(state.department.trust - 2);
      }
      expect(deserialize(serialize(closed.state, NOW))?.debriefs).toEqual(closed.state.debriefs);
      const duplicateClose = apply(closed.state, { type: 'closeDebrief' }); expect(duplicateClose.result.ok).toBe(false); expect(duplicateClose.state).toBe(closed.state);
    }
    expect(conclusions.size).toBeGreaterThan(0);
    expect(completed, `${info.type}: at least one sampled policy must complete its duties`).toBeGreaterThan(0);
  });
});
