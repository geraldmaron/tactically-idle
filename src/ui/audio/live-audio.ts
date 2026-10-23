// The live call's sound (docs/call-pressure.md, "The sensory layer"; owner 2026-10-21: on by default,
// with a mute in Settings). Everything is synthesized with Web Audio, so there are no clips to license
// or load: a radio squelch on each comms line, a phone tick when a stream jumps, a crowd murmur that
// follows the crowd, and a low heartbeat in a threat's last quarter. Presentation only: nothing here
// reads or writes the sim. Silent where the browser has no audio, before the player's first touch
// (browsers refuse sound until then), and whenever the setting is off.
//
// The station layer (owner 2026-10-23, station rebuild) shares this module and the Sound setting: short
// stings when the player hires, buys, enrols or promotes, and a faint room tone on HQ and Build. The
// station layer is also silent under reduced motion; the live call's sounds are unchanged.
import { soundOn, subscribeSettings } from '../settings/prefs';
import { REDUCED_MOTION_QUERY, reducedMotion } from '../motion';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let noise: AudioBuffer | null = null;
let murmur: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let unlocked = false;
let station: { source: AudioBufferSourceNode; lfo: OscillatorNode; hum: OscillatorNode; gain: GainNode } | null = null;
let ambienceWanted = false;

function audio(): Ctx | null {
  if (!soundOn() || !unlocked) return null;
  if (ctx) return ctx;
  const Ctor = (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try { ctx = new Ctor(); } catch { return null; }
  return ctx;
}

/** Browsers only allow sound after a touch: the live screen calls this from its first pointer event. */
export function unlockAudio(): void {
  unlocked = true;
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
}

/** Listens once for the first pointer or key press, so a screen that never mounts the live call (HQ,
 * Build) still unlocks sound on the player's first touch. Safe to call again. */
let armed = false;
export function armAudioUnlock(): void {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const unlock = () => {
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
    unlockAudio();
    syncAmbience();
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

/** The context for a station sound, or null: the Sound setting, a first touch (or the browser's own
 * record of one, so a purchase made before anything armed the listener still sounds) and reduced motion. */
function stationAudio(): Ctx | null {
  if (reducedMotion()) return null;
  const activation = typeof navigator !== 'undefined' ? (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation : undefined;
  if (!unlocked && activation?.hasBeenActive) unlocked = true;
  const c = audio();
  if (c && c.state === 'suspended') void c.resume();
  return c;
}

function noiseBuffer(c: Ctx): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise;
  const length = c.sampleRate * 2;
  noise = c.createBuffer(1, length, c.sampleRate);
  const data = noise.getChannelData(0);
  // Brown-ish noise: a soft roar rather than hiss. Seeded, so it never varies run to run.
  let last = 0;
  let seed = 7;
  for (let i = 0; i < length; i++) {
    seed = (seed * 16807) % 2147483647;
    const white = seed / 2147483647 * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return noise;
}

function envelope(c: Ctx, at: number, peak: number, attack: number, release: number): GainNode {
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + release);
  gain.connect(c.destination);
  return gain;
}

/** A radio key-up and squelch tail: the comms log's new line. */
export function playSquelch(): void {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1800;
  band.Q.value = 0.9;
  src.connect(band).connect(envelope(c, at, 0.18, 0.005, 0.22));
  src.start(at, Math.random() * 1.5, 0.3);
  const click = c.createOscillator();
  click.type = 'square';
  click.frequency.value = 2400;
  click.connect(envelope(c, at, 0.05, 0.002, 0.03));
  click.start(at);
  click.stop(at + 0.05);
}

/** A phone notification tick: a stream or a count jumps. */
export function playTick(): void {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  for (const [offset, freq] of [[0, 1320], [0.09, 1760]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(envelope(c, at + offset, 0.08, 0.004, 0.09));
    osc.start(at + offset);
    osc.stop(at + offset + 0.12);
  }
}

/** One heartbeat, two low thumps: played once a second in a threat's critical quarter. */
export function playHeartbeat(): void {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  for (const [offset, peak] of [[0, 0.35], [0.22, 0.22]] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(70, at + offset);
    osc.frequency.exponentialRampToValueAtTime(42, at + offset + 0.12);
    osc.connect(envelope(c, at + offset, peak, 0.01, 0.16));
    osc.start(at + offset);
    osc.stop(at + offset + 0.2);
  }
}

/** The crowd at the tape: a murmur whose level (0..1) follows the crowd. 0 stops it. */
export function setMurmur(level: number): void {
  const c = audio();
  const target = Math.max(0, Math.min(1, level)) * 0.07;
  if (!c || target <= 0.001) {
    if (murmur && c) murmur.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
    return;
  }
  if (!murmur) {
    const source = c.createBufferSource();
    source.buffer = noiseBuffer(c);
    source.loop = true;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 650;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    source.connect(low).connect(gain).connect(c.destination);
    source.start();
    murmur = { source, gain };
  }
  murmur.gain.gain.setTargetAtTime(target, c.currentTime, 0.6);
}

/** Leaving the live call: the murmur fades out and stops. */
export function stopLiveAudio(): void {
  if (!murmur || !ctx) return;
  const { source, gain } = murmur;
  gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
  window.setTimeout(() => { try { source.stop(); } catch { /* already stopped */ } }, 800);
  murmur = null;
}

/** A short buzz where the phone supports it (Android; iOS Safari has none, which is fine). */
export function buzz(pattern: number | number[]): void {
  if (!soundOn() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try { navigator.vibrate(pattern); } catch { /* refused */ }
}

// ---------------------------------------------------------------- station: stings and room tone

export type StingKind = 'hire' | 'buy' | 'enrol' | 'promotion';
export const STING_KINDS: readonly StingKind[] = ['hire', 'buy', 'enrol', 'promotion'];

/** Each sting is a few soft notes, a rising figure that says what happened: a badge clasp (hire), a
 * till (buy), a page turned and two chimes (enrol), a short ascent that holds (promotion). */
const STINGS: Record<StingKind, { notes: readonly (readonly [offset: number, freq: number, peak: number, release: number])[]; type: OscillatorType; buzz: number | number[] }> = {
  hire: { type: 'triangle', buzz: [18, 40, 18], notes: [[0, 523, 0.09, 0.14], [0.1, 659, 0.09, 0.14], [0.2, 784, 0.1, 0.32]] },
  buy: { type: 'sine', buzz: 14, notes: [[0, 880, 0.08, 0.1], [0.08, 1320, 0.09, 0.3]] },
  enrol: { type: 'sine', buzz: [12, 30, 12], notes: [[0, 660, 0.07, 0.18], [0.16, 880, 0.08, 0.34]] },
  promotion: { type: 'triangle', buzz: [18, 40, 18, 40, 30], notes: [[0, 392, 0.09, 0.14], [0.12, 523, 0.09, 0.14], [0.24, 659, 0.09, 0.16], [0.38, 784, 0.11, 0.55]] },
};

/** A short sting for a commitment that landed (the Beat primitive plays one with its stamp). Silent
 * with Sound off, under reduced motion, or before the first touch. The phone buzzes with it where it can. */
export function playSting(kind: StingKind): void {
  const c = stationAudio();
  if (!c) return;
  const at = c.currentTime;
  const def = STINGS[kind];
  for (const [offset, freq, peak, release] of def.notes) {
    const osc = c.createOscillator();
    osc.type = def.type;
    osc.frequency.value = freq;
    osc.connect(envelope(c, at + offset, peak, 0.005, release));
    osc.start(at + offset);
    osc.stop(at + offset + release + 0.05);
  }
  buzz(def.buzz);
}

/** The station's room tone: brown noise through a slowly moving low-pass, over a faint mains hum.
 * Fainter than the crowd murmur, and it never starts without Sound on, a first touch and full motion. */
function startRoomTone(c: Ctx): void {
  if (station) { station.gain.gain.setTargetAtTime(0.03, c.currentTime, 1.2); return; }
  const source = c.createBufferSource();
  source.buffer = noiseBuffer(c);
  source.loop = true;
  const low = c.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 420;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const sweep = c.createGain();
  sweep.gain.value = 120;
  lfo.connect(sweep).connect(low.frequency);
  const hum = c.createOscillator();
  hum.type = 'sine';
  hum.frequency.value = 60;
  const humGain = c.createGain();
  humGain.gain.value = 0.18;
  const gain = c.createGain();
  gain.gain.value = 0.0001;
  source.connect(low).connect(gain);
  hum.connect(humGain).connect(gain);
  gain.connect(c.destination);
  source.start();
  lfo.start();
  hum.start();
  gain.gain.setTargetAtTime(0.03, c.currentTime, 1.2);
  station = { source, lfo, hum, gain };
}

function silenceRoomTone(): void {
  if (!station) return;
  const { source, lfo, hum, gain } = station;
  station = null;
  if (ctx) gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
  window.setTimeout(() => { for (const node of [source, lfo, hum]) { try { node.stop(); } catch { /* already stopped */ } } }, 1200);
}

/** Starts or stops the room tone to match what is allowed right now. */
function syncAmbience(): void {
  const c = ambienceWanted ? stationAudio() : null;
  if (c) startRoomTone(c); else silenceRoomTone();
}

let watching = false;
function watchAmbience(): void {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  subscribeSettings(syncAmbience);
  window.matchMedia?.(REDUCED_MOTION_QUERY)?.addEventListener?.('change', syncAmbience);
  document.addEventListener('visibilitychange', () => {
    if (!station || !ctx) return;
    station.gain.gain.setTargetAtTime(document.hidden ? 0.0001 : 0.03, ctx.currentTime, 0.3);
  });
}

/** HQ and Build call this on entry: the room tone fades in once sound is allowed. */
export function startStationAmbience(): void {
  ambienceWanted = true;
  armAudioUnlock();
  watchAmbience();
  syncAmbience();
}

/** Leaving HQ or Build: the room tone fades out and stops. */
export function stopStationAmbience(): void {
  ambienceWanted = false;
  silenceRoomTone();
}

/** Test seam: forget the context, the unlock and every node this module holds. */
export function resetAudioForTests(): void {
  ctx = null; noise = null; murmur = null; station = null;
  unlocked = false; ambienceWanted = false; armed = false; watching = false;
}
