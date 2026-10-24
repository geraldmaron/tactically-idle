import { useMemo, useState } from 'react';
import { CRIME, DISTRICT_ORDER } from '../../../content/city/tuning';
import { employedPatrol } from '../../../sim/patrol';
import { BAND_LABEL, stressBand } from '../../../sim/officer';
import { coverageRefusal, crewLadder, districtView, shiftPreview, type DistrictView } from '../../../sim/world/selectors';
import type { DistrictId } from '../../../sim/world/types';
import type { GameState, Officer, SquadId } from '../../../sim/types';
import { useGame } from '../../store';
import { Button, Section, Segmented, Stepper } from '../../components/ui';
import { Face } from '../../components/Face';
import { Funds } from '../../components/Funds';
import { Sheet } from '../../components/Sheet';
import { useNav } from '../../components/nav';
import { useToast } from '../../components/toast';
import { Icon } from '../../icons';
import { duration, moneyFull } from '../../format';
import { crewSummary, crimeBand, moodLine, projectCrime, sparklinePoints, type CrewSummary } from './district';
import './city-district.css';

const HOURS = [2, 4, 8] as const;
type Hours = (typeof HOURS)[number];

/** The district sheet (B2): how the district feels, its crew, patrol coverage and the proactive shift. */
export function DistrictSheet({ id, onClose }: { id: DistrictId | null; onClose: () => void }) {
  const g = useGame();
  const [pick, setPick] = useState<{ squadId: SquadId | null; hours: Hours }>({ squadId: null, hours: 4 });
  if (!id) return <Sheet open={false} onClose={onClose} title="District">{null}</Sheet>;
  const view = districtView(g, id);
  // The squad the shift would use: the player's pick, else the first squad that is not already out on one.
  const free = g.squads.find((s) => !g.world.shifts.some((x) => x.squadId === s.id && x.stoppedAt === undefined))?.id ?? g.squads[0]?.id ?? 'A';
  const choice: ShiftChoice = { squadId: pick.squadId && g.squads.some((s) => s.id === pick.squadId) ? pick.squadId : free, hours: pick.hours };
  const update = (patch: Partial<ShiftChoice>) => setPick({ ...choice, ...patch });
  return <Sheet open onClose={onClose} title={view.name} subtitle={view.open ? moodLine(view) : view.blurb} className="district-sheet"
    footer={view.open ? <ShiftFooter g={g} view={view} choice={choice} onClose={onClose} /> : <OpenFooter view={view} onClose={onClose} />}>
    {view.open ? <OpenBody g={g} view={view} choice={choice} update={update} onClose={onClose} /> : <LockedBody view={view} />}
  </Sheet>;
}

interface ShiftChoice { squadId: SquadId; hours: Hours }

function OpenBody({ g, view, choice, update, onClose }: { g: GameState; view: DistrictView; choice: ShiftChoice; update: (patch: Partial<ShiftChoice>) => void; onClose: () => void }) {
  const nav = useNav();
  const { act } = useToast();
  const total = employedPatrol(g).length;
  // The home district only loses staff when another district takes them, so its step down is off: the engine
  // would refuse it (world/commands.ts coverageRefusal), and a button that always fails is worse than none.
  const floor = coverageRefusal(g, view.id, view.assigned - 1) ? view.assigned : 0;
  const projection = projectCrime(view);
  const end = projection[projection.length - 1];
  const index = DISTRICT_ORDER.indexOf(view.id) + 1;
  const crews = view.crews.filter((c) => c.status === 'active').map((c) => crewLadder(g, c.id)).filter((l) => !!l).map((l) => crewSummary(l!));
  return (
    <div className="district">
      <div className="district-crime">
        <div className="district-crime-main">
          <span className="district-kicker">DISTRICT {index} OF {DISTRICT_ORDER.length}</span>
          <b className="district-crime-num" data-band={crimeBand(view.crime)}>{Math.round(view.crime)}</b>
          <span className="district-crime-word">crime, {view.trend}</span>
        </div>
        <div className="district-spark">
          <svg width="88" height="28" viewBox="0 0 88 28" role="img" aria-label={`Crime heading from ${Math.round(view.crime)} to ${Math.round(end)} over the next 7 hours at today's coverage`}>
            <polyline points={sparklinePoints(projection, 88, 28)} data-band={crimeBand(view.crime)} />
          </svg>
          <span className="district-kicker">NEXT 7 HOURS</span>
        </div>
      </div>

      {crews.map((crew) => <CrewCard key={crew.id} crew={crew} onOpen={() => { onClose(); nav.go('ops'); }} />)}
      {crews.length === 0 && <p className="district-note">No crew is working here now. Crime settles on patrol alone.</p>}

      <section className="district-card district-patrol" aria-label="Patrol coverage">
        <span className="district-card-text"><b>Patrol units</b><span>Each pulls crime down about {CRIME.perUnit} and meets more people.</span></span>
        <span className="district-patrol-step">
          <Stepper label="patrol units here" value={view.assigned} min={floor} max={total} onChange={(units) => act({ type: 'setDistrictCoverage', districtId: view.id, units })} />
          <span className="district-kicker">OF {total}</span>
        </span>
      </section>

      <ShiftPanel g={g} view={view} pick={choice} update={update} />
    </div>
  );
}

function CrewCard({ crew, onOpen }: { crew: CrewSummary; onOpen: () => void }) {
  return <button type="button" className="district-card district-crew" onClick={onOpen} aria-label={`${crew.name}. ${crew.tiers.map((t) => t.text).join(', ')}. ${crew.warrantReady ? 'Warrant ready. ' : ''}Open investigations`}>
    <span className="district-crest" aria-hidden="true">{crew.initials}</span>
    <span className="district-card-text">
      <b>{crew.name}</b>
      <span className="district-tiers">{crew.tiers.map((t) => <span key={t.tier} data-warrant={t.warrant || undefined}>{t.text}</span>)}</span>
    </span>
    {crew.warrantReady ? <span className="district-warrant">Warrant ready</span> : <Icon name="chevronRight" size={16} />}
  </button>;
}

function strainBar(start: number, end: number) {
  return { start: Math.max(0, Math.min(100, start)), end: Math.max(0, Math.min(100, end)) };
}

function ShiftPanel({ g, view, pick, update }: { g: GameState; view: DistrictView; pick: ShiftChoice; update: (patch: Partial<ShiftChoice>) => void }) {
  const at = g.department.clockHighWater;
  const shift = view.shift;
  const preview = useMemo(() => shiftPreview(g, pick.squadId, view.id, pick.hours), [g, pick.squadId, pick.hours, view.id]);
  const squad = g.squads.find((s) => s.id === pick.squadId);
  const members = (squad?.officerIds ?? []).map((id) => g.officers[id]).filter((o): o is Officer => !!o);

  if (shift) {
    const running = g.squads.find((s) => s.id === shift.squadId)?.name ?? `Squad ${shift.squadId}`;
    return <section className="district-card district-shift" aria-label="Proactive shift">
      <div className="district-shift-head"><span className="district-kicker district-kicker-live">SWAT PROACTIVE SHIFT</span><span className="district-muted">{running}</span></div>
      <p className="district-line"><b>{running} is on a shift here.</b> It ends in {duration(Math.max(0, shift.endsAt - at))}. {shift.contacts === 0 ? 'No stops yet.' : shift.contacts === 1 ? 'One stop so far.' : `${shift.contacts} stops so far.`}</p>
    </section>;
  }

  const strainEach = preview.stress.length ? Math.round(preview.stress[0].end - preview.stress[0].start) : 0;
  return <section className="district-card district-shift" aria-label="Proactive shift">
    <div className="district-shift-head"><span className="district-kicker district-kicker-live">SWAT PROACTIVE SHIFT</span>
      {g.squads.length <= 1 && <span className="district-muted">{squad?.name}</span>}</div>
    {g.squads.length > 1 && <Segmented label="Squad for the shift" value={pick.squadId} onChange={(squadId) => update({ squadId })}
      options={g.squads.map((s) => ({ value: s.id, label: s.name }))} />}
    <div className="district-crew-faces" role="list" aria-label={`${squad?.name ?? 'Squad'} on the shift`}>
      {members.map((o) => {
        const row = preview.stress.find((s) => s.officerId === o.id);
        const bar = strainBar(row?.start ?? o.stress, row?.end ?? o.stress);
        const band = stressBand(bar.end);
        return <div key={o.id} className="district-member" role="listitem" aria-label={`${o.surname}, stress ${Math.round(bar.start)}, ends near ${Math.round(bar.end)}, ${BAND_LABEL[band].toLowerCase()}`}>
          <Face size="md" kind="officer" officer={o} />
          <span className="district-member-name">{o.surname}</span>
          <span className="district-bar" aria-hidden="true"><i data-band={stressBand(bar.start)} style={{ width: `${bar.start}%` }} /><i className="district-bar-gain" data-band={band} style={{ left: `${bar.start}%`, width: `${Math.max(0, bar.end - bar.start)}%` }} /></span>
          <span className="district-member-end" data-band={band}>{`→ ${Math.round(bar.end)}`}</span>
        </div>;
      })}
    </div>
    <Segmented label="Shift length" value={String(pick.hours) as `${Hours}`} onChange={(value) => update({ hours: Number(value) as Hours })}
      options={HOURS.map((h) => ({ value: String(h) as `${Hours}`, label: `${h} h` }))} />
    <dl className="district-facts">
      <div><dt>Likely case funding</dt><dd><Funds value={preview.awardP10} format="full" /> to {moneyFull(preview.awardP90)}</dd></div>
      <div><dt>Chance of a lieutenant lead</dt><dd className="district-fact-intel">{Math.round(preview.leadChance * 100)}%</dd></div>
      <div><dt>Strain, each officer</dt><dd className="district-fact-strain">{`+${strainEach}`}</dd></div>
      <div><dt>A call elsewhere</dt><dd className="district-fact-plain">Recalled at once, then travel</dd></div>
    </dl>
    <p className="district-line">
      {preview.stopsEarly ? `The shift stops after ${Math.floor(preview.hours)} h, before anyone reaches Overloaded. ` : 'It stops early if anyone nears Overloaded. '}
      An armed contact while you are here can be answered live, or kept as a lead.
    </p>
    {!preview.ok && preview.reason && <p className="district-block" role="status"><Icon name="lock" size={16} />{preview.reason}</p>}
  </section>;
}

function ShiftFooter({ g, view, choice: pick, onClose }: { g: GameState; view: DistrictView; choice: ShiftChoice; onClose: () => void }) {
  const { act } = useToast();
  const preview = useMemo(() => shiftPreview(g, pick.squadId, view.id, pick.hours), [g, pick.squadId, pick.hours, view.id]);
  if (view.shift) {
    const squadId = view.shift.squadId;
    return <Button variant="quiet" block icon="refresh" onClick={() => act({ type: 'recallProactiveShift', squadId }, 'Squad recalled')}>Recall the squad</Button>;
  }
  return <Button variant="primary" block data-primary disabled={!preview.ok}
    onClick={() => { if (act({ type: 'startProactiveShift', squadId: pick.squadId, districtId: view.id, hours: pick.hours }, `${pick.hours}-hour shift started`).ok) onClose(); }}>
    Start {pick.hours}-hour shift
  </Button>;
}

function LockedBody({ view }: { view: DistrictView }) {
  return <div className="district">
    <Section title="Who lives here" icon="house" level="h3">
      <ul className="district-residents">{view.residents.map((name) => <li key={name}>{name}</li>)}</ul>
    </Section>
    <p className="district-note">{view.canOpen ? `${view.name} is open for your department. Opening it adds its crews, its calls and a place for patrol.` : `${view.name} opens at department level ${view.openAtLevel}.`}</p>
  </div>;
}

function OpenFooter({ view, onClose }: { view: DistrictView; onClose: () => void }) {
  const { act } = useToast();
  if (!view.canOpen) return <Button variant="quiet" block icon="lock" disabled>{`Opens at level ${view.openAtLevel}`}</Button>;
  return <Button variant="primary" block data-primary onClick={() => { if (act({ type: 'openDistrict', districtId: view.id }, `${view.name} opened`).ok) onClose(); }}>Open {view.name}</Button>;
}
