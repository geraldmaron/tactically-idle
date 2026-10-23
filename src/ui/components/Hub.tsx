// The HQ plate: the department building painted at the shared plate height, the department's name
// and the date on it. It shows a painted tone on the first frame, so the title never sits on a blank
// band while the painting loads. Facts that repeat on the screen (calls waiting, squads ready, patrol
// coverage) are not repeated here; a pin appears only for something the screen below does not say.
import { useState } from 'react';
import { plateUrl } from '../art/Plates';
import { Button, Chip } from './ui';
import './hub.css';

export interface HubPin {
  room: string;
  text: string;
  /** harm: something is going wrong. */
  tone?: 'harm';
  onOpen?: () => void;
}

export function Hub({ pins, title, meta }: { pins: HubPin[]; title?: string; meta?: string }) {
  const src = plateUrl('hub_hq');
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const painted = !!src && state !== 'failed';
  return <section className={`hub${painted ? '' : ' hub-plain'}`} aria-label="Headquarters">
    <div className={`hub-plate${state === 'loaded' ? ' hub-plate-loaded' : ''}`}>
      {painted && <img className="hub-art" src={src} alt="" aria-hidden="true" decoding="async" draggable={false} onLoad={() => setState('loaded')} onError={() => setState('failed')} />}
      {title && <div className="hub-identity"><h1>{title}</h1>{meta && <span>{meta}</span>}</div>}
    </div>
    {pins.length > 0 && <ul className="hub-pins">
      {pins.map((pin) => <li key={pin.room}>
        {pin.onOpen ? <Button size="sm" variant="quiet" onClick={pin.onOpen}>{pin.text}</Button> : <Chip tone={pin.tone === 'harm' ? 'harm' : 'neutral'}>{pin.text}</Chip>}
      </li>)}
    </ul>}
  </section>;
}
