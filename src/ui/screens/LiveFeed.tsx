import { Ring } from '../components/ui';
// The live decision (docs/call-pressure.md, "The live decision"): the scene keeps moving while the
// player weighs a choice. Pressure sources tick as a count someone on scene would see, with what the
// people watching are saying in a two-line chat under it, and the comms log carries what is said on scene as it is
// said. The numbers come from the sim's projection (sim/clocks.ts stalledRun, stallFeed); how a
// count refreshes and who says what in the chat (live-chat.ts) are presentation only and never reach
// the sim, so a replay or the Scenario Lab reads exactly what the cards did.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FillView, StallLine } from '../../sim/clocks';
import type { NodeThreat } from '../../sim/scenario-types';
import { formatCount } from '../../sim/pressure-sources';
import { Icon } from '../icons';
import { PeopleText } from '../people/PeopleText';
import { buzz, playSquelch, playTick } from '../audio/live-audio';
import { reducedMotion } from '../motion';
import { CHAT_FADE_MS, chatGapMs, chatPhase, chatTick, countRefreshMs, drawChatLine, drawStateLine, nextChatHandle, nextLiveCount, seenCount, seenState } from './live-chat';

/** A small seeded generator, so each source refreshes and picks its chat in its own steady pattern. */
function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7) >>> 0;

interface ChatLine { key: number; who: string; text: string | null; at: number }

/** Lines the chat keeps on screen: the newest at the bottom, the one before it above, and nothing
 * fades out from under the reader (owner, 2026-10-21: the chat has to be easy to read). */
const CHAT_LINES = 2;

/** One pressure source on the strip: its count, refreshing every second or two toward where the sim
 * has it the way a stream app's count does (live-chat.ts nextLiveCount), and the chat of the people
 * watching, each line under a handle and never read twice on one run (`runKey`).
 *
 * The chat follows the pressure (docs/call-pressure.md, "Chat that follows the pressure"). While a
 * decision shows, the open threat's thread for the drain's phase plays in written order, with one
 * tick in four of filler from the cue pool and none in imminent. What began while the chat was
 * hidden (the stream stopped, slowed, surged, or its count fell) plays first, in its own pool, and
 * a stopped stream then goes quiet. A spent chat plays joins, and a line fades after 12 seconds.
 * A jump (a bump, a cue, the threat landing) bursts the chat and ticks. Nothing here reaches the
 * sim, and nothing is drawn while the chat is hidden. */
/** `chat`: the viewers' lines under the count, live texture for the decide beat; off on the result. */
export function SourceTicker({ view, runKey = 'preview', effect = null, chat: showChat = true, threat = null, dither = 0 }: { view: FillView; runKey?: string; effect?: string | null; chat?: boolean; threat?: NodeThreat | null; dither?: number }) {
  const target = Math.round(view.count?.value ?? view.value);
  const [shown, setShown] = useState(target);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const last = useRef(target);
  const keyRef = useRef(0);
  const random = useRef(rng(hash(`${runKey}:${view.id}`)));
  const chatRandom = useRef(rng(hash(`${runKey}:${view.id}:chat`)));
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

  const say = (text: string | null, by?: string) => {
    const key = ++keyRef.current;
    const who = by ?? nextChatHandle(runKey, view.id);
    setChat(list => [...list.slice(1 - CHAT_LINES), { key, who, text, at: Date.now() }]);
  };

  // The latest of everything the tick reads, so a tick never restarts the loop.
  const threatId = threat?.id ?? '';
  const minutes = threat?.minutes ?? 0;
  const thread = threat && threat.chat ? threat.chat : null;
  const streamDown = threat?.chat === false;
  const latest = useRef({ dither, fill: view.value, thread, minutes, stopped: view.stopped, streamDown, view });
  latest.current = { dither, fill: view.value, thread, minutes, stopped: view.stopped, streamDown, view };
  const queue = useRef<string[]>([]);
  const phase = chatPhase(dither, minutes);
  const state = view.stopped ? 'stopped' : view.slowed ? 'slowed' : view.surged ? 'surged' : 'none';

  // A new decision starts a new thread: the lines on screen and anything queued are the last one's.
  useEffect(() => { setChat([]); queue.current = []; }, [threatId]);

  // What began while the chat was hidden, or while it showed: the stream's state, in its own pool.
  useEffect(() => {
    if (!showChat) return;
    const before = seenState(runKey, view.id, state);
    if (state === 'none' || before === state) return;
    const pool = view.reactions?.[state] ?? [];
    for (let line = drawStateLine(runKey, view.id, state, pool); line; line = drawStateLine(runKey, view.id, state, pool)) queue.current.push(line);
  }, [state, showChat, runKey]);

  // The chat: a line every few seconds, quicker as the threat closes. The first line of a phase
  // plays as the drain enters it. Keyed on the pool's text, since the view is rebuilt on every tick.
  const poolKey = (view.reactions?.pool ?? []).join('\n');
  const spare = useRef({ n: 0 });
  useEffect(() => {
    if (!showChat) return;
    const pool = poolKey ? poolKey.split('\n') : [];
    let timer = 0;
    const next = () => {
      const now = latest.current;
      const p = chatPhase(now.dither, now.minutes);
      const tick = chatTick({ runKey, sourceId: view.id, threatId, thread: now.thread, dither: now.dither, minutes: now.minutes, stopped: now.stopped, streamDown: now.streamDown,
        pool, queue: queue.current, random: chatRandom.current, spare: spare.current });
      if (tick) say(tick.text, tick.by);
      timer = window.setTimeout(next, chatGapMs(now.fill, chatRandom.current, p));
    };
    timer = window.setTimeout(next, 0);
    return () => window.clearTimeout(timer);
  }, [poolKey, phase, threatId, showChat, runKey, reduced]);

  // A visible line fades after a while, so a spent chat never freezes on stale lines.
  useEffect(() => {
    const timer = window.setInterval(() => setChat(list => { const now = Date.now(); const kept = list.filter(item => now - item.at < CHAT_FADE_MS); return kept.length === list.length ? list : kept; }), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // A jump in the count the chat saw: a burst of the spike pool, or the dropped pool when the count
  // falls by a seventh or more. Compared with the last count a visible chat saw, so a jump that
  // came while it was hidden is read when it shows again.
  useEffect(() => {
    if (!showChat) return;
    const before = seenCount(runKey, view.id, target);
    if (before === null) return;
    const reactions = view.reactions;
    if (target < before * 6 / 7) {
      // A stopped stream outranks a falling count: its own lines play and the dropped pool doesn't.
      if (!view.stopped) for (let line = drawStateLine(runKey, view.id, 'dropped', reactions?.dropped ?? []); line; line = drawStateLine(runKey, view.id, 'dropped', reactions?.dropped ?? [])) queue.current.push(line);
      return;
    }
    if (!(target > before * 1.08 + 1)) return;
    // Two lines, far enough apart that the first is read before the second pushes it up.
    [0, 1].forEach(i => burst.current.push(window.setTimeout(() => {
      const line = drawChatLine(runKey, `${view.id}:spike`, reactions?.spike ?? [], chatRandom.current) ?? drawChatLine(runKey, view.id, reactions?.pool ?? [], chatRandom.current);
      say(line);
    }, i * 1600)));
  }, [target, showChat]);

  // A burst belongs to the decision that showed it: a result hiding the chat, or a new decision,
  // cancels what hasn't played, so nothing is consumed unseen or shown late beside the next thread.
  const burst = useRef<number[]>([]);
  useEffect(() => () => { burst.current.forEach(id => window.clearTimeout(id)); burst.current = []; }, [showChat, threatId]);

  useEffect(() => {
    const before = last.current;
    last.current = target;
    if (!(target > before * 1.08 + 1)) return;
    playTick();
    buzz(25);
  }, [target]);

  const unit = view.count?.unit;
  const number = view.count ? formatCount(shown) : `${Math.round(view.value)}`;
  return <div className={`source-ticker${view.stopped ? ' source-ticker-stopped' : ''}`} data-source={view.id} role="group" aria-label={`${view.label}: ${view.count ? `${formatCount(target)} ${unit}` : `${Math.round(view.value)} of 100`}${view.oddsPull ? `, ${view.oddsPull} off the checks it weighs on` : ''}, ${view.cues.filter((cue) => cue.heard).length} of ${view.cues.length} cues heard${view.stopped ? ', stopped' : ''}`}>
    {/* The source as a strip pill (component contract 10): the fill as the ring on the live dot, the
        count with its unit, a pip per cue (filled once heard) and the pull on the odds. The source's
        name is in the group's accessible name. */}
    <p className="source-pill" data-ui-pill aria-hidden="true">
      <Ring value={view.value} size={22} tone={view.stopped ? 'good' : 'warn'}><i className={`source-live-dot${view.stopped ? ' source-live-off' : ''}`} /></Ring>
      <b className="source-pill-count">{number}</b>
      <span className="source-pill-unit">{view.count ? unit : 'of 100'}</span>
      {view.cues.length > 0 && <span className="source-pill-cues">{view.cues.map(cue => <em key={cue.at} className={cue.heard ? 'source-cue source-cue-heard' : 'source-cue'} />)}</span>}
      <span className={`source-ticker-pull${view.oddsPull ? '' : ' source-ticker-pull-none'}`} title="Taken off the checks it weighs on">−{view.oddsPull || 0}</span>
    </p>
    {effect && <p className="source-ticker-effect">{effect}</p>}
    {showChat && <div className="source-reactions" aria-hidden="true">
      {chat.map(item => <span key={item.key} className={`source-reaction${item.text === null ? ' source-reaction-join' : ''}`}>
        <b className="source-reaction-who">{item.who}</b> {item.text === null ? 'joined' : <PeopleText text={item.text} />}
      </span>)}
    </div>}
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
