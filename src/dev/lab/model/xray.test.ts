// The X-ray against the engine: for every root choice of the four calls, and every choice at hostage
// `talking` reached by an explored path, the route predicted for each band the engine can produce is
// where a forced step of that band actually lands; contributor groups sum to the margin the card's
// odds come from; the truth strip reads the call's situation; the path chance is the product of the
// steps' natural chances.
import { describe, expect, it } from 'vitest';
import FULL_NOTE from '../surfaces/play/FullNote.tsx?raw';
import { aimedMoves, applyMove, NOW } from '../../../gen/incident/gates/engine-driver';
import type { Weight } from '../../../gen/incident/trees-v13/balance';
import { pathStateKey } from '../../../gen/incident/trees-v13/path-key';
import { bandProbabilities } from '../../../sim/resolution';
import { applyTuningPatch } from '../../../sim/tuning';
import type { GameState, OutcomeBand } from '../../../sim/types';
import { liveDecisions } from '../../../ui/screens/live-model';
import { visibleDecisions } from '../../../ui/screens/liveModels';
import { parseLabUrl } from '../url';
import { explore } from './explore';
import { aimsDrawn, nextStep, previewBand, previewDrawn } from './next-step';
import { currentFrame, openSession, playPath, replayTokens, rewindSession, stepSession } from './session';
import type { Frame, Session } from './session';
import { focusSquad } from './squads';
import { bandCurve, BANDS, clockRows, endedSummary, keysSet, notOfferedHere, pathChance, pathSteps, personTruth, priorSteps, truthStrip, weightsWanted, whereIs, withWeights, xrayChoices } from './xray';
import type { ChoiceXray, RouteTarget } from './xray';
import { dependencyIndex } from '../../../gen/incident/trees-v13/dependencies';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
const TYPES = ['hostage_crisis', 'barricaded', 'active_armed_incident', 'protected_rescue'] as const;

function openCall(query: string): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, null);
  if (!('frames' in opened)) throw new Error(`could not open ${query}: ${opened.message}`);
  return opened;
}
const key = (to: RouteTarget | null) => !to ? 'stays' : to.kind === 'node' ? `node:${to.node}` : `ending:${to.ending}`;

/** Where the X-ray says a forced band lands, given the drawn results the step settled on. */
function predicted(x: ChoiceXray, band: OutcomeBand, drawn: readonly string[]): RouteTarget | null {
  const route = x.bands[band];
  let to = route.to;
  for (const entry of route.drawn) {
    const hit = entry.results.find(result => drawn.includes(`${entry.model}:${result.key}`));
    if (hit?.to) to = hit.to;
  }
  return to;
}

/** Forces every possible band of every eligible row and compares the landing with the prediction. */
function checkRoutes(s: Session, frame: Frame): number {
  const at = { ...s, frames: [...s.frames.slice(0, s.frames.indexOf(frame) + 1)], ahead: [] };
  const deps = dependencyIndex(s.template);
  let checked = 0;
  for (const x of xrayChoices(s, frame, deps)) for (const band of BANDS) {
    if (!x.bands[band].possible) continue;
    const next = stepSession(at, { kind: 'decide', actionId: x.actionId, band });
    if ('refused' in next) throw new Error(next.refused);
    const after = currentFrame(next);
    expect(`${x.actionId}~${band} ${key(whereIs(s, after.state))}`).toBe(`${x.actionId}~${band} ${key(predicted(x, band, after.drawn))}`);
    checked++;
  }
  return checked;
}

describe('xrayChoices routes', () => {
  for (const type of TYPES) {
    it(`predicts where every root choice of ${type} lands, band by band`, () => {
      const s = openCall(`type=${type}`);
      expect(checkRoutes(s, s.frames[0])).toBeGreaterThan(3);
    });
  }

  it('predicts every choice at hostage talking reached by an explored path', () => {
    const s0 = openCall(REFERENCE);
    const found = explore(s0.frames[0].state, { node: 'talking' });
    expect(found.path).not.toBeNull();
    const s = replayTokens(s0, found.path!);
    expect(s.stopped).toBeNull();
    const rows = xrayChoices(s, currentFrame(s), dependencyIndex(s.template));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(checkRoutes(s, currentFrame(s))).toBeGreaterThan(6);
  });
  it('tags as "behind Show all" exactly the choices the player\'s five-card list leaves out', () => {
    // No shipped call offers more than four choices at once today (measured over the four calls'
    // whole walks), so the check reads the rule against the game's own visibleDecisions.
    const s0 = openCall(REFERENCE);
    const found = explore(s0.frames[0].state, { node: 'talking' });
    const s = replayTokens(s0, found.path!);
    const frame = currentFrame(s);
    const shown = new Set(visibleDecisions(frame.views, null, false).map(view => view.id));
    for (const row of xrayChoices(s, frame, dependencyIndex(s.template))) expect(row.shown).toBe(shown.has(row.actionId) ? 'shown' : 'behind-show-all');
  });
});

describe('xrayChoices numbers', () => {
  const s = openCall(REFERENCE);
  const rows = xrayChoices(s, s.frames[0], dependencyIndex(s.template));

  it('sums the contributor groups to the margin within 0.1, and the margin gives the card odds', () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const x of rows) {
      const sum = x.groups.reduce((total, group) => total + group.items.reduce((acc, item) => acc + item.value, 0), 0);
      expect(Math.abs(sum - x.margin)).toBeLessThanOrEqual(0.1);
      expect(Math.abs(x.score - x.difficulty - x.margin)).toBeLessThanOrEqual(0.06);
      if (!x.view.eligible) continue;
      const odds = bandProbabilities(x.margin);
      for (const band of BANDS) expect(x.view.likelihood[band]).toBeCloseTo(odds[band], 9);
    }
  });

  it('orders the rows as the player\'s cards: eligible first, the first five shown', () => {
    const ids = currentFrame(s).views;
    expect(rows.map(row => row.actionId).sort()).toEqual(ids.map(view => view.id).sort());
    const firstLocked = rows.findIndex(row => !row.view.eligible);
    if (firstLocked >= 0) expect(rows.slice(firstLocked).every(row => !row.view.eligible)).toBe(true);
    expect(rows.slice(0, 5).every(row => row.shown === 'shown')).toBe(true);
  });

  it('gives each band a route, its odds, and the keys it writes', () => {
    for (const x of rows) {
      expect(BANDS.reduce((sum, band) => sum + x.bands[band].p, 0)).toBeCloseTo(1, 9);
      for (const band of BANDS) {
        const route = x.bands[band];
        expect(route.to !== null || route.drawn.some(entry => entry.results.some(result => result.to))).toBe(true);
        for (const entry of route.drawn) expect(entry.results.reduce((sum, result) => sum + result.p, 0)).toBeCloseTo(1, 6);
      }
    }
  });
});

describe('truthStrip', () => {
  it('reads situation 2 of the hostage reference call: the facts true there, what the team knows', () => {
    const s = openCall(REFERENCE);
    const strip = truthStrip(s.scenario, currentFrame(s).state.activeRun!);
    const truth = Object.fromEntries(strip.map(entry => [entry.fact, entry.truth]));
    expect(truth).toMatchObject({ lets_go: true, raised: true, owner_faint: true, handgun: true });
    expect(strip.find(entry => entry.fact === 'handgun')?.team).toBe('reported');
    expect(strip.find(entry => entry.fact === 'lets_go')?.team).toBe('unknown');
    expect(strip.every(entry => !/[{}]/.test(entry.label))).toBe(true);
  });
});

describe('pathChance', () => {
  it('is the product of each step\'s natural band and drawn-result chances', () => {
    let s = openCall(REFERENCE);
    const take = (band: OutcomeBand | 'roll') => {
      const view = currentFrame(s).views.find(entry => entry.eligible)!;
      const next = stepSession(s, band === 'roll' ? { kind: 'roll', actionId: view.id } : { kind: 'decide', actionId: view.id, band });
      if ('refused' in next) throw new Error(next.refused);
      s = next;
      return view;
    };
    const first = take('mixed');
    take('roll');
    const chance = pathChance(s);
    expect(chance.steps).toHaveLength(2);
    expect(chance.steps[0].forced).toBe(true);
    expect(chance.steps[0].pBand).toBeCloseTo(first.likelihood.mixed, 12);
    expect(chance.steps[1].forced).toBe(false);
    expect(chance.p).toBeCloseTo(chance.steps.reduce((p, step) => p * step.pBand * step.pDrawn, 1), 12);
    expect(chance.p).toBeGreaterThan(0);
    expect(chance.p).toBeLessThan(1);
  });
});

describe('personTruth', () => {
  it('names each hostage person\'s hidden role in three words at most', () => {
    const s = openCall(REFERENCE);
    const tags = Object.fromEntries((s.scenario.incidentPeople ?? []).map(person => [person.id, personTruth(person)]));
    expect(tags.taker).toBe('real handgun');
    expect(Object.values(tags).every(tag => tag.split(' ').length <= 3)).toBe(true);
    expect(tags.courier).toMatch(/held/);
  });
});

describe('the rail and the path helpers', () => {
  const step = (s: ReturnType<typeof openCall>, move: Parameters<typeof stepSession>[1]) => { const next = stepSession(s, move); if ('refused' in next) throw new Error(next.refused); return next; };

  it('titles each step of the path with where it was taken and the choice, and keeps ahead steps after a rewind', () => {
    let s = openCall(REFERENCE);
    const first = currentFrame(s).views.find(view => view.eligible)!;
    s = step(s, { kind: 'decide', actionId: first.id, band: 'favorable' });
    const second = currentFrame(s).views.find(view => view.eligible)!;
    s = step(s, { kind: 'roll', actionId: second.id });
    const steps = pathSteps(s);
    expect(steps.map(entry => [entry.index, entry.nodeTitle, entry.choiceTitle, entry.forced, entry.ahead])).toEqual([
      [1, 'Offer', first.title, true, false], [2, steps[1].nodeTitle, second.title, false, false]]);
    expect(steps[0].prompt.length).toBeGreaterThan(10);
    const rewound = rewindSession(s, 1);
    expect(pathSteps(rewound).map(entry => entry.ahead)).toEqual([false, true]);
    expect(priorSteps(s)).toEqual([]);
  });

  it('fills in run classes for ending routes only where known, and lists what still needs a forced step', () => {
    const s0 = openCall(REFERENCE);
    const s = replayTokens(s0, explore(s0.frames[0].state, { node: 'talking' }).path!);
    const rows = xrayChoices(s, currentFrame(s), dependencyIndex(s.template));
    const wanted = weightsWanted(rows, false);
    expect(wanted.length).toBeGreaterThan(0);
    expect(wanted.every(entry => rows.find(row => row.actionId === entry.actionId)!.bands[entry.band].to?.kind === 'ending')).toBe(true);
    const weights = new Map([[wanted[0].key, 'clean' as const]]);
    const merged = withWeights(rows, weights);
    const target = merged.find(row => row.actionId === wanted[0].actionId)!.bands[wanted[0].band].to;
    expect(target).toMatchObject({ kind: 'ending', weight: 'clean' });
    expect(rows.find(row => row.actionId === wanted[0].actionId)!.bands[wanted[0].band].to).not.toHaveProperty('weight');
  });

  it('reads the state panel: keys set with their readers, clocks with the true minutes left', () => {
    const s0 = openCall(REFERENCE);
    const s = replayTokens(s0, explore(s0.frames[0].state, { node: 'talking' }).path!);
    const state = currentFrame(s).state;
    const deps = dependencyIndex(s.template);
    const keys = keysSet(s, state, deps);
    expect(keys.every(entry => !/[{}]/.test(entry.label))).toBe(true);
    for (const entry of keys) expect(state.activeRun!.flags.some(flag => flag === entry.key || flag.startsWith(entry.key))).toBe(true);
    const clocks = clockRows(s.scenario, state.activeRun!);
    for (const clock of clocks) if (clock.minutesLeft !== null) expect(clock.minutesLeft).toBeGreaterThanOrEqual(0);
    expect(endedSummary(s, state)).toBeNull();
  });

  it('summarizes an ended call: its ending, run class and score lines', () => {
    const s0 = openCall(REFERENCE);
    const found = explore(s0.frames[0].state, null);
    const [ending, path] = Object.entries(found.endings!)[0];
    const s = replayTokens(s0, path);
    const summary = endedSummary(s, currentFrame(s).state)!;
    expect(summary.ending).toMatchObject({ kind: 'ending', ending });
    expect(['clean', 'costly', 'unresolved', 'hurt', 'death']).toContain(summary.weight);
    expect(summary.lines.length).toBeGreaterThan(0);
  });

  it('lists the choices authored at this node that the engine does not offer here', () => {
    const s0 = openCall(REFERENCE);
    const s = replayTokens(s0, explore(s0.frames[0].state, { node: 'talking' }).path!);
    const frame = currentFrame(s);
    const offered = new Set(frame.views.map(view => view.id));
    const off = notOfferedHere(s, frame);
    expect(off.every(entry => entry.node === 'talking' && !offered.has(entry.actionId))).toBe(true);
    expect(off.length + offered.size).toBeLessThanOrEqual(s.tree.nodes.find(node => node.id === 'talking')!.choices.length);
  });
});

describe('clocks that run out during a band (review finding xray-misses-clock-out-harm)', () => {
  it('predicts the owner hurt when her clock runs out over a bad result, as the commit does', () => {
    // Hostage call 2, situation 2: Renata's condition clock runs out over "his pace" going badly.
    const s0 = openCall('type=hostage_crisis&call=2&variant=1');
    const s = replayTokens(s0, 't13_hostage_crisis_offer_take_courier~favorable,t13_hostage_crisis_out_keys_spare_key~favorable');
    expect(s.stopped).toBeNull();
    const x = xrayChoices(s, currentFrame(s), null).find(row => row.actionId.endsWith('_his_pace'))!;
    const route = x.bands.adverse;
    expect(route.possible).toBe(true);
    expect(route.harm).toContain('Renata badly hurt');
    expect(route.mayHarm).toBe(true);
    const after = stepSession(s, { kind: 'decide', actionId: x.actionId, band: 'adverse' });
    if ('refused' in after) throw new Error(after.refused);
    const run = currentFrame(after).state.activeRun!;
    expect(run.clocks?.owner_condition.value).toBe(0);
    expect(run.personCasualties?.owner?.severity).toBe('serious');
  });

  it('says harm wherever a forced step hurts someone, and only there, across the hostage call\'s states', () => {
    const s = openCall('type=hostage_crisis&call=2&variant=1');
    const seen = new Set<string>();
    let queue = [s.frames[0].state], states = 0, checks = 0, missed = 0, extra = 0, clockHarm = 0;
    while (queue.length && states < 300) {
      const next: typeof queue = [];
      for (const state of queue) {
        if (states++ >= 300) break;
        const run = state.activeRun;
        if (!run || run.status !== 'active' || run.stage === 'debrief') continue;
        const frame = playPath(state, '').frames[0];
        const rows = xrayChoices(s, frame, null);
        const views = liveDecisions(state, NOW, focusSquad(state));
        const hurt = (r: NonNullable<typeof run>) => Object.keys(r.personCasualties ?? {}).length + Object.keys(r.officerCasualties ?? {}).length;
        for (const move of aimedMoves(state, views)) {
          if (move.kind !== 'decide') continue;
          const after = applyMove(state, move, views);
          const x = rows.find(row => row.actionId === move.actionId);
          if (!after || !x) continue;
          const route = x.bands[move.band!];
          let predicted = route.harm.length > 0;
          (move.drawn ?? []).forEach((key, i) => { if (route.drawn[i]?.results.find(result => result.key === key)?.harms) predicted = true; });
          const got = hurt(after.activeRun!) > hurt(run);
          checks++;
          if (got && !predicted) missed++;
          if (predicted && !got) extra++;
          // Harm the band's own matched effects don't do: a clock that ran out on its owner.
          const action = Object.values(s.scenario.stages).flatMap(stage => stage.actions).find(entry => entry.id === move.actionId)!;
          const own = route.effects.flatMap(effect => action.outcomes[move.band!][effect.index].personHarm ?? []).length;
          if (got && route.harm.length > own + (route.harm.filter(words => words.startsWith('An officer')).length)) clockHarm++;
          const key = pathStateKey(after);
          if (!seen.has(key)) { seen.add(key); next.push(after); }
        }
      }
      queue = next;
    }
    expect(checks).toBeGreaterThan(300);
    expect({ missed, extra }).toEqual({ missed: 0, extra: 0 });
    expect(clockHarm).toBeGreaterThan(0);
  }, 60000);
});

describe('run classes of a band that draws (review finding band-run-class-from-one-forced-draw)', () => {
  it('never weighs a drawing band from one forced draw; Next step splits it by its drawn results\' classes', () => {
    // Armed call 2: "through the door, anyone in" ends the same way whatever the subject's fire does,
    // but nobody hit is costly while an officer hurt is hurt.
    const s0 = openCall('type=active_armed_incident&call=2&variant=1');
    const door = (state: GameState) => liveDecisions(state, NOW, focusSquad(state)).some(view => view.eligible && view.id.endsWith('_through_door_anyone_in'));
    const found = explore(s0.frames[0].state, null, { holds: door });
    expect(found.path).not.toBeNull();
    const s = replayTokens(s0, found.path!);
    const frame = currentFrame(s);
    const base = xrayChoices(s, frame, null);
    const wanted = weightsWanted(base, aimsDrawn());
    // No band that draws is asked for as a whole.
    for (const want of wanted) if (!want.drawn) expect(base.find(row => row.actionId === want.actionId)!.bands[want.band].drawn).toEqual([]);
    const weights = new Map<string, Weight>();
    for (const want of wanted) {
      const preview = want.drawn ? previewDrawn(s, frame, want.actionId, want.band, want.drawn) : previewBand(s, frame, want.actionId, want.band);
      if (preview?.weight) weights.set(want.key, preview.weight);
    }
    const x = withWeights(base, weights).find(row => row.actionId.endsWith('_through_door_anyone_in'))!;
    // Find a band that ends one way with drawn results of different classes.
    const band = BANDS.find(b => {
      const route = x.bands[b];
      const classes = new Set(route.drawn[0]?.results.filter(result => result.p > 0).map(result => result.to?.kind === 'ending' ? result.to.weight : undefined));
      return route.to?.kind === 'ending' && route.drawn.length === 1 && classes.size > 1;
    })!;
    expect(band).toBeDefined();
    const route = x.bands[band];
    // The band itself carries no single class.
    expect(route.to).not.toHaveProperty('weight');
    // Next step: one chip per class for that ending, each holding exactly its results' mass.
    const ending = (route.to as { ending: string }).ending;
    const mix = nextStep(x, whereIs(s, frame.state)).filter(entry => entry.to.kind === 'ending' && entry.to.ending === ending);
    const byClass = new Map<string, number>();
    for (const b of BANDS) {
      const r = x.bands[b];
      if (r.to?.kind !== 'ending' || r.to.ending !== ending) continue;
      if (!r.drawn.length) { byClass.set(r.to.weight ?? '', (byClass.get(r.to.weight ?? '') ?? 0) + r.p); continue; }
      for (const result of r.drawn[0].results) {
        const w = result.to?.kind === 'ending' ? result.to.weight ?? '' : '';
        if (result.p > 0) byClass.set(w, (byClass.get(w) ?? 0) + r.p * result.p);
      }
    }
    expect(mix.length).toBe(byClass.size);
    for (const entry of mix) expect(entry.p).toBeCloseTo(byClass.get((entry.to as { weight?: string }).weight ?? '')!, 12);
    // The hurt chip says someone can be harmed.
    expect(mix.find(entry => (entry.to as { weight?: string }).weight === 'hurt')?.harm).toBe(true);
  }, 60000);
});

describe('bandCurve (review finding fullnote-curve-ignores-patch)', () => {
  it('reads the tables in force, so an unsaved patch moves the curve under the note\'s margin marker', () => {
    const saved = bandCurve();
    expect(saved).toHaveLength(41);
    for (const point of saved) expect(point).toEqual({ margin: point.margin, ...bandProbabilities(point.margin) });
    expect(applyTuningPatch({ RESOLUTION_TUNING: { favorableAt: 10, adverseAt: -10 } })).toEqual([]);
    try {
      const patched = bandCurve();
      for (const point of patched) expect(point).toEqual({ margin: point.margin, ...bandProbabilities(point.margin) });
      expect(patched.find(point => point.margin === 10)!.favorable).not.toBeCloseTo(saved.find(point => point.margin === 10)!.favorable, 6);
    } finally { applyTuningPatch({}); }
  });
  it('is computed inside the full note per tuning, not once at module load', () => {
    expect(FULL_NOTE).not.toMatch(/^const \w+[^=]*=\s*Array\.from\([^\n]*bandProbabilities/m);
    expect(FULL_NOTE).toMatch(/useMemo\(\(\) => bandCurve\(\), \[tuning\.hash\]\)/);
    expect(FULL_NOTE).toMatch(/<BandCurve points=\{curve\}/);
  });
});
