import { TIE_LINE } from '../../../content/people/facts';
import { squadReadiness } from '../../../sim/department-selectors';
import { bondWeb } from '../../../sim/people/selectors';
import type { Tie } from '../../../sim/people/types';
import { DISTRICTS } from '../../../content/city/districts';
import { subjectDossier } from '../../../sim/world/selectors';
import { PlateArt, placeFor, sceneFor } from '../../art/Plates';
import { Face } from '../../components/Face';
import { officerFaceStatus } from '../../components/face-status';
import { familyBlurb, scenarioPlaceName } from '../../components/incident';
import { Funds } from '../../components/Funds';
import { Button } from '../../components/ui';
import { Icon } from '../../icons';
import { useGame } from '../../store';
import { boardEntries } from '../helpers';
import { callFlow } from '../call-flow';
import { bestFitSquad, joinNames, squadName } from '../operation-squads';
import { BackLink } from './Dossier';
import { objectPronoun, warrantTiles } from './model';
import { opsView, useTieChoice, type TieChoice } from './view';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Warrant prep (C3): the place, who is around, the squad that goes with the line on their bond, the choice the
 * knowing officer makes when one is on the record, and what closing the case does. Serve the warrant opens the
 * call's brief on the board (the existing deploy flow picks and sends the squads). */
export function WarrantPrep({ leadId }: { leadId: string }) {
  const g = useGame();
  const choice = useTieChoice(leadId);
  const lead = g.world.leads.find((l) => l.id === leadId);
  const dossier = lead ? subjectDossier(g, lead.subjectId) : null;
  const entry = lead?.cardId ? boardEntries(g, g.department.clockHighWater).find((e) => e.incident.id === lead.cardId) : undefined;
  if (!lead || !dossier) return <div className="page ow-page"><BackLink label="Dossier" /><p className="dim">That warrant is gone.</p></div>;
  const c = g.world.cases.find((k) => k.id === lead.caseId);
  const now = g.department.clockHighWater;
  const scenario = entry?.scenario ?? null;
  const familyId = entry?.incident.familyId ?? null;
  const place = scenarioPlaceName(scenario) ?? `${DISTRICTS[lead.districtId].name} warrant`;
  const him = objectPronoun(dossier.pronouns);

  // Who goes: the squad the deploy step opens with, and its closest bond.
  const ready = entry?.card.eligibleSquadIds ?? [];
  const fit = bestFitSquad(ready.map((id) => ({ id, ...squadReadiness(g, id, now) })));
  const squad = fit ? g.squads.find((s) => s.id === fit) : undefined;
  const members = (squad?.officerIds ?? []).map((id) => g.officers[id]).filter((o) => !!o).slice(0, 4);
  const edge = bondWeb(g, members.map((o) => o.id)).find((e) => e.state === 'close' || e.state === 'trusted' || e.state === 'mentor');
  const bondLine = edge ? `${g.officers[edge.a].surname} and ${g.officers[edge.b].surname} are ${edge.label.toLowerCase()}` : null;

  // The officer on this squad who knows the subject, on the record.
  const ties = g.people.ties.filter((t) => t.subjectId === lead.subjectId && t.onRecord && members.some((o) => o.id === t.officerId));
  const tie: Tie | undefined = ties[0];
  const knower = tie ? g.officers[tie.officerId] : undefined;

  const tiles = warrantTiles(g, c, lead.tier, lead.districtId, lead.crewId);
  const time = new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const serve = () => { if (entry) callFlow.openCall(entry.incident.id); };
  // The brief and the deploy step are one screen now (OpsPrepare), and the squads are chosen on it.
  const change = serve;
  const options: { id: TieChoice; title: string; body: string }[] = knower ? [
    { id: 'talks', title: `${knower.surname} talks from the landing`, body: `${knower.surname} calls ${him} by name through the door. Someone else makes the arrest.` },
    { id: 'holds', title: `${knower.surname} holds the street door`, body: `${knower.surname} stays out of the talk and keeps the way out covered. Nobody speaks to ${him} by name.` },
  ] : [];

  return <div className="ow-prep">
    <div className="ow-plate">
      <PlateArt src={placeFor(familyId) ?? sceneFor(entry?.incident.type)} />
      <span className="ow-plate-fade" aria-hidden="true" />
      <button type="button" className="ow-plate-back" onClick={() => opsView.back()} aria-label="Back to the dossier"><Icon name="chevronLeft" size={20} /></button>
    </div>
    <div className="ow-prep-body">
      <span className="ow-mono ow-kicker-live">{`WARRANT · ${dossier.name.toUpperCase()} · TIER ${lead.tier}`}</span>
      <h2 className="ow-prep-title">{place}</h2>
      <p className="ow-prep-line">{familyBlurb(familyId) ? `${cap(familyBlurb(familyId)!)}.` : `A tier ${lead.tier} warrant on ${dossier.crewName ?? 'a crew'}.`}</p>
      {!entry && <p className="ow-refusal" role="status"><Icon name="info" size={16} />This warrant is not on the board right now. Open the dossier and plan it again.</p>}

      <div className="ow-squad">
        <span className="ow-squad-faces" aria-hidden="true">{members.map((o) => <Face key={o.id} size="sm" kind="officer" officer={o} name={o.surname} status={officerFaceStatus(g, o.id, now)} />)}</span>
        <span className="ow-squad-text">
          <b>{squad ? `Squad ${squad.id}` : 'No squad ready'}</b>
          <span className={`ow-squad-bond${squad ? '' : ' ow-warn'}`}>{squad ? (bondLine ?? joinNames(ready.map((id) => squadName(g.squads, id))) + ' ready') : 'Everyone is out or recovering'}</span>
        </span>
        {entry && <Button size="sm" onClick={change}>Change</Button>}
      </div>

      {knower && tie && <fieldset className="ow-tie-choice">
        <legend className="ow-kicker ow-kicker-people">{knower.surname.toUpperCase()} KNOWS {him.toUpperCase()} · ON THE RECORD</legend>
        <p className="ow-note">{TIE_LINE[tie.kind]}.</p>
        {options.map((o) => <button key={o.id} type="button" role="radio" aria-checked={choice === o.id} className={`ow-radio${choice === o.id ? ' ow-radio-on' : ''}`} onClick={() => opsView.setTieChoice(lead.id, o.id)}>
          <span className="ow-radio-dot" aria-hidden="true"><i /></span>
          <span className="ow-radio-text"><b>{o.title}</b><span>{o.body}</span></span>
        </button>)}
      </fieldset>}

      <div className="ow-tiles">
        <div className="ow-tile"><span>Case funding</span><b className="ow-good">{tiles.caseFunding === null ? 'None' : <Funds value={tiles.caseFunding} format="full" />}</b></div>
        <div className="ow-tile"><span>{dossier.districtName} crime</span><b>{tiles.crimeLine}</b></div>
        <div className="ow-tile"><span>{dossier.crewName ?? 'The crew'}</span><b className="ow-intel">{tiles.intelLine}</b></div>
      </div>
    </div>
    <div className="ow-cta ow-cta-foot"><Button variant="primary" block onClick={serve} disabled={!entry}>Serve the warrant at {time}</Button></div>
  </div>;
}
