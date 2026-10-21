// The live decision (docs/call-pressure.md, "The live decision"): the scene keeps moving while the
// player weighs a choice. Pressure sources tick as a count someone on scene would see, with what the
// people watching are saying floating past, and the comms log carries what is said on scene as it is
// said. The numbers come from the sim's projection (sim/clocks.ts stalledRun, stallFeed); how a
// count refreshes and who says what in the chat (live-chat.ts) are presentation only and never reach
// the sim, so a replay or the Scenario Lab reads exactly what the cards did.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FillView, StallLine } from '../../sim/clocks';
import { formatCount } from '../../sim/pressure-sources';
import { Icon } from '../icons';
import { PeopleText } from '../people/PeopleText';
import { buzz, playSquelch, playTick } from '../audio/live-audio';
import { chatGapMs, chatHandle, countRefreshMs, drawChatLine, nextLiveCount } from './live-chat';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** A small seeded generator, so each source refreshes and picks its chat in its own steady pattern. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0;

interface Floating { key: number; who: string; text: string | null; lane: number }

/** One pressure source on the strip: its count, refreshing every second or two toward where the sim
 * has it the way a stream app's count does (live-chat.ts nextLiveCount), and the chat of the people
 * watching, each line under a handle and never read twice on one run (`runKey`). Once a cue's lines
 * are spent the chat thins to people joining while the count climbs. A jump (a bump, a cue, the
 * threat landing) bursts the chat and ticks. */
export function SourceTicker({ view, runKey = 'preview' }: { view: FillView; runKey?: string }) {
  const target = Math.round(view.count?.value ?? view.value);
  const [shown, setShown] = useState(target);
  const [floating, setFloating] = useState<Floating[]>([]);
  const last = useRef(target);
  const keyRef = useRef(0);
  const said = useRef(0);
  const random = useRef(rng(hash(`${runKey}:${view.id}`)));
  const reduced = reducedMotion();

  // The count refreshes on its own clock and reads the latest target from a ref, so the sim's ticks
  // don't restart it.
  const targetRef = useRef(target);
  targetRef.current = target;
  const counted = !!view.count;
  useEffect(() => {
    if (reduced || !counted) return;
    let timer = 0;
    const refresh = () => {
      setShown(now => nextLiveCount(now, targetRef.current, random.current));
      timer = window.setTimeout(refresh, countRefreshMs(random.current));
    };
    timer = window.setTimeout(refresh, countRefreshMs(random.current));
    return () => window.clearTimeout(timer);
  }, [reduced, counted]);
  if ((reduced || !counted) && shown !== target) setShown(target);

  const float = (text: string | null, lane: number) => {
    const key = ++keyRef.current;
    const who = chatHandle(runKey, view.id, said.current++);
    setFloating(list => [...list.slice(-4), { key, who, text, lane }]);
    window.setTimeout(() => setFloating(list => list.filter(item => item.key !== key)), reduced ? 4000 : 3600);
  };

  // The chat: a line every few seconds, quicker as it fills, each drawn once per run. Keyed on the
  // pool's text and the gauge in tenths, since the view itself is rebuilt on every tick.
  const poolKey = (view.reactions?.pool ?? []).join('\n');
  const pace = Math.round(view.value / 10);
  const rising = useRef(target);
  useEffect(() => {
    const pool = poolKey ? poolKey.split('\n') : [];
    if (!pool.length || view.stopped) return;
    let timer = 0;
    const next = () => {
      const line = drawChatLine(runKey, view.id, pool, random.current);
      const climbing = targetRef.current > rising.current;
      rising.current = targetRef.current;
      if (line) float(line, Math.floor(random.current() * 3));
      else if (climbing) float(null, Math.floor(random.current() * 3));
      timer = window.setTimeout(next, chatGapMs(pace * 10, random.current));
    };
    timer = window.setTimeout(next, chatGapMs(pace * 10, random.current) / 2);
    return () => window.clearTimeout(timer);
  }, [poolKey, pace, view.stopped, reduced, runKey]);

  useEffect(() => {
    const before = last.current;
    last.current = target;
    if (!(target > before * 1.08 + 1)) return;
    const spike = view.reactions?.spike ?? [];
    const pool = view.reactions?.pool ?? [];
    [0, 1, 2].forEach(i => window.setTimeout(() => {
      const line = drawChatLine(runKey, `${view.id}:spike`, spike, random.current) ?? drawChatLine(runKey, view.id, pool, random.current);
      float(line, i % 3);
    }, i * 420));
    playTick();
    buzz(25);
  }, [target]);

  const unit = view.count?.unit;
  const number = view.count ? formatCount(shown) : `${Math.round(view.value)}`;
  return <div className={`source-ticker${view.stopped ? ' source-ticker-stopped' : ''}`} data-source={view.id} role="group" aria-label={`${view.label}: ${view.count ? `${formatCount(target)} ${unit}` : `${Math.round(view.value)} of 100`}${view.stopped ? ', stopped' : ''}`}>
    <p className="source-ticker-head">
      <i className={`source-live-dot${view.stopped ? ' source-live-off' : ''}`} aria-hidden="true" />
      <span className="source-ticker-label"><PeopleText text={view.label} /></span>
      {/* Always in the row, hidden until it pulls, so a long label wraps once and never rewraps. */}
      <span className={`source-ticker-pull${view.oddsPull ? '' : ' source-ticker-pull-none'}`} title="Taken off the checks it weighs on" aria-hidden={view.oddsPull ? undefined : true}>−{view.oddsPull || 0}</span>
    </p>
    {/* The number and its unit wrap apart, never inside the number, and the digits are tabular,
        so a refresh never changes the ticker's height. */}
    <p className="source-ticker-count" aria-hidden="true"><b>{number}</b> <span>{view.count ? unit : 'of 100'}</span></p>
    <span className="source-ticker-bar" aria-hidden="true">
      <i style={{ width: `${Math.max(0, Math.min(100, view.value))}%` }} />
      {view.cues.map(cue => <em key={cue.at} className={cue.heard ? 'fill-gauge-tick fill-gauge-heard' : 'fill-gauge-tick'} style={{ left: `${cue.at}%` }} />)}
    </span>
    <div className="source-reactions" aria-hidden="true">
      {floating.map(item => <span key={item.key} className={`source-reaction source-lane-${item.lane}${item.text === null ? ' source-reaction-join' : ''}`}>
        <b className="source-reaction-who">{item.who}</b> {item.text === null ? 'joined' : <PeopleText text={item.text} />}
      </span>)}
    </div>
  </div>;
}

/** What is said on scene while the player decides, oldest first like a radio log: beats in their
 * speaker's voice and the cues the clocks pass, with what the threat did (`landed`) at the moment it
 * lands. Each new line keys the radio. The log holds its box from the decision's first render, before
 * anything is said, and new lines join at the bottom and scroll it there (while the player hasn't
 * scrolled back), so no line already shown ever moves and nothing under the log does either (owner,
 * 2026-10-21). */
export function CommsLog({ lines, landed = null }: { lines: readonly StallLine[]; landed?: ReactNode }) {
  const seen = useRef(new Set<string>());
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const list = useRef<HTMLUListElement>(null);
  const following = useRef(true);
  // Where the landing sits: after the lines said before it.
  const landedAt = useRef<number | null>(null);
  if (!landed) landedAt.current = null;
  else if (landedAt.current === null) landedAt.current = lines.length;
  useEffect(() => {
    const added = lines.filter(line => !seen.current.has(line.id));
    if (!added.length) return;
    added.forEach(line => seen.current.add(line.id));
    setFresh(new Set(added.map(line => line.id)));
    playSquelch();
    if (added.some(line => line.kind === 'beat')) buzz([18, 40, 18]);
    const timer = window.setTimeout(() => setFresh(new Set()), 1600);
    return () => window.clearTimeout(timer);
  }, [lines]);
  useLayoutEffect(() => {
    const el = list.current;
    if (el && following.current) el.scrollTop = el.scrollHeight;
  }, [lines.length, !!landed]);
  const at = landedAt.current ?? lines.length;
  const line = (entry: StallLine) => <li key={entry.id} className={`comms-line comms-${entry.kind}${fresh.has(entry.id) ? ' comms-fresh' : ''}`}>
    {entry.speaker && <b className="comms-speaker"><PeopleText text={entry.speaker} /></b>}
    <span className="comms-text"><PeopleText text={entry.text} /></span>
  </li>;
  return <section className="comms-log" aria-label="On scene, while you decide">
    <p className="comms-log-head"><Icon name="radio" size={13} />On scene</p>
    {/* Focusable so a keyboard can scroll it; polite, so each new line is read once. */}
    <ul ref={list} className="comms-log-lines" tabIndex={0} aria-live="polite" aria-label="Radio and what the team hears, newest last"
      onScroll={(event) => { const el = event.currentTarget; following.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8; }}>
      {lines.slice(0, at).map(line)}
      {landed && <li className="comms-line comms-landed">{landed}</li>}
      {lines.slice(at).map(line)}
      {!landed && !lines.length && <li className="comms-line comms-quiet">Nothing on the radio yet.</li>}
    </ul>
  </section>;
}
