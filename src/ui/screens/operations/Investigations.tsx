import type { ReactNode } from 'react';
import { DISTRICTS } from '../../../content/city/districts';
import { cityView, crewLadder, type CrewLadder, type LadderMember, type LadderTier } from '../../../sim/world/selectors';
import type { GameState } from '../../../sim/types';
import { EmptyState } from '../../components/ui';
import { useGame } from '../../store';
import { Dossier } from './Dossier';
import { WarrantPrep } from './WarrantPrep';
import { crewLine, memberState, shortName, tierCells, tierCounts, type CardState, type CellKind } from './model';
import { opsView, useOpsView } from './view';

const STATE_TAG: Record<CardState, (m: LadderMember) => string> = {
  ready: () => 'WARRANT READY',
  board: () => 'ON THE BOARD',
  held: () => 'HELD',
  known: () => 'KNOWN',
  intel: (m) => `INTEL ${m.intel} OF ${m.intelNeed}`,
  unknown: (m) => m.intelNeed !== null ? `INTEL ${m.intel} OF ${m.intelNeed}` : '',
};

/** Investigations (C1): the crews as chips, then the chosen crew's ladder on a dotted board, tier 4 at the top. A
 * known person opens their dossier. A person the player has not met is a dashed card and a number, never a name. */
export function Investigations() {
  const g = useGame();
  const view = useOpsView();
  const city = cityView(g);
  const crews = city.districts.filter((d) => d.open).flatMap((d) => d.crews.filter((c) => c.status === 'active'));
  if (view.prepLeadId) return <WarrantPrep leadId={view.prepLeadId} />;
  if (view.subjectId) return <Dossier subjectId={view.subjectId} />;
  if (crews.length === 0) return <div className="page"><EmptyState spot="noCalls" title="No crews on the file yet">Patrol and proactive shifts turn up the people who work a district. Their names land here as they are met.</EmptyState></div>;
  const crew = crews.find((c) => c.id === view.crewId) ?? crews[0];
  const ladder = crewLadder(g, crew.id);
  const districtId = g.world.crews.find((c) => c.id === crew.id)?.districtId;
  const district = districtId ? DISTRICTS[districtId] : undefined;
  const crime = districtId ? Math.round(g.world.districts[districtId].crime) : null;
  return <div className="page ow-page">
    <div className="ow-crews" role="tablist" aria-label="Crews">
      {crews.map((c) => <button key={c.id} type="button" role="tab" aria-selected={c.id === crew.id} className="ow-crew-chip" onClick={() => opsView.crew(c.id)}>{c.name}</button>)}
    </div>
    <p className="ow-crew-meta"><span>{crew.label}{district ? ` · ${district.name}` : ''}</span>{crime !== null && <span>Crime {crime}</span>}</p>
    {ladder && <Ladder g={g} ladder={ladder} />}
    <p className="ow-crew-line">{crewLine(g, crew.id)}</p>
  </div>;
}

function Ladder({ g, ladder }: { g: GameState; ladder: CrewLadder }) {
  const [t1, t2, t3, t4] = ladder.tiers;
  return <div className="ow-ladder">
    <Tier label={`TIER 4 · ${t4.name.toUpperCase()}`}>
      <div className="ow-row ow-row-1">{slots(t4).map((m, i) => m ? <PersonCard key={m.id} g={g} m={m} tier={t4} big /> : <TakenCard key={`gone${i}`} name={t4.name} />)}</div>
    </Tier>
    <Link />
    <Tier label={`TIER 3 · ${t3.name.toUpperCase()}`}>
      <div className="ow-row ow-row-2">{slots(t3).map((m, i) => m ? <PersonCard key={m.id} g={g} m={m} tier={t3} /> : <TakenCard key={`gone${i}`} name={t3.name} />)}</div>
    </Tier>
    <Link />
    <Tier label={`TIER 2 · ${t2.name.toUpperCase()}`}>
      <div className="ow-row ow-row-5">{slots(t2).map((m, i) => m ? <SmallCard key={m.id} m={m} tier={t2} /> : <span key={`gone${i}`} className="ow-small ow-small-taken"><span className="ow-small-name">Charged</span></span>)}</div>
    </Tier>
    <Link />
    <Tier label={`TIER 1 · ${t1.name.toUpperCase()}${t1.full ? ` · ${t1.full}` : ''}`}>
      <Strip tier={t1} />
    </Tier>
  </div>;
}

/** The people of a tier in order, with a null for each place taken by a charge (the crew's full size). */
function slots(t: LadderTier): (LadderMember | null)[] {
  const gone = Math.max(0, Math.min(t.full - t.members.length, t.taken));
  const members = [...t.members].sort((a, b) => Number(b.known) - Number(a.known));
  return [...members, ...Array<null>(gone).fill(null)];
}

function Tier({ label, children }: { label: string; children: ReactNode }) {
  return <section className="ow-tier" aria-label={label.toLowerCase()}><h3 className="ow-mono ow-tier-label">{label}</h3>{children}</section>;
}
const Link = () => <span className="ow-link" aria-hidden="true" />;

function PersonCard({ g, m, tier, big = false }: { g: GameState; m: LadderMember; tier: LadderTier; big?: boolean }) {
  const state = memberState(g, m);
  const tag = STATE_TAG[state](m);
  const cls = `ow-card ow-card-${state}${big ? ' ow-card-big' : ''}`;
  const share = m.intelNeed ? Math.min(100, Math.round((m.intel / m.intelNeed) * 100)) : 0;
  const body = <>
    <b className="ow-card-name">{m.known ? m.name : state === 'unknown' ? 'Unknown' : tier.name}</b>
    <span className="ow-card-sub">{m.known ? tier.name : `The crew's ${tier.name.toLowerCase()}`}</span>
    {tag && <span className={`ow-mono ow-card-tag ow-tag-${state}`}>{tag}</span>}
    {m.intelNeed !== null && state !== 'ready' && state !== 'board' && state !== 'held' && <span className="ow-bar" aria-hidden="true"><i style={{ width: `${share}%` }} /></span>}
  </>;
  if (m.known && m.name) return <button type="button" className={cls} onClick={() => opsView.openDossier(m.id)} aria-label={`${m.name}, ${tier.name}. ${tag ? tag.toLowerCase() + '.' : ''} Open the dossier`}>{body}</button>;
  return <div className={cls} role="group" aria-label={`Unknown ${tier.name.toLowerCase()}. ${tag.toLowerCase()}`}>{body}</div>;
}

function SmallCard({ m, tier }: { m: LadderMember; tier: LadderTier }) {
  const state: 'held' | 'known' | 'unknown' = m.held ? 'held' : m.known ? 'known' : 'unknown';
  const label = state === 'held' ? 'HELD' : state === 'known' ? 'KNOWN' : '';
  if (state === 'unknown') return <span className="ow-small ow-small-unknown" role="img" aria-label={`Unknown ${tier.name.toLowerCase()}`}>?</span>;
  return <button type="button" className={`ow-small ow-small-${state}`} onClick={() => opsView.openDossier(m.id)} aria-label={`${m.name}, ${tier.name}, ${label.toLowerCase()}. Open the dossier`}>
    <span className="ow-small-name">{shortName(m.name)}</span><span className={`ow-mono ow-small-tag ow-tag-${state}`}>{label}</span>
  </button>;
}

const TakenCard = ({ name }: { name: string }) => <div className="ow-card ow-card-taken" role="group" aria-label={`${name}, charged`}><b className="ow-card-name">Charged</b><span className="ow-card-sub">{name}</span><span className="ow-mono ow-card-tag ow-tag-held">OUT OF THE CREW</span></div>;

const LEGEND: { kind: CellKind; label: string }[] = [{ kind: 'held', label: 'Held' }, { kind: 'known', label: 'Known' }, { kind: 'unknown', label: 'Unknown' }, { kind: 'taken', label: 'Charged' }];

function Strip({ tier }: { tier: LadderTier }) {
  const cells = tierCells(tier);
  const counts = tierCounts(tier);
  const summary = LEGEND.filter((l) => counts[l.kind] > 0).map((l) => `${counts[l.kind]} ${l.label.toLowerCase()}`).join(', ');
  return <>
    <div className="ow-strip" role="img" aria-label={`${tier.name}: ${summary}`}>{cells.map((c, i) => <span key={i} className={`ow-cell ow-cell-${c}`} />)}</div>
    <p className="ow-legend" aria-hidden="true">{LEGEND.filter((l) => counts[l.kind] > 0).map((l) => <span key={l.kind}><i className={`ow-cell ow-cell-${l.kind}`} />{l.label} {counts[l.kind]}</span>)}</p>
  </>;
}
