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
  return (
    <section className="outcome-forecast" aria-label="Possible outcomes">
      <div className="outcome-forecast-heading">
        <h3>What could happen</h3>
        <span className={`consequence-level consequence-${action.consequenceLevel}`}>Possible harm: {CONSEQUENCE_LABEL[action.consequenceLevel].toLowerCase()}</span>
      </div>
      <p className="operation-note">{action.eligible ? 'Chances depend on your team and what you know. Even when a choice goes well, there may be more work to do.' : 'Check what is missing to see the chances for this choice.'} Possible harm describes how badly things could go.</p>
      <ul className="outcome-options">
        {(['favorable', 'mixed', 'adverse'] as const).map((band) => (
          <li key={band} className={`outcome-option outcome-${band}`}>
            <div><strong>{FORECAST_LABEL[band]}</strong>{action.eligible && <span>{percentages[band]}% chance</span>}</div>
            <p>{action.outcomePreview[band]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DecisionCard({ decision: d, full = false, officers = {}, explicitCompletion = false }: { decision: DecisionView; full?: boolean; officers?: DebriefOfficers; explicitCompletion?: boolean }) {
  const changes = [
    { label: 'Time', value: `+${opMinutes(d.timeCost)}`, tone: '' },
    ...(!explicitCompletion ? [{ label: 'Call progress', value: signed(d.objectiveDelta, 1), tone: d.objectiveDelta > 0 ? 'tone-mint' : d.objectiveDelta < 0 ? 'tone-danger' : '' }] : []),
    { label: 'Civilian safety', value: signed(d.civilianSafetyDelta, 1), tone: d.civilianSafetyDelta > 0 ? 'tone-mint' : d.civilianSafetyDelta < 0 ? 'tone-danger' : '' },
    { label: 'Pressure', value: signed(d.pressureDelta, 1), tone: d.pressureDelta < 0 ? 'tone-mint' : d.pressureDelta > 0 ? 'tone-warn' : '' },
  ];
  const narrative = d.consequences.filter((line) => !line.startsWith('Next: '));
  const next = d.consequences.filter((line) => line.startsWith('Next: '));
  // Keep every saved explanation available, without repeating consequence text in the default view.
  const causes = d.explanation.filter((line) => !d.consequences.includes(line) && !line.startsWith('Most strain:')).map(plainDecisionCause);
  return (
    <article className={`decision-card decision-${d.band}`} aria-label={`${d.title}: ${RESULT_LABEL[d.band]}`}>
      <header className="decision-heading">
        <div><span className="decision-stage">{d.stageLabel}</span><h3>{d.title}</h3></div>
        <Chip tone={RESULT_TONE[d.band]}>{RESULT_LABEL[d.band]}</Chip>
      </header>
      {narrative.length > 0 ? <ul className="decision-narrative">{(full ? narrative : narrative.slice(0, 1)).map((line, index) => <li key={index}>{line}</li>)}</ul> : <p className="decision-lead">{d.explanation[0]}</p>}
      <dl className={`decision-metrics${explicitCompletion ? ' decision-metrics-compact' : ''}`} aria-label="What changed">
        {changes.map((change) => <div key={change.label}><dt>{change.label}</dt><dd className={change.tone}>{change.value}</dd></div>)}
      </dl>
      <div className="decision-effects">
        <div><strong>Supplies used</strong><p>{d.supplies.length ? d.supplies.map((item) => `${item.qty} × ${item.label}`).join(', ') : 'None'}</p></div>
        <div><strong>What you learned</strong>{d.knowledgeChanges.length ? (full ? <ul>{d.knowledgeChanges.map((fact) => <li key={fact.factId}>{fact.label}: {KNOWLEDGE_LABEL[fact.status]}</li>)}</ul> : <p>{d.knowledgeChanges.map((fact) => `${fact.label}: ${KNOWLEDGE_LABEL[fact.status]}`).join(' · ')}</p>) : <p>Nothing new confirmed</p>}</div>
      </div>
      <DecisionStress decision={d} officers={officers} />
      <details className="decision-causes"><summary>What do the scores mean?</summary>{explicitCompletion ? <p>Civilian safety tracks how safely the call has gone, from 0 to 100. Completion depends on the work done and any agreed transfer of responsibility.</p> : <p>Call progress shows how much of the call has been resolved. Civilian safety tracks how safely it has gone. Both run from 0 to 100; higher is better.</p>}<p>Pressure runs from 0 to 100; lower is better. Delays and setbacks can raise it and make the situation harder. A lower safety score does not by itself mean someone was injured.</p></details>
      {next.length > 0 && <div className="decision-next">{next.map((line, index) => <p key={index}>{line}</p>)}</div>}
      {d.endingTitle && <p className="decision-next"><strong>Operation ended:</strong> {d.endingTitle}</p>}
      {(causes.length > 0 || (!full && narrative.length > 1)) && <details className="decision-causes">
        <summary>{full ? 'Why this happened' : 'Details and reasons'}</summary>
        {!full && narrative.length > 1 && <ul>{narrative.slice(1).map((line, index) => <li key={index}>{line}</li>)}</ul>}
        {causes.length > 0 && <ul>{causes.map((line, index) => <li key={index}>{line}</li>)}</ul>}
      </details>}
      {full && d.contributors.length > 0 && <details className="decision-causes">
        <summary>What affected the result</summary>
        <p>These numbers show how much each factor helped or hindered this choice. They are not experience rewards or percentage chances.</p>
        <ul>{d.contributors.map((contributor, index) => <li key={index}>{contributor.label}: {signed(contributor.value, 1)} points</li>)}</ul>
      </details>}
    </article>
  );
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
function DecisionStress({ decision: d, officers }: { decision: DecisionView; officers: DebriefOfficers }) {
  const changed = d.stressDeltas.filter((row) => row.delta !== 0);
  return <section className="decision-stress" aria-label={d.actualStressDeltas ? 'Officer stress' : 'Recorded strain'}>
    <h4>{d.actualStressDeltas ? 'Stress on the team' : 'Recorded strain'}</h4>
    {changed.length ? <ul className="decision-stress-list">{changed.map((row) => {
      const person = officers[row.officerId];
      const name = person ? `${person.firstName} ${person.surname}` : row.label;
      const known = row.stressBefore !== undefined && row.stressAfter !== undefined;
      return <li key={row.officerId} className="decision-stress-officer">
        <ResultPortrait officerId={row.officerId} officers={officers} size={40} />
        <div><div className="decision-stress-name"><strong>{name}</strong>{!known && <span className={`decision-stress-delta ${row.delta > 0 ? 'tone-warn' : 'tone-mint'}`}>{signed(row.delta, 1)} stress</span>}</div>
          {known ? <StressDisplay value={row.stressAfter!} before={row.stressBefore} /> : null}
        </div>
      </li>;
    })}</ul> : <p className="decision-stress-legacy">No change to officer stress.</p>}
    {d.actualStressDeltas && changed.some((row) => row.stressAfter === undefined) && <p className="decision-legacy-note">Only the stress change was saved for this older decision.</p>}
    {!d.actualStressDeltas && <p className="decision-legacy-note">Older record: strain may differ from the applied change.</p>}
    {changed.some((row) => row.stressAfter !== undefined) && <StressGuide />}
  </section>;
}

/** Keep the detailed contribution numbers in their breakdown, not in narrative prose. */
export function plainDecisionCause(line: string): string {
  if (/^(Helped most|Held back by): /.test(line)) return line.replace(/ \([+-]?\d+(?:\.\d+)?\)\.$/, '.');
  return line;
}
