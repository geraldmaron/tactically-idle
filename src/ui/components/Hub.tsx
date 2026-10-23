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
  detail?: string;
  /** act: the player's move (a call waits); harm: something is going wrong. */
  tone?: 'act' | 'harm';
  onOpen?: () => void;
}

/** A compact department scene. State chips name actual conditions, not invented room positions. */
export function Hub({ pins, title, meta }: { pins: HubPin[]; title?: string; meta?: string }) {
  const src = plateUrl('hub_hq');
  const [failed, setFailed] = useState(false);
  const painted = !!src && !failed;
  return <section className={`hub${painted ? '' : ' hub-plain'}`} aria-label="Headquarters">
    {painted && <img className="hub-art" src={src} alt="" aria-hidden="true" decoding="async" draggable={false} onError={() => setFailed(true)} />}
    {title && <div className="hub-identity"><span>{meta}</span><h1>{title}</h1></div>}
    {pins.length > 0 && <ul className="hub-pins">
      {pins.map((pin) => {
        const body = <>{pin.tone === 'act' && <i className="hub-dot" aria-hidden="true" />}<span className="hub-pin-text"><strong>{pin.text}</strong>{pin.detail && <span>{pin.detail}</span>}</span></>;
        return <li key={pin.room} className={`hub-pin${pin.tone ? ` hub-pin-${pin.tone}` : ''}`}>
          {pin.onOpen ? <button type="button" onClick={pin.onOpen}>{body}</button> : <span>{body}</span>}
        </li>;
      })}
    </ul>}
  </section>;
}
