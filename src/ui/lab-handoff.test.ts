// "Open in lab" hands the lab the exact game state under a one-shot key; the URL carries the key and
// the run's decisions as path tokens for the fallback replay.
import { describe, expect, it } from 'vitest';
import { startGateRun } from '../gen/incident/gates/engine-driver';
import { apply, makeState, NOW } from '../sim/test-fixtures';
import type { GameState } from '../sim/types';
import { historyTokens, LAB_HANDOFF_PREFIX, pruneLabHandoffs, readLabHandoff, writeLabHandoff, type HandoffStorage } from './lab-handoff';
import { liveDecisions } from './screens/live-model';

const HOSTAGE = 'gen:hostage_crisis:market_row:3035903061:1492309763:1:13';
const HOUR = 60 * 60 * 1000;

/** localStorage as a Map; `full` refuses every write. */
function fakeStorage(full = false) {
  const data = new Map<string, string>();
  const storage: HandoffStorage & { data: Map<string, string> } = {
    data,
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (full) throw new Error('QuotaExceededError'); data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  return storage;
}

/** The hostage call two decisions in, each with a band the engine drew. */
function twoSteps(): GameState {
  let g = startGateRun(HOSTAGE);
  for (let i = 0; i < 2; i++) {
    const choice = liveDecisions(g, NOW, 'A').find(action => action.eligible)!;
    g = apply(g, { type: 'decide', actionId: choice.id, actingSquadIds: ['A'], supportSquadIds: [] }).state;
  }
  return g;
}

describe('lab handoff', () => {
  const state = twoSteps();
  const run = state.activeRun!;

  it('writes the run\'s decisions as action~band tokens', () => {
    expect(run.history).toHaveLength(2);
    expect(historyTokens(run)).toBe(run.history.map(step => `${step.actionId}~${step.band}`).join(','));
    expect(historyTokens(run)).toMatch(/^t13_hostage_crisis_\w+~(favorable|mixed|adverse),t13_hostage_crisis_\w+~(favorable|mixed|adverse)$/);
    expect(historyTokens(startGateRun(HOSTAGE).activeRun!)).toBe('');
  });

  it('adds each decision\'s drawn results after its band, a cascade\'s + written as a dot', () => {
    const [first] = run.history;
    const drawn = [{ model: 'team_force' as const, personId: 'taker', key: 'firearm:none' }, { model: 'cascade' as const, personId: 'others', key: 'follows+stays' }];
    const withDrawn = { ...run, history: [{ ...first, committed: { ...first.committed!, drawn } }] };
    expect(historyTokens(withDrawn)).toBe(`${first.actionId}~${first.band}/firearm:none/follows.stays`);
    const url = writeLabHandoff({ ...state, activeRun: withDrawn }, '/', NOW, fakeStorage())!;
    expect(url).toContain(`hist=${first.actionId}~${first.band}/firearm:none/follows.stays`);
  });

  it('stores the state under a nonce and returns the lab URL; reading gives the same state back', () => {
    const storage = fakeStorage();
    const url = writeLabHandoff(state, '/', NOW, storage)!;
    const query = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/lab?id=')).toBe(true);
    expect(query.get('id')).toBe(run.scenarioId);
    expect(query.get('hist')).toBe(historyTokens(run));
    expect(url).toContain(`hist=${historyTokens(run)}`);
    const nonce = query.get('handoff')!;
    expect(storage.data.has(LAB_HANDOFF_PREFIX + nonce)).toBe(true);
    const handoff = readLabHandoff(nonce, storage)!;
    expect(handoff).toMatchObject({ v: 1, at: NOW, scenarioId: run.scenarioId, screen: 'live' });
    expect(handoff.state.activeRun).toEqual(state.activeRun);
    expect(handoff.state.officers).toEqual(state.officers);
    // The lab reopens a call when the draw or tuning changes, so a read never spends the key.
    expect(readLabHandoff(nonce, storage)).toEqual(handoff);
    expect(writeLabHandoff(state, '/tactically-idle', NOW, storage)!.startsWith('/tactically-idle/lab?')).toBe(true);
  });

  it('marks a debrief, and has nothing to hand over without a run', () => {
    const storage = fakeStorage();
    let ended = state;
    for (let i = 0; i < 40 && ended.activeRun!.status === 'active'; i++) {
      const choice = liveDecisions(ended, NOW, 'A').find(action => action.eligible)!;
      ended = apply(ended, { type: 'decide', actionId: choice.id, actingSquadIds: ['A'], supportSquadIds: [] }).state;
    }
    expect(ended.activeRun!.status).toBe('debrief');
    const nonce = new URLSearchParams(writeLabHandoff(ended, '/', NOW, storage)!.split('?')[1]).get('handoff')!;
    expect(readLabHandoff(nonce, storage)?.screen).toBe('debrief');
    expect(writeLabHandoff(makeState(), '/', NOW, storage)).toBeNull();
  });

  it('leaves the snapshot out of the URL when storage refuses it, so the lab replays the tokens', () => {
    const url = writeLabHandoff(state, '/', NOW, fakeStorage(true))!;
    expect(url).not.toContain('handoff=');
    expect(url).toContain(`hist=${historyTokens(run)}`);
    expect(writeLabHandoff(state, '/', NOW, null)).not.toContain('handoff=');
  });

  it('reads nothing for a missing, foreign or broken key', () => {
    const storage = fakeStorage();
    expect(readLabHandoff('missing', storage)).toBeNull();
    storage.setItem(`${LAB_HANDOFF_PREFIX}broken`, '{not json');
    expect(readLabHandoff('broken', storage)).toBeNull();
    storage.setItem(`${LAB_HANDOFF_PREFIX}old`, JSON.stringify({ v: 0, at: NOW, scenarioId: run.scenarioId, screen: 'live', save: '{}' }));
    expect(readLabHandoff('old', storage)).toBeNull();
  });

  it('prunes keys older than a day and keeps the newest five', () => {
    const storage = fakeStorage();
    storage.setItem('tactically-idle/campaign-slots', 'untouched');
    const nonces = Array.from({ length: 7 }, (_, i) => new URLSearchParams(writeLabHandoff(state, '/', NOW + i * HOUR, storage)!.split('?')[1]).get('handoff')!);
    // Each write keeps room for itself: never more than five.
    expect([...storage.data.keys()].filter(key => key.startsWith(LAB_HANDOFF_PREFIX))).toHaveLength(5);
    expect(nonces.slice(2).every(nonce => readLabHandoff(nonce, storage))).toBe(true);
    expect(readLabHandoff(nonces[0], storage)).toBeNull();
    pruneLabHandoffs(NOW + 2 * HOUR + 24 * HOUR + 1, storage);
    expect(readLabHandoff(nonces[2], storage)).toBeNull();
    expect(nonces.slice(3).every(nonce => readLabHandoff(nonce, storage))).toBe(true);
    pruneLabHandoffs(NOW + 6 * HOUR + 24 * HOUR + 1, storage);
    expect([...storage.data.keys()]).toEqual(['tactically-idle/campaign-slots']);
  });
});
