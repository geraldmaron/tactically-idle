import type { GameState, Officer, PersonnelState } from './types';
import { hashSeed } from './rng';

export function createPersonnel(campaignSeed: number, officers: Record<string, Officer>): PersonnelState {
  const people = Object.values(officers);
  return {
    campaignSeed: campaignSeed >>> 0, catalogVersion: 1,
    employedIdentityIds: people.flatMap((o) => o.identityId ? [o.identityId] : []),
    builds: Object.fromEntries(people.filter((o) => o.identityId).map((o) => [o.identityId!, structuredClone(o)])),
  };
}

export function markEmployed(state: GameState, officer: Officer): void {
  if (!officer.identityId) return;
  const personnel = state.personnel!;
  if (!personnel.employedIdentityIds.includes(officer.identityId)) personnel.employedIdentityIds.push(officer.identityId);
}

/** Browser new-campaign seeds differ even when reset twice in one millisecond. Sim tests pass explicit seeds. */
export function randomCampaignSeed(): number {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return hashSeed(`${Date.now()}:${Math.random()}`);
}
