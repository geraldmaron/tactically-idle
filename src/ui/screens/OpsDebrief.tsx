import { useGame } from '../store';
import { decisionViews, pendingDebrief } from '../../sim/operation-selectors';
import type { DebriefResult } from '../../sim/types';
import { getScenario } from '../../sim/scenario-registry';
import { Button, Card } from '../components/ui';
import { DebriefConsequences, DebriefScore, DebriefSummary, OfficerResults, type DebriefOfficers } from '../components/DebriefResults';
import { useToast } from '../components/toast';
import { Sheet } from '../components/Sheet';
import { PersonCasualtyList } from '../components/IncidentPeople';
import { OpenInLab } from '../components/OpenInLab';
import { GamePeopleProvider } from '../people/PeopleText';
import { lexiconFor } from '../people/lexicon';
import { DebriefContents, DebriefEvidence } from './DebriefContents';
import './ops-visual.css';

/** A saved debrief is self-contained; it never borrows history from a newer active run. */
export function SavedDebriefContents({ debrief: d, officers }: { debrief: DebriefResult; officers: DebriefOfficers }) {
  return <div className="saved-debrief-content">
    <DebriefSummary debrief={d} />
    <DebriefScore debrief={d} />
    <PersonCasualtyList casualties={(d.personCasualties ?? []).filter((person) => !(d.civilianOutcomes ?? []).some((civilian) => civilian.id === person.personId))} />
    {d.endingSummary && <p className="debrief-narrative">{d.endingSummary}</p>}
    <DebriefConsequences debrief={d} />
    <OfficerResults debrief={d} officers={officers} />
    <DebriefEvidence debrief={d} decisions={d.decisions ?? []} officers={officers} />
  </div>;
}

export function SavedDebriefReview({ debrief, officers, onClose }: { debrief: DebriefResult | null; officers: DebriefOfficers; onClose: () => void }) {
  return <Sheet open={!!debrief} onClose={onClose} title={debrief?.endingTitle ?? 'Saved result'} className="operation-log-sheet" footer={<Button block onClick={onClose}>Return to HQ</Button>}>
    {debrief && <SavedDebriefContents debrief={debrief} officers={officers} />}
  </Sheet>;
}

export function OpsDebrief() {
  const g = useGame();
  const { act } = useToast();
  const d = pendingDebrief(g);
  const close = () => act({ type: 'closeDebrief' });
  if (!d) return <div className="page"><Card>
    <h2 className="section-title">Debrief</h2>
    <p className="dim">The operation is over. The debrief is not available yet.</p>
    <Button variant="primary" block onClick={close}>Close</Button>
  </Card></div>;
  const decisions = d.decisions ?? decisionViews(g);
  const run = g.activeRun;
  const scenario = getScenario(d.scenarioId);
  // The call's people and the squads that went in, for the names in the debrief.
  const deployed = g.squads.filter((squad) => run?.squadIds.includes(squad.id));
  const people = scenario ? lexiconFor(scenario, run, deployed.flatMap((squad) => squad.officerIds.flatMap((id) => g.officers[id] ? [{ ...g.officers[id], squad: squad.id }] : []))) : null;
  return <GamePeopleProvider lexicon={people}><div className="debrief-layout"><div className="page debrief">
    <DebriefContents result={d} officers={g.officers} decisions={decisions} scenario={scenario ?? undefined} heroAction={import.meta.env.DEV && <OpenInLab getState={() => g} />} />
  </div><div className="debrief-footer"><Button variant="primary" block onClick={close}>Close debrief</Button></div></div></GamePeopleProvider>;
}
