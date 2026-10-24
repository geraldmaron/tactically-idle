import type { CityView } from '../../../sim/world/selectors';
import type { GameState } from '../../../sim/types';
import { DISTRICTS } from '../../../content/city/districts';
import { Funds } from '../../components/Funds';
import { radioItems } from './radio-lines';
import './city-panels.css';

/** The radio panel (B1): the three newest lines in mono with their times, and who is out. */
export function Radio({ g, view }: { g: GameState; view: CityView }) {
  const items = radioItems(g, 3);
  const units = view.districts.reduce((sum, d) => sum + d.units, 0);
  const shifts = view.shifts.map((s) => `Squad ${s.squadId} on ${DISTRICTS[s.districtId].name.split(' ')[0]}`);
  const status = [`${units} ${units === 1 ? 'unit' : 'units'}`, ...shifts].join(' · ').toUpperCase();
  return (
    <section className="city-radio" aria-label="Radio">
      <div className="city-radio-head"><span>RADIO</span><span>{status}</span></div>
      {items.length === 0
        ? <p className="city-radio-quiet">Quiet on the radio. The first calls come in as patrol works the streets.</p>
        : <ol className="city-radio-lines">{items.map((item) => <li key={item.id}> 
          <span className="city-radio-time">{item.time}</span>
          <span className="city-radio-text" data-tone={item.tone}>{item.who} · {item.place} · {item.text}{item.amount ? <> · <Funds value={item.amount} format="signed" /></> : null}</span>
        </li>)}</ol>}
    </section>
  );
}
