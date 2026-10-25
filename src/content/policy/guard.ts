// The runtime boundary (control set in docs/content-policy.md). A generated or authored scenario is read
// once, bound, as it enters the game (sim/scenario-registry.ts getScenario): every player-visible string
// in it, whichever field it sits in, goes through the text controls, and a scenario with a blocking
// finding is refused rather than shown. Walking the whole object, not a list of known fields, is the
// point: engine-written consequence lines, clock cues, threat labels and chat pools are reached the same
// way as authored prose, and a new field is covered the day it is added.
import { blocking, checkText, surfaceOfPath, type PolicyFinding } from './checks';
import type { Surface } from './controls';

/** The policy version a decision was made under; change it when a control or lexicon changes. */
export const POLICY_VERSION = 'policy-2026-10-24.1';

export interface LocatedFinding extends PolicyFinding { where: string; text: string }

const surfaceOf = (where: string): Surface => /reaction|chat/i.test(where) ? 'chat' : surfaceOfPath(where);

/** Every text finding in `value`, with the path of the string it came from. Strings with no space (ids,
 * marks, keys) are not prose and are skipped. */
export function scenarioFindings(value: unknown, root = ''): LocatedFinding[] {
  const found: LocatedFinding[] = [];
  const seen = new WeakSet<object>();
  const visit = (node: unknown, where: string): void => {
    if (typeof node === 'string') {
      if (!/\s/.test(node)) return;
      for (const finding of checkText(node, surfaceOf(where), { generated: true, speech: /(^|\.)line$|exchange|reactions/.test(where) })) found.push({ ...finding, where, text: node });
      return;
    }
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) node.forEach((item, index) => visit(item, `${where}[${index}]`));
    else for (const [key, item] of Object.entries(node)) visit(item, where ? `${where}.${key}` : key);
  };
  visit(value, root);
  return found;
}

const refused = new Map<string, LocatedFinding[]>();
/** What the guard turned away this session, by scenario id (for the Lab and tests). */
export const policyRefusals = (): ReadonlyMap<string, readonly LocatedFinding[]> => refused;

/** True when `scenario` may be shown. A refusal is logged once and kept in policyRefusals. */
export function admitScenario(id: string, scenario: unknown): boolean {
  const blocks = blocking(scenarioFindings(scenario)) as LocatedFinding[];
  if (!blocks.length) return true;
  refused.set(id, blocks);
  console.error(`policy ${POLICY_VERSION}: refused scenario ${id}: ${blocks.slice(0, 3).map((b) => `${b.control} "${b.match}" at ${b.where}`).join('; ')}`);
  return false;
}
