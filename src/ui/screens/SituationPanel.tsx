import { useState } from 'react';
import type { KnowledgeStatus, OperationRun } from '../../sim/types';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { Icon } from '../icons';
import './situation-panel.css';

const STATUS_LABEL: Partial<Record<KnowledgeStatus, string>> = { reported: 'Reported', confirmed: 'Confirmed', disproved: 'Ruled out' };

/** The call's situation stays in view during the operation: the summary is always readable and the
 * rest of the briefing opens in place. Only public information is listed: the authored briefing and
 * facts this run has already reported, confirmed or ruled out. Unknown facts are never enumerated,
 * because whether one is drawn can depend on its hidden truth. */
export function SituationPanel({ scenario, run }: { scenario: ScenarioDefinition; run: Pick<OperationRun, 'knowledge'> }) {
  const [open, setOpen] = useState(false);
  const { dispatchReason, teamResponsibilities, unknown } = scenario.briefing;
  const established = scenario.facts.filter((fact) => STATUS_LABEL[run.knowledge[fact.id] ?? fact.initial]);
  const hasMore = !!dispatchReason || !!teamResponsibilities?.length || unknown.length > 0 || established.length > 0;
  return (
    <section className={`situation${open ? ' situation-open' : ''}`} aria-label="Situation">
      <p className="situation-summary">{scenario.summary}</p>
      {hasMore && (
        <button type="button" className="situation-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <Icon name="intel" size={14} />
          {open ? 'Hide briefing' : 'Briefing'}
          <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
        </button>
      )}
      {open && (
        <div className="situation-body">
          {dispatchReason && <div><h3>Why your team was sent</h3><p>{dispatchReason}</p></div>}
          {!!teamResponsibilities?.length && <div><h3>Your team’s job</h3><ul>{teamResponsibilities.map((task) => <li key={task}>{task}</li>)}</ul></div>}
          {unknown.length > 0 && <div><h3>Open at dispatch</h3><ul>{unknown.map((question) => <li key={question}>{question}</li>)}</ul></div>}
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
