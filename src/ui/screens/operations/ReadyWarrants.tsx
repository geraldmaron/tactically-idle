import { Icon } from '../../icons';
import { Silhouette } from '../../portraits/Silhouette';
import { Funds } from '../../components/Funds';
import { useGame } from '../../store';
import { subjectDossier } from '../../../sim/world/selectors';
import { readyLeads } from './model';
import { opsView } from './view';

/** Warrants that can be planned now, on the Now segment (C1): one ivory card per lead, tapping opens the dossier.
 * A warrant already on the board is a call card below, not here. */
export function ReadyWarrants() {
  const g = useGame();
  const leads = readyLeads(g);
  if (leads.length === 0) return null;
  return <section className="ow-ready" aria-label="Warrants ready">
    <h2 className="ow-kicker ow-kicker-live">WARRANTS READY · {leads.length}</h2>
    <ul className="ow-ready-list" data-ui-list>
      {leads.map((lead) => {
        const d = subjectDossier(g, lead.subjectId);
        const award = g.world.cases.find((c) => c.id === lead.caseId)?.award ?? null;
        if (!d) return null;
        return <li key={lead.id}>
          <button type="button" className="ow-ready-card" onClick={() => opsView.openDossier(lead.subjectId)} aria-label={`Warrant ready: ${d.name}. Open the dossier`}>
            <span className="ow-ready-photo" aria-hidden="true"><Silhouette kind="person" seed={d.id} /></span>
            <span className="ow-ready-text">
              <span className="ow-mono ow-ready-kicker">WARRANT READY · TIER {d.tier}</span>
              <b className="ow-ready-name">{d.name}</b>
              <span className="ow-ready-sub">{[d.tierName, d.crewName].filter(Boolean).join(', ')}</span>
            </span>
            <span className="ow-ready-trail">
              {award !== null && <span className="ow-ready-funds"><Funds value={award} format="full" /></span>}
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        </li>;
      })}
    </ul>
  </section>;
}
