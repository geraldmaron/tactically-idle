import { useState } from 'react';
import type { KnowledgeStatus, OperationRun } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { Icon } from '../icons';
import { PeopleText } from '../people/PeopleText';
import './situation-panel.css';
import { ColdOpen, WhoTheyAre } from '../components/DepthBrief';
import { Disclosure } from '../components/Disclosure';

const STATUS_LABEL: Partial<Record<KnowledgeStatus, string>> = { reported: 'Reported', confirmed: 'Confirmed', disproved: 'Ruled out' };

/** The call's situation stays in view during the operation: the summary is always readable and the
 * rest of the briefing opens in place. It starts folded: the player read the full briefing on
 * Prepare, and on a phone the scene's first screen belongs to the moment and the choices. Only public information is listed: the authored briefing and
 * facts this run has already reported, confirmed or ruled out. Unknown facts are never enumerated,
 * because whether one is drawn can depend on its hidden truth. */
export function SituationPanel({ scenario, run }: { scenario: ScenarioDefinition; run: Pick<OperationRun, 'knowledge'> & Partial<Pick<OperationRun, 'history'>> }) {
  const [open, setOpen] = useState(false);
  // The cold open reads in full on the briefing's first open; after that it folds away.
  const [opens, setOpens] = useState(0);
  const { dispatchReason, teamResponsibilities, unknown, people } = scenario.briefing;
  const established = scenario.facts.filter((fact) => STATUS_LABEL[run.knowledge[fact.id] ?? fact.initial]);
  const hasMore = !!scenario.coldOpen || !!people?.length || !!dispatchReason || !!teamResponsibilities?.length || unknown.length > 0 || established.length > 0;
  return (
    <section className={`situation${open ? ' situation-open' : ''}`} aria-label="Situation">
      <h2 className="situation-head"><Icon name="intel" size={14} />Briefing</h2>
      <p className="situation-summary"><PeopleText text={scenario.summary} /></p>
      {hasMore && (
        <button type="button" className="situation-toggle" aria-expanded={open} onClick={() => { if (!open) setOpens((n) => n + 1); setOpen((value) => !value); }}>
          {open ? 'Hide details' : 'Full briefing'}
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
        </button>
      )}
      {open && (
        <div className="situation-body">
          {scenario.coldOpen && (opens <= 1 ? <ColdOpen text={scenario.coldOpen} className="situation-cold-open" />
            : <Disclosure name="situation-cold-open" summary="Before the call"><p><PeopleText text={scenario.coldOpen} /></p></Disclosure>)}
          <WhoTheyAre people={people} />
          {dispatchReason && <div><h3>Why your team was sent</h3><p><PeopleText text={dispatchReason} /></p></div>}
          {!!teamResponsibilities?.length && <div><h3>Your team’s job</h3><ul>{teamResponsibilities.map((task) => <li key={task}><PeopleText text={task} /></li>)}</ul></div>}
          {unknown.length > 0 && <div><h3>Open at dispatch</h3><ul>{unknown.map((question) => <li key={question}><PeopleText text={question} /></li>)}</ul></div>}
          {established.length > 0 && (
            <div>
              <h3>Established on this call</h3>
              <ul className="situation-facts">
                {established.map((fact) => {
                  const status = run.knowledge[fact.id] ?? fact.initial;
                  return <li key={fact.id} data-status={status}><span>{fact.label}</span><strong>{STATUS_LABEL[status]}</strong></li>;
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
