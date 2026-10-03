// Pure shared development read model. UI, simulation, and campaign wallet quote
// the same next purchase, without creating a dependency on the settlement loop.
import { DEV_NODES } from '../content/dev-tree';
import type { DevelopmentNode, DevelopmentTier, GameState, Id, NodeEffect } from './types';

export const tierLabel = (tier: number): string => ['Not owned', 'I', 'II', 'III'][tier] ?? String(tier);

export function maxDevelopmentTier(node: DevelopmentNode): number {
  return node.tiers?.length ?? 1;
}

export function developmentTierDefinition(node: DevelopmentNode, tier: number): DevelopmentTier | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > maxDevelopmentTier(node)) return null;
  return node.tiers?.[tier - 1] ?? { cost: node.cost, effects: node.effects };
}

/** Read legacy entitlements as tier I; never add duplicate benefits. */
export function developmentTier(state: GameState, nodeId: Id): number {
  const node = Object.hasOwn(DEV_NODES, nodeId) ? DEV_NODES[nodeId] : undefined;
  if (!node) return 0;
  const saved = state.department.developmentTiers?.[nodeId];
  const entitlement = state.department.unlockedNodes.includes(nodeId) ? 1 : 0;
  return typeof saved === 'number' && Number.isInteger(saved) && saved > 0
    ? Math.max(entitlement, Math.min(saved, maxDevelopmentTier(node)))
    : entitlement;
}

export function effectiveDevelopmentEffects(state: GameState): NodeEffect[] {
  return Object.values(DEV_NODES).flatMap((node) =>
    developmentTierDefinition(node, developmentTier(state, node.id))?.effects ?? []);
}

export interface DevelopmentQuote {
  ok: boolean;
  reason: string | null;
  node: DevelopmentNode | null;
  currentTier: number;
  targetTier: number | null;
  maxTier: number;
  cost: DevelopmentTier['cost'] | null;
  effects: NodeEffect[];
  currentEffects: NodeEffect[];
  missingPrerequisites: Id[];
}

const fundingLabel = (amount: number) => `$${Math.round(amount).toLocaleString('en-US')}`;

/**
 * Omit expectedTier only for a read-only preview. Purchase callers pass their
 * displayed target (legacy commands default to I), so stale clicks never buy II.
 */
export function quoteDevelopment(state: GameState, nodeId: Id, expectedTier?: number): DevelopmentQuote {
  const node = Object.hasOwn(DEV_NODES, nodeId) ? DEV_NODES[nodeId] : null;
  const currentTier = developmentTier(state, nodeId);
  const maxTier = node ? maxDevelopmentTier(node) : 0;
  const targetTier = node && currentTier < maxTier ? currentTier + 1 : null;
  const next = node && targetTier ? developmentTierDefinition(node, targetTier) : null;
  const missingPrerequisites = node?.requires.filter((id) => developmentTier(state, id) === 0) ?? [];
  let reason: string | null = null;
  if (!node) reason = 'Unknown development node';
  else if (targetTier === null) reason = node.tiers ? `${node.name} is already at its maximum tier` : `${node.name} is already unlocked`;
  else if (expectedTier !== undefined && (!Number.isInteger(expectedTier) || expectedTier !== targetTier)) {
    reason = `Development changed. ${node.name} is ${currentTier ? `at tier ${tierLabel(currentTier)}` : 'not owned'}; review tier ${tierLabel(targetTier)} before buying.`;
  } else if (missingPrerequisites.length) {
    reason = `Requires ${missingPrerequisites.map((id) => DEV_NODES[id]?.name ?? id).join(', ')}`;
  } else if (state.department.devPoints < next!.cost.dp) {
    reason = `Needs ${next!.cost.dp} development points (have ${Math.floor(state.department.devPoints * 10) / 10})`;
  } else if (state.department.funding < next!.cost.funding) {
    reason = `Needs ${fundingLabel(next!.cost.funding)} (have ${fundingLabel(state.department.funding)})`;
  }
  return {
    ok: reason === null, reason, node, currentTier, targetTier, maxTier,
    cost: next?.cost ?? null, effects: next?.effects ?? [],
    currentEffects: node ? developmentTierDefinition(node, currentTier)?.effects ?? [] : [],
    missingPrerequisites,
  };
}
