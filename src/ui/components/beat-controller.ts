// The clock and the single slot behind Beat (components/Beat.tsx). Framework-free, so the timing and the
// reduced-motion path run in node tests: `play` shows one beat at once, a new beat replaces the one on
// screen, and every beat leaves by itself after BEAT_MS. Under reduced motion the beat is the final state
// from the first frame (`still`), with no entrance or exit, held the same time so the line can be read.
import type { Command, HandlerResult } from '../../sim/types';
import type { FaceKind } from './Face';
import type { PortraitProps } from '../portraits/Portrait';
import { reducedMotion } from '../motion';
import { playSting, type StingKind } from '../audio/live-audio';

/** How long a beat stays up. */
export const BEAT_MS = 1500;

export interface BeatFace {
  /** An officer, painted through the Face the rest of the game uses. */
  officer?: PortraitProps['officer'];
  /** A patrol person or anyone else with a file path under public/. */
  src?: string;
  kind?: FaceKind;
  /** Read aloud with the line, e.g. 'Brooks'. */
  name?: string;
}

export interface BeatSpec {
  /** The stamp word: OPEN, SIGNED, ENROLLED, PROMOTED. Shown in capitals whatever is passed. */
  stamp: string;
  face?: BeatFace;
  /** What the person says or does, one short line in the house voice. */
  line?: string;
  sting?: StingKind;
}

export interface ActiveBeat {
  id: number;
  spec: BeatSpec;
  /** Reduced motion: final state at once, nothing moves. */
  still: boolean;
}

export interface BeatDeps {
  still: () => boolean;
  sting: (kind: StingKind) => void;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

const defaultDeps: BeatDeps = {
  still: reducedMotion,
  sting: playSting,
  setTimer: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimer: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** What a screen reader hears for a beat: the stamp, then the line, once. */
export function beatAnnouncement(spec: BeatSpec): string {
  const who = spec.face?.name;
  return [spec.stamp, who && spec.line ? `${who}. ${spec.line}` : spec.line].filter(Boolean).join('. ');
}

export interface BeatController {
  play: (spec: BeatSpec) => number;
  dismiss: () => void;
  get: () => ActiveBeat | null;
  subscribe: (listener: () => void) => () => void;
}

export function createBeatController(deps: Partial<BeatDeps> = {}): BeatController {
  const d = { ...defaultDeps, ...deps };
  const listeners = new Set<() => void>();
  let active: ActiveBeat | null = null;
  let timer: unknown = null;
  let nextId = 1;
  const emit = () => listeners.forEach((listener) => listener());
  const clear = () => { if (timer !== null) d.clearTimer(timer); timer = null; };
  const dismiss = () => { clear(); if (active) { active = null; emit(); } };
  return {
    play(spec) {
      clear();
      const id = nextId++;
      active = { id, spec, still: d.still() };
      timer = d.setTimer(() => { timer = null; if (active?.id === id) { active = null; emit(); } }, BEAT_MS);
      if (spec.sting) d.sting(spec.sting);
      emit();
      return id;
    },
    dismiss,
    get: () => active,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

type Ok = Extract<HandlerResult, { ok: true }>;

export interface BeatApi {
  /** Shows a beat now; a beat already on screen is replaced. */
  play: (spec: BeatSpec) => void;
  /** Sends a command; on success plays the beat (the spec, or the one a function of the result builds,
   * or none if it returns null). A refusal toasts its reason and plays nothing. Never a success toast:
   * the beat replaces it, so the player hears one announcement. */
  act: (cmd: Command, beat: BeatSpec | ((result: Ok) => BeatSpec | null)) => HandlerResult;
}

/** The API screens use, over a controller, the command sender and the toast's notify. */
export function createBeatApi(
  controller: Pick<BeatController, 'play'>,
  send: (cmd: Command) => HandlerResult,
  notify: (title: string, opts: { tone: 'error' }) => void,
): BeatApi {
  return {
    play: (spec) => { controller.play(spec); },
    act: (cmd, beat) => {
      const res = send(cmd);
      if (!res.ok) { notify(res.reason, { tone: 'error' }); return res; }
      const spec = typeof beat === 'function' ? beat(res) : beat;
      if (spec) controller.play(spec);
      return res;
    },
  };
}
