// Every player-visible string of a call tree as rows for the swat-call-prose string checker
// (.agents/skills/swat-call-prose/scripts/game_string_checks.py, columns in its
// references/string-checks.md). The checker stays the one implementation of the house rules: the
// CLI (scripts/check-strings.ts) and the Scenario Lab both send it these rows.
import type { CallTree, TreeIf, TreeOutcome } from '../../../content/call-trees/types';
import type { OutcomeBand } from '../../../sim/types';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { reachableWithin, treeForCounts } from './compile';

export interface StringRow {
  /** s1, s2, s3 (the tree's situations, one-based) or all. */
  situation: string;
  where: string;
  surface: string;
  text: string;
  stage?: string;
  action?: string;
  band?: string;
  path?: string;
}

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

/** Which situations an outcome's hidden-truth condition holds in. A clock condition depends on
 * time as well as the situation, so only fact conditions narrow the rows. */
function situationsFor(tree: CallTree, outcome: TreeOutcome): string[] {
  const conditions = ([] as TreeIf[]).concat(outcome.if ?? []).flatMap(c => 'fact' in c ? [c] : []);
  if (!conditions.length) return ['all'];
  const holds = tree.situations.map((situation, index) => conditions.every(c => (tree.facts[c.fact]?.truth ?? situation.truth[c.fact]) === c.is) ? `s${index + 1}` : null)
    .filter((entry): entry is string => !!entry);
  return holds.length === tree.situations.length ? ['all'] : holds;
}

/** The call's strings, each passed through `bind` (names, pronouns and rooms of one instance).
 * With `counts` (each group's size in that instance), only the strings a call of that size can
 * show: count conditions settled, and endings only a cascade result it can't have would reach left
 * out. Without, every string. */
export function callStringRows(authored: CallTree, bind: (text: string) => string, counts?: Record<string, number>): StringRow[] {
  const tree = counts ? treeForCounts(authored, counts) : authored;
  // With group sizes known, only what a call of that size can reach: from the root, through every
  // turn a call can draw, along the cascade results it can have.
  const { nodes, endings } = counts ? reachableWithin(tree, counts) : { nodes: null, endings: null };
  const rows: StringRow[] = [];
  const add = (where: string, surface: string, text: string | undefined, extra: Partial<StringRow> = {}, situation = 'all') => {
    if (text) rows.push({ situation, where, surface, text: bind(text), ...extra });
  };
  add('card.title', 'title', tree.title);
  add('card.summary', 'hook', tree.summary);
  add('card.pressure', 'pressure_label', tree.pressureLabel);
  add('briefing.dispatch', 'dispatch', tree.briefing.dispatchReason);
  tree.briefing.known.forEach((line, i) => add(`briefing.known[${i}]`, 'known', line));
  tree.briefing.unknown.forEach((line, i) => add(`briefing.unknown[${i}]`, 'unknown', line));
  tree.briefing.responsibilities.forEach((line, i) => add(`briefing.team[${i}]`, 'team_job', line));
  for (const [stage, label] of Object.entries(tree.stageLabels)) add(`stage.${stage}`, 'stage_label', label);
  tree.objectives.forEach(objective => add(`objective.${objective.id}`, 'objective', objective.label));
  for (const [key, fact] of Object.entries(tree.facts)) {
    add(`fact.${key}.label`, 'fact_label', fact.label);
    add(`fact.${key}.claim`, 'fact_claim', fact.claim);
    add(`fact.${key}.confirmed`, 'fact_result', fact.confirmed);
    add(`fact.${key}.disproved`, 'fact_result', fact.disproved);
  }
  for (const node of tree.nodes) {
    if (nodes && !nodes.has(node.id)) continue;
    add(`${node.id}.prompt`, 'prompt', node.prompt, { stage: node.stage, path: node.id });
    (node.promptIf ?? []).forEach((entry, i) => add(`${node.id}.promptIf[${i}]`, 'prompt', entry.prompt, { stage: node.stage, path: node.id }));
    for (const choice of node.choices) {
      const base = { stage: node.stage, action: choice.id, path: node.id };
      add(`${node.id}.${choice.id}.title`, 'choice_title', choice.title, base);
      add(`${node.id}.${choice.id}.summary`, 'summary', choice.summary, base);
      for (const band of BANDS) add(`${node.id}.${choice.id}.preview.${band}`, 'preview', choice.preview[band], { ...base, band });
      (choice.modifiers ?? []).forEach((modifier, i) => add(`${node.id}.${choice.id}.modifier[${i}]`, 'modifier', modifier.label, base));
      for (const band of BANDS) choice.outcomes[band].forEach((outcome, i) => {
        for (const situation of situationsFor(tree, outcome)) add(`${node.id}.${choice.id}.${band}[${i}]`, 'result', outcome.text, { ...base, band }, situation);
      });
    }
  }
  for (const [id, ending] of Object.entries(tree.endings)) {
    if (endings && !endings.has(id)) continue;
    add(`ending.${id}.title`, 'ending_title', ending.title);
    add(`ending.${id}.summary`, 'ending_summary', ending.summary);
    (ending.remainingTasks ?? []).forEach((task, i) => add(`ending.${id}.task[${i}]`, 'still_needed', task));
  }
  // Clocks (content/incidents): the label on the player's panel and each cue line the engine adds
  // to a result, once per distinct text, in the situations that run it. A cue that repeats a fact's
  // result line is already a row.
  const factTexts = new Set(Object.values(tree.facts).flatMap(fact => [fact.confirmed, fact.disproved]));
  const clocks = new Map<string, { label: string; cues: Map<string, Set<number>> }>();
  // The template drawn for this tree, never another tree of the same type.
  const template = INCIDENT_TEMPLATES[authored.type];
  for (const situation of template?.tree === authored ? template.situations : []) for (const clock of situation.clocks ?? []) {
    if (clock.story) continue;
    const entry = clocks.get(clock.id) ?? { label: clock.label, cues: new Map() };
    for (const cue of clock.cues) if (!factTexts.has(cue.text)) entry.cues.set(cue.text, (entry.cues.get(cue.text) ?? new Set()).add(situation.index));
    clocks.set(clock.id, entry);
  }
  for (const [id, clock] of clocks) {
    add(`clock.${id}.label`, 'fact_label', clock.label);
    [...clock.cues].forEach(([text, situations], i) => {
      const tags = situations.size === tree.situations.length ? ['all'] : [...situations].map(index => `s${index + 1}`);
      for (const situation of tags) add(`clock.${id}.cue[${i}]`, 'result', text, {}, situation);
    });
  }
  return rows;
}

const COLUMNS = ['situation', 'where', 'surface', 'text', 'stage', 'action', 'band', 'path'] as const;
/** The checker's TSV: tabs and newlines inside text are flattened. */
export function toTsv(rows: readonly StringRow[]): string {
  const cell = (value: string | undefined) => (value ?? '').replace(/[\t\n\r]+/g, ' ');
  return [COLUMNS.join('\t'), ...rows.map(row => COLUMNS.map(column => cell(row[column])).join('\t'))].join('\n') + '\n';
}

/** One finding line from the checker: `kind situation where detail`. */
export interface StringFinding { kind: string; situation: string; where: string; detail: string }
export function parseFindings(stdout: string, rows: readonly StringRow[]): { findings: StringFinding[]; summary: string[] } {
  const wheres = new Set(rows.map(row => row.where));
  const findings: StringFinding[] = [], summary: string[] = [];
  for (const line of stdout.split('\n')) {
    const match = line.match(/^(\S+)\s+(s\d|all)?\s*(\S+)?\s+(.*)$/);
    if (match && match[3] && wheres.has(match[3])) findings.push({ kind: match[1], situation: match[2] ?? '', where: match[3], detail: match[4].trim() });
    else if (line.trim()) summary.push(line.trim());
  }
  return { findings, summary };
}
