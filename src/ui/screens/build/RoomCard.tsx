// The room cards and the "Next for the station" card. Each is one button: the room's painting, a line on
// what it does for people, the faces it helps, and the price last with small pips for what is built.
import { useEffect, useRef } from 'react';
import type { GameState, Id } from '../../../sim/types';
import { Face } from '../../components/Face';
import { officerFaceStatus } from '../../components/face-status';
import { Icon } from '../../icons';
import { funding } from '../../format';
import { turnIndex } from '../../people/story-line';
import { useStoryClock } from '../../people/story-clock';
import { Segments, type CostQuote } from '../build-parts';
import { PriceCapsule, type PriceTone } from '../../components/PriceCapsule';

/** A step's price as the capsule shows it (canvas Build): plain when it can be bought, warning when
 * funding is short, dashed behind a lock, a tick once everything is built. */
function CapsuleFor({ quote, next = false }: { quote: CostQuote; next?: boolean }) {
  const tone: PriceTone = quote.state === 'owned' ? 'owned' : quote.state === 'locked' ? 'locked' : quote.state === 'short' ? 'short' : next ? 'hot' : 'plain';
  return <PriceCapsule value={quote.price ?? 0} tone={tone} label={quote.state === 'owned' ? quote.done ?? 'Owned' : undefined} />;
}
import { RoomArt } from './Station';
import { nameList, nodeSummary, personById, roomFaces, roomLines, stepQuote, stepHelp, type GarageView, type RoomView } from './room-model';

/** Up to three faces, overlapped, through the same Face the rest of the game uses. Decorative: the
 * card's label names them. */
export function FaceStack({ game, ids, now, size = 'sm' }: { game: GameState; ids: readonly Id[]; now: number; size?: 'sm' | 'md' }) {
  if (!ids.length) return null;
  return <span className="face-stack" aria-hidden="true">{ids.map((id) => {
    const person = personById(game, id);
    if (!person) return null;
    return <Face key={id} size={size} kind="officer" officer={person} status={game.officers[id] ? officerFaceStatus(game, id, now) : null} />;
  })}</span>;
}

/** The card's one line of copy. It turns through what the room is for and a recorded fact about each person
 * it helps, on the shared story clock; reduced motion holds it on the first. Decorative: the card's own
 * label carries the first line. */
function RoomLine({ game, view, now }: { game: GameState; view: RoomView; now: number }) {
  const clock = useStoryClock();
  const lines = roomLines(game, view, now);
  // First paint says what the room is for; the turn starts with the clock.
  const shown = useRef<string | null>(null);
  const text = lines[clock.still || shown.current === null ? 0 : turnIndex(lines.length, clock.now, view.room.id)];
  // The line fades in only when it turns over, never on first paint.
  const turned = shown.current !== null && shown.current !== text;
  useEffect(() => { shown.current = text; });
  return <span key={text} className={turned ? 'room-line room-line-turned' : 'room-line'}>{text}</span>;
}

export function RoomCard({ game, view, now, onOpen }: { game: GameState; view: RoomView; now: number; onOpen: () => void }) {
  const { room, next, state } = view;
  const faces = roomFaces(game, view);
  const quote = next ? stepQuote(next, game.department.funding) : { state: 'owned' as const, done: 'All built' };
  const label = [
    `${room.name}. ${view.open ? 'Open' : 'Closed'}.`, room.line,
    faces.length ? `Helps ${nameList(game, faces)}.` : '',
    next ? `Next step ${next.node.name}${quote.price ? `, ${next.quote.ok ? '' : 'not yet affordable, '}${funding(quote.price)}` : ''}.` : 'Every step is built.',
  ].filter(Boolean).join(' ');
  // One row (canvas Build): the room's painting, its name, its line and its level pips, the price at the trail.
  return <button type="button" className="room-card" data-room={room.id} data-state={state} data-open={view.open ? 'yes' : undefined} aria-label={label} onClick={onOpen}>
    <RoomArt room={room} open={view.open} />
    <span className="room-main" aria-hidden="true">
      <span className="room-title">{room.name}</span>
      <RoomLine game={game} view={view} now={now} />
      <Segments done={view.owned} total={view.total} />
    </span>
    <span className="room-trail" aria-hidden="true"><CapsuleFor quote={quote} /></span>
  </button>;
}

/** The garage is the patrol workforce's room: the card says how many are on the street, and taps through
 * to Team on Patrol. */
export function GarageCard({ garage, onOpen }: { garage: GarageView; onOpen: () => void }) {
  const { room, employed, capacity, next } = garage;
  const more = next ? `Level ${next.level} adds ${next.positions - capacity} places` : 'Every place is open';
  return <button type="button" className="room-card" data-room="garage" data-state="lit" data-open="yes"
    aria-label={`${room.name}. ${employed} of ${capacity} patrol positions filled. ${more}. Opens Team, Patrol.`} onClick={onOpen}>
    <RoomArt room={room} open />
    <span className="room-main" aria-hidden="true">
      <span className="room-title">{room.name}</span>
      <span className="room-line">{employed === 0 ? 'The bays are empty. Hire patrol officers in Team.' : `${employed} on the beat, ${capacity - employed} places free.`}</span>
    </span>
    <span className="room-trail" aria-hidden="true">
      <span className="cost-quote" data-state="owned"><span className="cost-quote-value"><Icon name="people" size={16} />{employed}</span></span>
      <Segments done={employed} total={capacity} />
      <span className="room-note">{more}</span>
    </span>
  </button>;
}

/** "Next for the station": the one room worth opening or growing now, with who it helps. */
export function NextCard({ game, view, now, onOpen }: { game: GameState; view: RoomView; now: number; onOpen: () => void }) {
  const step = view.next!;
  const help = stepHelp(game, step);
  const faces = help.faces.slice(0, 3);
  const quote = stepQuote(step, game.department.funding);
  return <button type="button" className="next-card" data-room={view.room.id}
    aria-label={`Next for the station: ${step.node.name} in the ${view.room.name}. ${help.effect}. ${faces.length ? `Helps ${nameList(game, faces)}. ` : ''}${quote.price ? funding(quote.price) : ''}. Ready to build.`} onClick={onOpen}>
    <RoomArt room={view.room} open={view.open} />
    <span className="next-main" aria-hidden="true">
      <span className="next-eyebrow">Next for the station</span>
      <strong className="next-title">{step.node.name}</strong>
      <span className="room-line">{view.room.name}. {nodeSummary(step)}</span>
      <FaceStack game={game} ids={faces} now={now} />
    </span>
    <span className="room-trail" aria-hidden="true"><CapsuleFor quote={quote} next /></span>
  </button>;
}
