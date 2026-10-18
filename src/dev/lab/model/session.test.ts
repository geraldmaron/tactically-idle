// The lab's run model on the real engine: opening the call a link draws, stepping with forced or
// natural bands, rewinding, replaying a path (keeping its valid prefix), opening a handed-over game
// state, and reopening under a tuning patch.
import { afterEach, describe, expect, it } from 'vitest';
import { aimedDrawnState, drawnAt, drawnChance, drawnCombos, NOW, sampleFor } from '../../../gen/incident/gates/engine-driver';
import { bandProbabilities } from '../../../sim/resolution';
import { applyTuningPatch } from '../../../sim/tuning';
import type { GameState, OutcomeBand } from '../../../sim/types';
import type { LabHandoff } from '../../../ui/lab-handoff';
import { liveDecisions } from '../../../ui/screens/live-model';
import { parseLabUrl } from '../url';
import { decodePath, readParams, resolveScenario } from './call';
import { explore } from './explore';
import { currentFrame, nodeAt, openSession, playPath, replayTokens, rewindSession, sessionTokens, stepChance, stepSession } from './session';
import type { OpenError, Session } from './session';

const REFERENCE = 'type=hostage_crisis&family=market_row&seed=7&tier=2&variant=1';
const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

function open(query: string, handoff: LabHandoff | null = null): Session {
  const opened = openSession(parseLabUrl(`?${query}`).url, handoff);
  if (!('frames' in opened)) throw new Error(`could not open ${query}: ${opened.message}`);
  return opened;
}
const step = (s: Session, ...args: Parameters<typeof stepSession>[1][]): Session => args.reduce((at, move) => {
  const next = stepSession(at, move);
  if ('refused' in next) throw new Error(next.refused);
  return next;
}, s);
/** The first eligible choice's natural roll, n times. */
function rollOn(s: Session, n: number): Session {
  let at = s;
  for (let i = 0; i < n; i++) {
    const view = currentFrame(at).views.find(entry => entry.eligible);
    if (!view) break;
    at = step(at, { kind: 'roll', actionId: view.id });
  }
  return at;
}

afterEach(() => { applyTuningPatch({}); });

describe('openSession', () => {
  it('opens the hostage reference deep link on the scenario resolveScenario names', () => {
    const s = open(REFERENCE);
    const resolved = resolveScenario(readParams(new URLSearchParams(REFERENCE)));
    expect(s.scenario.id).toBe(resolved.id);
    expect(s.resolved.id).toBe(resolved.id);
    expect(s.tree.type).toBe('hostage_crisis');
    expect(s.situation).toBe(1);
    expect(s.squad).toEqual({ kind: 'reference', seed: 719, certs: [] });
    expect(s.frames).toHaveLength(1);
    expect(s.prior).toEqual([]);
    expect(s.stopped).toBeNull();
    expect(s.focus).toBe('A');
    expect(Object.keys(s.turnDrawn)).toEqual(Object.keys(s.tree.turns ?? {}));
    expect(s.counts).toHaveProperty('others');
    expect(nodeAt(currentFrame(s).state, s.tree)).toBe(s.tree.root);
  });

  it('gives the frame the player\'s own choice list (liveDecisions for squad A)', () => {
    let s = open(REFERENCE);
    for (let i = 0; i < 3; i++) {
      const frame = currentFrame(s);
      expect(frame.views).toEqual(liveDecisions(frame.state, NOW, 'A'));
      s = rollOn(s, 1);
    }
  });

  it('keys the session by the call, the squad and the tuning', () => {
    const a = open(REFERENCE), b = open(`${REFERENCE}&squad=4242`), c = open(`${REFERENCE}&certs=vehicle_operations`);
    expect(new Set([a.key, b.key, c.key]).size).toBe(3);
    expect(c.squad).toEqual({ kind: 'reference', seed: 719, certs: ['vehicle_operations'] });
    expect(open(REFERENCE).key).toBe(a.key);
  });

  it('refuses links the lab cannot open, with the reason', () => {
    const fail = (query: string) => openSession(parseLabUrl(`?${query}`).url, null) as OpenError;
    expect(fail('id=gen:hostage_crisis:market_row:7:2:2:11')).toMatchObject({ kind: 'generate', message: expect.stringContaining('current incident ID') });
    expect(fail('id=gen:burglary:market_row:7:2:2:13')).toMatchObject({ kind: 'generate' });
    expect(fail('id=gen:hostage_crisis:nowhere:7:2:2:13')).toMatchObject({ kind: 'generate' });
  });

  it('says when the drawn building cannot host the call, and where the generator moved it', () => {
    // semi_detached_g2 can't host about half of rescue's calls (generation moves them to another seed).
    let moved: OpenError | null = null;
    for (let seed = 0; seed < 40 && !moved; seed++) {
      const opened = openSession(parseLabUrl(`?type=protected_rescue&family=semi_detached_g2&seed=${seed}&tier=2&variant=0`).url, null);
      if (!('frames' in opened)) moved = opened;
    }
    expect(moved).toMatchObject({ kind: 'host-moved', movedTo: expect.any(Number) });
    const s = open(`type=protected_rescue&family=semi_detached_g2&seed=${moved!.movedTo}&tier=2&variant=0`);
    expect(s.scenario.locationSeed).toBe(moved!.movedTo);
  }, 30000);
});

describe('stepping', () => {
  it('lands a forced band exactly as asked, or refuses it', () => {
    let s = open(REFERENCE), landed = 0, refused = 0;
    for (let depth = 0; depth < 3; depth++) {
      const frame = currentFrame(s);
      for (const view of frame.views) for (const band of BANDS) {
        const next = stepSession(s, { kind: 'decide', actionId: view.id, band });
        if ('refused' in next) {
          refused++;
          expect(!view.eligible || sampleFor(view, band) === null).toBe(true);
          continue;
        }
        landed++;
        const last = currentFrame(next);
        expect(last.band).toBe(band);
        expect(last.state.activeRun!.history.at(-1)!.band).toBe(band);
        expect(last.forced).toBe(true);
        expect(last.pBand).toBeCloseTo(view.likelihood[band], 9);
      }
      s = rollOn(s, 1);
    }
    expect(landed).toBeGreaterThan(10);
    expect(refused).toBeGreaterThanOrEqual(0);
  }, 30000);

  it('says a band the dice allow in a window too narrow to force can only be rolled (review finding unforceable-band-called-impossible)', () => {
    const s = open(REFERENCE);
    const frame = currentFrame(s);
    const view = frame.views.find(entry => entry.eligible)!;
    // Margin 37.6: the mixed window is about 0.6% wide, under sampleFor's 1%.
    const narrow = { ...view, likelihood: { ...view.likelihood, ...bandProbabilities(37.6) } };
    expect(narrow.likelihood.mixed).toBeGreaterThan(0.005);
    expect(sampleFor(narrow, 'mixed')).toBeNull();
    const at: Session = { ...s, frames: [{ ...frame, views: frame.views.map(entry => entry === view ? narrow : entry) }] };
    expect(stepSession(at, { kind: 'decide', actionId: view.id, band: 'mixed' }))
      .toEqual({ refused: expect.stringMatching(/comes out mixed only 1% of the time at this margin, a window too narrow to force\. Roll to take it with the dice\.$/) });
    // A band with no chance at all still says it can't come out.
    const none = { ...view, likelihood: { favorable: 0.9, mixed: 0, adverse: 0.1 } };
    const zero: Session = { ...s, frames: [{ ...frame, views: frame.views.map(entry => entry === view ? none : entry) }] };
    expect(stepSession(zero, { kind: 'decide', actionId: view.id, band: 'mixed' })).toEqual({ refused: expect.stringMatching(/can't come out mixed at this margin\.$/) });
  });

  it('refuses a choice that is not offered or is locked, with the engine reason', () => {
    const rescue = open('type=protected_rescue&tier=2');
    const locked = currentFrame(rescue).views.find(view => !view.eligible)!;
    expect(locked).toBeDefined();
    const refusal = stepSession(rescue, { kind: 'roll', actionId: locked.id });
    expect(refusal).toEqual({ refused: expect.stringContaining(locked.reason!) });
    expect(stepSession(rescue, { kind: 'roll', actionId: 't13_protected_rescue_nowhere_x' })).toEqual({ refused: expect.stringContaining("isn't offered here") });
  });

  it('records the natural chance of the band and the drawn results of each move', () => {
    const s = rollOn(open(REFERENCE), 4);
    for (let i = 1; i < s.frames.length; i++) {
      const frame = s.frames[i], before = s.frames[i - 1];
      const view = before.views.find(entry => entry.id === frame.move!.actionId)!;
      expect(frame.forced).toBe(false);
      expect(frame.band).toBe(frame.state.activeRun!.history.at(-1)!.band);
      expect(frame.pBand).toBe(view.likelihood[frame.band!]);
      expect(frame.drawn).toEqual((frame.state.activeRun!.history.at(-1)!.committed?.drawn ?? []).map(d => `${d.model}:${d.key}`));
    }
  });

  it('rewinds without recomputing and steps forward through what was ahead', () => {
    const s = rollOn(open(REFERENCE), 3);
    const back = rewindSession(s, 1);
    expect(back.frames).toEqual(s.frames.slice(0, 2));
    expect(back.ahead).toHaveLength(s.frames.length - 2);
    expect(sessionTokens(back)).toBe(sessionTokens(s).split(',')[0]);
    const forward = rewindSession(back, s.frames.length - 1);
    expect(forward.frames.every((frame, i) => frame === s.frames[i])).toBe(true);
    // The same move again reuses the frame ahead; a different one drops what was ahead.
    const again = step(back, s.frames[2].move!);
    expect(again.frames[2]).toBe(s.frames[2]);
    expect(again.ahead).toHaveLength(back.ahead.length - 1);
    const other = currentFrame(back).views.find(view => view.eligible && view.id !== s.frames[2].move!.actionId);
    if (other) expect(step(back, { kind: 'roll', actionId: other.id }).ahead).toEqual([]);
  });
});

describe('aimed drawn results', () => {
  /** Every drawn combination every eligible choice can bring at this frame, forced: each lands with
   * that band and exactly those drawn results (what the engine recorded on the commit), and the frame
   * carries their natural chance. Returns the drawn models seen. */
  function forceEveryDrawn(s: Session): { models: Record<string, number>; variants: number } {
    const frame = currentFrame(s), models: Record<string, number> = {};
    let variants = 0;
    for (const view of frame.views) for (const band of BANDS) {
      if (!view.eligible || sampleFor(view, band) === null) continue;
      const dists = drawnAt(frame.state, view, band);
      for (const combo of dists.length ? drawnCombos(dists) : []) {
        const next = stepSession(s, { kind: 'decide', actionId: view.id, band, drawn: combo.keys });
        if ('refused' in next) throw new Error(`${view.id}~${band}/${combo.keys.join('/')}: ${next.refused}`);
        const last = currentFrame(next), h = last.state.activeRun!.history.at(-1)!;
        expect(h.band).toBe(band);
        expect(h.committed!.drawn!.map(d => d.key)).toEqual(combo.keys);
        expect(last.drawn).toEqual(h.committed!.drawn!.map(d => `${d.model}:${d.key}`));
        expect(last.pBand).toBe(view.likelihood[band]);
        expect(last.pDrawn).toBeCloseTo(combo.p, 12);
        expect(stepChance(last)).toBeCloseTo(view.likelihood[band] * combo.p, 12);
        expect(sessionTokens(next).split(',').at(-1)).toBe(`${view.id}~${band}/${combo.keys.map(key => key.replace(/\+/g, '.')).join('/')}`);
        for (const d of h.committed!.drawn!) models[d.model] = (models[d.model] ?? 0) + 1;
        variants++;
      }
    }
    return { models, variants };
  }
  const reach = (s: Session, goal: Parameters<typeof explore>[1]) => {
    const found = explore(s.frames[0].state, goal);
    expect(found.path).not.toBeNull();
    const r = replayTokens(s, found.path!);
    expect(r.stopped).toBeNull();
    return r;
  };

  it('forces every drawn result offered at the root of all four calls and at hostage talking', () => {
    let variants = 0;
    const models: Record<string, number> = {};
    for (const query of [REFERENCE, 'type=barricaded', 'type=active_armed_incident', 'type=protected_rescue']) {
      const found = forceEveryDrawn(open(query));
      variants += found.variants;
      for (const [model, n] of Object.entries(found.models)) models[model] = (models[model] ?? 0) + n;
    }
    const talking = reach(open(REFERENCE), { node: 'talking' });
    expect(nodeAt(currentFrame(talking).state, talking.tree)).toBe('talking');
    variants += forceEveryDrawn(talking).variants;
    // Measured 2026-10-09: only the armed call's root draws (the subject's fire, three results);
    // the next test covers team force and cascades.
    expect(variants).toBeGreaterThanOrEqual(3);
    expect(models.incoming_fire).toBeGreaterThanOrEqual(3);
  }, 60000);

  it('forces team force and cascade results too: the shot at the owner, and a group that follows or stays', () => {
    // Situation 3 of the reference building (lets_go false): going in badly brings the team's force
    // on the taker and the taker's fire, two drawn effects in that order.
    const keeps = open(`${REFERENCE.replace('variant=1', 'variant=2')}`);
    const killed = explore(keeps.frames[0].state, { ending: 'owner_killed' });
    expect(killed.path).not.toBeNull();
    const before = replayTokens(keeps, killed.path!.split(',').slice(0, -1).join(','));
    const force = forceEveryDrawn(before);
    expect(force.models.team_force).toBeGreaterThanOrEqual(2);
    expect(force.models.incoming_fire).toBeGreaterThanOrEqual(2);
    // A call with two others in the group (call seed 1): the first state where a choice can cascade.
    const group = open('type=hostage_crisis&family=market_row&seed=7&tier=2&call=1');
    expect(group.counts.others).toBe(2);
    const cascades = (state: GameState) => !!state.activeRun && state.activeRun.status === 'active' && liveDecisions(state, NOW, 'A')
      .some(view => view.eligible && BANDS.some(band => sampleFor(view, band) !== null && drawnAt(state, view, band).some(d => d.model === 'cascade')));
    const found = explore(group.frames[0].state, null, { holds: cascades });
    expect(found.path).not.toBeNull();
    const cascade = forceEveryDrawn(replayTokens(group, found.path!));
    expect(cascade.models.cascade).toBeGreaterThanOrEqual(3);
  }, 120000);

  it('refuses drawn results that cannot happen, with what can', () => {
    const keeps = open(`${REFERENCE.replace('variant=1', 'variant=2')}&kit=full&certs=entry_team`);
    const killed = explore(keeps.frames[0].state, { ending: 'owner_killed' }).path!;
    const tokens = killed.split(',');
    const before = replayTokens(keeps, tokens.slice(0, -1).join(','));
    const last = decodePath(tokens.at(-1)!)[0];
    expect(last.drawn).toHaveLength(2);
    const view = currentFrame(before).views.find(entry => entry.id === last.actionId)!;
    // The taker is never killed (noFatal), so the firearm can't come out fatal; the engine says what can.
    const fatal = stepSession(before, { ...last, drawn: ['firearm:fatal', last.drawn![1]] });
    expect(fatal).toEqual({ refused: expect.stringMatching(/can't come out badly with "firearm:fatal" here\. Possible: Firearm: not hurt, .*Firearm: badly hurt/) });
    expect(aimedDrawnState(before.frames.at(-1)!.state, view, 'adverse', ['firearm:fatal', last.drawn![1]])).toBeNull();
    expect(drawnChance(drawnAt(currentFrame(before).state, view, 'adverse'), ['firearm:fatal', last.drawn![1]])).toBe(0);
    // One key for two drawn effects, and keys on a band that draws nothing.
    expect(stepSession(before, { ...last, drawn: [last.drawn![0]] })).toEqual({ refused: expect.stringContaining('draws 2 results when it comes out badly; the path names 1') });
    expect(aimedDrawnState(currentFrame(before).state, view, 'adverse', [last.drawn![0]])).toBeNull();
    const plain = currentFrame(before).views.find(entry => entry.eligible && BANDS.every(band => sampleFor(entry, band) === null || !drawnAt(currentFrame(before).state, entry, band).length))!;
    expect(stepSession(before, { kind: 'decide', actionId: plain.id, band: 'favorable', drawn: ['none'] })).toEqual({ refused: expect.stringContaining('draws nothing when it comes out well') });
    // The same path through a replayed link stops there and says why.
    const bad = replayTokens(keeps, [...tokens.slice(0, -1), `${last.actionId}~adverse/firearm:fatal/${last.drawn![1]}`].join(','));
    expect(bad.stopped).toMatchObject({ step: tokens.length, why: expect.stringContaining('Possible:') });
  }, 60000);

  it('makes the path chance the product of each step\'s band and drawn chances, forced or rolled', () => {
    const keeps = open(`${REFERENCE.replace('variant=1', 'variant=2')}`);
    const s = replayTokens(keeps, explore(keeps.frames[0].state, { ending: 'owner_killed' }).path!);
    expect(s.stopped).toBeNull();
    expect(currentFrame(s).state.activeRun!.endingId).toBe('owner_killed');
    const rolled = rollOn(open(REFERENCE), 5);
    for (const path of [s, rolled]) {
      let product = 1, expected = 1;
      for (let i = 1; i < path.frames.length; i++) {
        const frame = path.frames[i], prior = path.frames[i - 1];
        const view = prior.views.find(entry => entry.id === frame.move!.actionId)!;
        const keys = frame.state.activeRun!.history.at(-1)!.committed?.drawn?.map(d => d.key) ?? [];
        const pDrawn = keys.length ? drawnChance(drawnAt(prior.state, view, frame.band!), keys) : 1;
        expect(frame.pDrawn).toBeCloseTo(pDrawn, 12);
        expect(frame.pDrawn).toBeGreaterThan(0);
        expect(stepChance(frame)).toBeCloseTo(view.likelihood[frame.band!] * pDrawn, 12);
        product *= stepChance(frame)!;
        expected *= view.likelihood[frame.band!] * pDrawn;
      }
      expect(product).toBeCloseTo(expected, 12);
      expect(product).toBeGreaterThan(0);
    }
    // The aimed last step drew something, and its chance counts in the path's.
    expect(currentFrame(s).pDrawn).toBeLessThan(1);
    expect(s.frames[0].pDrawn).toBeNull();
    expect(stepChance(s.frames[0])).toBeNull();
  }, 60000);
});

describe('replayTokens', () => {
  it('replays a path to the same states as stepping it', () => {
    const s = rollOn(open(REFERENCE), 4);
    const replayed = replayTokens(open(REFERENCE), sessionTokens(s));
    expect(replayed.stopped).toBeNull();
    expect(sessionTokens(replayed)).toBe(sessionTokens(s));
    expect(currentFrame(replayed).state).toEqual(currentFrame(s).state);
  });

  it('keeps the valid prefix and reports the refused token with the engine reason', () => {
    const s = rollOn(open(REFERENCE), 2);
    const tokens = sessionTokens(s).split(',');
    const bad = 't13_hostage_crisis_offer_take_courier~favorable';
    const replayed = replayTokens(open(REFERENCE), [...tokens, bad, tokens[0]].join(','));
    expect(sessionTokens(replayed)).toBe(tokens.join(','));
    expect(replayed.stopped).toEqual({ step: 3, token: bad, why: expect.stringContaining("isn't offered here") });
    const junk = replayTokens(open(REFERENCE), `${tokens[0]},nonsense`);
    expect(junk.frames).toHaveLength(2);
    expect(junk.stopped).toMatchObject({ step: 2, token: 'nonsense' });
  });

  it('plays a path on a bare engine state the same way (workers have no session)', () => {
    const s = rollOn(open(REFERENCE), 3);
    const played = playPath(s.frames[0].state, `${sessionTokens(s)},nonsense`);
    expect(played.frames.map(frame => frame.state)).toEqual(s.frames.map(frame => frame.state));
    expect(played.stopped).toMatchObject({ step: 4, token: 'nonsense' });
    expect(playPath(s.frames[0].state, '')).toEqual({ frames: [s.frames[0]], stopped: null });
  });

  it('reuses frames already computed for the same leading tokens', () => {
    const s = rollOn(open(REFERENCE), 3);
    const shorter = replayTokens(s, sessionTokens(s).split(',').slice(0, 1).join(','));
    expect(shorter.frames[1]).toBe(s.frames[1]);
    expect(replayTokens(shorter, sessionTokens(s)).frames.every((frame, i) => frame === s.frames[i])).toBe(true);
    expect(replayTokens(s, '').frames).toHaveLength(1);
  });

  it('reads a link typed another way as the same path and settles after one replay', () => {
    // Review finding path-replay-render-loop: the shell replays while sessionTokens(session) differs
    // from the URL path, so a non-canonical path must come back canonical, and replaying it again
    // must return the same session (no new object, no second engine replay).
    const s = rollOn(open(REFERENCE), 2);
    const tokens = sessionTokens(s);
    for (const typed of [`${tokens},`, ` ${tokens.split(',').join(' , ')} `, `,${tokens},,`]) {
      const replayed = replayTokens(open(REFERENCE), typed);
      expect(replayed.stopped).toBeNull();
      expect(sessionTokens(replayed)).toBe(tokens);
      expect(replayTokens(replayed, typed)).toBe(replayed);
      expect(replayTokens(replayed, sessionTokens(replayed))).toBe(replayed);
    }
    // A cascade key typed with `+` or a space (call.test.ts reads both as the same key).
    const group = open('type=hostage_crisis&family=market_row&seed=7&tier=2&call=1');
    const cascades = (state: GameState) => !!state.activeRun && state.activeRun.status === 'active' && liveDecisions(state, NOW, 'A')
      .some(view => view.eligible && BANDS.some(band => sampleFor(view, band) !== null && drawnAt(state, view, band).some(d => d.model === 'cascade')));
    const before = replayTokens(group, explore(group.frames[0].state, null, { holds: cascades }).path!);
    const frame = currentFrame(before);
    const [view, band, keys] = frame.views.flatMap(entry => BANDS.flatMap(b => {
      if (!entry.eligible || sampleFor(entry, b) === null) return [];
      const dists = drawnAt(frame.state, entry, b);
      const combo = dists.some(d => d.model === 'cascade') ? drawnCombos(dists).find(c => c.keys.some(key => key.includes('+'))) : undefined;
      return combo ? [[entry, b, combo.keys] as const] : [];
    }))[0];
    const stepped = step(before, { kind: 'decide', actionId: view.id, band, drawn: [...keys] });
    const canonical = sessionTokens(stepped);
    expect(canonical.split(',').at(-1)).toMatch(/\./);
    for (const typed of [canonical.replace(/\.(?=[^,]*$)/g, '+'), canonical.replace(/\.(?=[^,]*$)/g, ' ')]) {
      expect(typed).not.toBe(canonical);
      const replayed = replayTokens(stepped, typed);
      expect(replayed).toBe(stepped);
      expect(sessionTokens(replayTokens(before, typed))).toBe(canonical);
    }
  }, 60000);

  it('reopens and replays under a tuning patch: same moves, the patch\'s odds', () => {
    const saved = rollOn(open(REFERENCE), 2);
    const tokens = sessionTokens(saved);
    expect(applyTuningPatch({ RESOLUTION_TUNING: { favorableAt: 20 } })).toEqual([]);
    const patched = replayTokens(open(REFERENCE), tokens);
    expect(patched.key).not.toBe(saved.key);
    expect(patched.stopped === null || patched.stopped.step > 0).toBe(true);
    const first = (s: Session) => s.frames[0].views.find(view => view.eligible)!.likelihood.favorable;
    expect(first(patched)).toBeLessThan(first(saved));
    applyTuningPatch({});
    expect(open(REFERENCE).key).toBe(saved.key);
  });
});

describe('handoff', () => {
  /** A "game": the hostage reference call two decisions in, for another campaign's squad. */
  function gameState(): GameState {
    const game = rollOn(open(`${REFERENCE}&squad=4242`), 2);
    return currentFrame(game).state;
  }

  it('starts at the snapshot, with the game\'s decisions as prior steps', () => {
    const state = gameState();
    const run = state.activeRun!;
    const handoff: LabHandoff = { v: 1, at: NOW, scenarioId: run.scenarioId, state, screen: 'live' };
    const s = open(`id=${run.scenarioId}&handoff=abc&hist=x`, handoff);
    expect(s.frames).toHaveLength(1);
    expect(s.frames[0].state).toBe(state);
    expect(s.squad).toEqual({ kind: 'game', at: NOW });
    expect(s.prior.map(p => `${p.actionId}~${p.band}`)).toEqual(run.history.map(h => `${h.actionId}~${h.band}`));
    expect(s.prior.every(p => p.node && p.choice)).toBe(true);
    expect(s.note).toBeNull();
    // Steps from there play on the game's state.
    const on = rollOn(s, 1);
    expect(currentFrame(on).state.activeRun!.history).toHaveLength(run.history.length + 1);
  });

  it('replays the game\'s moves with forced bands on the reference squad when the snapshot is gone', () => {
    const state = gameState(), run = state.activeRun!;
    const hist = run.history.map(h => `${h.actionId}~${h.band}`).join(',');
    const s = open(`id=${run.scenarioId}&handoff=gone&hist=${hist}`);
    expect(s.squad).toMatchObject({ kind: 'reference', seed: 719 });
    expect(s.prior.map(p => `${p.actionId}~${p.band}`).join(',')).toBe(hist);
    expect(s.frames[0].state.activeRun!.history.map(h => h.band)).toEqual(run.history.map(h => h.band));
    expect(s.note).toContain('The game snapshot for this link has expired.');
    expect(sessionTokens(s)).toBe('');
  });

  it('replays the game\'s drawn results too, and says when this squad can\'t produce one', () => {
    const drawnPath = 't13_hostage_crisis_offer_take_courier~favorable,t13_hostage_crisis_out_six_years_ask_courier~adverse,t13_hostage_crisis_threat_go_in~adverse/firearm:none/none';
    const id = open('type=hostage_crisis&family=market_row&seed=7&tier=2&variant=2').resolved.id!;
    const aimed = open(`id=${id}&kit=full&certs=entry_team&handoff=gone&hist=${drawnPath}`);
    expect(aimed.prior).toHaveLength(3);
    expect(aimed.prior[2].drawn).toEqual(['team_force:firearm:none', 'incoming_fire:none']);
    expect(aimed.note).toContain('with the same bands and drawn results');
    expect(aimed.note).not.toContain('couldn\'t be matched');
    // No fatal result is possible on that entry: the band is kept and the dice settle the rest.
    const unmatched = open(`id=${id}&handoff=gone&hist=${drawnPath.replace('firearm:none/none', 'firearm:fatal/none')}`);
    expect(unmatched.prior).toHaveLength(3);
    expect(unmatched.prior[2].band).toBe('adverse');
    expect(unmatched.note).toContain('One drawn result couldn\'t be matched on this squad');
  });
});
