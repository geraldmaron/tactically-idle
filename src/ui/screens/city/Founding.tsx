import { useId, useState } from 'react';
import { DISTRICT_ORDER } from '../../../content/city/tuning';
import { DISTRICTS } from '../../../content/city/districts';
import { cityView, type DistrictView } from '../../../sim/world/selectors';
import type { DistrictId } from '../../../sim/world/types';
import { useGame } from '../../store';
import { Button } from '../../components/ui';
import { Face } from '../../components/Face';
import { useChromeMode } from '../../components/chrome';
import { useToast } from '../../components/toast';
import { clockStamp } from './clock';
import { crimeBand } from './district';
import { firstCallOfficers, firstSentences } from './first-call';
import './city-onboarding.css';

const DEFAULT_NAME = 'Night Unit';
/** The starting choices the canvas shows: the first three districts. */
// The districts a new department may start in (content/city/districts.ts `startable`), as the engine allows.
const CHOICES = DISTRICT_ORDER.filter((id) => DISTRICTS[id].startable);

/** A2, take command: the call's result in a line, the faces, a name for the unit and a starting district. The
 * districts above the department's level show as locked: `foundDepartment` only opens what the level allows. */
export function Founding() {
  useChromeMode('focus');
  const g = useGame();
  const { act } = useToast();
  const nameId = useId();
  const [name, setName] = useState(DEFAULT_NAME);
  const [district, setDistrict] = useState<DistrictId>('pike');
  const at = Math.max(Date.now(), g.department.clockHighWater);
  const debrief = g.debriefs[0];
  const view = cityView(g);
  const choices = CHOICES.map((id) => view.districts.find((d) => d.id === id)!).filter(Boolean);
  const officers = debrief
    ? debrief.officerCondition.map((row) => g.officers[row.officerId]).filter((o) => !!o).slice(0, 4)
    : firstCallOfficers(g, at);
  const remembered = officers.filter((o) => g.people.facts.some((f) => f.officerId === o.id && f.kind === 'first_call')).length;
  const result = firstSentences(debrief?.endingSummary ?? debrief?.endingTitle, 2, 200);
  const valid = name.trim().length >= 2 && name.trim().length <= 40;
  const start = () => { act({ type: 'foundDepartment', name, districtId: district }); };
  return (
    <main className="found" aria-labelledby="found-title">
      <header className="found-head">
        <p className="found-kicker">CALL CLOSED · {clockStamp(g, at).time}</p>
        <h1 id="found-title" className="found-title">Take command</h1>
        {result && <p className="found-result">{result}</p>}
      </header>
      {officers.length > 0 && <div className="found-team">
        <span className="found-stack" role="list" aria-label="Your officers">{officers.map((o) => <span key={o.id} role="listitem"><Face size="md" kind="officer" officer={o} name={`${o.firstName} ${o.surname}`} /></span>)}</span>
        <span className="found-team-line">{remembered === officers.length && officers.length > 0 ? `${officers.length === 4 ? 'Four' : officers.length} officers, and a first memory each in their jackets.` : `${officers.length} ${officers.length === 1 ? 'officer' : 'officers'} on that first call.`}</span>
      </div>}
      <div className="found-field">
        <label htmlFor={nameId} className="found-label">NAME YOUR UNIT</label>
        <input id={nameId} className="found-input" type="text" value={name} maxLength={40} autoComplete="off" spellCheck={false} onChange={(e) => setName(e.target.value)} />
      </div>
      <fieldset className="found-districts">
        <legend className="found-label">WHERE YOUR PATROL STARTS</legend>
        {choices.map((d) => <DistrictCard key={d.id} d={d} checked={district === d.id} onPick={() => setDistrict(d.id)} />)}
      </fieldset>
      <Button variant="primary" block data-primary className="found-go" disabled={!valid} onClick={start}>Start the first shift</Button>
    </main>
  );
}

function DistrictCard({ d, checked, onPick }: { d: DistrictView; checked: boolean; onPick: () => void }) {
  // Every starting district can be chosen at founding, whatever its later opening level.
  const locked = !DISTRICTS[d.id].startable;
  return <label className="found-card" data-checked={checked || undefined} data-locked={locked || undefined}>
    <input type="radio" name="district" value={d.id} checked={checked} disabled={locked} onChange={onPick} />
    <span className="found-card-main">
      <span className="found-card-top"><b>{d.name}</b><span className="found-card-crime" data-band={crimeBand(d.crime)}>CRIME {Math.round(d.crime)}</span></span>
      <span className="found-bar" aria-hidden="true"><i data-band={crimeBand(d.crime)} style={{ width: `${Math.round(d.crime)}%` }} /></span>
      <span className="found-card-line">{locked ? `Opens at department level ${d.openAtLevel}. ${d.blurb}` : d.blurb}</span>
    </span>
  </label>;
}
