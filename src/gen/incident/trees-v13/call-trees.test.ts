import { describe, expect, it } from 'vitest';
import { CALL_TREES, CALL_TREE_CONTENT_VERSION } from '../../../content/call-trees';
import { CIVILIAN_FIRST_NAMES, CIVILIAN_SURNAMES } from '../../../content/call-trees/civilian-names';
import personas from '../../../content/personas.json';
import type { CallTree, TreeChoice, TreeNext, TreeOutcome } from '../../../content/call-trees/types';
import { RETIRED_FROM_DISPATCH, TACTICAL_FRAMEWORKS } from '../../../content/unlocks';
import { SCENARIO_TYPES_V11 } from '../../../content/scenario-types-v11';
import { buildLocation } from '../../../sim/location';
import { validateScenario } from '../../../sim/operation';
import { actionViews } from '../../../sim/operation-selectors';
import type { GameState, OutcomeBand } from '../../../sim/types';
import { applyMove, availableMoves, NOW, startGateRun } from '../gates/engine-driver';
import { drawIncidentSpec, generateIncident, INCIDENT_CONTENT_VERSION } from '../index';
import { specForSituation } from '../gates/catalog';
import { bindRoleTokens, memberId, outcomeNexts, reachableWithin, TOKEN, treeForCounts } from './compile';
import { asRole, CASCADE_LINES, FIRE_LINES, FORCE_LINES } from '../../../content/incidents/lines';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import type { IncidentTemplate } from '../../../content/incidents/types';
import type { TreeIf } from '../../../content/call-trees/types';
import { CONCESSIONS_ALLOWED } from '../../../sim/scenario-types';
import { GROUP_TEMPLATE, GROUP_TREE } from './group-fixture';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const TREES = Object.values(CALL_TREES) as CallTree[];
/** The dispatched trees, and the group fixture for the gates that bind text and check groups, so
 * those gates run on a group call before the first dispatched one is written. */
const BOUND_TREES = [...TREES, GROUP_TREE];
const STAGE_ORDER = ['assess', 'adapt', 'resolve'];
const outcomesOf = (choice: TreeChoice): TreeOutcome[] => BANDS.flatMap(band => choice.outcomes[band]);
/** Where an outcome can go: its `next`, every severity of a drawn force outcome, or every result of a cascade. */
const nextsOf = (outcome: TreeOutcome): TreeNext[] => outcomeNexts(outcome);
/** The template a tree is drawn from: its own, never another tree's of the same type. */
const templateOf = (tree: CallTree): IncidentTemplate | undefined => tree === GROUP_TREE ? GROUP_TEMPLATE : INCIDENT_TEMPLATES[tree.type]?.tree === tree ? INCIDENT_TEMPLATES[tree.type] : undefined;
/** Every combination of group sizes the template allows: [{}] for a tree without groups. */
function countsOf(tree: CallTree): Record<string, number>[] {
  let combos: Record<string, number>[] = [{}];
  for (const [group, def] of Object.entries(tree.groups ?? {})) {
    const slot = templateOf(tree)?.cast.find(entry => entry.id === def.slot);
    const lo = Math.max(0, (slot?.count.min ?? 0) - (slot?.keyRoles.length ?? 0)), hi = Math.max(lo, (slot?.count.max ?? 0) - (slot?.keyRoles.length ?? 0));
    combos = combos.flatMap(combo => Array.from({ length: hi - lo + 1 }, (_, i) => ({ ...combo, [group]: lo + i })));
  }
  return combos;
}
/** Marks an outcome can set: its own, and the one a drawn hit sets. */
const marksOf = (outcome: TreeOutcome): string[] => [...outcome.mark ?? [], ...(outcome.fire?.mark ? [outcome.fire.mark] : [])];
const targets = (tree: CallTree, next: TreeNext): string[] => 'node' in next ? [next.node] : 'turn' in next ? [...tree.turns?.[next.turn] ?? []] : [];

/** Every player-visible string in a tree, with the field it sits in. */
const GENDERED = /\b(he|him|his|himself|she|her|hers|herself|man|men|woman|women|boy|boys|girl|girls|son|daughter|mother|father|mum|mom|dad|husband|wife|boyfriend|girlfriend|gentleman|lady|guy|sister|brother|aunt|uncle)\b/i;
const ADVERB = '(?:(?:never|still|only|also|just|always|already|then|now) )?';
/** Agreement slips a pronoun token can't catch by itself: a singular verb after they, a plural one
 * after he or she, and a compound verb after they ("they take the cash and goes"). */
const AGREEMENT = [
  new RegExp(`\\b[Tt]hey ${ADVERB}(?:is|was|has|does|doesn’t|isn’t|wasn’t|hasn’t|(?!this\\b)[a-z]+[^s’u]s)\\b`),
  new RegExp(`\\b(?:[Hh]e|[Ss]he) ${ADVERB}(?:are|were|have|do|don’t|aren’t|weren’t|haven’t)\\b`),
  // A new subject (a name, he, she, it) starts another clause: "they say Ana signs or stays" is fine.
  /\b[Tt]hey [a-z’]+ (?:(?![A-Z]|\b(?:he|she|it)\b)[^,;])*?\b(?:and|or) (?:then )?(?!his\b|this\b|its\b|hers\b)([a-z]+[^s’u]s)\b/,
  // ...and a verb in a comma list ("they stuff the cash in their jacket, sees the lights").
  /\b[Tt]hey [a-z’]+ (?:(?![A-Z]|\b(?:he|she|it)\b)[^.;])*?, (?:then )?(?:sees|hears|says|asks|goes|keeps|takes|turns|walks|stops|picks|puts|leaves|comes|looks|calls|holds|pulls|lets|tells|kicks|fires|drops|steps|sits|stands|runs|shouts|waits|answers|backs|moves|opens|shuts|locks|grabs|points|swings|raises|lowers|hangs)\b/,
];
/** With `counts`, the strings a call of those group sizes can show: count conditions settled, and
 * nodes and endings it can't reach left out. */
function treeStrings(authored: CallTree, counts?: Record<string, number>): { field: string; text: string }[] {
  const tree = counts ? treeForCounts(authored, counts) : authored;
  const reach = counts && authored.groups ? reachableWithin(tree, counts) : null;
  const out: { field: string; text: string }[] = [];
  const add = (field: string, text: string | undefined) => { if (text) out.push({ field, text }); };
  add('summary', tree.summary); add('title', tree.title); add('pressureLabel', tree.pressureLabel);
  for (const role of tree.roles) add('role.label', role.label);
  add('dispatchReason', tree.briefing.dispatchReason);
  for (const line of [...tree.briefing.known, ...tree.briefing.unknown, ...tree.briefing.responsibilities]) add('briefing', line);
  for (const label of Object.values(tree.stageLabels)) add('stageLabel', label);
  for (const objective of tree.objectives) add('objective', objective.label);
  for (const fact of Object.values(tree.facts)) for (const key of ['label', 'claim', 'confirmed', 'disproved', 'threat'] as const) add(`fact.${key}`, fact[key]);
  // Command's reasons (sim/authorization.ts): each completes "Command approves it because …" on a card.
  for (const phrase of Object.values(tree.threatMarks ?? {})) add('threatMark', phrase);
  for (const node of tree.nodes) {
    if (reach && !reach.nodes.has(node.id)) continue;
    add('prompt', node.prompt);
    for (const entry of node.promptIf ?? []) add('prompt', entry.prompt);
    for (const choice of node.choices) {
      add('choice.title', choice.title); add('choice.summary', choice.summary);
      for (const band of BANDS) add('choice.preview', choice.preview[band]);
      for (const modifier of choice.modifiers ?? []) add('modifier', modifier.label);
      for (const outcome of outcomesOf(choice)) add('outcome', outcome.text);
    }
  }
  for (const [id, ending] of Object.entries(tree.endings)) {
    if (reach && !reach.endings.has(id)) continue;
    add('ending.title', ending.title); add('ending.summary', ending.summary); for (const task of ending.remainingTasks ?? []) add('ending.task', task);
  }
  for (const situation of templateOf(authored)?.situations ?? []) for (const clock of situation.clocks ?? []) {
    add('clock.label', clock.label);
    for (const cue of clock.cues) add('clock.cue', cue.text);
    add('clock.urgent', clock.urgent);
  }
  return out;
}

describe('call trees: civilian names', () => {
  it('share no first name or surname with any officer the player can hire, and repeat nothing', () => {
    const officers = (personas as { firstName: string; surname: string }[]);
    const officerNames = new Set(officers.flatMap(person => [person.firstName, person.surname]));
    const first = Object.values(CIVILIAN_FIRST_NAMES).flat();
    expect(first.filter(name => officerNames.has(name))).toEqual([]);
    expect(CIVILIAN_SURNAMES.filter(name => officerNames.has(name))).toEqual([]);
    for (const list of [...Object.values(CIVILIAN_FIRST_NAMES), CIVILIAN_SURNAMES]) expect(new Set(list).size).toBe(list.length);
    expect(first.filter(name => CIVILIAN_SURNAMES.includes(name))).toEqual([]);
  });
});

describe('call trees: authoring rules', () => {
  it('dispatches only tactical frameworks, and every tree is one of them', () => {
    expect(SCENARIO_TYPES_V11.map(info => info.type).filter(type => !RETIRED_FROM_DISPATCH.has(type)).sort()).toEqual([...TACTICAL_FRAMEWORKS].sort());
    for (const tree of TREES) expect(TACTICAL_FRAMEWORKS.has(tree.type), tree.type).toBe(true);
    expect(INCIDENT_CONTENT_VERSION).toBeGreaterThanOrEqual(CALL_TREE_CONTENT_VERSION);
  });

  for (const tree of TREES) describe(tree.type, () => {
    const nodeById = new Map(tree.nodes.map(node => [node.id, node]));

    it('has unique ids, a root, a fallback ending and situations that settle every hidden fact', () => {
      expect(new Set(tree.nodes.map(node => node.id)).size).toBe(tree.nodes.length);
      expect(nodeById.get(tree.root)?.stage).toBe('assess');
      expect(tree.endings.handed_over?.disposition).toBe('unresolved');
      for (const node of tree.nodes) expect(new Set(node.choices.map(choice => choice.id)).size, node.id).toBe(node.choices.length);
      for (const [key, fact] of Object.entries(tree.facts)) if (fact.truth === undefined)
        for (const situation of tree.situations) expect(typeof situation.truth[key], `${key} in ${situation.note}`).toBe('boolean');
      for (const role of tree.roles) expect(role.id, 'role ids are roles in lower snake case, never names').toMatch(/^[a-z][a-z_]*$/);
    });

    it('offers two or more exclusive choices at every node, one of them always takeable', () => {
      for (const node of tree.nodes) {
        expect(node.choices.length, node.id).toBeGreaterThanOrEqual(2);
        expect(node.choices.some(choice => !choice.requires && !choice.onlyIf), `${node.id} needs a choice with no requirement`).toBe(true);
      }
    });

    it('routes every band forward to a real node or ending, never back to its own node or stage', () => {
      for (const node of tree.nodes) for (const choice of node.choices) for (const band of BANDS) {
        const routed = choice.outcomes[band].filter(outcome => nextsOf(outcome).length);
        expect(routed.length, `${node.id}.${choice.id}.${band} routes nowhere`).toBeGreaterThan(0);
        for (const next of routed.flatMap(nextsOf)) {
          if ('ending' in next) { expect(tree.endings[next.ending], next.ending).toBeDefined(); continue; }
          for (const target of targets(tree, next)) {
            const to = nodeById.get(target);
            expect(to, `${node.id}.${choice.id} -> ${target}`).toBeDefined();
            expect(target, `${node.id}.${choice.id} routes back to its own node`).not.toBe(node.id);
            expect(STAGE_ORDER.indexOf(to!.stage)).toBeGreaterThanOrEqual(STAGE_ORDER.indexOf(node.stage));
          }
        }
      }
    });

    it('reaches every node from the root', () => {
      const seen = new Set([tree.root]), queue = [tree.root];
      while (queue.length) for (const choice of nodeById.get(queue.shift()!)!.choices) for (const outcome of outcomesOf(choice))
        for (const target of nextsOf(outcome).flatMap(next => targets(tree, next))) if (!seen.has(target)) { seen.add(target); queue.push(target); }
      expect(tree.nodes.map(node => node.id).filter(id => !seen.has(id))).toEqual([]);
    });

    it('reads every mark it sets, and sets every mark it reads', () => {
      // A clock's cues set marks too (content/incidents).
      const cueMarks = (INCIDENT_TEMPLATES[tree.type]?.situations ?? []).flatMap(situation => (situation.clocks ?? []).flatMap(clock => clock.cues.flatMap(cue => cue.mark ? [cue.mark] : [])));
      const set = new Set([...tree.nodes.flatMap(node => node.choices.flatMap(choice => outcomesOf(choice).flatMap(marksOf))), ...cueMarks]);
      // Authorization reads threat marks (sim/authorization.ts).
      const read = new Set([...Object.keys(tree.threatMarks ?? {}), ...tree.nodes.flatMap(node => [
        ...(node.promptIf ?? []).flatMap(entry => [...entry.when.marks ?? [], ...entry.when.notMarks ?? []]),
        ...node.choices.flatMap(choice => [...choice.onlyIf?.marks ?? [], ...choice.onlyIf?.notMarks ?? [], ...(choice.modifiers ?? []).map(m => m.mark),
          ...outcomesOf(choice).flatMap(outcome => [...outcome.when?.marks ?? [], ...outcome.when?.notMarks ?? []])]),
      ])]);
      expect([...set].filter(mark => !read.has(mark)), 'marks nobody reads').toEqual([]);
      expect([...read].filter(mark => !set.has(mark)), 'marks nobody sets').toEqual([]);
    });

    // Authorization (docs/incident-domain-model.md §7, sim/authorization.ts). These are the data
    // rules; whether each entry is authorized where the tree offers it is the engine's to prove.
    it('asks command for entry wherever the team goes in, and gives command a threat or a clock to cite', () => {
      const choices = tree.nodes.flatMap(node => node.choices.map(choice => ({ where: `${node.id}.${choice.id}`, choice })));
      for (const { where, choice } of choices) if (choice.icon === 'shield' || choice.requires?.certs?.includes('entry_team'))
        expect(choice.authority, `${where} sends the team in without asking command`).toBe('entry');
      const revealed = new Set(choices.flatMap(({ choice }) => outcomesOf(choice).flatMap(outcome => outcome.reveal ?? [])));
      for (const [key, fact] of Object.entries(tree.facts)) if (fact.threat) {
        expect(fact.public || revealed.has(key), `threat fact ${key} is never reported or revealed`).toBe(true);
        expect(fact.truth ?? tree.situations.some(situation => situation.truth[key]), `threat fact ${key} is never true`).toBe(true);
      }
      const urgent = (INCIDENT_TEMPLATES[tree.type]?.situations ?? []).some(situation => (situation.clocks ?? []).some(clock => clock.urgent));
      const evidence = Object.values(tree.facts).some(fact => fact.threat) || Object.keys(tree.threatMarks ?? {}).length > 0 || urgent;
      if (choices.some(({ choice }) => choice.authority === 'entry')) expect(evidence, 'entries with no threat or urgent clock to authorize them').toBe(true);
    });

    it('concedes and promises only what command can give, and only to a subject', () => {
      const promisedTo = new Map<string, string>();
      for (const node of tree.nodes) for (const choice of node.choices) {
        const where = `${node.id}.${choice.id}`;
        if (choice.authority && choice.authority !== 'entry') expect(CONCESSIONS_ALLOWED, `${where} concedes ${choice.authority.concede}`).toContain(choice.authority.concede);
        for (const outcome of outcomesOf(choice)) if (outcome.promise) {
          const { id, to, kind = 'promise' } = outcome.promise;
          expect(tree.roles.find(role => role.id === to)?.kind, `${where} promises ${id} to ${to}`).toBe('subject');
          if (kind !== 'promise') expect(CONCESSIONS_ALLOWED, `${where} promises ${kind}`).toContain(kind);
          expect(promisedTo.get(id) ?? to, `promise ${id} made to two people`).toBe(to);
          promisedTo.set(id, to);
        }
      }
    });

    it('gives the choices at a node different futures: another node, ending, or an option only they open', () => {
      const opens = new Set(tree.nodes.flatMap(node => node.choices.flatMap(choice => choice.onlyIf?.marks ?? [])));
      const future = (choice: TreeChoice) => JSON.stringify([...new Set(outcomesOf(choice).flatMap(outcome =>
        [...nextsOf(outcome).flatMap(next => 'ending' in next ? [`end:${next.ending}`] : targets(tree, next)), ...marksOf(outcome).filter(mark => opens.has(mark)).map(mark => `opens:${mark}`)]))].sort());
      for (const node of tree.nodes) expect(new Set(node.choices.map(future)).size, `${node.id}: every choice leads to the same place`).toBeGreaterThan(1);
    });

  });
});

describe('call trees: text for whoever is drawn, at every group size', () => {
  for (const tree of BOUND_TREES) describe(tree === GROUP_TREE ? 'group fixture' : tree.type, () => {
    const roles = new Set(tree.roles.map(role => role.id)), groups = new Set(Object.keys(tree.groups ?? {}));

    it('writes known role tokens only, {lead} only in summaries, and no dashes or stray colons', () => {
      for (const { field, text } of treeStrings(tree)) {
        for (const [, token, part, singular, , heForm, , , oneForm] of text.matchAll(TOKEN)) {
          if (token === 'lead') { expect(field, `{lead} in ${field}: "${text}"`).toBe('choice.summary'); continue; }
          if (token === 'place' || token === 'scene') { expect(part).toBeUndefined(); continue; }
          if (part === 'room') { expect(roles.has(token) || groups.has(token), `unknown room token {${token}.room}`).toBe(true); continue; }
          expect(roles.has(token) || groups.has(token), `unknown token {${token}} in "${text}"`).toBe(true);
          if (part) expect(['first', 'last', 'age', 'he', 'him', 'his', 'hers', 'himself', ...groups.has(token) ? ['n'] : []]).toContain(part.toLowerCase());
          // Number agreement after names is for a group; one person's name is always singular.
          if (oneForm !== undefined) expect(groups.has(token), `{${token}#…} on a key role in "${text}"`).toBe(true);
          if (groups.has(token)) expect(part, `{${token}.age} in "${text}"`).not.toBe('age');
          void singular; void heForm;
        }
        expect(text.replace(TOKEN, ''), `malformed token in ${field}`).not.toMatch(/[{}]/);
        expect(text, `dash in ${field}`).not.toMatch(/[–—]| - /);
        expect(text.replace(/\b\d{1,2}:\d{2}\b/g, ''), `colon in ${field}`).not.toContain(':');
      }
    });

    // Identity is drawn per call, the same way for every kind of person (content/incidents/types.ts),
    // so no call text may assume one: pronouns, verb agreement and gendered nouns are tokens.
    it('writes no gendered word: whoever is drawn, the text fits them', () => {
      for (const { field, text } of treeStrings(tree)) expect(text.replace(TOKEN, ''), `gendered word in ${field}: "${text}"`).not.toMatch(GENDERED);
    });

    // A tree with groups is bound at every group size its template allows, with each role and each
    // member as he, she and they: a lone call must bind no group text, and a group of two must
    // read as plural.
    it('reads correctly with every role and member drawn as he, she and they', () => {
      for (const counts of countsOf(tree)) {
        const members = Object.fromEntries(Object.entries(counts).map(([group, n]) => [group, Array.from({ length: n }, (_, i) => memberId(group, i + 1))]));
        const ids = [...tree.roles.map(role => role.id), ...Object.values(members).flat()];
        const strings = treeStrings(tree, tree.groups ? counts : undefined);
        for (const role of ids) for (const pronouns of ['he', 'she', 'they'] as const) {
          const cast = Object.fromEntries(ids.map(id => [id, { firstName: id.replace(/_\d+$/, '').toUpperCase() + id.replace(/\D/g, ''), surname: 'X', pronouns: id === role ? pronouns : 'he' as const, age: 15 }]));
          const rooms = { scene: 'SCENE', ...Object.fromEntries([...ids, ...Object.keys(members).filter(group => members[group].length)].map(id => [id, 'ROOM'])) };
          for (const { field, text } of strings) {
            const bound = bindRoleTokens(text, cast, 'PLACE', rooms, members);
            for (const sentence of bound.split(/(?<=[.?!])\s+/)) for (const check of AGREEMENT) expect(sentence, `${field} with ${role} as ${pronouns} at ${JSON.stringify(counts)}`).not.toMatch(check);
          }
        }
      }
    });
  });

  it('draws every counted person into a group the tree names, led by the slot’s first key role', () => {
    for (const tree of BOUND_TREES) {
      const template = templateOf(tree);
      expect(template, `${tree.type} has no template of its own`).toBeDefined();
      for (const slot of template!.cast) if (slot.count.max > slot.keyRoles.length)
        expect(Object.values(tree.groups ?? {}).some(group => group.slot === slot.id), `${tree.type} slot ${slot.id} draws people no group names`).toBe(true);
      for (const [id, group] of Object.entries(tree.groups ?? {})) {
        const slot = template!.cast.find(entry => entry.id === group.slot);
        expect(slot, `group ${id} reads slot ${group.slot}`).toBeDefined();
        expect(slot!.keyRoles[0], `group ${id} is led by the slot’s first key role`).toBe(group.leader);
        expect(tree.roles.some(role => role.id === id), `group ${id} shares a role id`).toBe(false);
      }
      for (const node of tree.nodes) for (const choice of node.choices) {
        for (const state of [choice.onlyIf, ...outcomesOf(choice).map(outcome => outcome.when)]) if (state?.count) expect(tree.groups?.[state.count.role], `${node.id}.${choice.id} counts ${state.count.role}`).toBeDefined();
        for (const outcome of outcomesOf(choice)) if (outcome.cascade) expect(tree.groups?.[outcome.cascade.group]?.leader, `${node.id}.${choice.id} cascade`).toBe(outcome.cascade.leader);
      }
    }
  });
});

describe('call trees: clocks (content/incidents, sim/clocks.ts)', () => {
  for (const tree of TREES) describe(tree.type, () => {
    const template = INCIDENT_TEMPLATES[tree.type]!;
    const clocks = template.situations.flatMap(situation => (situation.clocks ?? []).map(clock => ({ situation, clock })));
    const forks = tree.nodes.flatMap(node => node.choices.flatMap(choice => BANDS.map(band => ({ where: `${node.id}.${choice.id}.${band}`,
      conditions: choice.outcomes[band].flatMap(outcome => ([] as TreeIf[]).concat(outcome.if ?? []).flatMap(c => 'clock' in c ? [c] : [])) }))));

    it('reads only clocks its template runs, and never one the story still runs by itself', () => {
      for (const { where, conditions } of forks) for (const c of conditions) {
        const runs = clocks.filter(entry => entry.clock.id === c.clock);
        expect(runs.length, `${where} reads clock ${c.clock}, which no situation has`).toBeGreaterThan(0);
        expect(runs.some(entry => entry.clock.story), `${where} reads ${c.clock}, which the story runs by itself`).toBe(false);
      }
    });

    it('forks on a clock both ways in the same band, so the call goes on whichever way time fell', () => {
      for (const { where, conditions } of forks) {
        const keys = new Set(conditions.map(c => `${c.clock}:${'low' in c ? 'low' : 'out'}:${'low' in c ? c.low : c.out}`));
        for (const key of keys) expect(keys.has(key.replace(/true$|false$/, flag => flag === 'true' ? 'false' : 'true')), `${where}: ${key} has no other side`).toBe(true);
      }
    });

    it('cues that settle a fact say what the situation says, and lead with a warning before running out', () => {
      for (const { situation, clock } of clocks) {
        expect(clock.cues.some(cue => cue.at > 0), `${clock.id} has no warning before it runs out`).toBe(true);
        expect(clock.cues.every((cue, i) => i === 0 || cue.at <= clock.cues[i - 1].at), `${clock.id} cues highest first`).toBe(true);
        for (const cue of clock.cues.filter(entry => entry.reveal)) {
          const fact = tree.facts[clock.factKey!];
          const truth = fact.truth ?? tree.situations[situation.index].truth[clock.factKey!];
          expect(cue.text, `${clock.id} cue in situation ${situation.index}`).toBe(truth ? fact.confirmed : fact.disproved);
        }
      }
    });
  });
});

describe('call trees: generated calls', () => {
  for (const tree of TREES) it(`${tree.type} generates, binds and validates on every hosting building`, () => {
    let state = 2024, made = 0;
    const turnsSeen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const drawn = drawIncidentSpec(state, { level: 10, trust: 90, contentVersion: INCIDENT_CONTENT_VERSION, unlockedTypes: [tree.type] });
      state = drawn.state;
      const s = generateIncident(drawn.spec);
      made++;
      expect(s.version).toBe(13);
      // The roles, then every member of a group (others_1, others_2), each a story-bound person.
      const members = Object.keys(s.story!.cast!).filter(id => !tree.roles.some(role => role.id === id));
      expect(Object.keys(s.story!.cast!).filter(id => !members.includes(id)).sort()).toEqual(tree.roles.map(role => role.id).sort());
      for (const id of members) {
        expect(Object.keys(tree.groups ?? {}).some(group => new RegExp(`^${group}_\\d+$`).test(id)), `${id} belongs to no group`).toBe(true);
        expect(s.story!.bindings.people[id], `${id} is not story-bound`).toBeDefined();
        expect(s.incidentPeople?.some(person => person.id === id), `${id} is not an engine person`).toBe(true);
      }
      const text = JSON.stringify(s);
      expect(text.match(/\{(?!lead\})[a-z0-9_.]+\}/g), 'unbound token').toBeNull();
      for (const role of tree.roles) expect(text, 'engine keys are roles').toContain(`"${role.id}"`);
      const built = buildLocation(s.locationFamilyId, s.locationSeed);
      expect(validateScenario(s, built)).toEqual([]);
      // The scene fits the call: a listed building type, and a room of a listed type.
      expect(tree.families).toContain(s.incident!.familyId);
      const scene = built.location.rooms.find(room => room.id === s.story!.bindings.rooms.scene.spaceId)!;
      expect(tree.scene.rooms).toContain(scene.type);
      for (const group of Object.values(tree.turns ?? {})) for (const id of group) if (s.story!.episode!.modules.includes(id)) turnsSeen.add(id);
    }
    expect(made).toBe(60);
    for (const group of Object.values(tree.turns ?? {})) for (const id of group) expect(turnsSeen.has(id), `turn ${id} never drawn`).toBe(true);
  }, 120000);
});

describe('call trees: every path through the engine', () => {
  // Clock states that can change a fork (how many cues fired, and whether it ran out) are part of
  // where the call is, so the walk explores both sides of a time branch.
  const key = (state: GameState) => { const run = state.activeRun!; return JSON.stringify([run.stage, run.status, [...run.flags].sort(), Object.entries(run.knowledge).sort(),
    Object.entries(run.clocks ?? {}).map(([id, clock]) => [id, clock.cued, clock.value <= 0, Math.floor(clock.value / 10)]).sort()]); };
  for (const tree of TREES) it(`${tree.type}: a pick never leaves its siblings, no dead ends, one node at a time`, () => {
    const family = SCENARIO_TYPES_V11.find(info => info.type === tree.type)!.families[0];
    let leftovers = 0, deadEnds = 0, twoNodes = 0, ended = 0;
    // Authority (sim/authorization.ts): a choice the call offers must be authorized somewhere it is offered.
    const offered = new Set<string>(), authorized = new Set<string>();
    for (const variant of [0, 1, 2] as const) {
      const start = startGateRun(generateIncident(specForSituation(tree.type, family, variant)).id);
      const queue = [start], seen = new Set([key(start)]);
      while (queue.length) {
        const state = queue.shift()!, run = state.activeRun!;
        if (run.status !== 'active' || run.stage === 'debrief') { ended++; continue; }
        if (run.flags.filter(flag => flag.startsWith('at:')).length > 1) twoNodes++;
        const views = actionViews(state, NOW, 'A');
        const eligible = views.filter(view => view.eligible);
        if (!eligible.length) deadEnds++;
        for (const view of views) if (view.authority) { offered.add(view.id); if (view.authority.allowed) authorized.add(view.id); }
        for (const view of eligible) {
          const after = applyMove(state, { kind: 'decide', actionId: view.id, band: 'favorable' }, views);
          const left = after?.activeRun?.status === 'active' ? actionViews(after, NOW, 'A').filter(next => next.eligible).map(next => next.id) : [];
          if (eligible.some(other => other.id !== view.id && left.includes(other.id))) leftovers++;
        }
        for (const move of availableMoves(state, views)) {
          if (move.kind === 'fail') continue;
          const after = applyMove(state, move, views);
          if (!after || seen.has(key(after))) continue;
          seen.add(key(after)); queue.push(after);
        }
      }
    }
    expect({ leftovers, deadEnds, twoNodes }).toEqual({ leftovers: 0, deadEnds: 0, twoNodes: 0 });
    expect(ended).toBeGreaterThan(0);
    expect([...offered].filter(id => !authorized.has(id)), 'offered but never authorized').toEqual([]);
  }, 300000);
});

describe('standard lines for drawn consequences (content/incidents/lines.ts)', () => {
  it('write no gendered word and read correctly whoever is drawn', () => {
    const lines = [...Object.values(FIRE_LINES), ...Object.values(FORCE_LINES).flatMap(entry => Object.values(entry))].map(line => asRole(line, 'x'));
    for (const line of lines) expect(line.replace(TOKEN, ''), line).not.toMatch(GENDERED);
    for (const pronouns of ['he', 'she', 'they'] as const) for (const line of lines) {
      const bound = bindRoleTokens(line, { x: { firstName: 'Ash', surname: 'Lee', pronouns } });
      for (const check of AGREEMENT) expect(bound, `${line} as ${pronouns}`).not.toMatch(check);
      expect(bound, 'colon or dash').not.toMatch(/[:–—]| - /);
    }
  });

  it('name who followed a leader who gave up, one name or several, whoever is drawn', () => {
    const forms = Object.values(CASCADE_LINES).flatMap(entry => [['one', entry.one], ['many', entry.many]] as const);
    for (const [, line] of forms) expect(asRole(line, 'x').replace(TOKEN, ''), line).not.toMatch(GENDERED);
    for (const pronouns of ['he', 'she', 'they'] as const) for (const [count, line] of forms) {
      const names = count === 'one' ? 'Sol' : 'Sol and Ines';
      const bound = bindRoleTokens(asRole(line, 'x').replace('{names}', names), { x: { firstName: 'Ash', surname: 'Lee', pronouns } });
      for (const check of AGREEMENT) expect(bound, `${line} as ${pronouns}`).not.toMatch(check);
      expect(bound, 'colon or dash').not.toMatch(/[:–—]| - /);
      expect(bound).toMatch(count === 'one' ? /^Sol [a-z]+s / : /^Sol and Ines [a-z]+[^s] /);
    }
  });
});
