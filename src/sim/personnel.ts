import { STARTER_PERSONAS } from '../content/personas';
import type { GameState, Officer, PersonnelState } from './types';
import { hashSeed } from './rng';

export function createPersonnel(campaignSeed: number, officers?: Record<string, Officer>): PersonnelState {
  // Missing officers means legacy migration: all eight original starters have
  // already served, including anyone who departed before identity tracking existed.
  const people = Object.values(officers ?? {});
  return {
    campaignSeed: campaignSeed >>> 0, catalogVersion: 1,
    employedIdentityIds: officers ? people.flatMap((o) => o.identityId ? [o.identityId] : []) : STARTER_PERSONAS.map((p) => p.id),
    builds: Object.fromEntries(people.filter((o) => o.identityId).map((o) => [o.identityId!, structuredClone(o)])),
  };
}

/** Legacy builds are preserved byte-for-byte apart from the safe known-identity link. */
export function initializePersonnel(state: GameState): PersonnelState {
  if (state.personnel) return state.personnel;
  const personnel = createPersonnel(hashSeed(`legacy:${state.department.calendarEpoch}:${state.rngState}`));
  for (const officer of [...Object.values(state.officers), ...state.candidates.map((c) => c.officer)]) {
    const known = STARTER_PERSONAS.find((p) => p.legacyOfficerId === officer.id && p.firstName === officer.firstName && p.surname === officer.surname);
    if (known) officer.identityId = known.id;
    if (officer.identityId) personnel.builds[officer.identityId] = structuredClone(officer);
  }
  for (const officer of Object.values(state.officers)) {
    if (officer.identityId && !personnel.employedIdentityIds.includes(officer.identityId)) personnel.employedIdentityIds.push(officer.identityId);
  }
  state.personnel = personnel;
  return personnel;
}

export function markEmployed(state: GameState, officer: Officer): void {
  if (!officer.identityId) return;
  const personnel = initializePersonnel(state);
  if (!personnel.employedIdentityIds.includes(officer.identityId)) personnel.employedIdentityIds.push(officer.identityId);
}

/** Browser new-campaign seeds differ even when reset twice in one millisecond. Sim tests pass explicit seeds. */
export function randomCampaignSeed(): number {
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return hashSeed(`${Date.now()}:${Math.random()}`);
}
