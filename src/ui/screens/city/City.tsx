import { useState } from 'react';
import { cityView, type CityView, type DistrictView } from '../../../sim/world/selectors';
import type { DistrictId } from '../../../sim/world/types';
import type { GameState } from '../../../sim/types';
import { useGame } from '../../store';
import { Row, Section } from '../../components/ui';
import { Funds } from '../../components/Funds';
import { openReport, useReportOpen } from '../../components/WelcomeBack';
import { Icon } from '../../icons';
import { awayText, clockStamp } from './clock';
import { CityMap, type MapMarks } from './CityMap';
import { crimeBand, crimeSpoken } from './district';
import { DistrictSheet } from './DistrictSheet';
import { FirstCustody } from './FirstCustody';
import { armedLive } from './now';
import { NowStrip } from './NowStrip';
import { Radio } from './Radio';
import { Debriefs } from './Results';
import './city.css';

/** Where the map pins a live call: an armed contact the player can answer now. */
function marksFor(g: GameState, view: CityView, at: number): MapMarks {
  const armed = g.world.leads.find((l) => armedLive(l, at));
  const squads: MapMarks['squads'] = {};
  for (const shift of view.shifts) squads[shift.districtId] = shift.squadId;
  return { live: armed?.districtId ?? null, squads };
}

/** The City tab (B1): the map, the radio, the one thing waiting, and the districts as a readable list. */
export function City() {
  const g = useGame();
  const [open, setOpen] = useState<DistrictId | null>(null);
  const now = Date.now();
  const at = Math.max(now, g.department.clockHighWater);
  const view = cityView(g);
  const stamp = clockStamp(g, at);
  return (
    <>
      <div className="city">
        <header className="city-head">
          <span>DAY {stamp.day} · {stamp.time}</span>
          <span>CITY CRIME {Math.round(view.allocation.crime)}</span>
        </header>
        <CityMap view={view} marks={marksFor(g, view, at)} onOpen={setOpen} />
        <div className="city-body">
          <SinceYouLeft g={g} />
          <Radio g={g} view={view} />
          <NowStrip g={g} at={at} />
          <Section id="city-districts" title="Districts" icon="city" well count={`${view.districts.filter((d) => d.open).length} open of ${view.districts.length}`}>
            {view.districts.map((d) => <DistrictRow key={d.id} d={d} onOpen={() => setOpen(d.id)} />)}
          </Section>
          <Debriefs g={g} now={now} />
        </div>
      </div>
      <DistrictSheet id={open} onClose={() => setOpen(null)} />
      <FirstCustody />
    </>
  );
}

function DistrictRow({ d, onOpen }: { d: DistrictView; onOpen: () => void }) {
  const facts = d.open
    ? [crimeSpoken(d), `${d.units} ${d.units === 1 ? 'unit' : 'units'}`, d.shift ? `Squad ${d.shift.squadId} on shift` : '', d.leads ? `${d.leads} ${d.leads === 1 ? 'lead' : 'leads'}` : ''].filter(Boolean).join(' · ')
    : d.canOpen ? 'Ready to open' : `Opens at department level ${d.openAtLevel}`;
  return <Row onClick={onOpen} className="city-row" data={{ 'data-district': d.id }}
    label={`${d.name}. ${facts}`}
    lead={d.open ? <span className="city-crime" data-band={crimeBand(d.crime)}>{Math.round(d.crime)}</span> : <span className="city-crime city-crime-locked"><Icon name="lock" size={18} /></span>}
    title={d.name} detail={facts} trail={<Icon name="chevronRight" size={16} />} />;
}

/** A report the player has not acknowledged: a slim row that reopens it, with the net it credited. */
function SinceYouLeft({ g }: { g: GameState }) {
  const report = g.report;
  const open = useReportOpen();
  if (!report || open) return null;
  const world = report.world;
  return <button type="button" className="city-since" onClick={openReport} aria-label={`While you were off, ${awayText(report.to - report.from)}. Net ${report.net < 0 ? 'minus ' : ''}${Math.abs(Math.round(report.net))} funding. Open the report`}>
    <Icon name="clock" size={18} />
    <span className="city-since-main"><b>While you were off</b><span>{awayText(report.to - report.from)}{world && world.casesClosed ? ` · ${world.casesClosed} ${world.casesClosed === 1 ? 'case' : 'cases'} closed` : ''}</span></span>
    <span className={`city-since-net ${report.net < 0 ? 'tone-danger' : 'tone-mint'}`}><Funds value={report.net} format="signed" /></span>
    <Icon name="chevronRight" size={16} />
  </button>;
}
