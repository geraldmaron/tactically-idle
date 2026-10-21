// The beat gate (docs/call-pressure.md, "Beats"): each beat keeps to its rules, a threshold above 0
// and below the threat's minutes, a unique id, and a speaking role, group or voice. No
// situation suppresses a line (owner decision 2026-10-20: content is filtered by the player's
// settings, and the timer Off means no stall).
import { TREE_VOICES, type CallTree } from '../../../content/call-trees/types';
import type { IncidentTemplate } from '../../../content/incidents/types';

export interface PushbackFinding { type: string; message: string }

/** The tree's own rules for its lines, read from the data. */
export function pushbackDataFindings(tree: CallTree): PushbackFinding[] {
  const speakers = new Set([...tree.roles.map(role => role.id), ...Object.keys(tree.groups ?? {}), ...Object.keys(TREE_VOICES)]);
  return tree.nodes.flatMap(node => {
    const threat = node.threat;
    if (!threat?.beats?.length) return [];
    const ids = new Set<string>();
    return threat.beats.flatMap((line): PushbackFinding[] => {
      const found: PushbackFinding[] = [];
      const at = `${tree.type} ${node.id} beat ${line.id}`;
      if (!line.id || ids.has(line.id)) found.push({ type: tree.type, message: `${at}: needs a unique id` });
      ids.add(line.id);
      if (!(line.at > 0 && line.at < threat.minutes)) found.push({ type: tree.type, message: `${at}: fires at ${line.at}, not above 0 and below the threat's ${threat.minutes} minutes` });
      if (!speakers.has(line.by)) found.push({ type: tree.type, message: `${at}: ${line.by} is no role, group or voice` });
      if (!line.line.trim()) found.push({ type: tree.type, message: `${at}: is empty` });
      return found;
    });
  });
}

/** The gate: a tree's lines keep to their rules. */
export function pushbackFindings(template: IncidentTemplate): PushbackFinding[] {
  return pushbackDataFindings(template.tree);
}
