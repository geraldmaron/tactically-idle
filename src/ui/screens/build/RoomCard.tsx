// The room cards and the "Next for the station" card. Each is one button: the room's painting, a line on
// what it does for people, the faces it helps, and the price last with small pips for what is built.
import type { GameState, Id } from '../../../sim/types';
import { Face } from '../../components/Face';
import { officerFaceStatus } from '../../components/face-status';
import { Icon } from '../../icons';
import { moneyFull } from '../../format';
import { CostTag, Segments } from '../build-parts';
import { RoomArt } from './Station';
import { nameList, nodeSummary, personById, roomFaces, stepQuote, stepHelp, type GarageView, type RoomView } from './room-model';

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

export function RoomCard({ game, view, now, onOpen }: { game: GameState; view: RoomView; now: number; onOpen: () => void }) {
  const { room, next, state } = view;
  const faces = roomFaces(game, view);
  const quote = next ? stepQuote(next, game.department.funding) : { state: 'owned' as const, done: 'All built' };
  const label = [
    `${room.name}. ${view.open ? 'Open' : 'Closed'}.`, room.line,
    faces.length ? `Helps ${nameList(game, faces)}.` : '',
    next ? `Next step ${next.node.name}${quote.price ? `, ${next.quote.ok ? '' : 'not yet affordable, '}${moneyFull(quote.price)}` : ''}.` : 'Every step is built.',
  ].filter(Boolean).join(' ');
  return <button type="button" className="room-card" data-room={room.id} data-state={state} data-open={view.open ? 'yes' : undefined} aria-label={label} onClick={onOpen}>
    <RoomArt room={room} open={view.open} />
    <span className="room-main" aria-hidden="true">
      <span className="room-title">{room.name}</span>
      <span className="room-line">{room.line}</span>
      <FaceStack game={game} ids={faces} now={now} />
    </span>
    <span className="room-trail" aria-hidden="true">
      {state === 'ready' ? <span className="room-status" data-state="ready"><Icon name="check" size={16} />Ready</span> : !view.open ? <span className="room-status" data-state="closed"><Icon name="lock" size={16} />Closed</span> : null}
      <CostTag part="value" quote={quote} />
      <Segments done={view.owned} total={view.total} />
    </span>
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
    aria-label={`Next for the station: ${step.node.name} in the ${view.room.name}. ${help.effect}. ${faces.length ? `Helps ${nameList(game, faces)}. ` : ''}${quote.price ? moneyFull(quote.price) : ''}. Ready to build.`} onClick={onOpen}>
    <RoomArt room={view.room} open={view.open} />
    <span className="next-main" aria-hidden="true">
      <span className="next-eyebrow">Next for the station</span>
      <strong className="next-title">{step.node.name}</strong>
      <span className="room-line">{view.room.name}. {nodeSummary(step)}</span>
      <FaceStack game={game} ids={faces} now={now} />
    </span>
    <span className="room-trail" aria-hidden="true"><CostTag part="value" quote={quote} /></span>
  </button>;
}
