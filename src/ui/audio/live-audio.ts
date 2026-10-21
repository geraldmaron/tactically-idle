// The live call's sound (docs/call-pressure.md, "The sensory layer"; owner 2026-10-21: on by default,
// with a mute in Settings). Everything is synthesized with Web Audio, so there are no clips to license
// or load: a radio squelch on each comms line, a phone tick when a stream jumps, a crowd murmur that
// follows the crowd, and a low heartbeat in a threat's last quarter. Presentation only: nothing here
// reads or writes the sim. Silent where the browser has no audio, before the player's first touch
// (browsers refuse sound until then), and whenever the setting is off.
import { soundOn } from '../settings/prefs';

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let noise: AudioBuffer | null = null;
let murmur: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
let unlocked = false;

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
