// STUB (owned by the incident-generator agent). Export names and signatures are fixed.
import type { IncidentSpec, IncidentType, ScenarioDefinition } from '../../sim/scenario-types';

export interface IncidentTypeInfo {
  type: IncidentType;
  label: string;
  /** Building families this incident can occur in. */
  families: string[];
  /** Typical squad range before geometry limits it. */
  squads: [min: number, max: number];
}

export const INCIDENT_TYPES: IncidentTypeInfo[] = [];

/** 'gen:<type>:<familyId>:<buildingSeed>:<seed>:<tier>:<contentVersion>' */
export function incidentId(spec: IncidentSpec): string {
  return `gen:${spec.type}:${spec.familyId}:${spec.buildingSeed}:${spec.seed}:${spec.tier}:${spec.contentVersion}`;
}

export function parseIncidentId(id: string): IncidentSpec | null {
  const m = /^gen:([a-z_]+):([a-z0-9_]+):(\d+):(\d+):(\d+):(\d+)$/.exec(id);
  if (!m) return null;
  return {
    type: m[1] as IncidentType,
    familyId: m[2],
    buildingSeed: Number(m[3]),
    seed: Number(m[4]),
    tier: Number(m[5]),
    contentVersion: Number(m[6]),
  };
}

/**
 * Deterministic: same spec → identical ScenarioDefinition (id = incidentId(spec),
 * locationFamilyId = spec.familyId, locationSeed = spec.buildingSeed). Validated
 * solvable; retries with derived seeds and falls back rather than returning a broken case.
 */
export function generateIncident(spec: IncidentSpec): ScenarioDefinition {
  throw new Error(`No incident generator yet (${incidentId(spec)})`);
}

/** Draw the next incident spec for the board from a PRNG state, gated by department level/trust. */
export function drawIncidentSpec(
  rngState: number,
  ctx: { level: number; trust: number; contentVersion: number },
): { spec: IncidentSpec; state: number } {
  void ctx;
  return {
    spec: { type: 'welfare_check', familyId: 'maple_street', buildingSeed: 0, seed: rngState, tier: 1, contentVersion: 1 },
    state: rngState,
  };
}
