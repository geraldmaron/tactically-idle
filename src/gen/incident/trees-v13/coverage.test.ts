import { describe, expect, it } from 'vitest';
import { CALL_TREES } from '../../../content/call-trees';
import type { CallTree } from '../../../content/call-trees/types';
import { scenarioRecipe } from '../../../content/scenario-recipes';
import { cascadeKey, cascadeResult, cascadeStates, type CascadeState, drawnKey, drawnKeys, incomingFireSeverity, teamForceSeverity, type ForceProfile } from '../../../sim/drawn-effects';
import { INCIDENT_TEMPLATES } from '../../../content/incidents';
import { stanceOf } from '../../../sim/meters';
import { matchedEffects } from '../../../sim/operation';
import { actionViews } from '../../../sim/operation-selectors';
import { next } from '../../../sim/rng';
import { getScenario } from '../../../sim/scenario-registry';
import type { OutcomeEffect, ScenarioDefinition } from '../../../sim/scenario-types';
import { apply } from '../../../sim/test-fixtures';
import type { ActionView, GameState, OutcomeBand } from '../../../sim/types';
import { applyMove, availableMoves, NOW, sampleFor, startGateRun, withDraftScenario } from '../gates/engine-driver';
import { GATE_CONTENT_VERSION } from '../gates/catalog';
import { drawIncidentSpec, generateIncident } from '../index';
import { choiceActionId, memberCounts } from './compile';
import { GROUP_TEMPLATE, GROUP_TREE } from './group-fixture';
import { compileIncident, drawInstance, hostedSpec } from '../instance';
import { buildLocation } from '../../../sim/location';

// The coverage gate (docs/incident-domain-model.md §8, M2 slice 5): resolve, then narrate. Every
// state a call can reach through the real engine must have exactly one routed outcome with text,
// whatever the models settled. It walks:
// - every situation of each call with both pacings and every node of each turn group, two calls per
//   turn node for the clock rates, drawn the way the board draws them (building type, tier, seed);
// - every eligible choice at every reachable state, with every band that can occur at its odds;
// - every result of a drawn consequence (incoming fire, team force, a group's cascade): checked for
//   routing and text statically at each commit, and walked by steering the engine's own dice into
//   each result the model can give there;
// - the group fixture (group-fixture.ts) with 0 to 3 others, for the cascade and count conditions;
// - states told apart by flags (node, marks, who is out, casualties), what the team knows, each
//   clock's cue count, whether it ran out and its value in tens, and, in a call that branches on
//   meters, each subject's stance and the agitation thresholds its branches read. Bound: where no
//   branch reads meters, states that differ only in meter values merge, though meters still move
//   the odds and so which bands can occur.
// At every commit it fails a band whose matched effects route nowhere or route twice (two effects
// that set a node or an ending), or carry no text; and any live state with no eligible choice.
// Gaps are reported by field path: call, start, node.choice.band[drawn result], and the state.

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const TREES = Object.values(CALL_TREES) as CallTree[];
/** Calls per turn node in a situation with a clock: each call draws its own clock rate. */
const SEEDS_PER_START = 2;
/** Second-draw bins a drawn consequence is steered through: one run state each, of which the walk
 * plays one per distinct result (a result narrower than a bin can be missed by the walk, never by
 * the static check, which reads every variant). */
const STEER_BINS = 200;
/** Calls whose gaps are listed, not failed, while they are rewritten. Empty: the hostage call had no
 * gaps when the gate landed (2026-10-07), so the gate guards its rewrite as the slice 5 pilot. */
const REPORT_ONLY = new Set<string>();

interface Start { label: string; scenarioId: string }

/** Generated calls, drawn the way the board draws them, until every situation has met every
 * pacing once and every turn node `SEEDS_PER_START` times. Pacing and turn node are not crossed:
 * the turn draw and the situation draw share the call seed's hash parity (hashSeed is FNV-1a), so a
 * two-node turn group follows the pacing and some crossings never occur. */
function startsFor(tree: CallTree): Start[] {
  const groups = Object.values(tree.turns ?? {});
  const clocked = (variant: number) => (INCIDENT_TEMPLATES[tree.type]?.situations[variant]?.clocks ?? []).some(clock => !clock.story);
  const targets = new Map<string, number>();
  for (const variant of [0, 1, 2]) {
    for (const pacing of ['ordinary', 'deliberate_answers']) targets.set(`${variant}/${pacing}`, 1);
    for (const node of groups.flat()) targets.set(`${variant}/${node}`, clocked(variant) ? SEEDS_PER_START : 1);
  }
  const count = new Map<string, number>();
  const starts: Start[] = [];
  let state = 2024;
  for (let i = 0; i < 2000 && [...targets].some(([target, n]) => (count.get(target) ?? 0) < n); i++) {
    const drawn = drawIncidentSpec(state, { level: 10, trust: 90, contentVersion: GATE_CONTENT_VERSION, unlockedTypes: [tree.type] });
    state = drawn.state;
    const s = generateIncident(drawn.spec);
    const picked = scenarioRecipe(s.incident!);
    const modules = s.story?.episode?.modules ?? [];
    const keys = [`${picked.variant}/${picked.characteristic}`, ...groups.flat().filter(node => modules.includes(node)).map(node => `${picked.variant}/${node}`)];
    if (!keys.some(key => (count.get(key) ?? 0) < (targets.get(key) ?? 0))) continue;
    for (const key of keys) count.set(key, (count.get(key) ?? 0) + 1);
    starts.push({ label: `situation ${keys.join(' ')} on ${s.incident!.familyId} tier ${s.incident!.tier} seed ${s.incident!.seed}`, scenarioId: s.id });
  }
  const missing = [...targets].filter(([target, n]) => (count.get(target) ?? 0) < n).map(([target]) => target);
  if (missing.length) throw new Error(`${tree.type}: no call drawn for ${missing.join(', ')}`);
  return starts;
}

/** The agitation thresholds a call's meter branches read, or null when none branch on meters. */
function meterThresholds(scenario: ScenarioDefinition): number[] | null {
  const conditions = Object.values(scenario.stages).flatMap(stage => stage.actions.flatMap(action => Object.values(action.outcomes).flat())).flatMap(effect => effect.meters ?? []);
  if (!conditions.length) return null;
  return [...new Set(conditions.flatMap(condition => condition.agitationAtLeast ?? []))].sort((a, b) => a - b);
}

/** Where the call is. Meters count only in a call whose outcomes branch on them (stance, and which
 * of its agitation thresholds are met): elsewhere they move only the odds, and keying on them
 * multiplies the states without reaching a new branch. */
function stateKey(state: GameState, thresholds: number[] | null): string {
  const run = state.activeRun!;
  return JSON.stringify([run.stage, run.status, [...run.flags].sort(), Object.entries(run.knowledge).sort(),
    Object.entries(run.clocks ?? {}).map(([id, clock]) => [id, clock.cued, clock.value <= 0, Math.floor(clock.value / 10)]).sort(),
    thresholds ? Object.entries(run.meters ?? {}).map(([id, meters]) => [id, stanceOf(meters), thresholds.filter(at => meters.agitation >= at).length]).sort() : []]);
}

/** Where the walk is, for a gap's field path: marks, who is out, clocks and stances. */
function describeState(state: GameState): string {
  const run = state.activeRun!;
  const marks = run.flags.filter(flag => flag.startsWith('mark:')).map(flag => flag.slice(5));
  const out = run.flags.filter(flag => flag.startsWith('out:')).map(flag => flag.slice(4));
  const harm = run.flags.filter(flag => flag.startsWith('person_harm:')).map(flag => flag.slice(12));
  const clocks = Object.entries(run.clocks ?? {}).map(([id, clock]) => `${id} ${clock.value <= 0 ? 'out' : clock.cued ? 'low' : 'fine'} (${clock.value})`);
  const meters = Object.entries(run.meters ?? {}).map(([id, meters]) => `${id} ${stanceOf(meters)} (agitation ${meters.agitation})`);
  return `{marks: ${marks.join(' ') || '-'}; out: ${out.join(' ') || '-'}; harm: ${harm.join(' ') || '-'}; clocks: ${clocks.join(', ') || '-'}; meters: ${meters.join(', ') || '-'}}`;
}

/** Every result the drawn consequences in `matched` can give, each as the effects the commit applies. */
function drawnResults(matched: OutcomeEffect[], scenario: ScenarioDefinition): { key: string; effects: OutcomeEffect[] }[] {
  let results: { key: string; effects: OutcomeEffect[] }[] = [{ key: '', effects: [] }];
  for (const effect of matched) {
    if (!effect.drawn) { results = results.map(result => ({ ...result, effects: [...result.effects, effect] })); continue; }
    const { drawn: _drawn, variants, ...rest } = effect;
    results = results.flatMap(result => drawnKeys(effect, scenario).map(key => ({ key: result.key ? `${result.key}+${key}` : key, effects: [...result.effects, rest, ...variants?.[key] ?? []] })));
  }
  return results;
}

const routes = (effect: OutcomeEffect) => !!effect.ending || !!effect.setFlags?.some(flag => flag.startsWith('at:'));

/** Run states whose first draw lands in a band's sample bin and whose second lands in each of
 * STEER_BINS bins: the second draw is the first drawn consequence's own sample (operation.ts decide). */
const steerTables = new Map<number, { rngState: number; second: number }[]>();
function steerStates(bandSample: number): { rngState: number; second: number }[] {
  const bin = Math.floor(bandSample * 400);
  const cached = steerTables.get(bin);
  if (cached) return cached;
  const table: ({ rngState: number; second: number } | undefined)[] = new Array(STEER_BINS).fill(undefined);
  let filled = 0;
  for (let k = 1; filled < STEER_BINS && k < 50_000_000; k++) {
    const first = next(k);
    if (Math.floor(first.value * 400) !== bin) continue;
    const second = next(first.state).value;
    const at = Math.floor(second * STEER_BINS);
    if (!table[at]) { table[at] = { rngState: k, second }; filled++; }
  }
  const states = table.filter((entry): entry is { rngState: number; second: number } => !!entry);
  steerTables.set(bin, states);
  return states;
}
/** One steered run state per distinct result of the first drawn consequence, from the model's own
 * rules (sim/drawn-effects.ts): incoming fire by the subject's odds; a cascade by each member's
 * chance; team force by the profile the engine picks here (learned from one steered commit) and its
 * severity table. A model the gate doesn't know is steered through every bin. */
function drawnSteers(state: GameState, view: ActionView, band: OutcomeBand, sample: number, matched: OutcomeEffect[], scenario: ScenarioDefinition): number[] {
  const table = steerStates(sample);
  const drawn = matched.find(effect => effect.drawn)!.drawn!;
  let keyOf: ((second: number) => string) | null = null;
  if (drawn.model === 'incoming_fire') {
    const person = scenario.incidentPeople?.find(entry => entry.id === drawn.from);
    if (person) keyOf = second => incomingFireSeverity(person, second);
  } else if (drawn.model === 'cascade') {
    // Each member's draw comes from the cascade's one sample, read against the run as it stands.
    const run = state.activeRun!;
    keyOf = second => cascadeKey(cascadeStates(scenario, run, drawn.members, second));
  } else if (drawn.model === 'team_force') {
    const person = scenario.incidentPeople?.find(entry => entry.id === drawn.on);
    const probe = applySteered(state, view, band, table[0].rngState);
    const profile = probe?.activeRun!.history.at(-1)?.committed?.drawn?.[0]?.key.split(':')[0] as ForceProfile | undefined;
    if (profile) keyOf = second => drawnKey('team_force', teamForceSeverity(person, profile, second), profile);
  }
  if (!keyOf) return table.map(entry => entry.rngState);
  const chosen = new Map<string, number>();
  for (const entry of table) { const key = keyOf(entry.second); if (!chosen.has(key)) chosen.set(key, entry.rngState); }
  return [...chosen.values()];
}
function applySteered(state: GameState, view: ActionView, band: OutcomeBand, rngState: number): GameState | null {
  const aimed = structuredClone(state);
  aimed.activeRun!.rngState = rngState;
  const result = apply(aimed, { type: 'decide', actionId: view.id, actingSquadIds: view.actingSquadIds, supportSquadIds: view.supportSquadIds }, NOW);
  return result.result.ok && result.state.activeRun!.history.at(-1)?.band === band ? result.state : null;
}

interface Coverage { gaps: string[]; starts: number; states: number; commits: number; drawnWalked: number; ended: number; ms: number;
  /** Every drawn result the walk played, as `model:key`. */
  drawnSeen: Set<string> }

function walk(tree: CallTree, starts: Start[] = startsFor(tree), around: (start: Start, play: () => void) => void = (_start, play) => play()): Coverage {
  const t0 = Date.now();
  const gaps = new Set<string>();
  let states = 0, commits = 0, drawnWalked = 0, ended = 0;
  const drawnSeen = new Set<string>();
  for (const start of starts) around(start, () => {
    const scenario = getScenario(start.scenarioId)!;
    const thresholds = meterThresholds(scenario);
    const actions = new Map(Object.values(scenario.stages).flatMap(stage => stage.actions.map(action => [action.id, action] as const)));
    const first = startGateRun(start.scenarioId);
    const queue = [first], seen = new Set([stateKey(first, thresholds)]);
    const push = (after: GameState | null) => {
      if (!after) return false;
      const key = stateKey(after, thresholds);
      if (seen.has(key)) return false;
      seen.add(key); queue.push(after);
      for (const record of after.activeRun!.history.at(-1)?.committed?.drawn ?? []) drawnSeen.add(`${record.model}:${record.key}`);
      return true;
    };
    while (queue.length) {
      const state = queue.shift()!, run = state.activeRun!;
      states++;
      if (run.status !== 'active' || run.stage === 'debrief') { ended++; continue; }
      const node = run.flags.find(flag => flag.startsWith('at:'))?.slice(3) ?? tree.root;
      const views = actionViews(state, NOW, 'A');
      const eligible = views.filter(view => view.eligible);
      if (!eligible.length) gaps.add(`${tree.type} ${start.label}: ${node} has no choice the engine allows (${views.map(view => `${view.id.slice(choiceActionId(tree.type, node, '').length)}: ${view.reason ?? 'not offered'}`).join('; ')}) ${describeState(state)}`);
      for (const view of eligible) {
        const action = actions.get(view.id)!;
        const choice = view.id.slice(choiceActionId(tree.type, node, '').length);
        for (const band of BANDS) {
          const sample = sampleFor(view, band);
          if (sample === null) continue;
          commits++;
          const matched = matchedEffects(action, band, run, scenario);
          for (const result of drawnResults(matched, scenario)) {
            const where = `${tree.type} ${start.label}: ${node}.${choice}.${band}${result.key ? `[${result.key}]` : ''} ${describeState(state)}`;
            const routed = result.effects.filter(routes).length;
            if (routed === 0) gaps.add(`${where} routes nowhere`);
            if (routed > 1) gaps.add(`${where} routes ${routed} ways`);
            if (!result.effects.some(effect => effect.text?.trim())) gaps.add(`${where} has no outcome text`);
          }
          push(applyMove(state, { kind: 'decide', actionId: view.id, band }, views));
          // Walk every result of a drawn consequence the engine's own dice can give here.
          if (matched.some(effect => effect.drawn)) for (const rngState of drawnSteers(state, view, band, sample, matched, scenario)) if (push(applySteered(state, view, band, rngState))) drawnWalked++;
        }
      }
      for (const move of availableMoves(state, views)) if (move.kind === 'continue') push(applyMove(state, move, views));
    }
  });
  return { gaps: [...gaps], starts: starts.length, states, commits, drawnWalked, ended, ms: Date.now() - t0, drawnSeen };
}

/** The group fixture compiled over a hosted hostage call's frame, as groups.test.ts does: each count
 * of others from 0 to 3, from two call seeds each. Drafts, so each is walked inside its draft. */
function groupStarts(): { start: Start; scenario: ScenarioDefinition }[] {
  const out: { start: Start; scenario: ScenarioDefinition }[] = [];
  for (const members of [0, 1, 2, 3]) for (const from of [1, 300]) {
    for (let seed = from; seed < from + 600; seed++) {
      const { clocks: _clocks, incidentPeople: _people, threats: _threats, ...base } = generateIncident({ type: 'hostage_crisis', familyId: 'market_row', buildingSeed: 7, seed, tier: 2, contentVersion: GATE_CONTENT_VERSION });
      const spec = hostedSpec(base), built = buildLocation(base.locationFamilyId, base.locationSeed);
      let instance;
      try { instance = drawInstance(GROUP_TEMPLATE, built, spec); } catch { continue; }
      if ((memberCounts(instance.placed).others ?? 0) !== members) continue;
      const scenario = compileIncident({ ...base, id: `coverage-group-${members}-${seed}`, incident: spec }, built, GROUP_TEMPLATE);
      out.push({ start: { label: `${members} others, seed ${seed}`, scenarioId: `draft:${scenario.id}` }, scenario });
      break;
    }
  }
  return out;
}

describe('call trees: coverage of every reachable state (resolve, then narrate)', () => {
  for (const tree of TREES) it(`${tree.type}: one routed outcome with text at every commit, and no dead end`, () => {
    const coverage = walk(tree);
    console.info(`${tree.type} coverage: ${coverage.starts} starts, ${coverage.states} states, ${coverage.commits} commits, ${coverage.drawnWalked} drawn results walked, ${coverage.ended} endings, ${coverage.gaps.length} gaps, ${coverage.ms} ms`);
    expect(coverage.ended).toBeGreaterThan(0);
    if (REPORT_ONLY.has(tree.type)) {
      if (coverage.gaps.length) console.info(`${tree.type} gaps (report only, call being rewritten):\n${coverage.gaps.join('\n')}`);
      return;
    }
    expect(coverage.gaps).toEqual([]);
  }, 600000);

  it('the group fixture with 0 to 3 others: every cascade result routes once, with text', () => {
    const calls = groupStarts();
    const coverage = walk(GROUP_TREE, calls.map(call => call.start), (start, play) => withDraftScenario(calls.find(call => call.start === start)!.scenario, play));
    console.info(`group fixture coverage: ${[...coverage.drawnSeen].filter(seen => seen.startsWith('cascade:')).length} cascade results, ${coverage.starts} starts, ${coverage.states} states, ${coverage.commits} commits, ${coverage.drawnWalked} drawn results walked, ${coverage.ended} endings, ${coverage.gaps.length} gaps, ${coverage.ms} ms`);
    expect(coverage.ended).toBeGreaterThan(0);
    // The cascade was played into each of its routes: everyone followed, some did, nobody did.
    const cascades = [...coverage.drawnSeen].filter(seen => seen.startsWith('cascade:')).map(seen => cascadeResult(seen.slice(8).split('+') as CascadeState[]));
    expect(new Set(cascades)).toEqual(new Set(['all', 'some', 'none']));
    expect(coverage.gaps).toEqual([]);
  }, 600000);
});
