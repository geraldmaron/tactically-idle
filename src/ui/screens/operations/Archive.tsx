import { DISTRICTS } from '../../../content/city/districts';
import { gameDay } from '../../../sim/calendar';
import { subjectName } from '../../../sim/world/population';
import { Chip, Row, Section } from '../../components/ui';
import { Funds } from '../../components/Funds';
import { Face } from '../../components/Face';
import { useGame } from '../../store';
import { Casebook } from '../Casebook';
import { opsView } from './view';

const RESOLUTION: Record<string, string> = { charged: 'Charged', diverted: 'Diverted', care: 'Handed to care', released: 'Released', cleared: 'Cleared' };

/** Archive (C1): the investigations already closed, newest first, then the casebook of kinds of call. */
export function Archive() {
  const g = useGame();
  const closed = g.world.cases.filter((c) => c.status === 'closed').sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0)).slice(0, 12);
  return <div className="page ow-page">
    <Section title="Closed investigations" icon="dossier" count={closed.length === 0 ? 'Nothing has closed yet' : `${closed.length} most recent`}>
      {closed.length === 0 ? <p className="dim ow-note">A case closes after its review clock and pays its award once. It lands here.</p> : <div className="panel-well" data-ui-list>
        {closed.map((c) => {
          const s = g.world.subjects[c.subjectId];
          const name = s?.known ? subjectName(s) : 'A person you did not name';
          return <Row key={c.id}
            lead={<Face size="md" kind="person" seed={c.subjectId} />}
            title={name}
            detail={`${RESOLUTION[c.resolution] ?? c.resolution} · ${DISTRICTS[c.districtId].name} · day ${Math.max(0, Math.floor(gameDay(g, c.paidAt ?? c.openedAt)))}`}
            trail={<span className="ow-archive-trail"><Chip tone="mint">Tier {c.tier}</Chip><Funds value={c.award} format="full" /></span>}
            onClick={s?.known ? () => opsView.openDossier(c.subjectId) : undefined} />;
        })}
      </div>}
    </Section>
    <Casebook state={g} />
  </div>;
}
