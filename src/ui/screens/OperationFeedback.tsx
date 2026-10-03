import { useState } from 'react';
import type { ActionView, DecisionView, KnowledgeStatus, OutcomeBand, RiskBand } from '../../sim/types';
import { Button, Chip } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { opMinutes, signed } from '../format';
import { outcomePercentages } from './liveModels';
import './operation-feedback.css';

export const RESULT_LABEL: Record<OutcomeBand, string> = { favorable: 'Favorable', mixed: 'Mixed', adverse: 'Adverse' };
export const CONSEQUENCE_LABEL: Record<RiskBand, string> = { low: 'Low', moderate: 'Moderate', high: 'High', severe: 'Severe' };
const RESULT_TONE = { favorable: 'mint', mixed: 'amber', adverse: 'danger' } as const;
const KNOWLEDGE_LABEL: Record<KnowledgeStatus, string> = { unknown: 'Unknown', reported: 'Reported, unconfirmed', confirmed: 'Confirmed', disproved: 'Ruled out' };

/** Public forecasts only. The engine owns the odds and the authored consequence descriptions. */
export function OutcomeForecast({ action }: { action: ActionView }) {
  const percentages = outcomePercentages(action.likelihood);
  return (
    <section className="outcome-forecast" aria-label="Possible outcomes">
      <div className="outcome-forecast-heading">
        <h3>What could happen</h3>
        <span className={`consequence-level consequence-${action.consequenceLevel}`}>{CONSEQUENCE_LABEL[action.consequenceLevel]} consequence severity</span>
      </div>
      <p className="operation-note">{action.eligible ? 'Chances reflect current preparation and knowledge, and do not guarantee a result.' : 'Meet the requirements to see a usable forecast.'} Severity describes how serious the consequences could be.</p>
      <ul className="outcome-options">
        {(['favorable', 'mixed', 'adverse'] as const).map((band) => (
          <li key={band} className={`outcome-option outcome-${band}`}>
            <div><strong>{RESULT_LABEL[band]}</strong>{action.eligible && <span>{percentages[band]}% chance</span>}</div>
            <p>{action.outcomePreview[band]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DecisionCard({ decision: d, full = false }: { decision: DecisionView; full?: boolean }) {
  const changes = [
    { label: 'Time', value: `+${opMinutes(d.timeCost)}`, tone: '' },
    { label: 'Objective', value: signed(d.objectiveDelta, 1), tone: d.objectiveDelta > 0 ? 'tone-mint' : d.objectiveDelta < 0 ? 'tone-danger' : '' },
    { label: 'Civilian safety', value: signed(d.civilianSafetyDelta, 1), tone: d.civilianSafetyDelta > 0 ? 'tone-mint' : d.civilianSafetyDelta < 0 ? 'tone-danger' : '' },
    { label: 'Pressure', value: signed(d.pressureDelta, 1), tone: d.pressureDelta < 0 ? 'tone-mint' : d.pressureDelta > 0 ? 'tone-warn' : '' },
  ];
  const narrative = d.consequences.filter((line) => !line.startsWith('Next: '));
  const next = d.consequences.filter((line) => line.startsWith('Next: '));
  // Keep every saved explanation available, without repeating consequence text in the default view.
  const causes = d.explanation.filter((line) => !d.consequences.includes(line));
  const stress = d.stressDeltas.filter((officer) => officer.delta !== 0);
  const stressValues = stress.map((officer) => officer.delta);
  const stressMin = Math.min(...stressValues);
  const stressMax = Math.max(...stressValues);
  const stressSummary = !stress.length ? 'No change' : `${stressMin === stressMax ? signed(stressMin, 1) : `${signed(stressMin, 1)} to ${signed(stressMax, 1)}`} per officer (${stress.length})`;
  return (
    <article className={`decision-card decision-${d.band}`} aria-label={`${d.title}: ${RESULT_LABEL[d.band]} result`}>
      <header className="decision-heading">
        <div><span className="decision-stage">{d.stageLabel}</span><h3>{d.title}</h3></div>
        <Chip tone={RESULT_TONE[d.band]}>{RESULT_LABEL[d.band]} result</Chip>
      </header>
      {narrative.length > 0 ? <ul className="decision-narrative">{(full ? narrative : narrative.slice(0, 1)).map((line, index) => <li key={index}>{line}</li>)}</ul> : <p className="decision-lead">{d.explanation[0]}</p>}
      <dl className="decision-metrics" aria-label="Committed changes">
        {changes.map((change) => <div key={change.label}><dt>{change.label}</dt><dd className={change.tone}>{change.value}</dd></div>)}
      </dl>
      <div className="decision-effects">
        <div><strong>Supplies used</strong><p>{d.supplies.length ? d.supplies.map((item) => `${item.qty} × ${item.label}`).join(', ') : 'None'}</p></div>
        <div><strong>{d.actualStressDeltas ? 'Officer stress' : 'Recorded strain'}</strong><p>{full && d.stressDeltas.length ? d.stressDeltas.map((officer) => `${officer.label} ${signed(officer.delta, 1)}`).join(' · ') : stressSummary}</p></div>
        <div><strong>Knowledge</strong>{d.knowledgeChanges.length ? (full ? <ul>{d.knowledgeChanges.map((fact) => <li key={fact.factId}>{fact.label}: {KNOWLEDGE_LABEL[fact.status]}</li>)}</ul> : <p>{d.knowledgeChanges.map((fact) => `${fact.label}: ${KNOWLEDGE_LABEL[fact.status]}`).join(' · ')}</p>) : <p>No new information</p>}</div>
      </div>
      {!d.actualStressDeltas && <p className="decision-legacy-note">Older log: recorded strain may differ from applied stress at its limits.</p>}
      {next.length > 0 && <div className="decision-next">{next.map((line, index) => <p key={index}>{line}</p>)}</div>}
      {d.endingTitle && <p className="decision-next"><strong>Operation ended:</strong> {d.endingTitle}</p>}
      {(causes.length > 0 || (!full && (narrative.length > 1 || stress.length > 0))) && <details className="decision-causes">
        <summary>{full ? 'Why this happened' : 'More consequences and causes'}</summary>
        {!full && narrative.length > 1 && <ul>{narrative.slice(1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
        {!full && stress.length > 0 && <p>Officer stress: {stress.map((officer) => `${officer.label} ${signed(officer.delta, 1)}`).join(' · ')}</p>}
        {causes.length > 0 && <ul>{causes.map((line, index) => <li key={index}>{line}</li>)}</ul>}
      </details>}
      {full && d.contributors.length > 0 && <details className="decision-causes">
        <summary>Decision contributors</summary>
        <ul>{d.contributors.map((contributor, index) => <li key={index}>{contributor.label}: {signed(contributor.value, 1)} points</li>)}</ul>
      </details>}
    </article>
  );
}

export function OperationLogContents({ decisions, practice }: { decisions: DecisionView[]; practice: boolean }) {
  return (
    <div className="operation-log-content">
      <p className="operation-note">{decisions.length} committed decision{decisions.length === 1 ? '' : 's'}, in order. {practice ? 'Practice results do not change your department.' : 'Costs and changes are recorded when each decision is confirmed.'}</p>
      <ol className="operation-log-list">{decisions.map((decision, index) => <li key={decision.revision}><span className="decision-number">Decision {index + 1}</span><DecisionCard decision={decision} full /></li>)}</ol>
    </div>
  );
}

/** The history comes from the saved run, so closing a sheet or reloading cannot discard it. */
export function OperationFeedback({ decisions, practice, ended = false, onOpenLog }: { decisions: DecisionView[]; practice: boolean; ended?: boolean; onOpenLog?: () => void }) {
  const [open, setOpen] = useState(false);
  const last = decisions.at(-1);
  if (!last) return null;
  return (
    <section className="operation-feedback" aria-label="Operation feedback">
      <div className="operation-feedback-heading"><h2>Last decision</h2><Button variant="ghost" size="sm" className="operation-log-trigger" onClick={() => { onOpenLog?.(); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open}>Decision log ({decisions.length})</Button></div>
      <DecisionCard key={last.revision} decision={last} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Decision log" className="operation-log-sheet" footer={<Button block onClick={() => setOpen(false)}>{ended ? 'Return to debrief' : 'Return to operation'}</Button>}>
        <OperationLogContents decisions={decisions} practice={practice} />
      </Sheet>
    </section>
  );
}
