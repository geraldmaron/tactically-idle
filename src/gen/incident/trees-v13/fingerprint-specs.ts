import { CALL_TREES } from '../../../content/call-trees';
import type { IncidentSpec, IncidentType } from '../../../sim/scenario-types';

/** Every call tree on every building it lists, at four call seeds (compiled-fingerprints.test.ts). */
export const TREE_FINGERPRINT_SPECS: IncidentSpec[] = Object.values(CALL_TREES).flatMap(tree => tree!.families.flatMap(familyId =>
  [[7, 3], [7, 11], [19, 29], [23, 47]].map(([buildingSeed, seed]) => ({ type: tree!.type as IncidentType, familyId, buildingSeed, seed, tier: 2, contentVersion: 13 }))));

/** SHA-256 of JSON.stringify, as every fingerprint suite computes it. */
export const digest = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value))))].map(n => n.toString(16).padStart(2, '0')).join('');
