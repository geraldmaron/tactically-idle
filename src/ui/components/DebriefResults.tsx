import type { DebriefResult, DecisionView, Officer } from '../../sim/types';
import { Portrait } from '../portraits/Portrait';
import { Silhouette } from '../portraits/Silhouette';
import { Icon } from '../icons';
import { opMinutes, signed, signedMoney } from '../format';
import { Card, Chip, Meter, Ring, SubHead } from './ui';
import { STRESS_LABEL, StressDisplay, changeText } from './StressDisplay';
import { stressBand } from '../../sim/officer';
import { CivilianOutcomeList, OfficerInjuryResult } from './IncidentPeople';
import './debrief-results.css';
import { Disclosure } from './Disclosure';
import { RankInsignia } from './RankInsignia';
import { RANKS } from '../../content/ranks';

/** Only identity is read from the roster. All result values come from the saved debrief. */
export type DebriefOfficers = Record<string, Pick<Officer, 'surname' | 'firstName'> & Partial<Pick<Officer, 'id' | 'identityId' | 'portrait' | 'role'>>>;
type Condition = DebriefResult['officerCondition'][number];
const scoreTone = (value: number) => value >= 70 ? 'hi' : value >= 40 ? 'mid' : 'lo';


/** What each tracked person's own score lines cost or paid, so a person's tile carries it and the
 * scoring list does not say the same outcome a second time. */
function personValues(d: DebriefResult): Map<string, { trust: number; strain: number }> {
  const values = new Map<string, { trust: number; strain: number }>();
  const ids = new Set((d.civilianOutcomes ?? []).map((person) => person.id));
  for (const line of d.scoreLines ?? []) {
    const id = /^person:(.+):[^:]+$/.exec(line.key)?.[1];
    if (!id || !ids.has(id)) continue;
    const have = values.get(id) ?? { trust: 0, strain: 0 };
    values.set(id, { trust: have.trust + line.trust, strain: have.strain + line.strain });
  }
  return values;
}

export function DebriefSummary({ debrief: d, includeRewards = true }: { debrief: DebriefResult; includeRewards?: boolean }) {
  return <Card className="result-summary">
    {d.disposition && <CompletionResult debrief={d} />}
    {d.civilianOutcomes?.length ? <section className="result-civilian-outcomes"><span className="result-score-label"><Icon name="civilian" size={16} />People at the call</span><CivilianOutcomeList outcomes={d.civilianOutcomes} values={personValues(d)} /></section> : <div className={`result-scores${d.disposition ? ' result-scores-explicit' : ''}`}>
      {(d.disposition ? [{ label: 'Civilian safety', icon: 'civilian', result: d.civilianSafety }] as const : [{ label: 'Call progress', icon: 'flag', result: d.objective }, { label: 'Civilian safety', icon: 'civilian', result: d.civilianSafety }] as const).map(({ label, icon, result }) => <section className={`result-score result-score-${scoreTone(result.score)}`} key={label} aria-label={`${label} ${Math.round(result.score)}/100`}>
        <Ring value={result.score} size={58}><strong className="result-score-value">{Math.round(result.score)}</strong></Ring>
        <span className="result-score-text">
          <span className="result-score-label"><Icon name={icon} size={14} />{label}</span>
          <span className="result-score-outcome">{result.label}</span>
          <Meter value={result.score} tone={scoreTone(result.score)} label={label} valueText={`${Math.round(result.score)} of 100; ${result.label}`} />
        </span>
      </section>)}
    </div>}
    {includeRewards && <DebriefRewards debrief={d} />}
  </Card>;
}

/** Kept separate in the full debrief so people and their condition precede department rewards. */
export function DebriefRewards({ debrief: d }: { debrief: DebriefResult }) {
  const promotions = d.officerCondition.reduce((total, c) => total + (c.promotions?.length ?? 0), 0);
  return <section className="result-rewards" aria-label="Rewards">
      <span className="result-score-label"><Icon name="cash" size={16} />Rewards</span>
      <div className="chips result-reward-chips">
        {d.fundingReward !== 0 && <Chip tone={d.fundingReward < 0 ? 'danger' : 'mint'} icon="cash">{signedMoney(d.fundingReward)} funding</Chip>}
        {d.trustDelta !== 0 && <Chip tone={d.trustDelta < 0 ? 'danger' : 'mint'} icon="shield">{signed(d.trustDelta, 1)} trust</Chip>}
        {promotions > 0 && <Chip tone="amber" icon="medal">{promotions === 1 ? '1 promotion' : `${promotions} promotions`}</Chip>}
        {!!d.serviceEarned && <Chip tone="mint" icon="medal">{signed(d.serviceEarned)} service</Chip>}
        {d.levelReached !== undefined && <Chip tone="amber" icon="medal">Department level {d.levelReached}</Chip>}
        {d.fundingReward === 0 && d.trustDelta === 0 && !d.serviceEarned && !promotions && <span className="dim">No funding or trust change.</span>}
      </div>
    </section>;
}

/** V13: what the call was scored on, line by line (the trust lines add up to the trust change before
 * the department's 0 to 100 clamp), and the force the team used, on whom, and why. */
export function DebriefScore({ debrief: d }: { debrief: DebriefResult }) {
  // A tracked person's line is on their tile (People at the call), so it is not listed twice.
  const onTiles = personValues(d);
  const scoreLines = (d.scoreLines ?? []).filter((line) => { const id = /^person:(.+):[^:]+$/.exec(line.key)?.[1]; return !(id && onTiles.has(id)); });
  if (!scoreLines.length && !d.forceLines?.length) return null;
  return <Card className="result-score-lines">
    {!!scoreLines.length && <section aria-label="How the call was scored">
      <SubHead icon="gauge">How the call was scored</SubHead>
      <ul className="score-lines">{scoreLines.map((line) => <li key={line.key} className={`score-line${line.key === 'result' ? ' score-line-result' : ''}`} data-score-line={line.key}>
        <span className="score-line-text">{line.text}</span>
        <span className="score-line-values">
          {line.trust !== 0 && <span className={line.trust < 0 ? 'tone-danger' : 'tone-mint'}>{signed(line.trust, 1)} trust</span>}
          {line.strain !== 0 && <span className={line.strain > 0 ? 'tone-warn' : 'tone-mint'}>{signed(line.strain, 1)} strain</span>}
          {line.trust === 0 && line.strain === 0 && <span className="tone-neutral">No change</span>}
        </span>
      </li>)}</ul>
    </section>}
    {!!d.forceLines?.length && <section aria-label="Force used">
      <SubHead icon="shield">Force used</SubHead>
      <ul className="force-lines">{d.forceLines.map((line, index) => <li key={index}>
        <span>{line.text}</span>
        {line.reason && <span className="force-line-reason"><span className="force-line-why">Why</span>{line.reason}</span>}
      </li>)}</ul>
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
  return <span className="result-officer-fallback" role="img" aria-label={officer ? `${officer.firstName} ${officer.surname}; no photo on file` : `Officer ${officerId}; identity no longer on file`} style={{ width: size, height: Math.round(size * 1.04) }}><Silhouette kind="officer" className="result-officer-silhouette" seed={officer ? `${officer.firstName} ${officer.surname}` : officerId} /></span>;
}

function OfficerChange({ condition: c, officers, casualty }: { condition: Condition; officers: DebriefOfficers; casualty?: NonNullable<DebriefResult['officerCasualties']>[number] }) {
  const officer = officers[c.officerId];
  const label = officer ? `${officer.firstName} ${officer.surname}` : 'Former officer';
  const delta = c.stressAfter - c.stressBefore;
  const change = changeText(c.stressBefore, c.stressAfter);
  const before = stressBand(Math.max(0, Math.min(100, c.stressBefore))), after = stressBand(Math.max(0, Math.min(100, c.stressAfter)));
  return <li className={`result-officer${casualty ? ' result-officer-hurt' : ''}`} data-officer-result={c.officerId}>
    <ResultPortrait officerId={c.officerId} officers={officers} size={44} />
    <div className="result-officer-body">
      <div className="result-officer-heading">
        <div><strong>{label}</strong>{!officer && <span className="result-officer-id">{c.officerId}</span>}</div>
        {c.xpGained !== 0 && <span className={c.xpGained > 0 ? 'result-xp' : 'result-xp tone-danger'}>{signed(c.xpGained, 1)} XP{c.promotions?.length ? <>, <RankInsignia rank={c.promotions[c.promotions.length - 1].rank} size={13} /> {RANKS[c.promotions[c.promotions.length - 1].rank].abbr}</> : null}</span>}
      </div>
      {casualty && <OfficerInjuryResult casualty={casualty} />}
      <div className="result-stress-row">
        <StressDisplay value={c.stressAfter} before={delta !== 0 ? c.stressBefore : undefined} compact />
        {delta !== 0 && <strong className={`result-stress-delta ${change.direction > 0 ? 'tone-warn' : change.direction < 0 ? 'tone-mint' : ''}`}>{change.text}</strong>}
        {delta === 0 && <span className="result-stress-unchanged">Stress unchanged</span>}
      </div>
      <span className="result-stress-track" aria-hidden="true">
        <i className={`stress-fill-${after}`} style={{ width: `${Math.max(2, Math.min(100, c.stressAfter))}%` }} />
        {delta !== 0 && <b style={{ left: `${Math.max(0, Math.min(100, c.stressBefore))}%` }} />}
      </span>
      {before !== after && <span className="result-stress-crossing">Now {STRESS_LABEL[after].toLowerCase()}</span>}
    </div>
  </li>;
}

export function OfficerResults({ debrief: d, officers }: { debrief: DebriefResult; officers: DebriefOfficers }) {
  const casualties = new Map((d.officerCasualties ?? []).map((casualty) => [casualty.officerId, casualty]));
  const extraCasualties = (d.officerCasualties ?? []).filter((casualty) => !d.officerCondition.some((condition) => condition.officerId === casualty.officerId));
  const changed = d.officerCondition.filter((c) => casualties.has(c.officerId) || c.xpGained !== 0 || c.stressAfter !== c.stressBefore);
  const unchanged = d.officerCondition.filter((c) => !changed.includes(c));
  const xp = d.officerCondition.reduce((total, c) => total + c.xpGained, 0);
  const promoted = d.officerCondition.flatMap((c) => (c.promotions ?? []).map((p) => ({ ...p, officerId: c.officerId })));
  return <Card className="result-officers">
    <div className="result-section-heading"><SubHead icon="people">Officer changes</SubHead>{xp !== 0 && <span className="result-xp">{signed(xp, 1)} XP total</span>}</div>
    {promoted.length > 0 && <ul className="result-promotions" aria-label="Promotions">{promoted.map((p) => {
      const officer = officers[p.officerId];
      return <li key={`${p.officerId}:${p.rank}`} className="result-promotion" data-promotion={p.rank}>
        <span className="result-promotion-mark"><RankInsignia rank={p.rank} size={30} /></span>
        <span className="result-promotion-body">
          <span className="result-promotion-kicker">Promoted</span>
          <strong>{officer ? `${officer.firstName} ${officer.surname}` : 'Former officer'} makes {RANKS[p.rank].title}</strong>
          {p.line && <span className="result-promotion-line">{p.line}</span>}
        </span>
      </li>;
    })}</ul>}
    {changed.length > 0 && <ul className="result-officer-list">{changed.map((c) => <OfficerChange key={c.officerId} condition={c} officers={officers} casualty={casualties.get(c.officerId)} />)}</ul>}
    {extraCasualties.length > 0 && <ul className="result-officer-list">{extraCasualties.map((casualty) => <li className="result-officer" key={casualty.officerId}><ResultPortrait officerId={casualty.officerId} officers={officers} /><div className="result-officer-body"><strong>{officers[casualty.officerId] ? `${officers[casualty.officerId].firstName} ${officers[casualty.officerId].surname}` : 'Former officer'}</strong><OfficerInjuryResult casualty={casualty} /></div></li>)}</ul>}
    {unchanged.length > 0 && <Disclosure name="debrief-unchanged" className="result-disclosure result-unchanged" hint="View condition"
      summary={<span className="result-unchanged-summary"><span className="result-portrait-stack" aria-hidden="true">{unchanged.slice(0, 3).map((c) => <ResultPortrait key={c.officerId} officerId={c.officerId} officers={officers} size={28} />)}</span><span>{unchanged.length} officer{unchanged.length === 1 ? '' : 's'} unchanged</span></span>}>
      <ul className="result-officer-list">{unchanged.map((c) => <OfficerChange key={c.officerId} condition={c} officers={officers} casualty={casualties.get(c.officerId)} />)}</ul>
    </Disclosure>}
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
