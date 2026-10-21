// One dependency index per call tree: every state key (marks, safety, facts, clocks, meters, harm,
// scalars, the call's own draws), every place that writes it and every place that reads it; the
// static lint built on it; and the requirement tree behind any choice, prompt, outcome, ending or
// node. Shared by the tree tests and the Scenario Lab, so the two never count differently.
//
// The walk follows tree-model.md "State dependency recipe": nodes, choices, bands and outcomes,
// then the template's clocks in every situation (a cue's mark and a clock running out write marks
// and harm too). A clock the story still runs by itself is left out: the engine never runs it.
import type { CallTree, TreeChoice, TreeIf, TreeNext, TreeOutcome, TreeState } from '../../../content/call-trees/types';
import type { Clock, IncidentTemplate } from '../../../content/incidents/types';
import type { MeterStance } from '../../../sim/scenario-types';
import type { OutcomeBand } from '../../../sim/types';
import { clockMarksOf } from '../instance';
import { choiceActionId, outcomeNexts, prunePlan, reachableWithin, templateClockNexts, TOKEN, treeForCounts } from './compile';

export type StateKey = `mark:${string}` | `safe:${string}` | `out:${string}` | `fact:${string}` | `clock:${string}` | `meter:${string}`
  | `promise:${string}` | `harm:${string}` | `count:${string}` | `turn:${string}` | 'situation'
  | 'scalar:objective' | 'scalar:civilian' | 'scalar:pressure';
export type SiteField = 'outcome.mark' | 'fire.mark' | 'threat.mark' | 'beat.mark' | 'clock.cue.mark' | 'clock.onOut.mark' | 'clock.onFull.mark' | 'clock.rateFlags' | 'outcome.safe' | 'outcome.out'
  | 'force.out' | 'cascade.out' | 'outcome.reveal' | 'clock.cue.reveal' | 'fact.public' | 'outcome.moves' | 'outcome.promise'
  | 'authority.concede' | 'outcome.harm' | 'outcome.officer' | 'fire.harm' | 'force.harm' | 'clock.onOut.harm' | 'clock.onFull.harm'
  | 'outcome.objective' | 'outcome.civilian' | 'outcome.pressure' | 'choice.minutes' | 'draw'
  | 'promptIf.when' | 'onlyIf' | 'outcome.when' | 'outcome.if' | 'modifier' | 'threatMarks' | 'carries.knownFrom'
  | 'fact.threat' | 'clock.urgent' | 'next.turn' | 'engine';
/** Where a key is written or read. `outcome` is the index in the authored band list; `drawn` marks a
 * write that happens only on some drawn results (an officer hit, force, followers); `negated` a read
 * that needs the key absent (`notMarks`, `notSafe`, `is: false`); `conditional` the conditions the
 * site applies under (an outcome's `if` and `when`), the value a modifier adds, or what the engine
 * does with the key. */
export interface Site { node?: string; choice?: string; band?: OutcomeBand; outcome?: number; promptIf?: number; clock?: string;
  situation?: 0 | 1 | 2; field: SiteField; drawn?: boolean; negated?: boolean; conditional?: string }

/** Stable id for anchors and lint ids: the location, then the field (`n.talking/c.offer/b.mixed/o.2/f.outcome.when`). */
export function siteKey(s: Site): string {
  return [s.node !== undefined && `n.${s.node}`, s.choice !== undefined && `c.${s.choice}`, s.band && `b.${s.band}`, s.outcome !== undefined && `o.${s.outcome}`,
    s.promptIf !== undefined && `p.${s.promptIf}`, s.clock !== undefined && `k.${s.clock}`, s.situation !== undefined && `s.${s.situation}`, `f.${s.field}`, s.negated && 'not']
    .filter(Boolean).join('/');
}

/** One state key: a plain label (no role tokens), and its writer and reader sites in walk order. */
export interface KeyEntry { key: StateKey; label: string; writers: Site[]; readers: Site[] }
/** Keys grouped by kind (marks, safe, out, facts, clocks, meters, promises, harm, scalars, counts,
 * turns, situation), then by key. */
export interface DependencyIndex { keys: ReadonlyMap<StateKey, KeyEntry> }

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const KIND_ORDER = ['mark', 'safe', 'out', 'fact', 'clock', 'meter', 'promise', 'harm', 'scalar', 'count', 'turn', 'situation'];
const kindOf = (key: StateKey) => key.split(':')[0];
const ifsOf = (outcome: TreeOutcome): TreeIf[] => ([] as TreeIf[]).concat(outcome.if ?? []);

/** `rifle_at_door` → "Rifle at door". */
export const sentenceCase = (id: string): string => { const text = id.replace(/_/g, ' ').trim(); return text.charAt(0).toUpperCase() + text.slice(1); };

/** Tree text with its role tokens read as role nouns ("{taker.first} turned the handgun" → "The
 * former employee turned the handgun"), for labels that have no drawn cast to bind. */
export function plainTokens(text: string, tree: CallTree): string {
  const plain = text.replace(new RegExp(TOKEN.source, TOKEN.flags), (match, id: string, part?: string, _sg?: string, plural?: string, _he?: string, _she?: string, they?: string, _one?: string, many?: string) => {
    if (plural !== undefined) return plural;
    if (they !== undefined) return they;
    if (many !== undefined) return many;
    if (id === 'place' && !part) return 'the building';
    if (id === 'scene' && !part) return 'the scene';
    if (id === 'lead' && !part) return 'the lead officer';
    if (!part || part === 'first' || part === 'last') return `the ${roleNoun(tree, id)}`;
    if (PRONOUNS[part.toLowerCase()]) return part[0] === part[0].toUpperCase() ? sentenceCase(PRONOUNS[part.toLowerCase()]) : PRONOUNS[part.toLowerCase()];
    if (part === 'room') return `the ${roleNoun(tree, id)}’s room`;
    if (part === 'n') return 'some';
    if (part === 'age') return 'their age';
    return match;
  }).replace(/\bthe the\b/gi, match => match.slice(0, 3));
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}
const PRONOUNS: Record<string, string> = { he: 'they', him: 'them', his: 'their', hers: 'theirs', himself: 'themselves' };

/** A role's plain noun, lower case: its label with any token in it dropped or read neutrally
 * ("{ex.his} {child^son|daughter|child}, {child.age}" → "child"), a group or member by its id. */
export function roleNoun(tree: CallTree, id: string): string {
  const label = tree.roles.find(role => role.id === id)?.label;
  if (label === undefined) return id === 'officer' ? 'officer' : id.replace(/_\d+$/, '').replace(/_/g, ' ');
  const noun = label.replace(new RegExp(TOKEN.source, TOKEN.flags), (_match, _id: string, _part?: string, _sg?: string, plural?: string, _he?: string, _she?: string, they?: string, _one?: string, many?: string) =>
    plural ?? they ?? many ?? '').replace(/\s+/g, ' ').replace(/^[\s,;]+|[\s,;]+$/g, '').replace(/\s+,/g, ',');
  return (noun.charAt(0).toLowerCase() + noun.slice(1)) || id.replace(/_/g, ' ');
}

/** Every combination of group sizes the template allows (`[{}]` for a tree without groups): the
 * calls a static check must cover. */
export function countCombos(template: IncidentTemplate): Record<string, number>[] {
  let combos: Record<string, number>[] = [{}];
  for (const [group, def] of Object.entries(template.tree.groups ?? {})) {
    const slot = template.cast.find(entry => entry.id === def.slot);
    const lo = Math.max(0, (slot?.count.min ?? 0) - (slot?.keyRoles.length ?? 0)), hi = Math.max(lo, (slot?.count.max ?? 0) - (slot?.keyRoles.length ?? 0));
    combos = combos.flatMap(combo => Array.from({ length: hi - lo + 1 }, (_, i) => ({ ...combo, [group]: lo + i })));
  }
  return combos;
}

/** Marks any situation's clocks can set by themselves: settable for every static check. */
const templateClockMarks = (template: IncidentTemplate): string[] => [...new Set(template.situations.flatMap(situation => clockMarksOf(situation.clocks ?? [])))];

/** What a clock reaching its end does: running out, or (a gauge that fills) filling. */
const endOfClock = (clock: Pick<Clock, 'direction' | 'onOut' | 'onFull'>) => clock.direction === 'fill' ? clock.onFull : clock.onOut;

/** Each clock of any situation that sends the call somewhere when it runs out (a fill: when it is
 * full, which the tree reads as `out`), for requirementTree. */
export const templateClockRoutes = (template: IncidentTemplate): { clock: string; next: TreeNext }[] =>
  [...new Map(template.situations.flatMap(situation => (situation.clocks ?? []).filter(clock => !clock.story && endOfClock(clock)?.next)
    .map(clock => [`${clock.id}:${JSON.stringify(endOfClock(clock)!.next)}`, { clock: clock.id, next: endOfClock(clock)!.next! }] as const))).values()];

/** A count condition as text: "others ≥ 1", "others 1 to 2". */
function countText(count: NonNullable<TreeState['count']>): string {
  const { role, min, max } = count;
  return min !== undefined && max !== undefined ? min === max ? `${role} = ${min}` : `${role} ${min} to ${max}` : min !== undefined ? `${role} ≥ ${min}` : `${role} ≤ ${max}`;
}
/** One engine-only condition as text: "lets_go = true", "owner_condition out", "taker not breaking". */
function ifText(entry: TreeIf): string {
  if ('fact' in entry) return `${entry.fact} = ${entry.is}`;
  if ('low' in entry) return `${entry.clock} ${entry.low ? 'low' : 'not low'}`;
  if ('out' in entry) return `${entry.clock} ${entry.out ? 'out' : 'not out'}`;
  const stance = entry.stance === undefined ? [] : ([] as MeterStance[]).concat(entry.stance);
  const parts = [...stance.length ? [stance.join(' or ')] : [], ...entry.agitationAtLeast !== undefined ? [`agitation ≥ ${entry.agitationAtLeast}`] : []];
  return `${entry.meter} ${entry.is === false ? 'not ' : ''}${parts.join(' and ')}`;
}
/** A public state as text: "marks terms", "not safe courier", "others ≥ 1". */
function stateText(state: TreeState | undefined): string[] {
  if (!state) return [];
  return [...(state.marks ?? []).map(mark => `mark ${mark}`), ...(state.notMarks ?? []).map(mark => `no mark ${mark}`),
    ...(state.safe ?? []).map(role => `${role} safe`), ...(state.notSafe ?? []).map(role => `${role} not safe`), ...state.count ? [countText(state.count)] : []];
}
/** The conditions an outcome applies under, as one note, or undefined when it always applies. */
function outcomeConditions(outcome: TreeOutcome): string | undefined {
  const parts = [...ifsOf(outcome).map(ifText), ...stateText(outcome.when)];
  return parts.length ? parts.join(' and ') : undefined;
}

/** The index for one template's tree and clocks. Pure; about a millisecond per tree. */
export function dependencyIndex(template: IncidentTemplate): DependencyIndex {
  const tree = template.tree;
  const entries = new Map<StateKey, { writers: Site[]; readers: Site[]; seen: Set<string> }>();
  const add = (key: StateKey, side: 'writers' | 'readers', site: Site) => {
    let entry = entries.get(key);
    if (!entry) entries.set(key, entry = { writers: [], readers: [], seen: new Set() });
    const clean = Object.fromEntries(Object.entries(site).filter(([, value]) => value !== undefined && value !== false)) as unknown as Site;
    const id = `${side}|${siteKey(clean)}|${clean.conditional ?? ''}|${clean.drawn ? 'drawn' : ''}`;
    if (entry.seen.has(id)) return;
    entry.seen.add(id);
    entry[side].push(clean);
  };
  const write = (key: StateKey, site: Site) => add(key, 'writers', site);
  const read = (key: StateKey, site: Site) => add(key, 'readers', site);
  const readState = (state: TreeState | undefined, at: Omit<Site, 'field'>, field: SiteField) => {
    if (!state) return;
    for (const mark of state.marks ?? []) read(`mark:${mark}`, { ...at, field });
    for (const mark of state.notMarks ?? []) read(`mark:${mark}`, { ...at, field, negated: true });
    for (const role of state.safe ?? []) read(`safe:${role}`, { ...at, field });
    for (const role of state.notSafe ?? []) read(`safe:${role}`, { ...at, field, negated: true });
    if (state.count) read(`count:${state.count.role}`, { ...at, field, conditional: countText(state.count) });
  };
  // Clocks the engine runs, by id: every choice's minutes advance them.
  const clocks = template.situations.flatMap(situation => (situation.clocks ?? []).filter(clock => !clock.story).map(clock => ({ situation: situation.index as 0 | 1 | 2, clock })));
  const clockIds = [...new Set(clocks.map(entry => entry.clock.id))];

  // The call's own draws.
  write('situation', { field: 'draw' });
  for (const group of Object.keys(tree.groups ?? {})) write(`count:${group}`, { field: 'draw' });
  for (const group of Object.keys(tree.turns ?? {})) write(`turn:${group}`, { field: 'draw' });
  // Facts the team starts with, and what reads what the team believes.
  for (const [key, fact] of Object.entries(tree.facts)) {
    if (fact.public) write(`fact:${key}`, { field: 'fact.public' });
    if (fact.threat) read(`fact:${key}`, { field: 'fact.threat' });
  }
  for (const role of tree.roles) if (role.carries) read(`fact:${role.carries.knownFrom}`, { field: 'carries.knownFrom', conditional: `${role.id} carries ${role.carries.label}` });
  for (const mark of Object.keys(tree.threatMarks ?? {})) read(`mark:${mark}`, { field: 'threatMarks' });

  for (const node of tree.nodes) {
    (node.promptIf ?? []).forEach((entry, promptIf) => readState(entry.when, { node: node.id, promptIf }, 'promptIf.when'));
    // A decision point's threat sets its marks when it lands, by a slow choice or by running out,
    // and a beat when the stall reaches it.
    for (const mark of node.threat?.mark ?? []) write(`mark:${mark}`, { node: node.id, field: 'threat.mark', conditional: `when ${node.threat!.label} lands` });
    for (const beat of node.threat?.beats ?? []) for (const mark of beat.mark ?? []) write(`mark:${mark}`, { node: node.id, field: 'beat.mark', conditional: `at ${beat.at} min of stall` });
    for (const choice of node.choices) {
      const at = { node: node.id, choice: choice.id };
      readState(choice.onlyIf, at, 'onlyIf');
      for (const modifier of choice.modifiers ?? []) read(`mark:${modifier.mark}`, { ...at, field: 'modifier', conditional: `odds ${modifier.value > 0 ? '+' : ''}${modifier.value}` });
      for (const id of clockIds) write(`clock:${id}`, { ...at, field: 'choice.minutes', conditional: `${choice.minutes} min` });
      // A concession command gives on a result that goes well enough (sim/commitments.ts), when no
      // outcome made a promise of its own.
      if (choice.authority && choice.authority !== 'entry' && (choice.talksTo || choice.walks))
        for (const band of ['favorable', 'mixed'] as const) write(`promise:concession:${choiceActionId(tree.type, node.id, choice.id)}`, { ...at, band, field: 'authority.concede', conditional: `concedes ${choice.authority.concede}` });
      for (const band of BANDS) choice.outcomes[band].forEach((outcome, index) => {
        const site = { ...at, band, outcome: index };
        const conditional = outcomeConditions(outcome);
        const w = (key: StateKey, field: SiteField, drawn?: boolean) => write(key, { ...site, field, conditional, drawn });
        readState(outcome.when, site, 'outcome.when');
        for (const entry of ifsOf(outcome)) {
          if ('fact' in entry) read('situation', { ...site, field: 'outcome.if', conditional: ifText(entry), negated: !entry.is });
          else if ('clock' in entry) read(`clock:${entry.clock}`, { ...site, field: 'outcome.if', conditional: ifText(entry), negated: 'low' in entry ? !entry.low : !entry.out });
          else read(`meter:${entry.meter}`, { ...site, field: 'outcome.if', conditional: ifText(entry), negated: entry.is === false });
        }
        for (const mark of outcome.mark ?? []) w(`mark:${mark}`, 'outcome.mark');
        for (const role of outcome.safe ?? []) { w(`safe:${role}`, 'outcome.safe'); w(`out:${role}`, 'outcome.safe'); }
        for (const role of outcome.out ?? []) w(`out:${role}`, 'outcome.out');
        for (const fact of outcome.reveal ?? []) w(`fact:${fact}`, 'outcome.reveal');
        for (const role of Object.keys(outcome.moves ?? {})) w(`meter:${role}`, 'outcome.moves');
        if (outcome.promise) w(`promise:${outcome.promise.id}`, 'outcome.promise');
        for (const role of Object.keys(outcome.harm ?? {})) w(`harm:${role}`, 'outcome.harm');
        if (outcome.officer) w('harm:officer', 'outcome.officer');
        if (outcome.fire) { w('harm:officer', 'fire.harm', true); if (outcome.fire.mark) w(`mark:${outcome.fire.mark}`, 'fire.mark', true); }
        // Force: everything but a fatal result brings the person out; any result but none hurts them.
        if (outcome.force) { w(`out:${outcome.force.on}`, 'force.out', true); w(`harm:${outcome.force.on}`, 'force.harm', true); }
        if (outcome.cascade) w(`out:${outcome.cascade.group}`, 'cascade.out', true);
        if (outcome.objective) w('scalar:objective', 'outcome.objective');
        if (outcome.civilian) w('scalar:civilian', 'outcome.civilian');
        if (outcome.pressure) w('scalar:pressure', 'outcome.pressure');
        if (outcome.minutes) for (const id of clockIds) w(`clock:${id}`, 'choice.minutes');
        for (const next of outcomeNexts(outcome)) if ('turn' in next) read(`turn:${next.turn}`, { ...site, field: 'next.turn' });
      });
    }
  }

  // Clocks, per situation: cues and running out write; urgency and running out read.
  for (const { situation, clock } of clocks) {
    const at = { clock: clock.id, situation };
    for (const cue of clock.cues) {
      if (cue.mark) write(`mark:${cue.mark}`, { ...at, field: 'clock.cue.mark', conditional: `at ${cue.at}` });
      if (cue.reveal && clock.factKey) write(`fact:${clock.factKey}`, { ...at, field: 'clock.cue.reveal', conditional: `at ${cue.at}` });
    }
    if (clock.urgent) read(`clock:${clock.id}`, { ...at, field: 'clock.urgent' });
    const end = endOfClock(clock), fills = clock.direction === 'fill';
    if (end) {
      const markField = fills ? 'clock.onFull.mark' : 'clock.onOut.mark', harmField = fills ? 'clock.onFull.harm' : 'clock.onOut.harm';
      read(`clock:${clock.id}`, { ...at, field: end.mark ? markField : harmField });
      if (end.mark) write(`mark:${end.mark}`, { ...at, field: markField });
      if (end.harm && clock.owner) write(`harm:${clock.owner}`, { ...at, field: harmField, conditional: end.harm });
    }
    // A rate flag that names a mark reads it: the engine slows the gauge while the mark is set
    // (ClockDef.rateFlags).
    for (const entry of clock.rateFlags ?? []) if (entry.flag.startsWith('mark:')) read(entry.flag as StateKey, { ...at, field: 'clock.rateFlags', conditional: `${entry.ratePerMin} a minute` });
  }

  // What the engine itself reads (scoring, the map, promises, odds, the debrief).
  const ENGINE: Record<string, string> = {
    safe: 'scored as safe', out: 'shown outside on the map; keeps promises made to them', meter: 'odds of later talks with them',
    promise: 'kept or broken by what the team does next', harm: 'debrief, score, and refusals of later choices that involve them', scalar: 'score',
  };
  for (const [key, entry] of entries) {
    const kind = kindOf(key);
    if (ENGINE[kind]) entry.readers.push({ field: 'engine', conditional: key === 'scalar:pressure' ? 'score; past its threshold it costs civilian safety' : ENGINE[kind] });
  }

  const sorted = [...entries.entries()].sort(([a], [b]) => KIND_ORDER.indexOf(kindOf(a)) - KIND_ORDER.indexOf(kindOf(b)) || (a < b ? -1 : a > b ? 1 : 0));
  return { keys: new Map(sorted.map(([key, { writers, readers }]) => [key, { key, label: keyLabel(key, template), writers, readers }])) };
}

/** A key's plain label: a mark by its threat phrase or its id, a role by its label, a fact by its
 * label, a clock by its label. */
function keyLabel(key: StateKey, template: IncidentTemplate): string {
  const tree = template.tree;
  const [kind, ...rest] = key.split(':');
  const id = rest.join(':');
  const who = (role: string) => roleNoun(tree, role);
  const Who = (role: string) => sentenceCase(who(role));
  switch (kind) {
    case 'mark': return tree.threatMarks?.[id] ? plainTokens(tree.threatMarks[id], tree) : sentenceCase(id);
    case 'safe': return `${Who(id)} out safe`;
    case 'out': return `${Who(id)} out of the building`;
    case 'fact': return tree.facts[id] ? plainTokens(tree.facts[id].label, tree) : sentenceCase(id);
    case 'clock': {
      const clock = template.situations.flatMap(situation => situation.clocks ?? []).find(entry => entry.id === id);
      return clock ? plainTokens(clock.label, tree) : sentenceCase(id);
    }
    case 'meter': return `${Who(id)} agitation and rapport`;
    case 'promise': {
      if (id.startsWith('concession:')) {
        // The engine keys a concession by the action id; name the choice by its title instead.
        const actionId = id.slice('concession:'.length);
        const choice = tree.nodes.flatMap(node => node.choices.map(choice => ({ node, choice }))).find(({ node, choice }) => choiceActionId(tree.type, node.id, choice.id) === actionId)?.choice;
        return choice ? `Concession on “${plainTokens(choice.title, tree)}”` : `Concession on ${actionId}`;
      }
      const promise = tree.nodes.flatMap(node => node.choices.flatMap(choice => BANDS.flatMap(band => choice.outcomes[band]))).find(outcome => outcome.promise?.id === id)?.promise;
      return promise ? `${sentenceCase(id)}, promised to the ${who(promise.to)}` : sentenceCase(id);
    }
    case 'harm': return `${Who(id)} hurt`;
    case 'scalar': return id === 'objective' ? 'Objective progress' : id === 'civilian' ? 'Civilian safety' : 'Pressure';
    case 'count': return `How many ${id.replace(/_/g, ' ')}`;
    case 'turn': return `Turn drawn for ${id.replace(/_/g, ' ')}`;
    default: return 'Situation drawn';
  }
}

// ---------------------------------------------------------------- lint

export type LintCode = 'read_never_written' | 'dead_write' | 'threat_only' | 'drawn_only' | 'clock_writer'
  | 'unreachable_node' | 'unreachable_ending' | 'never_offered' | 'never_matched';
/** One finding. `id` is `<code>:<subject>` (a key, `node:<id>`, `ending:<id>` or a site key), stable
 * across runs, so a note can anchor `finding:<id>`. */
export interface LintFinding { id: string; code: LintCode | 'not_in_this_draw' | 'never_reached' | 'locked_for_squad' | 'flat_odds' | 'stuck_runs' | 'name_matcher';
  severity: 'error' | 'warn' | 'info'; key?: StateKey; node?: string; ending?: string; sites: Site[]; message: string }

/** Static lint for one template (spec 6.3): wiring of marks and safe flags, reachability over every
 * turn and group size, and choices or outcomes the compiler's own pruning drops in every call. */
export function lintTree(template: IncidentTemplate, index: DependencyIndex = dependencyIndex(template)): LintFinding[] {
  const tree = template.tree;
  const findings: LintFinding[] = [];
  const add = (finding: Omit<LintFinding, 'id'>, subject: string) => findings.push({ id: `${finding.code}:${subject}`, ...finding });

  for (const entry of index.keys.values()) {
    const kind = kindOf(entry.key);
    if (kind !== 'mark' && kind !== 'safe') continue;
    const readers = entry.readers.filter(site => site.field !== 'engine');
    const { writers, label, key } = entry;
    if (readers.length && !writers.length)
      add({ code: 'read_never_written', severity: 'error', key, sites: readers, message: `${label} is read but nothing sets it, so the compiler drops every choice, prompt and line that needs it.` }, key);
    if (kind !== 'mark') continue;
    if (writers.length && !readers.length)
      add({ code: 'dead_write', severity: 'warn', key, sites: writers, message: `${label} is set but nothing reads it.` }, key);
    if (readers.length && readers.every(site => site.field === 'threatMarks'))
      add({ code: 'threat_only', severity: 'info', key, sites: readers, message: `${label} is read only by command approval (threat marks).` }, key);
    if (writers.length && writers.every(site => site.drawn))
      add({ code: 'drawn_only', severity: 'info', key, sites: writers, message: `${label} is set only by a drawn result (an officer hit).` }, key);
    const onOut = writers.filter(site => site.field === 'clock.onOut.mark');
    if (onOut.length)
      add({ code: 'clock_writer', severity: 'info', key, sites: onOut, message: `${label} is also set when ${[...new Set(onOut.map(site => site.clock))].join(' or ')} runs out.` }, key);
    const onFull = writers.filter(site => site.field === 'clock.onFull.mark');
    if (onFull.length)
      add({ code: 'clock_writer', severity: 'info', key, sites: onFull, message: `${label} is also set when ${[...new Set(onFull.map(site => site.clock))].join(' or ')} fills.` }, key);
  }

  // Reachability and pruning, over every group size the template draws and every turn.
  const combos = countCombos(template);
  const clockMarks = templateClockMarks(template);
  // Where a clock running out sends the call is reachable from any node (R-G4).
  const clockNexts = templateClockNexts(template);
  const nodes = new Set<string>(), endings = new Set<string>();
  for (const counts of combos) {
    const reach = reachableWithin(treeForCounts(tree, counts), counts, clockNexts);
    for (const id of reach.nodes) nodes.add(id);
    for (const id of reach.endings) endings.add(id);
  }
  for (const node of tree.nodes) if (!nodes.has(node.id))
    add({ code: 'unreachable_node', severity: 'error', node: node.id, sites: [], message: `${sentenceCase(node.id)} can't be reached from ${tree.root} by any turn or group size.` }, `node:${node.id}`);
  for (const ending of Object.keys(tree.endings)) if (ending !== 'handed_over' && !endings.has(ending))
    add({ code: 'unreachable_ending', severity: 'error', ending, sites: [], message: `The ending ${ending} can't be reached by any turn or group size.` }, `ending:${ending}`);

  const plans = combos.map(counts => prunePlan(tree, counts, clockMarks, undefined, clockNexts));
  const never = (state: TreeState | undefined) => !!state && plans.every(plan => !plan.possible(state));
  for (const node of tree.nodes) for (const choice of node.choices) {
    if (never(choice.onlyIf)) {
      const site: Site = { node: node.id, choice: choice.id, field: 'onlyIf' };
      add({ code: 'never_offered', severity: 'warn', node: node.id, sites: [site], message: `${sentenceCase(node.id)} › ${choice.id} is never offered: ${plans[0].why(choice.onlyIf)} (every group size).` }, siteKey(site));
      continue;
    }
    for (const band of BANDS) choice.outcomes[band].forEach((outcome, index) => {
      if (!never(outcome.when)) return;
      const site: Site = { node: node.id, choice: choice.id, band, outcome: index, field: 'outcome.when' };
      add({ code: 'never_matched', severity: 'warn', node: node.id, sites: [site], message: `${sentenceCase(node.id)} › ${choice.id} · ${band} line ${index + 1} never applies: ${plans[0].why(outcome.when)} (every group size).` }, siteKey(site));
    });
  }
  return findings;
}

// ---------------------------------------------------------------- requirements

/** One requirement. `clock` carries `is` (a fork reads a clock both ways: low or not low). */
export type ReqLeaf =
  | { kind: 'at'; node: string } | { kind: 'mark'; mark: string; want: boolean } | { kind: 'safe'; role: string; want: boolean }
  | { kind: 'count'; group: string; min?: number; max?: number } | { kind: 'armed'; role: string; min?: number } | { kind: 'cert'; cert: string } | { kind: 'tags'; tags: string[]; all: boolean }
  | { kind: 'minSquads'; n: number } | { kind: 'fact'; fact: string; is: boolean } | { kind: 'clock'; clock: string; when: 'low' | 'out'; is: boolean }
  | { kind: 'meter'; role: string; stance?: MeterStance[]; agitationAtLeast?: number; is?: boolean } | { kind: 'band'; band: OutcomeBand }
  | { kind: 'turn'; group: string; node: string } | { kind: 'drawn'; result: string } | { kind: 'authority'; detail: string }
  | { kind: 'noEarlierPrompt'; node: string; index: number };
export type ReqNode = { all: ReqNode[] } | { any: ReqNode[] } | { leaf: ReqLeaf };
export type ReqTarget = { choice: [node: string, choice: string] } | { prompt: [node: string, index: number] }
  | { outcome: [node: string, choice: string, band: OutcomeBand, index: number] } | { ending: string } | { node: string };

const leaf = (value: ReqLeaf): ReqNode => ({ leaf: value });
function stateLeaves(state: TreeState | undefined): ReqNode[] {
  if (!state) return [];
  return [...(state.marks ?? []).map(mark => leaf({ kind: 'mark', mark, want: true })), ...(state.notMarks ?? []).map(mark => leaf({ kind: 'mark', mark, want: false })),
    ...(state.safe ?? []).map(role => leaf({ kind: 'safe', role, want: true })), ...(state.notSafe ?? []).map(role => leaf({ kind: 'safe', role, want: false })),
    ...state.count ? [leaf({ kind: 'count', group: state.count.role, ...state.count.min !== undefined ? { min: state.count.min } : {}, ...state.count.max !== undefined ? { max: state.count.max } : {} })] : [],
    // TreeState.armed: how many of the group hold a weapon a look would see, settled per call like count.
    ...state.armed ? [leaf({ kind: 'armed', role: state.armed.role, ...state.armed.min !== undefined ? { min: state.armed.min } : {} })] : []];
}
function ifLeaves(outcome: TreeOutcome): ReqNode[] {
  return ifsOf(outcome).map(entry => 'fact' in entry ? leaf({ kind: 'fact', fact: entry.fact, is: entry.is })
    : 'low' in entry ? leaf({ kind: 'clock', clock: entry.clock, when: 'low', is: entry.low })
      : 'out' in entry ? leaf({ kind: 'clock', clock: entry.clock, when: 'out', is: entry.out })
        : leaf({ kind: 'meter', role: entry.meter, ...entry.stance !== undefined ? { stance: ([] as MeterStance[]).concat(entry.stance) } : {},
          ...entry.agitationAtLeast !== undefined ? { agitationAtLeast: entry.agitationAtLeast } : {}, is: entry.is ?? true }));
}
function choiceLeaves(node: string, choice: TreeChoice): ReqNode[] {
  const r = choice.requires;
  return [leaf({ kind: 'at', node }), ...stateLeaves(choice.onlyIf),
    ...(r?.certs ?? []).map(cert => leaf({ kind: 'cert', cert })),
    ...r?.anyTags?.length ? [leaf({ kind: 'tags', tags: [...r.anyTags], all: false })] : [],
    ...r?.allTags?.length ? [leaf({ kind: 'tags', tags: [...r.allTags], all: true })] : [],
    ...r?.minSquads ? [leaf({ kind: 'minSquads', n: r.minSquads.count })] : [],
    ...choice.authority ? [leaf({ kind: 'authority', detail: choice.authority === 'entry' ? 'entry' : `concede ${choice.authority.concede}` })] : []];
}

/** Every route an outcome takes, with the drawn result and the group size that route needs. */
function routesOf(outcome: TreeOutcome): { next: TreeNext; drawn?: string; count?: { group: string; min: number } }[] {
  if (outcome.next) return [{ next: outcome.next }];
  if (outcome.force) {
    const { next, noFatal } = outcome.force;
    return [...noFatal ? [] : [{ next: next.fatal ?? next.hurt, drawn: 'force:fatal' }], { next: next.hurt, drawn: 'force:hurt' }, { next: next.none, drawn: 'force:none' }];
  }
  if (outcome.cascade) {
    const { next, group } = outcome.cascade;
    return [{ next: next.all, drawn: 'cascade:all' }, { next: next.some, drawn: 'cascade:some', count: { group, min: 2 } }, { next: next.none, drawn: 'cascade:none', count: { group, min: 1 } }];
  }
  return [];
}

/** What must hold for a target to happen (spec 6.4): a choice offered and eligible; a prompt
 * variant shown; an outcome applying; an ending or node reached (any edge into it, and any clock
 * whose running out sends the call there: `clocks`, the template's clock ids and `onOut.next`).
 * Being at a node is a leaf (`at`), never expanded; the engine's own refusal reason is the lab's to add. */
export function requirementTree(tree: CallTree, target: ReqTarget, clocks: readonly { clock: string; next: TreeNext }[] = []): ReqNode {
  const nodeOf = (id: string) => {
    const node = tree.nodes.find(entry => entry.id === id);
    if (!node) throw new Error(`${tree.type}: no node ${id}`);
    return node;
  };
  const choiceOf = (node: string, id: string) => {
    const choice = nodeOf(node).choices.find(entry => entry.id === id);
    if (!choice) throw new Error(`${tree.type}: no choice ${id} at ${node}`);
    return choice;
  };
  const outcomeReq = (node: string, choice: TreeChoice, band: OutcomeBand, outcome: TreeOutcome): ReqNode[] =>
    [...choiceLeaves(node, choice), leaf({ kind: 'band', band }), ...stateLeaves(outcome.when), ...ifLeaves(outcome)];
  /** Every edge into a node or an ending, each as what must hold to take it. */
  const into = (match: (next: TreeNext) => { turn?: { group: string; node: string } } | null): ReqNode => ({ any: [...tree.nodes.flatMap(node => node.choices.flatMap(choice => BANDS.flatMap(band =>
    choice.outcomes[band].flatMap(outcome => routesOf(outcome).flatMap(route => {
      const hit = match(route.next);
      if (!hit) return [];
      return [{ all: [...outcomeReq(node.id, choice, band, outcome), ...route.drawn ? [leaf({ kind: 'drawn', result: route.drawn })] : [],
        ...route.count ? [leaf({ kind: 'count', group: route.count.group, min: route.count.min })] : [],
        ...hit.turn ? [leaf({ kind: 'turn', ...hit.turn })] : []] }];
    }))))),
    // A clock that runs out sends the call there from wherever it is (R-G4).
    ...clocks.flatMap(({ clock, next }) => {
      const hit = match(next);
      return hit ? [{ all: [leaf({ kind: 'clock', clock, when: 'out', is: true }), ...hit.turn ? [leaf({ kind: 'turn', ...hit.turn })] : []] }] : [];
    })] });

  if ('choice' in target) return { all: choiceLeaves(target.choice[0], choiceOf(...target.choice)) };
  if ('prompt' in target) {
    const [node, index] = target.prompt;
    const entry = nodeOf(node).promptIf?.[index];
    if (!entry) throw new Error(`${tree.type}: no prompt variant ${index} at ${node}`);
    return { all: [leaf({ kind: 'at', node }), ...stateLeaves(entry.when), ...index > 0 ? [leaf({ kind: 'noEarlierPrompt', node, index })] : []] };
  }
  if ('outcome' in target) {
    const [node, id, band, index] = target.outcome;
    const choice = choiceOf(node, id);
    const outcome = choice.outcomes[band][index];
    if (!outcome) throw new Error(`${tree.type}: no ${band} outcome ${index} on ${node}.${id}`);
    return { all: outcomeReq(node, choice, band, outcome) };
  }
  if ('ending' in target) {
    if (!tree.endings[target.ending]) throw new Error(`${tree.type}: no ending ${target.ending}`);
    return into(next => 'ending' in next && next.ending === target.ending ? {} : null);
  }
  const node = nodeOf(target.node).id;
  if (node === tree.root) return { all: [] };
  return into(next => 'node' in next && next.node === node ? {} : 'turn' in next && tree.turns?.[next.turn]?.includes(node) ? { turn: { group: next.turn, node } } : null);
}
