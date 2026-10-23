// The station layer of the audio module: stings and room tone obey the Sound setting, the first touch
// and reduced motion, and the live call's own sounds are not held to reduced motion.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSettingsMemory, updateSettings } from '../settings/prefs';
import { STING_KINDS, armAudioUnlock, playSquelch, playSting, resetAudioForTests, startStationAmbience, stopStationAmbience, unlockAudio } from './live-audio';

interface Fake { oscillators: number; sources: number; buzzes: unknown[]; contexts: number; listeners: Record<string, (() => void)[]>; reduced: boolean; activated: boolean }

function install(): Fake {
  const fake: Fake = { oscillators: 0, sources: 0, buzzes: [], contexts: 0, listeners: {}, reduced: false, activated: false };
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
  const node = (extra: object = {}) => ({ connect(next: unknown) { return next ?? node(); }, ...extra });
  class FakeContext {
    state = 'running'; currentTime = 0; sampleRate = 8000; destination = {};
    constructor() { fake.contexts++; }
    resume() { return Promise.resolve(); }
    createGain() { return node({ gain: param() }); }
    createOscillator() { fake.oscillators++; return node({ frequency: param(), type: 'sine', start() {}, stop() {} }); }
    createBufferSource() { fake.sources++; return node({ buffer: null, loop: false, start() {}, stop() {} }); }
    createBiquadFilter() { return node({ frequency: param(), Q: param(), type: 'lowpass' }); }
    createBuffer(_c: number, length: number) { return { sampleRate: 8000, getChannelData: () => new Float32Array(length) }; }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('navigator', { vibrate: (pattern: unknown) => { fake.buzzes.push(pattern); return true; }, get userActivation() { return { hasBeenActive: fake.activated }; } });
  vi.stubGlobal('document', { hidden: false, addEventListener() {} });
  vi.stubGlobal('window', {
    setTimeout: () => 0,
    addEventListener: (type: string, fn: () => void) => { (fake.listeners[type] ??= []).push(fn); },
    removeEventListener: () => {},
    matchMedia: () => ({ get matches() { return fake.reduced; }, addEventListener() {} }),
  });
  return fake;
}

let fake: Fake;
beforeEach(() => { resetAudioForTests(); resetSettingsMemory(); fake = install(); });
afterEach(() => { stopStationAmbience(); vi.unstubAllGlobals(); resetSettingsMemory(); });

describe('stings', () => {
  it('has one for hire, buy, enrol and promotion that sounds after a first touch and buzzes the phone', () => {
    unlockAudio();
    for (const kind of STING_KINDS) {
      const before = fake.oscillators;
      playSting(kind);
      expect(fake.oscillators - before, kind).toBeGreaterThanOrEqual(2);
    }
    expect(fake.buzzes).toHaveLength(STING_KINDS.length);
  });

  it('is silent before the first touch, and a purchase made before anything armed the listener still sounds once the browser says the page was touched', () => {
    playSting('buy');
    expect(fake.oscillators).toBe(0);
    fake.activated = true;
    playSting('buy');
    expect(fake.oscillators).toBeGreaterThan(0);
  });

  it('is silent with the Sound setting off, with no buzz either', () => {
    unlockAudio();
    updateSettings({ sound: false });
    playSting('hire');
    expect(fake.oscillators).toBe(0);
    expect(fake.buzzes).toEqual([]);
  });

  it('is silent under reduced motion, with no buzz, while the live call still sounds', () => {
    unlockAudio();
    fake.reduced = true;
    playSting('promotion');
    expect(fake.oscillators).toBe(0);
    expect(fake.buzzes).toEqual([]);
    playSquelch();
    expect(fake.oscillators).toBeGreaterThan(0);
  });
});

describe('room tone', () => {
  it('waits for the first touch, then fades in, and stops with the screen', () => {
    startStationAmbience();
    expect(fake.sources).toBe(0);
    expect(fake.listeners.pointerdown?.length).toBe(1);
    fake.listeners.pointerdown[0]();
    expect(fake.sources).toBe(1);
    expect(fake.oscillators).toBe(2);
    stopStationAmbience();
    fake.listeners.pointerdown = [];
    startStationAmbience();
    expect(fake.sources).toBe(2);
  });

  it('does not start with Sound off or under reduced motion', () => {
    unlockAudio();
    updateSettings({ sound: false });
    startStationAmbience();
    expect(fake.sources).toBe(0);
    stopStationAmbience();
    updateSettings({ sound: true });
    fake.reduced = true;
    startStationAmbience();
    expect(fake.sources).toBe(0);
  });

  it('arms the unlock listener once however many screens ask', () => {
    armAudioUnlock();
    armAudioUnlock();
    expect(fake.listeners.pointerdown).toHaveLength(1);
  });
});
