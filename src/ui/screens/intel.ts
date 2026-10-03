// Briefing intel for the prepare screen, derived only from what the player is told at dispatch.
// Truth fields (FactDefinition.truth, PersonDefinition positions and threat profiles) are never read here.
import type { BuiltLocation, Id, KnowledgeStatus } from '../../sim/types';
import type { EnvironmentDefinition, FactDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import { spaceName } from '../../sim/resolution';

export interface IntelLine {
  id: Id;
  label: string;
  /** What the report says, in plain words. */
  claim: string;
  /** Who reported it; null when nobody did. */
  source: string | null;
  status: KnowledgeStatus;
  /** Room as the report places it. */
  where: string | null;
}

export interface Intel {
  people: IntelLine[];
  threats: IntelLine[];
  environment: EnvironmentDefinition | null;
  difficulty: ScenarioDefinition['difficulty'] | null;
  /** Briefing sentences already shown as People or Threat lines, so Known does not repeat them. */
  covered: Set<string>;
}

const WEAPON = /\b(armed|unarmed|weapons?|knife|knives|blade|gun|guns|firearm|pistol|handgun|rifle|shotgun|bat|club|machete|axe|hammer)\b/i;

function isWeaponFact(f: FactDefinition): boolean {
  const kind = (f as { kind?: string }).kind;
  if (kind) return kind === 'armament';
  return WEAPON.test(f.claim) || WEAPON.test(f.label);
}

function line(f: FactDefinition, built: BuiltLocation, label?: string): IntelLine {
  return { id: f.id, label: label ?? f.person?.label ?? f.label, claim: f.claim, source: f.source, status: f.initial, where: spaceName(built, f.spaceId) };
}

export function buildIntel(s: ScenarioDefinition | null, built: BuiltLocation): Intel {
  const empty: Intel = { people: [], threats: [], environment: null, difficulty: null, covered: new Set() };
  if (!s) return empty;
  const told = s.facts.filter((f) => f.initial === 'reported' || f.initial === 'confirmed');
  // V4's individual civilian outcomes link public person reports without adding
  // dynamic engine people or exposing their hidden positions/truth.
  const civilians = new Map(s.version >= 4 ? (s.civilianOutcomes ?? []).map(person => [person.factId, person.label]) : []);
  const isPerson = (fact: FactDefinition) => !!fact.person || civilians.has(fact.id);
  const people = told.filter(isPerson).map((f) => line(f, built, civilians.get(f.id)));
  const threats = told.filter(isWeaponFact).map((f) => line(f, built));
  const covered = new Set<string>();
  for (const f of told) if ((isPerson(f) || isWeaponFact(f)) && f.reportedText) covered.add(f.reportedText);
  return { people, threats, environment: s.environment ?? null, difficulty: s.difficulty ?? null, covered };
}
