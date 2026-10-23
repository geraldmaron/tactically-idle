// Beat: one slot, one clock, one announcement. The reduced-motion path shows the final state at once;
// the success toast is replaced, never doubled.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { stylesheetsUnder } from '../../dev/lab/css-rules';
import { BeatLayer, BeatView } from './Beat';
import { BEAT_MS, beatAnnouncement, createBeatApi, createBeatController, type BeatSpec } from './beat-controller';

const SHEETS = stylesheetsUnder('src/ui');
const OPEN: BeatSpec = { stamp: 'Open', face: { kind: 'officer', name: 'Brooks' }, line: 'That bay has been dark since March.', sting: 'buy' };

function rig(still = false) {
  vi.useFakeTimers();
  const sting = vi.fn();
  const controller = createBeatController({
    still: () => still, sting,
    setTimer: (fn, ms) => setTimeout(fn, ms), clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  return { controller, sting };
}

describe('the beat clock', () => {
  it('plays about 1.5 seconds, then clears itself and tells its listeners', () => {
    const { controller, sting } = rig();
    const seen = vi.fn();
    controller.subscribe(seen);
    controller.play(OPEN);
    expect(controller.get()?.spec.stamp).toBe('Open');
    expect(sting).toHaveBeenCalledWith('buy');
    vi.advanceTimersByTime(BEAT_MS - 1);
    expect(controller.get()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(controller.get()).toBeNull();
    expect(seen).toHaveBeenCalledTimes(2);
    expect(BEAT_MS).toBe(1500);
    vi.useRealTimers();
  });

  it('replaces a beat already on screen and restarts the clock, so the old one cannot clear the new one', () => {
    const { controller } = rig();
    controller.play({ stamp: 'Open' });
    vi.advanceTimersByTime(1000);
    controller.play({ stamp: 'Signed' });
    vi.advanceTimersByTime(1000);
    expect(controller.get()?.spec.stamp).toBe('Signed');
    vi.advanceTimersByTime(500);
    expect(controller.get()).toBeNull();
    vi.useRealTimers();
  });

  it('plays no sting when the spec has none', () => {
    const { controller, sting } = rig();
    controller.play({ stamp: 'Open' });
    expect(sting).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('reduced motion', () => {
  it('marks the beat still from the first frame, with the stamp, face and line all present and no entrance state', () => {
    const { controller } = rig(true);
    controller.play(OPEN);
    const beat = controller.get()!;
    expect(beat.still).toBe(true);
    const html = renderToStaticMarkup(createElement(BeatView, { beat }));
    expect(html).toContain('data-still=""');
    expect(html).toContain('OPEN');
    expect(html).toContain('face-officer');
    expect(html).toContain('That bay has been dark since March.');
    vi.useRealTimers();
  });

  it('holds the same time as the animated beat so the line can still be read', () => {
    const { controller } = rig(true);
    controller.play(OPEN);
    vi.advanceTimersByTime(BEAT_MS - 1);
    expect(controller.get()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(controller.get()).toBeNull();
    vi.useRealTimers();
  });

  it('is animated, without data-still, when motion is allowed', () => {
    const { controller } = rig(false);
    controller.play(OPEN);
    expect(renderToStaticMarkup(createElement(BeatView, { beat: controller.get()! }))).not.toContain('data-still');
    vi.useRealTimers();
  });
});

describe('the overlay', () => {
  it('is decorative, takes no input and holds one live region that says the stamp and the line once', () => {
    const { controller } = rig();
    controller.play(OPEN);
    const html = renderToStaticMarkup(createElement(BeatLayer, { controller }));
    expect(html).toContain('role="status"');
    expect(html).toContain('Open. Brooks. That bay has been dark since March.');
    expect(html.match(/That bay has been dark since March\./g)).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<button|<a |tabindex/);
    vi.useRealTimers();
  });

  it('keeps an empty live region standing while idle, so the next beat is announced', () => {
    const { controller } = rig();
    const html = renderToStaticMarkup(createElement(BeatLayer, { controller }));
    expect(html).toMatch(/role="status"[^>]*><\/div>/);
    expect(html).not.toContain('class="beat"');
    vi.useRealTimers();
  });

  it('draws as an overlay: no flow position, no pointer events, no reserved space', () => {
    const css = SHEETS['components/beat.css'];
    expect(css).toMatch(/\.beat-layer \{[^}]*position: absolute;[^}]*pointer-events: none;/);
    expect(css).not.toMatch(/min-height|\bheight:/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.beat[^}]*animation: none !important/);
  });
});

describe('announcement', () => {
  it('says the stamp, then who and the line, with no empty parts', () => {
    expect(beatAnnouncement({ stamp: 'OPEN' })).toBe('OPEN');
    expect(beatAnnouncement({ stamp: 'SIGNED', line: 'Welcome aboard.' })).toBe('SIGNED. Welcome aboard.');
    expect(beatAnnouncement({ stamp: 'PROMOTED', face: { name: 'Park' }, line: 'Third stripe.' })).toBe('PROMOTED. Park. Third stripe.');
  });
});

describe('the toast decision: a beat replaces the success toast', () => {
  const cmd = { type: 'noop' } as never;

  it('plays the beat on success and never sends a success toast', () => {
    const play = vi.fn(); const notify = vi.fn();
    const api = createBeatApi({ play }, () => ({ ok: true }), notify);
    expect(api.act(cmd, OPEN)).toEqual({ ok: true });
    expect(play).toHaveBeenCalledWith(OPEN);
    expect(notify).not.toHaveBeenCalled();
  });

  it('toasts a refusal as an error and plays no beat', () => {
    const play = vi.fn(); const notify = vi.fn();
    const api = createBeatApi({ play }, () => ({ ok: false, reason: 'Not enough funding' }), notify);
    expect(api.act(cmd, OPEN)).toEqual({ ok: false, reason: 'Not enough funding' });
    expect(notify).toHaveBeenCalledWith('Not enough funding', { tone: 'error' });
    expect(play).not.toHaveBeenCalled();
  });

  it('builds the beat from the result when given a function, and plays none when it returns null', () => {
    const play = vi.fn();
    const api = createBeatApi({ play }, () => ({ ok: true }), vi.fn());
    api.act(cmd, () => ({ stamp: 'Signed' }));
    expect(play).toHaveBeenCalledWith({ stamp: 'Signed' });
    play.mockClear();
    api.act(cmd, () => null);
    expect(play).not.toHaveBeenCalled();
  });
});
