import type { KnowledgeStatus, OperationRun } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { Icon } from '../icons';
import { PeopleText } from '../people/PeopleText';
import './situation-panel.css';
import { WhoTheyAre } from '../components/DepthBrief';
import { Disclosure } from '../components/Disclosure';
import { FactStatusChip } from '../components/FactStatusChip';

const STATUS_LABEL: Partial<Record<KnowledgeStatus, string>> = { reported: 'Reported', confirmed: 'Confirmed', disproved: 'Ruled out' };

/** The call's briefing at the head of the live Scene (docs/call-presentation.md): reference the
 * player consults, never clamped. The cold open was read in full on Prepare, so it folds here.
 * Only public information is listed: the authored briefing and facts this run has already
 * reported, confirmed or ruled out. Unknown facts are never enumerated, because whether one is
 * drawn can depend on its hidden truth. */
export function SituationPanel({ scenario, run }: { scenario: ScenarioDefinition; run: Pick<OperationRun, 'knowledge'> & Partial<Pick<OperationRun, 'history'>> }) {
  const { dispatchReason, teamResponsibilities, unknown, people } = scenario.briefing;
  const established = scenario.facts.filter((fact) => STATUS_LABEL[run.knowledge[fact.id] ?? fact.initial]);
  return (
    <section className="situation" aria-label="Situation">
      <h2 className="situation-head"><Icon name="intel" size={14} />Briefing</h2>
      <p className="situation-summary"><PeopleText text={scenario.summary} /></p>
      <div className="situation-body">
        {established.length > 0 && (
          <div>
            <h3>Established on this call</h3>
            <ul className="situation-facts">
              {established.map((fact) => {
                const status = run.knowledge[fact.id] ?? fact.initial;
                return <li key={fact.id} data-status={status}><span>{fact.label}</span><FactStatusChip status={status} /></li>;
              })}
            </ul>
          </div>
        )}
        {!!teamResponsibilities?.length && <div><h3>Your team’s job</h3><ul>{teamResponsibilities.map((task) => <li key={task}><PeopleText text={task} /></li>)}</ul></div>}
        {unknown.length > 0 && <div><h3>Open at dispatch</h3><ul>{unknown.map((question) => <li key={question}><PeopleText text={question} /></li>)}</ul></div>}
        <WhoTheyAre people={people} />
        {dispatchReason && <div><h3>Why your team was sent</h3><p><PeopleText text={dispatchReason} /></p></div>}
        {scenario.coldOpen && <Disclosure name="situation-cold-open" summary="Before the call"><p><PeopleText text={scenario.coldOpen} /></p></Disclosure>}
      </div>
    </section>
  );
}
