// The HQ hub: the department building in cutaway, the familiar home screen of management games,
// each room a labeled button to the place it stands for. The painting is decoration; every room is
// a real button with its own name and status, and they read in order as a list, so the hub works
// without the image (a failed file shows the same buttons on a plain building block).
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import { plateUrl } from '../art/Plates';
import './hub.css';

export interface HubRoom {
  id: string;
  label: string;
  icon: IconName;
  /** One short status, such as "3 calls" or "1 place free". */
  status: string;
  /** Something the player can act on now: the room's badge lights. */
  alert?: boolean;
  onOpen(): void;
}

/** Where each room sits on the painting, as percentages of its width and height (hub_hq.webp). */
const ROOM_BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  dispatch: { x: 7.5, y: 20.5, w: 40.5, h: 17 },
  training: { x: 52, y: 20.5, w: 40.5, h: 17 },
  lockers: { x: 7.5, y: 41, w: 40.5, h: 18 },
  armory: { x: 52, y: 41, w: 40.5, h: 18 },
  briefing: { x: 7.5, y: 62, w: 40.5, h: 19 },
  garage: { x: 52, y: 62, w: 40.5, h: 19 },
};

export function Hub({ title, kicker, line, rooms }: { title: string; kicker: string; line: string; rooms: HubRoom[] }) {
  const src = plateUrl('hub_hq');
  const [failed, setFailed] = useState(false);
  const painted = !!src && !failed;
  return <section className={`hub${painted ? '' : ' hub-plain'}`} aria-label="Headquarters">
    {painted && <img className="hub-art" src={src} alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFailed(true)} />}
    <header className="hub-sign">
      <span className="hub-kicker">{kicker}</span>
      <h2 className="hub-title">{title}</h2>
      <p className="hub-line">{line}</p>
    </header>
    <ul className="hub-rooms">
      {rooms.map((room) => {
        const box = ROOM_BOX[room.id];
        const style = box ? { '--x': `${box.x}%`, '--y': `${box.y}%`, '--w': `${box.w}%`, '--h': `${box.h}%` } as CSSProperties : undefined;
        return <li key={room.id} className="hub-room" style={style}>
          <button type="button" onClick={room.onOpen} className={room.alert ? 'hub-room-alert' : undefined} aria-label={`${room.label}: ${room.status}`}>
            <span className="hub-pin">
              <Icon name={room.icon} size={15} />
              <span className="hub-pin-text"><b>{room.label}</b><small>{room.status}</small></span>
              {room.alert && <i className="hub-badge" aria-hidden="true" />}
            </span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}
