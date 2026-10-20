// Development grants (save v12). Every development tier has a cash price and a milestone, an
// UnlockRule from content/unlocks.ts read by the same missingFor the call board uses. The player
// can buy a tier now, or it is granted free the moment its milestone holds and its prerequisites
// are owned. Grants apply themselves: closing a debrief (where level, trust and resolved calls move)
// and buying a development (which can own a waiting grant's last prerequisite) run applyGrants,
// which records each one on the department (Develop, the toast) and in the shift report.
import { DEV_NODES } from '../content/dev-tree';
import { missingFor, type UnlockRule } from '../content/unlocks';
import { developmentTier, developmentTierDefinition, maxDevelopmentTier } from './development-tiers';
import { departmentService, serviceForLevel } from './department-level';
import { openReport } from './shift-report';
import { fillOpenPosts } from './command-staff';
import type { GameState, GrantRecord, Id, NodeEffect } from './types';

/** A milestone as Develop shows it: 'Granted at Level 4, 3 of 4'. One condition per milestone. */
export interface MilestoneView {
  kind: 'level' | 'resolved' | 'trust';
  label: string;
  have: number;
  need: number;
  met: boolean;
}

export function milestoneView(state: Pick<GameState, 'department'>, rule: UnlockRule): MilestoneView {
  const dep = state.department;
  if (rule.resolved !== undefined) {
    const have = dep.callsResolved ?? 0;
    return { kind: 'resolved', label: `${rule.resolved} calls resolved`, have: Math.min(have, rule.resolved), need: rule.resolved, met: have >= rule.resolved };
  }
  if (rule.trust !== undefined) {
    const have = Math.round(dep.trust);
    return { kind: 'trust', label: `Trust ${rule.trust}`, have: Math.min(have, rule.trust), need: rule.trust, met: dep.trust >= rule.trust };
  }
  return { kind: 'level', label: `Level ${rule.level}`, have: Math.min(dep.level, rule.level), need: rule.level, met: dep.level >= rule.level };
}

/** Share of the way to a level milestone, counting service within levels, for a progress bar. */
export function milestoneShare(state: Pick<GameState, 'department'>, view: MilestoneView): number {
  if (view.met) return 1;
  if (view.kind !== 'level') return view.need > 0 ? view.have / view.need : 1;
  return Math.min(1, departmentService(state.department) / serviceForLevel(view.need));
}

/** The milestone of the tier a node would gain next, or null when it is complete. */
export function nextMilestone(state: Pick<GameState, 'department'>, nodeId: Id): { tier: number; rule: UnlockRule; view: MilestoneView } | null {
  const node = Object.hasOwn(DEV_NODES, nodeId) ? DEV_NODES[nodeId] : null;
  if (!node) return null;
  const tier = developmentTier(state as GameState, nodeId) + 1;
  const definition = developmentTierDefinition(node, tier);
  if (!definition) return null;
  return { tier, rule: definition.grant, view: milestoneView(state, definition.grant) };
}

/** Put a node at `tier`: the entitlement, and only the difference in roster and training places. */
export function applyTier(d: GameState, nodeId: Id, tier: number): void {
  const node = DEV_NODES[nodeId];
  const current = developmentTier(d, nodeId);
  const effects = (t: number): NodeEffect[] => developmentTierDefinition(node, t)?.effects ?? [];
  const dep = d.department;
  dep.developmentTiers ??= {};
  dep.developmentTiers[nodeId] = tier;
  if (!dep.unlockedNodes.includes(nodeId)) dep.unlockedNodes.push(nodeId);
  // Persist only the difference: upgrading never replays purchased capacities.
  for (const kind of ['rosterCap', 'trainingSlots'] as const) {
    const total = (list: NodeEffect[]) => list.reduce((sum, effect) => sum + (effect.kind === kind ? effect.delta : 0), 0);
    const difference = total(effects(tier)) - total(current ? effects(current) : []);
    if (kind === 'rosterCap') dep.rosterCap += difference;
    else dep.trainingSlots += difference;
  }
  // Opening a Command Staff post puts its first candidates on offer.
  if (effects(tier).some((effect) => effect.kind === 'commandStaff')) fillOpenPosts(d);
}

/**
 * Grant every tier whose milestone holds and whose prerequisites are owned, in tree order, until
 * nothing more qualifies (a grant can own the prerequisite of another). Records each grant on the
 * department and in the open shift report, and returns them.
 */
export function applyGrants(d: GameState, at: number): GrantRecord[] {
  const out: GrantRecord[] = [];
  for (let changed = true; changed;) {
    changed = false;
    for (const node of Object.values(DEV_NODES)) {
      const tier = developmentTier(d, node.id) + 1;
      if (tier > maxDevelopmentTier(node)) continue;
      if (node.requires.some((id) => developmentTier(d, id) === 0)) continue;
      const rule = developmentTierDefinition(node, tier)!.grant;
      if (Object.keys(missingFor(d, rule)).length) continue;
      applyTier(d, node.id, tier);
      out.push({ nodeId: node.id, tier, at, milestone: milestoneView(d, rule).label });
      changed = true;
    }
  }
  if (!out.length) return out;
  d.department.grants = [...(d.department.grants ?? []), ...out];
  const report = openReport(d, at);
  report.grants = [...(report.grants ?? []), ...out];
  return out;
}

/** The grant that gave a node this tier, when a milestone gave it. */
export function grantOf(state: Pick<GameState, 'department'>, nodeId: Id, tier: number): GrantRecord | null {
  return state.department.grants?.find((grant) => grant.nodeId === nodeId && grant.tier === tier) ?? null;
}
