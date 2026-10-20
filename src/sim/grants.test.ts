import { describe, expect, it } from 'vitest';
import { DEV_NODES } from '../content/dev-tree';
import { createInitialState } from './department';
import { developmentTierDefinition, maxDevelopmentTier } from './development-tiers';
import { applyGrants, milestoneView, nextMilestone } from './grants';
import { serviceForLevel } from './department-level';
import { deserialize, serialize } from './save';
import { nodeOptions } from './department-selectors';
import { dispatch } from './game';

const T0 = Date.UTC(2026, 0, 5, 12);

describe('development milestones (develop-grants)', () => {
  it('gives every tier a cash price and one milestone, none met at the start', () => {
    const s = createInitialState(T0);
    for (const node of Object.values(DEV_NODES)) {
      for (let tier = 1; tier <= maxDevelopmentTier(node); tier++) {
        const definition = developmentTierDefinition(node, tier)!;
        expect(definition.cost.funding).toBeGreaterThan(0);
        const conditions = ['resolved', 'trust'].filter((key) => key in definition.grant);
        expect(conditions.length + (definition.grant.level > 1 ? 1 : 0)).toBe(1);
        expect(milestoneView(s, definition.grant).met).toBe(false);
      }
    }
    expect(applyGrants(s, T0)).toEqual([]);
    expect(s.department.grants).toEqual([]);
  });

  it('later tiers ask more of the same kind of milestone', () => {
    for (const node of Object.values(DEV_NODES)) {
      const rules = (node.tiers ?? []).map((tier) => tier.grant);
      for (let i = 1; i < rules.length; i++) {
        const need = (rule: typeof rules[number]) => rule.resolved ?? rule.trust ?? rule.level;
        expect(need(rules[i])).toBeGreaterThan(need(rules[i - 1]));
      }
    }
  });

  it('shows progress in words: Granted at Level 4, 3 of 4', () => {
    const s = createInitialState(T0);
    s.department.level = 3;
    s.department.callsResolved = 5;
    expect(nextMilestone(s, 'personnel_training_sergeant')!.view).toMatchObject({ label: 'Level 4', have: 3, need: 4, met: false });
    expect(nextMilestone(s, 'logistics_restock')!.view).toMatchObject({ label: '10 calls resolved', have: 5, need: 10 });
    expect(nextMilestone(s, 'personnel_peer_support_lead')!.view).toMatchObject({ label: 'Trust 95', have: 78, need: 95 });
    const option = nodeOptions(s).find((entry) => entry.node.id === 'personnel_training_sergeant')!;
    expect(option.milestone).toMatchObject({ label: 'Level 4', have: 3, need: 4 });
  });

  it('grants free when the milestone holds, in prerequisite order, and records it', () => {
    const s = createInitialState(T0);
    const funding = s.department.funding;
    s.department.level = 3;
    s.department.service = serviceForLevel(3);
    const granted = applyGrants(s, T0 + 1);
    const ids = granted.map((grant) => `${grant.nodeId}:${grant.tier}`);
    expect(ids).toEqual(expect.arrayContaining(['personnel_recruiting:1', 'personnel_academy:1', 'field_entry_course:1', 'intel_thermal:1', 'wellbeing_peer_support:1', 'wellbeing_first_aid:1']));
    // Medical training needs the peer support program, which a level 2 milestone granted first.
    expect(ids.indexOf('wellbeing_first_aid:1')).toBeGreaterThan(ids.indexOf('wellbeing_peer_support:1'));
    expect(s.department.funding).toBe(funding);
    expect(s.department.rosterCap).toBe(14);
    expect(s.department.trainingSlots).toBe(2);
    expect(s.department.grants).toEqual(granted);
    expect(s.report!.grants).toEqual(granted);
    expect(granted.find((grant) => grant.nodeId === 'intel_thermal')!.milestone).toBe('Level 3');
    expect(applyGrants(s, T0 + 2)).toEqual([]);
    expect(deserialize(serialize(s, T0 + 2))!.department.grants).toEqual(granted);
  });

  it('buying the last prerequisite grants a development whose milestone already holds, with no second charge', () => {
    const s = createInitialState(T0);
    s.department.funding = 100_000;
    s.department.level = 7;
    s.department.service = serviceForLevel(7);
    s.department.callsResolved = 11;
    applyGrants(s, T0);
    expect(s.department.developmentTiers.field_specialist_response).toBeUndefined();
    const before = s.department.funding;
    const out = dispatch(s, { type: 'unlockNode', nodeId: 'field_response_program' }, { now: T0 });
    expect(out.result).toEqual({ ok: true });
    expect(out.state.department.developmentTiers.field_specialist_response).toBe(1);
    expect(out.state.department.funding).toBe(before - DEV_NODES.field_response_program.cost.funding);
    expect(out.state.department.grants.at(-1)).toMatchObject({ nodeId: 'field_specialist_response', milestone: 'Level 7' });
  });

  it('a Command Staff grant opens the post with candidates on offer', () => {
    const s = createInitialState(T0);
    s.department.callsResolved = 5;
    applyGrants(s, T0);
    expect(s.department.developmentTiers.personnel_watch_commander).toBe(1);
    expect(s.commandStaff!.watch_commander.post!.pool.length).toBe(3);
  });
});
