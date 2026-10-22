// The HQ cutaway: the department building as a picture of its state. Rooms are not buttons to the
// tabs (docs/ui-ux-audit.md, "HQ"); a room speaks with a pin only when something in it needs the
// player, and a pin that leads somewhere is a button. Without the painting the pins sit on a plain
// block, so the hub reads the same without the image.
import { useState } from 'react';
import { plateUrl } from '../art/Plates';
import './hub.css';

export type HubRoom = 'dispatch' | 'training' | 'lockers' | 'armory' | 'briefing' | 'garage';
export interface HubPin {
  room: HubRoom;
  text: string;
  /** act: the player's move (a call waits); harm: something is going wrong. */
  tone?: 'act' | 'harm';
  onOpen?: () => void;
}

/** Where each room's pin stands on the cropped painting (hub_hq.webp), left or right column and
 * the room's height as a share of the frame. */
const PIN_AT: Record<HubRoom, { side: 'left' | 'right'; top: number }> = {
  dispatch: { side: 'left', top: 17 }, training: { side: 'right', top: 17 },
  lockers: { side: 'left', top: 49 }, armory: { side: 'right', top: 49 },
  briefing: { side: 'left', top: 78 }, garage: { side: 'right', top: 78 },
};

export function Hub({ pins }: { pins: HubPin[] }) {
  const src = plateUrl('hub_hq');
  const [failed, setFailed] = useState(false);
  const painted = !!src && !failed;
  return <section className={`hub${painted ? '' : ' hub-plain'}`} aria-label="Headquarters">
    {painted && <img className="hub-art" src={src} alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFailed(true)} />}
    {pins.length > 0 && <ul className="hub-pins">
      {pins.map((pin) => {
        const at = PIN_AT[pin.room];
        const body = <>{pin.tone === 'act' && <i className="hub-dot" aria-hidden="true" />}{pin.text}</>;
        return <li key={pin.room} className={`hub-pin${pin.tone ? ` hub-pin-${pin.tone}` : ''}`} style={{ top: `${at.top}%`, [at.side]: 'var(--sp4)' }}>
          {pin.onOpen ? <button type="button" onClick={pin.onOpen}>{body}</button> : <span>{body}</span>}
        </li>;
      })}
    </ul>}
  </section>;
}
