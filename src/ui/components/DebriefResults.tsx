import type { DebriefResult, DecisionView, Officer } from '../../sim/types';
import { Portrait } from '../portraits/Portrait';
import { Icon } from '../icons';
import { opMinutes, signed, signedMoney } from '../format';
import { Card, Chip, Meter, SubHead } from './ui';
import { StressDisplay } from './StressDisplay';
import { CivilianOutcomeList, OfficerInjuryResult } from './IncidentPeople';
import './debrief-results.css';

/** Only identity is read from the roster. All result values come from the saved debrief. */
export type DebriefOfficers = Record<string, Pick<Officer, 'surname' | 'firstName'> & Partial<Pick<Officer, 'id' | 'identityId' | 'portrait' | 'role'>>>;
type Condition = DebriefResult['officerCondition'][number];
const scoreTone = (value: number) => value >= 70 ? 'hi' : value >= 40 ? 'mid' : 'lo';

export function DebriefSummary({ debrief: d }: { debrief: DebriefResult }) {
  return <Card className="result-summary">
    {d.disposition && <CompletionResult debrief={d} />}
    {d.civilianOutcomes?.length ? <section className="result-civilian-outcomes"><span className="result-score-label"><Icon name="civilian" size={16} />People at the call</span><CivilianOutcomeList outcomes={d.civilianOutcomes} /></section> : <div className={`result-scores${d.disposition ? ' result-scores-explicit' : ''}`}>
      {(d.disposition ? [{ label: 'Civilian safety', icon: 'civilian', result: d.civilianSafety }] as const : [{ label: 'Call progress', icon: 'flag', result: d.objective }, { label: 'Civilian safety', icon: 'civilian', result: d.civilianSafety }] as const).map(({ label, icon, result }) => <section className="result-score" key={label} aria-label={`${label} ${Math.round(result.score)}/100`}>
        <span className="result-score-label"><Icon name={icon} size={16} />{label}</span>
        <strong className="result-score-value">{Math.round(result.score)}<span>/100</span></strong>
        <Meter value={result.score} tone={scoreTone(result.score)} label={label} valueText={`${Math.round(result.score)} of 100; ${result.label}`} />
        <span className="result-score-outcome">{result.label}</span>
      </section>)}
    </div>}
    {d.practice ? <p className="result-practice"><Icon name="info" size={18} /><span><strong>Practice complete</strong>No lasting changes to officers, supplies or reputation. No rewards earned. A better result still counts as your casebook best.</span></p> : <section className="result-rewards" aria-label="Rewards">
      <span className="result-score-label"><Icon name="cash" size={16} />Rewards</span>
      <div className="chips">
        {d.fundingReward !== 0 && <Chip tone={d.fundingReward < 0 ? 'danger' : 'mint'} icon="cash">{signedMoney(d.fundingReward)} funding</Chip>}
        {d.trustDelta !== 0 && <Chip tone={d.trustDelta < 0 ? 'danger' : 'mint'} icon="shield">{signed(d.trustDelta, 1)} trust</Chip>}
        {d.devPointReward !== 0 && <Chip tone={d.devPointReward < 0 ? 'danger' : 'amber'} icon="chart">{signed(d.devPointReward)} dev point{Math.abs(d.devPointReward) === 1 ? '' : 's'}</Chip>}
        {d.fundingReward === 0 && d.trustDelta === 0 && d.devPointReward === 0 && <span className="dim">No funding, trust or development-point change.</span>}
      </div>
    </section>}
  </Card>;
}

/** Saved completion evidence wins over numeric progress and later scenario content. */
export function completionLabel(d: DebriefResult): string {
  if (!d.disposition) return d.objective.label;
  if (d.disposition === 'relief_partial') return 'Partial progress · call unresolved';
  if (!d.completionAchieved) return 'Call unresolved';
  if (d.disposition === 'care_accepted') return d.receivingService ? 'Care accepted' : 'Call unresolved';
  if (d.disposition === 'followup_agreed') return 'Follow-up agreed';
  return d.disposition === 'resolved' ? 'Call resolved' : 'Call unresolved';
}

export function CompletionResult({ debrief: d }: { debrief: DebriefResult }) {
  const label = completionLabel(d);
  const complete = d.completionAchieved && !label.includes('unresolved');
  return <section className={`result-completion${complete ? ' result-completion-achieved' : ''}`} aria-label="Call outcome">
    <span className="result-score-label"><Icon name="flag" size={16} />Call outcome</span>
    <strong className="result-completion-label">{label}</strong>
    {d.receivingService && <p>{d.receivingService.label} accepted responsibility at {opMinutes(d.receivingService.acceptedAt)}.</p>}
    {!!d.remainingTasks?.length && <div className="result-remaining"><h3>Still needed</h3><ul>{d.remainingTasks.map((task) => <li key={task}>{task}</li>)}</ul></div>}
    {!complete && !d.remainingTasks?.length && <p>Further work was still needed when the call ended.</p>}
  </section>;
}

export function ResultPortrait({ officerId, officers, size = 48 }: { officerId: string; officers: DebriefOfficers; size?: number }) {
  const officer = officers[officerId];
  if (officer?.role && officer.portrait) return <Portrait officer={{ ...officer, id: officer.id ?? officerId, role: officer.role, portrait: officer.portrait }} size={size} className="result-officer-portrait" />;
  const initials = officer ? `${officer.firstName.slice(0, 1)}${officer.surname.slice(0, 1)}` : '?';
  return <span className="result-officer-fallback" role="img" aria-label={officer ? `${officer.firstName} ${officer.surname}; no photo on file` : `Officer ${officerId}; identity no longer on file`} style={{ width: size, height: Math.round(size * 1.04) }}><span aria-hidden="true">{initials}</span></span>;
}

function OfficerChange({ condition: c, officers, practice, casualty }: { condition: Condition; officers: DebriefOfficers; practice: boolean; casualty?: NonNullable<DebriefResult['officerCasualties']>[number] }) {
  const officer = officers[c.officerId];
  const label = officer ? `${officer.firstName} ${officer.surname}` : 'Former officer';
  const delta = c.stressAfter - c.stressBefore;
  return <li className="result-officer" data-officer-result={c.officerId}>
    <ResultPortrait officerId={c.officerId} officers={officers} />
    <div className="result-officer-body">
      <div className="result-officer-heading">
        <div><strong>{label}</strong>{!officer && <span className="result-officer-id">{c.officerId}</span>}</div>
        {!practice && c.xpGained !== 0 && <span className={c.xpGained > 0 ? 'result-xp' : 'result-xp tone-danger'}>{signed(c.xpGained, 1)} XP</span>}
      </div>
      {casualty && <OfficerInjuryResult casualty={casualty} practice={practice} />}
      <StressDisplay value={c.stressAfter} before={delta !== 0 ? c.stressBefore : undefined} />
      {delta === 0 && <span className="result-stress-unchanged">Stress unchanged</span>}
    </div>
  </li>;
}

export function OfficerResults({ debrief: d, officers }: { debrief: DebriefResult; officers: DebriefOfficers }) {
  const casualties = new Map((d.officerCasualties ?? []).map((casualty) => [casualty.officerId, casualty]));
  const extraCasualties = (d.officerCasualties ?? []).filter((casualty) => !d.officerCondition.some((condition) => condition.officerId === casualty.officerId));
  const changed = d.officerCondition.filter((c) => casualties.has(c.officerId) || (!d.practice && (c.xpGained !== 0 || c.stressAfter !== c.stressBefore)));
  const unchanged = d.officerCondition.filter((c) => !changed.includes(c));
  const xp = d.practice ? 0 : d.officerCondition.reduce((total, c) => total + c.xpGained, 0);
  return <Card className="result-officers">
    <div className="result-section-heading"><SubHead icon="people">Officer {d.practice ? 'condition' : 'changes'}</SubHead>{xp !== 0 && <span className="result-xp">{signed(xp, 1)} XP total</span>}</div>
    {changed.length > 0 && <ul className="result-officer-list">{changed.map((c) => <OfficerChange key={c.officerId} condition={c} officers={officers} practice={d.practice} casualty={casualties.get(c.officerId)} />)}</ul>}
    {extraCasualties.length > 0 && <ul className="result-officer-list">{extraCasualties.map((casualty) => <li className="result-officer" key={casualty.officerId}><ResultPortrait officerId={casualty.officerId} officers={officers} /><div className="result-officer-body"><strong>{officers[casualty.officerId] ? `${officers[casualty.officerId].firstName} ${officers[casualty.officerId].surname}` : 'Former officer'}</strong><OfficerInjuryResult casualty={casualty} practice={d.practice} /></div></li>)}</ul>}
    {unchanged.length > 0 && <details className="result-disclosure result-unchanged">
      <summary><span className="result-unchanged-summary"><span className="result-portrait-stack" aria-hidden="true">{unchanged.slice(0, 3).map((c) => <ResultPortrait key={c.officerId} officerId={c.officerId} officers={officers} size={28} />)}</span><span>{unchanged.length} officer{unchanged.length === 1 ? '' : 's'} · unchanged<span className="result-summary-hint">View condition</span></span></span></summary>
      <ul className="result-officer-list">{unchanged.map((c) => <OfficerChange key={c.officerId} condition={c} officers={officers} practice={d.practice} casualty={casualties.get(c.officerId)} />)}</ul>
    </details>}
    {d.officerCondition.length === 0 && extraCasualties.length === 0 && <p className="result-empty dim">No officers deployed.</p>}
  </Card>;
}

// Saved older records have only prose. Keep consequential evidence visible even when
// there is no structured decision delta, without interpreting it as a new game event.
const consequenceWords = /\b(injur\w*|wound\w*|kill\w*|dead|death\w*|fatal\w*|harm\w*|hurt|casualt\w*|lost|loss\w*|bleed\w*|damage\w*|escap\w*)\b/i;

export function visibleDebriefConsequences(d: DebriefResult, decisions: DecisionView[] = d.decisions ?? []): string[] {
  const lines = decisions.flatMap((decision) => {
    const structured = decision.officerCasualties !== undefined;
    const material = (decision.band === 'adverse' && !decision.resultLabel) || decision.civilianSafetyDelta < 0 || decision.objectiveDelta < 0 || !!decision.officerCasualties?.length;
    const narrative = decision.consequences.filter((line) => !line.startsWith('Next: ') && (material || (!structured && consequenceWords.test(line))));
    // Current records already contain every committed event. Their explanations
    // repeat joined narrative, so reserve prose mining for older saved records.
    const evidence = structured ? [] : decision.explanation.filter((line) => consequenceWords.test(line));
    const losses = [
      ...(decision.civilianSafetyDelta < 0 ? [`Civilian safety ${signed(decision.civilianSafetyDelta, 1)}.`] : []),
      ...(decision.objectiveDelta < 0 ? [`Call progress ${signed(decision.objectiveDelta, 1)}.`] : []),
    ];
    return [...new Set([...losses, ...narrative, ...evidence])].map((line) => `${decision.title}: ${line}`);
  });
  const causes = d.causes.filter((line) => consequenceWords.test(line));
  return [...new Set([...lines, ...causes])].filter((line) => line !== d.endingSummary);
}

export function DebriefConsequences({ debrief, decisions }: { debrief: DebriefResult; decisions?: DecisionView[] }) {
  const lines = visibleDebriefConsequences(debrief, decisions);
  if (!lines.length) return null;
  return <Card className="result-consequences"><SubHead icon="warning">Recorded consequences</SubHead><ul>{lines.map((line, index) => <li key={index}>{line}</li>)}</ul></Card>;
}
