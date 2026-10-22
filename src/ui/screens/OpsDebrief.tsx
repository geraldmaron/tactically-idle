import { useGame } from '../store';
import { decisionViews, pendingDebrief } from '../../sim/operation-selectors';
import type { DebriefResult } from '../../sim/types';
import { getScenario } from '../../sim/scenario-registry';
import { ActionBar, Button } from '../components/ui';
import { CallHead } from './CallHead';
import { callFlow } from './call-flow';
import { DebriefConsequences, DebriefScore, DebriefSummary, OfficerResults, type DebriefOfficers } from '../components/DebriefResults';
import { useToast } from '../components/toast';
import { Sheet } from '../components/Sheet';
import { PersonCasualtyList } from '../components/IncidentPeople';
import { OpenInLab } from '../components/OpenInLab';
import { GamePeopleProvider } from '../people/PeopleText';
import { lexiconFor } from '../people/lexicon';
import { DebriefContents, DebriefEvidence } from './DebriefContents';
import './ops-visual.css';
import { runRoster } from '../../sim/squads';

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
  return <Sheet open={!!debrief} onClose={onClose} title={debrief?.endingTitle ?? 'Saved result'} className="operation-log-sheet" footer={<Button block onClick={onClose}>Done</Button>}>
    {debrief && <SavedDebriefContents debrief={debrief} officers={officers} />}
  </Sheet>;
}

/** The debrief as a flow with no Back (docs/ui-ux-audit.md, exit table): Done settles the call
 * (closeDebrief pays, awards experience and releases the squads) and then leaves for the board. A tab
 * change or browser Back leaves it unsettled, and the Calls tab returns to it. */
export function OpsDebrief() {
  const g = useGame();
  const { act } = useToast();
  const d = pendingDebrief(g);
  const done = () => { if (act({ type: 'closeDebrief' }).ok) callFlow.close(); };
  if (!d) return <div className="cl-flow">
    <CallHead title="Debrief" />
    <div className="page cl-flow-body"><p className="dim">The call is over. The debrief is not available yet.</p></div>
    <div className="cl-flow-foot"><ActionBar primary={{ label: 'Done', onClick: done }} /></div>
  </div>;
  const decisions = d.decisions ?? decisionViews(g);
  const run = g.activeRun;
  const scenario = getScenario(d.scenarioId);
  // The call's people and the squads that went in, for the names in the debrief.
  const deployed = g.squads.filter((squad) => run?.squadIds.includes(squad.id));
  const people = scenario ? lexiconFor(scenario, run, deployed.flatMap((squad) => (run ? runRoster(g, run, squad.id) : squad.officerIds).flatMap((id) => g.officers[id] ? [{ ...g.officers[id], squad: squad.id }] : []))) : null;
  return <GamePeopleProvider lexicon={people}><div className="cl-flow debrief-layout">
    <CallHead title="Debrief" />
    <div className="page debrief cl-flow-body">
      <DebriefContents result={d} officers={g.officers} decisions={decisions} scenario={scenario ?? undefined} heroAction={import.meta.env.DEV && <OpenInLab getState={() => g} />} />
    </div>
    <div className="cl-flow-foot debrief-footer"><ActionBar primary={{ label: 'Done', onClick: done }} /></div>
  </div></GamePeopleProvider>;
}
