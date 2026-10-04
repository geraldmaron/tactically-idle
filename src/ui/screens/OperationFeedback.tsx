import { useState } from 'react';
import type { ActionView, DecisionView, KnowledgeStatus, OutcomeBand, RiskBand } from '../../sim/types';
import { Button, Chip } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { ResultPortrait, type DebriefOfficers } from '../components/DebriefResults';
import { StressDisplay, StressGuide } from '../components/StressDisplay';
import { opMinutes, signed } from '../format';
import { outcomePercentages } from './liveModels';
import './operation-feedback.css';

export const RESULT_LABEL: Record<OutcomeBand, string> = { favorable: 'Went well', mixed: 'Had complications', adverse: 'Went badly' };
export const FORECAST_LABEL: Record<OutcomeBand, string> = { favorable: 'Goes well', mixed: 'Complications', adverse: 'Goes badly' };
export const CONSEQUENCE_LABEL: Record<RiskBand, string> = { low: 'Low', moderate: 'Moderate', high: 'High', severe: 'Severe' };
const RESULT_TONE = { favorable: 'mint', mixed: 'amber', adverse: 'danger' } as const;
const KNOWLEDGE_LABEL: Record<KnowledgeStatus, string> = { unknown: 'Unknown', reported: 'Reported, unconfirmed', confirmed: 'Confirmed', disproved: 'Ruled out' };

/** Public forecasts only. The engine owns the odds and the authored consequence descriptions. */
export function OutcomeForecast({ action }: { action: ActionView }) {
  const percentages = outcomePercentages(action.likelihood);
  const commonEvent = action.eventResult && new Set(Object.values(action.outcomePreview)).size === 1;
  return (
    <section className="outcome-forecast" aria-label="Possible outcomes">
      <div className="outcome-forecast-heading">
        <h3>{commonEvent ? 'Expected event' : 'What could happen'}</h3>
        <span className={`consequence-level consequence-${action.consequenceLevel}`}>Possible harm: {CONSEQUENCE_LABEL[action.consequenceLevel].toLowerCase()}</span>
      </div>
      {commonEvent ? <p>{action.outcomePreview.favorable}</p> : <>
      <p className="operation-note">{action.eventResult ? 'The event is established. These checks describe how the step unfolds and its costs.' : action.eligible ? 'Chances depend on your team and what you know. Even when a choice goes well, there may be more work to do.' : 'Check what is missing to see the chances for this choice.'} Possible harm describes how badly things could go.</p>
      <ul className="outcome-options">
        {(['favorable', 'mixed', 'adverse'] as const).map((band) => (
          <li key={band} className={`outcome-option outcome-${band}`}>
            <div><strong>{action.eventResult ? ({ favorable: 'Smoothly', mixed: 'With delays', adverse: 'With difficulty' } as const)[band] : FORECAST_LABEL[band]}</strong>{action.eligible && <span>{percentages[band]}% chance</span>}</div>
            <p>{action.outcomePreview[band]}</p>
          </li>
        ))}
      </ul>
      </>}
    </section>
  );
}

export function DecisionCard({ decision: d, full = false, officers = {}, explicitCompletion = false }: { decision: DecisionView; full?: boolean; officers?: DebriefOfficers; explicitCompletion?: boolean }) {
  // Consequences are saved facts, in authored order. A later line can contain an injury or discovery.
  const narrative = d.consequences.filter((line) => !line.startsWith('Next: '));
  const next = d.consequences.filter((line) => line.startsWith('Next: '));
  const fallback = narrative.length === 0 ? d.explanation.find((line) => line.trim()) : undefined;
  return (
    <article className={`decision-card decision-${d.resultLabel ? 'event' : d.band}`} aria-label={`${d.title}: ${d.resultLabel ?? RESULT_LABEL[d.band]}`}>
      <header className="decision-heading">
        <div><span className="decision-stage">{d.stageLabel}</span><h3>{d.title}</h3></div>
        <Chip tone={d.resultLabel ? 'neutral' : RESULT_TONE[d.band]}>{d.resultLabel ?? RESULT_LABEL[d.band]}</Chip>
      </header>
      {narrative.length > 0 ? <ul className="decision-narrative">{narrative.map((line, index) => <li key={index}>{line}</li>)}</ul> : fallback ? <p className="decision-lead">{fallback}</p> : null}
      <DecisionChanges decision={d} complete={full} explicitCompletion={explicitCompletion} />
      <DecisionEffects decision={d} complete={full} />
      <DecisionStress decision={d} officers={officers} complete={full} />
      {next.length > 0 && <div className="decision-next">{next.map((line, index) => <p key={index}>{line}</p>)}</div>}
      {d.endingTitle && <p className="decision-next"><strong>Operation ended:</strong> {d.endingTitle}</p>}
      <details className="decision-causes decision-record" open={full}>
        <summary>Details and reasons</summary>
        {d.resultLabel && <p>Recorded check: {d.band}. Time, supplies and stress are recorded below.</p>}
        {!full && <>
          <h4>Recorded changes</h4>
          <DecisionChanges decision={d} complete />
          <DecisionEffects decision={d} complete />
          <DecisionStress decision={d} officers={officers} complete />
        </>}
        {d.explanation.length > 0 && <><h4>Recorded explanation</h4><ul>{d.explanation.map((line, index) => <li key={index}>{line}</li>)}</ul></>}
        {d.contributors.length > 0 && <>
          <h4>What affected the result</h4>
          <p>These numbers show how much each factor helped or hindered this choice. They are not experience rewards or percentage chances.</p>
          <ul>{d.contributors.map((contributor, index) => <li key={index}>{contributor.label}: {signed(contributor.value, 1)} points</li>)}</ul>
        </>}
        <h4>What do the scores mean?</h4>
        {explicitCompletion ? <p>The recorded call progress score is separate from completion. Completion depends on the work done and any agreed transfer of responsibility. Civilian safety tracks how safely the call has gone, from 0 to 100.</p> : <p>Call progress shows how much of the call has been resolved. Civilian safety tracks how safely it has gone. Both run from 0 to 100; higher is better.</p>}
        <p>Pressure runs from 0 to 100; lower is better. Delays and setbacks can raise it and make the situation harder. A lower safety score does not by itself mean someone was injured.</p>
      </details>
    </article>
  );
}

/** Time and nonzero changes stay visible; the complete record also includes unchanged scores. */
function DecisionChanges({ decision: d, complete = false, explicitCompletion = false }: { decision: DecisionView; complete?: boolean; explicitCompletion?: boolean }) {
  const changes = [
    { label: 'Time', value: d.timeCost, text: `+${opMinutes(d.timeCost)}`, tone: '' },
    ...(!explicitCompletion || complete ? [{ label: 'Call progress', value: d.objectiveDelta, text: signed(d.objectiveDelta, 1), tone: d.objectiveDelta > 0 ? 'tone-mint' : d.objectiveDelta < 0 ? 'tone-danger' : '' }] : []),
    { label: 'Civilian safety', value: d.civilianSafetyDelta, text: signed(d.civilianSafetyDelta, 1), tone: d.civilianSafetyDelta > 0 ? 'tone-mint' : d.civilianSafetyDelta < 0 ? 'tone-danger' : '' },
    { label: 'Pressure', value: d.pressureDelta, text: signed(d.pressureDelta, 1), tone: d.pressureDelta < 0 ? 'tone-mint' : d.pressureDelta > 0 ? 'tone-warn' : '' },
  ].filter((change) => complete || change.label === 'Time' || change.value !== 0);
  return <dl className="decision-metrics" aria-label={complete ? 'Recorded changes' : 'What changed'}>
    {changes.map((change) => <div key={change.label}><dt>{change.label}</dt><dd className={change.tone}>{change.text}</dd></div>)}
  </dl>;
}

function DecisionEffects({ decision: d, complete = false }: { decision: DecisionView; complete?: boolean }) {
  const supplies = d.supplies.filter((item) => complete || item.qty !== 0);
  if (!complete && !supplies.length && !d.knowledgeChanges.length) return null;
  return <div className="decision-effects">
    {(complete || supplies.length > 0) && <div><strong>Supplies used</strong><p>{supplies.length ? supplies.map((item) => `${item.qty} × ${item.label}`).join(', ') : 'None'}</p></div>}
    {(complete || d.knowledgeChanges.length > 0) && <div><strong>What you learned</strong>{d.knowledgeChanges.length ? <ul>{d.knowledgeChanges.map((fact) => <li key={fact.factId}>{fact.label}: {KNOWLEDGE_LABEL[fact.status]}</li>)}</ul> : <p>No knowledge changes recorded.</p>}</div>}
  </div>;
}

export function OperationLogContents({ decisions, practice, officers = {}, explicitCompletion = false }: { decisions: DecisionView[]; practice: boolean; officers?: DebriefOfficers; explicitCompletion?: boolean }) {
  return (
    <div className="operation-log-content">
      <p className="operation-note">{decisions.length} decision{decisions.length === 1 ? '' : 's'}, in order. {practice ? 'Practice results do not change your department.' : 'Each choice records the time, supplies and changes it caused.'}</p>
      <ol className="operation-log-list">{decisions.map((decision, index) => <li key={decision.revision}><span className="decision-number">Decision {index + 1}</span><DecisionCard decision={decision} officers={officers} explicitCompletion={explicitCompletion} full /></li>)}</ol>
    </div>
  );
}

/** The history comes from the saved run, so closing a sheet or reloading cannot discard it. */
export function OperationFeedback({ decisions, practice, ended = false, onOpenLog, officers = {}, explicitCompletion = false }: { decisions: DecisionView[]; practice: boolean; ended?: boolean; onOpenLog?: () => void; officers?: DebriefOfficers; explicitCompletion?: boolean }) {
  const [open, setOpen] = useState(false);
  const last = decisions.at(-1);
  if (!last) return null;
  return (
    <section className="operation-feedback" aria-label="Operation feedback">
      <div className="operation-feedback-heading"><h2>Last decision</h2><Button variant="ghost" size="sm" className="operation-log-trigger" onClick={() => { onOpenLog?.(); setOpen(true); }} aria-haspopup="dialog" aria-expanded={open}>Decision log ({decisions.length})</Button></div>
      <DecisionCard key={last.revision} decision={last} officers={officers} explicitCompletion={explicitCompletion} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Decision log" className="operation-log-sheet" footer={<Button block onClick={() => setOpen(false)}>{ended ? 'Return to debrief' : 'Return to operation'}</Button>}>
        <OperationLogContents decisions={decisions} practice={practice} officers={officers} explicitCompletion={explicitCompletion} />
      </Sheet>
    </section>
  );
}

/** Saved levels are authoritative. Older decisions show changes without invented condition. */
function DecisionStress({ decision: d, officers, complete = false }: { decision: DecisionView; officers: DebriefOfficers; complete?: boolean }) {
  const changed = d.stressDeltas.filter((row) => complete || row.delta !== 0);
  if (!complete && changed.length === 0) return null;
  return <section className="decision-stress" aria-label={d.actualStressDeltas ? 'Officer stress' : 'Recorded strain'}>
    <h4>{d.actualStressDeltas ? 'Stress on the team' : 'Recorded strain'}</h4>
    {changed.length ? <ul className="decision-stress-list">{changed.map((row) => {
      const person = officers[row.officerId];
      const name = person ? `${person.firstName} ${person.surname}` : row.label;
      const known = row.stressBefore !== undefined && row.stressAfter !== undefined;
      return <li key={row.officerId} className="decision-stress-officer">
        <ResultPortrait officerId={row.officerId} officers={officers} size={40} />
        <div><div className="decision-stress-name"><strong>{name}</strong>{!known && <span className={`decision-stress-delta ${row.delta > 0 ? 'tone-warn' : row.delta < 0 ? 'tone-mint' : ''}`}>{signed(row.delta, 1)} {d.actualStressDeltas ? 'stress' : 'recorded strain'}</span>}</div>
          {known ? <StressDisplay value={row.stressAfter!} before={row.stressBefore} /> : null}
        </div>
      </li>;
    })}</ul> : <p className="decision-stress-legacy">{d.actualStressDeltas ? 'No change to officer stress.' : 'No strain entries were saved.'}</p>}
    {d.actualStressDeltas && changed.some((row) => row.stressAfter === undefined) && <p className="decision-legacy-note">Only the stress change was saved for this older decision.</p>}
    {!d.actualStressDeltas && <p className="decision-legacy-note">Older record: strain may differ from the applied change.</p>}
    {changed.some((row) => row.stressAfter !== undefined) && <StressGuide />}
  </section>;
}
