import { useMemo } from 'react';
import { DISTRICTS } from '../../../content/city/districts';
import type { DebriefResult, GameState } from '../../../sim/types';
import { Face } from '../../components/Face';
import { Funds } from '../../components/Funds';
import { useGame } from '../../store';
import { useSettings } from '../../settings/SettingsControls';
import { clockIn, warrantTiles } from './model';
import { caseAfter, previewClose, staysWithThem, type StayChip } from './stays';
import './ops-world.css';

/** The debrief's world and people sections (D2): four tiles for a call the world sent (everyone, case funding, crime,
 * intel), then "What stays with them": per officer a memory line and chips. Read from the debrief closed on a copy,
 * so what is shown is what closing it writes. */
export function DebriefWorld({ debrief }: { debrief: DebriefResult }) {
  const g = useGame();
  const run = g.activeRun;
  const personalLives = useSettings().personalLives;
  const runId = run?.id;
  // One close on a copy per call: ticks while the player reads change nothing it shows.
  const after = useMemo(() => previewClose(g, Date.now()), [runId]); // eslint-disable-line react-hooks/exhaustive-deps
  const stays = useMemo(() => after ? staysWithThem(g, after, debrief.officerCondition.map((o) => o.officerId), personalLives) : null, [after, personalLives]); // eslint-disable-line react-hooks/exhaustive-deps
  const ref = run?.world;
  return <>
    {ref && after && <WorldTiles g={g} after={after} debrief={debrief} />}
    {stays && (stays.entries.length > 0 || stays.pairs.length > 0) && <section className="ow-stays" aria-label="What stays with them">
      <h3 className="ow-kicker ow-kicker-people">WHAT STAYS WITH THEM</h3>
      {stays.entries.map((e, i) => {
        return <div key={e.officerIds.join('-')} className={`ow-stay${i === 0 ? ' ow-stay-first' : ''}`}>
          <span className={`ow-stay-faces${e.officerIds.length > 1 ? ' ow-stay-faces-many' : ''}`}>{e.officerIds.slice(0, 4).map((id) => <Face key={id} size={e.officerIds.length > 1 ? 'sm' : 'md'} kind="officer" officer={g.officers[id]} />)}</span>
          <span className="ow-stay-text">
            <b>{e.names}</b>
            {e.memory && <span className="ow-stay-line">Memory: {e.memory}</span>}
            {e.chips.length > 0 && <span className="ow-chips">{e.chips.map((c) => <Chip key={c.text} chip={c} />)}</span>}
          </span>
        </div>;
      })}
      {stays.pairs.map((p) => <div key={p.line} className="ow-pair">
        <span className="ow-pair-faces" aria-hidden="true">{p.ids.map((id) => <Face key={id} size="sm" kind="officer" officer={g.officers[id]} />)}</span>
        <span className="ow-stay-line">{p.line}</span>
      </div>)}
    </section>}
  </>;
}

const Chip = ({ chip }: { chip: StayChip }) => <span className={`ow-chip ow-chip-${chip.tone}`}>{chip.text}</span>;

function WorldTiles({ g, after, debrief }: { g: GameState; after: GameState; debrief: DebriefResult }) {
  const ref = g.activeRun!.world!;
  const c = g.world.cases.find((k) => k.id === ref.caseId);
  const closed = caseAfter(after, ref.caseId);
  const paying = closed?.status === 'review';
  const hurt = (debrief.officerCasualties?.length ?? 0) + (debrief.personCasualties?.length ?? 0);
  const tiles = warrantTiles(g, c, ref.caseTier, ref.districtId, c?.crewId ?? null);
  const crewName = c?.crewId ? g.world.crews.find((k) => k.id === c.crewId)?.name : null;
  return <div className="ow-tiles ow-tiles-2" aria-label="What the call did to the case">
    <div className="ow-tile"><span>Everyone</span><b className={hurt === 0 ? 'ow-good' : 'ow-warn'}>{hurt === 0 ? 'Unhurt' : `${hurt} hurt`}</b></div>
    <div className="ow-tile"><span>{paying && closed?.closesAt ? `Case funding, closes in ${clockIn(closed.closesAt, g.department.clockHighWater)}` : 'Case funding'}</span>
      <b>{paying && tiles.caseFunding !== null ? <Funds value={tiles.caseFunding} format="full" /> : 'The lead stays open'}</b></div>
    <div className="ow-tile"><span>{DISTRICTS[ref.districtId].name} crime</span><b>{paying ? tiles.crimeLine : `${Math.round(g.world.districts[ref.districtId].crime)} holds`}</b></div>
    <div className="ow-tile"><span>{crewName ?? 'The crew'}</span><b className="ow-intel">{paying ? tiles.intelLine : 'No new intel'}</b></div>
  </div>;
}
