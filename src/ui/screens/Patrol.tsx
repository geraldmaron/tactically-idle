import { useEffect, useRef, useState } from 'react';
import {
  employedPatrol, PATROL_BOOSTS, PATROL_GRADES, patrolBoostQuote, patrolCandidates, patrolCapacity,
  patrolDismissQuote, patrolHireQuote, patrolProfile, patrolRates, patrolTrainingQuote, type PatrolQuote,
} from '../../sim/patrol';
import type { Command, GameState, Id, PatrolEmployee, PatrolGrade, PatrolReceipt } from '../../sim/types';
import { ManagerPortrait } from '../art/ManagerArt';
import { PlateArt, plateUrl } from '../art/Plates';
import { Disclosure } from '../components/Disclosure';
import { useNav } from '../components/nav';
import { Sheet } from '../components/Sheet';
import { useToast } from '../components/toast';
import { Button, Chip, EmptyState } from '../components/ui';
import { duration, moneyFull, perHour, rate, relativeTime } from '../format';
import { Icon } from '../icons';
import { useGame } from '../store';
import './patrol.css';

type Commitment = { kind: 'hire'; profileId: Id } | { kind: 'dismiss'; employeeId: Id } | { kind: 'training'; employeeId: Id } | { kind: 'boost'; boostId: Id };
type PatrolSelection = Commitment | { kind: 'candidates' };
const profileName = (profileId: Id) => {
  const profile = patrolProfile(profileId);
  return profile ? `${profile.firstName} ${profile.surname}` : 'Patrol employee';
};

/** Existing personnel portraits, without constructing a tactical Officer record for patrol staff. */
function PatrolPortrait({ profileId, size = 64 }: { profileId: Id; size?: number }) {
  const profile = patrolProfile(profileId);
  return <ManagerPortrait person={profile ? { ...profile, identityId: profile.id, note: null } : null} size={size} />;
}

export function PatrolScreen() {
  const game = useGame();
  const nav = useNav();
  const [selection, setSelection] = useState<PatrolSelection | null>(null);
  const employees = employedPatrol(game);
  useEffect(() => {
    if (nav.patrolFocus?.kind === 'hire') setSelection({ kind: 'candidates' });
    else if (nav.patrolFocus?.kind === 'training') setSelection({ kind: 'training', employeeId: nav.patrolFocus.employeeId });
  }, [nav.patrolRequest]);
  return <div className="page patrol-page">
    <PatrolSummary game={game} onHire={() => setSelection({ kind: 'candidates' })} />
    <div className="patrol-roster-head"><h2 className="section-title">Patrol team</h2><Button variant="primary" icon="plus" onClick={() => setSelection({ kind: 'candidates' })}>Hire patrol</Button></div>
    <p className="patrol-explanation">Coverage runs automatically. Patrol staff stay separate from SWAT squads.</p>
    {employees.length === 0 ? <EmptyState spot="noCandidates" title="No patrol staff">Hire into an authorized position to begin patrol coverage.</EmptyState>
      : <div className="patrol-roster">{employees.map((employee) => <PatrolEmployeeCard key={employee.id} employee={employee} game={game} onReview={(kind) => setSelection({ kind, employeeId: employee.id })} />)}</div>}
    <PatrolBoosts />
    {selection?.kind === 'candidates' ? <PatrolHiring onClose={() => setSelection(null)} onChoose={(profileId) => setSelection({ kind: 'hire', profileId })} />
      : selection && <PatrolCommitment key={JSON.stringify(selection)} selection={selection} onClose={() => setSelection(null)} />}
  </div>;
}

export function PatrolSummary({ game, onHire }: { game: GameState; onHire?: () => void }) {
  const at = game.department.clockHighWater;
  const rates = patrolRates(game, at);
  return <section className="patrol-summary" aria-label="Patrol division">
    <PatrolScene game={game} onHire={onHire} />
    <div className="patrol-summary-net"><span>Patrol net after payroll and operations</span><strong>{rate(rates.net)}</strong></div>
    <dl className="patrol-money-grid patrol-money-strip"><div><dt>Gross</dt><dd>{rate(rates.gross)}</dd></div><div><dt>Payroll</dt><dd>{perHour(rates.wages)}</dd></div><div><dt>Operations</dt><dd>{perHour(rates.operating)}</dd></div></dl>
    {rates.factor > 1 && <p className="patrol-boost-active">×{rates.factor} patrol gross · {rate(rates.boostAmount)} extra</p>}
  </section>;
}

function PatrolScene({ game, onHire }: { game: GameState; onHire?: () => void }) {
  const employees = employedPatrol(game);
  const rates = patrolRates(game, game.department.clockHighWater);
  const training = employees.filter((employee) => employee.training).length;
  return <div className={`patrol-scene${rates.productive === 0 ? ' patrol-scene-idle' : ''}`} data-patrol-scene-state={employees.length === 0 ? 'empty' : training ? 'training' : 'covering'}>
    <PlateArt src={plateUrl('scene_patrol_garage')} />
    <div className="patrol-scene-activity"><div><h2>Patrol division</h2><p>{rates.productive > 0 ? `${rates.productive} providing coverage` : employees.length ? 'Coverage paused for training' : 'Patrol positions are open'}</p>{training > 0 && <p>{training} in training</p>}</div></div>
    <div className="patrol-scene-posts" aria-label={`${employees.length} of ${patrolCapacity(game)} patrol positions filled`}>
      {Array.from({ length: patrolCapacity(game) }, (_, index) => {
        const employee = employees[index];
        return employee ? <button type="button" key={employee.id} className={`patrol-scene-post${employee.training ? ' patrol-scene-post-training' : ''}`} aria-label={`View ${profileName(employee.profileId)}, ${employee.training ? 'in training' : 'providing coverage'}`} onClick={() => { const card = document.querySelector<HTMLElement>(`[data-patrol-employee="${employee.id}"]`); card?.scrollIntoView({ block: 'center' }); card?.focus({ preventScroll: true }); }}><PatrolPortrait profileId={employee.profileId} size={40} /><span>{patrolProfile(employee.profileId)?.firstName ?? 'Employee'}</span>{employee.training && <Icon name="mortarboard" size={16} />}</button>
          : <button type="button" className="patrol-scene-post patrol-scene-post-open" key={`open-${index}`} onClick={onHire} disabled={!onHire} aria-label={`Hire into open patrol position ${index + 1}`}><span className="patrol-scene-open-slot" aria-hidden="true"><Icon name="plus" size={24} /></span><span>Open</span></button>;
      })}
    </div>
  </div>;
}

/** HQ's automatic workforce summary and one useful next staffing action. */
export function PatrolActivity({ game, departmentNet }: { game: GameState; departmentNet: number }) {
  const nav = useNav();
  const employees = employedPatrol(game);
  const candidates = patrolCandidates(game);
  const hire = candidates[0] ? patrolHireQuote(game, candidates[0].id) : null;
  const trainee = employees.find((employee) => patrolTrainingQuote(game, employee.id).ok);
  const next = trainee ? { label: 'Train patrol', detail: profileName(trainee.profileId), act: () => nav.openPatrol({ kind: 'training', employeeId: trainee.id }) }
    : hire?.ok ? { label: 'Hire patrol', detail: `${moneyFull(hire.upfront)} · ${rate(hire.netDelta)} base net`, act: () => nav.openPatrol({ kind: 'hire' }) }
      : { label: 'Manage patrol', detail: `${employees.length} of ${patrolCapacity(game)} positions filled`, act: () => nav.setTeamSection('patrol') };
  const rates = patrolRates(game, game.department.clockHighWater);
  return <section className="hq-patrol" aria-label="Patrol activity">
    <div className="hq-patrol-top" data-patrol-funding-origin><span className="hq-patrol-faces" aria-hidden="true">{employees.slice(0, 3).map((employee) => <PatrolPortrait key={employee.id} profileId={employee.profileId} size={32} />)}</span><div><strong>Patrol coverage</strong><span>{rates.productive} productive · {rates.employed} employed</span></div><div className="hq-patrol-rate"><span>Department net</span><strong>{rate(departmentNet)}</strong></div></div>
    <div className="hq-patrol-next"><span>{next.detail}</span><Button variant="primary" onClick={next.act}>{next.label}</Button></div>
    <Disclosure name="hq-patrol-funding" summary="Patrol funding breakdown"><dl className="patrol-money-grid"><div><dt>Patrol gross</dt><dd>{rate(rates.gross)}</dd></div><div><dt>Patrol payroll</dt><dd>{perHour(rates.wages)}</dd></div><div><dt>Patrol operations</dt><dd>{perHour(rates.operating)}</dd></div><div><dt>Patrol net</dt><dd>{rate(rates.net)}</dd></div></dl><p>Funding is credited automatically. Department net also includes SWAT payroll and other department costs.</p></Disclosure>
  </section>;
}

function PatrolEmployeeCard({ employee, game, onReview }: { employee: PatrolEmployee; game: GameState; onReview: (kind: 'dismiss' | 'training') => void }) {
  const grade = PATROL_GRADES[employee.grade];
  const next = employee.grade < 3 ? PATROL_GRADES[(employee.grade + 1) as PatrolGrade] : null;
  const training = employee.training;
  const readyToTrain = patrolTrainingQuote(game, employee.id).ok;
  return <article className="patrol-card" data-patrol-employee={employee.id} tabIndex={-1} aria-label={profileName(employee.profileId)}>
    <div className="patrol-person"><PatrolPortrait profileId={employee.profileId} /><div><h3>{profileName(employee.profileId)}</h3><span>Grade {employee.grade} · {grade.name}</span><Chip tone={training ? 'blue' : 'mint'} icon={training ? 'mortarboard' : 'check'}>{training ? 'In training' : 'Providing coverage'}</Chip></div></div>
    <div className="patrol-card-finance"><div><strong>{training ? '$0/h' : perHour(grade.gross)}</strong><span>{training ? 'Gross during training' : 'Base gross'}</span></div><div><span>Payroll {perHour(grade.wage)}</span><span>Operations {perHour(grade.operating)}</span></div></div>
    {training ? <p className="patrol-training-status">{PATROL_GRADES[training.toGrade].name} · {duration(Math.max(0, training.endsAt - game.department.clockHighWater))} remaining. Grade changes when training finishes.</p>
      : next ? <div className="patrol-grade-progress"><progress value={Math.min(employee.serviceHours, next.serviceHours)} max={next.serviceHours} aria-label={`Service toward ${next.name}`} /><span>{Math.floor(employee.serviceHours)} / {next.serviceHours} funded hours · Level {next.departmentLevel} required</span></div> : <p className="patrol-training-status">Highest patrol grade</p>}
    <div className="patrol-card-actions">{next && <Button variant={readyToTrain ? 'primary' : 'secondary'} onClick={() => onReview('training')} disabled={!!training} aria-label={`Review training for ${profileName(employee.profileId)}`}>{readyToTrain ? 'Train for next grade' : 'Review training'}</Button>}<Button variant="ghost" onClick={() => onReview('dismiss')} aria-label={`Review dismissal for ${profileName(employee.profileId)}`}>Dismiss</Button></div>
  </article>;
}

function PatrolHiring({ onClose, onChoose }: { onClose: () => void; onChoose: (profileId: Id) => void }) {
  const game = useGame();
  const candidates = patrolCandidates(game);
  return <Sheet open onClose={onClose} title="Hire patrol" subtitle={`${employedPatrol(game).length} of ${patrolCapacity(game)} authorized positions filled`} className="patrol-sheet">
    <div className="patrol-candidates">{candidates.length === 0 ? <EmptyState spot="noCandidates" title="No patrol candidates">Every available identity is already employed or offered elsewhere.</EmptyState> : candidates.map((person) => {
      const quote = patrolHireQuote(game, person.id);
      return <article className="patrol-card" data-patrol-candidate={person.id} key={person.id}><div className="patrol-person"><PatrolPortrait profileId={person.id} size={76} /><div><h3>{profileName(person.id)}</h3><span>{PATROL_GRADES[1].name}</span></div></div><div className="patrol-candidate-terms"><span>Payroll {perHour(quote.wageDelta)} · Operations {perHour(quote.operatingDelta)}</span><strong>{rate(quote.netDelta)} unboosted net</strong></div>{quote.reason && <p className="reason">{quote.reason}</p>}<Button variant="primary" block disabled={!quote.ok} onClick={() => onChoose(person.id)} aria-label={`Review hire for ${profileName(person.id)}`}>Review hire · {moneyFull(quote.upfront)}</Button></article>;
    })}</div>
  </Sheet>;
}

/** Reused by Team and Store; the same engine quote and confirmation handle either entry point. */
export function PatrolBoosts() {
  const game = useGame();
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const at = game.department.clockHighWater;
  return <section className="patrol-boosts" aria-label="Patrol funding boosts"><h2 className="section-title">Patrol funding boosts</h2>{Object.entries(PATROL_BOOSTS).map(([id, definition]) => {
    const quote = patrolBoostQuote(game, id);
    const active = game.patrol.boosts.find((boost) => boost.id === id && boost.expiresAt > at);
    return <div className="patrol-boost-card" key={id}><div className="patrol-boost-heading"><Icon name="trend" size={20} /><div><h3>Community grant</h3><span>×{definition.factor} patrol gross · {definition.hours}h</span></div><strong>{moneyFull(quote.upfront)}</strong></div><p>{active ? `Active · ${duration(active.expiresAt - at)} remaining. Another grant extends the duration.` : 'Increases eligible patrol gross. Allocation, call rewards and costs stay unchanged.'}</p><p className="patrol-boost-change">{active ? 'Extends the current rate' : `${rate(quote.netDelta)} department net while active`}</p><p>Estimated additional funding {moneyFull(quote.incrementalReturn)} over {definition.hours}h</p><Button block disabled={!quote.ok} onClick={() => setSelectedId(id)}>{active ? 'Extend grant' : 'Review grant'}</Button>{quote.reason && <p className="reason">{quote.reason}</p>}</div>;
  })}{selectedId && <PatrolCommitment selection={{ kind: 'boost', boostId: selectedId }} onClose={() => setSelectedId(null)} />}</section>;
}

function PatrolQuoteRows({ quote, boost = false }: { quote: PatrolQuote; boost?: boolean }) {
  return <div className="patrol-quote"><dl className="patrol-money-grid"><div><dt>Cost now</dt><dd>{moneyFull(quote.upfront)}</dd></div><div><dt>{boost ? 'Net change while active' : 'Unboosted net change'}</dt><dd>{rate(quote.netDelta)}</dd></div>{!boost && <><div><dt>Payroll change</dt><dd>{rate(quote.wageDelta)}</dd></div><div><dt>Operations change</dt><dd>{rate(quote.operatingDelta)}</dd></div></>}</dl><p className="patrol-projection">Department net{boost ? '' : ' without boosts'}<strong>{rate(quote.netBefore)} <span aria-hidden="true">→</span><span className="sr-only"> to </span> {rate(quote.netAfter)}</strong></p>{quote.paybackHours !== null && <p>Estimated payback {Math.round(quote.paybackHours * 10) / 10} productive hours</p>}</div>;
}

function PatrolCommitment({ selection, onClose }: { selection: Commitment; onClose: () => void }) {
  const game = useGame();
  const { act } = useToast();
  const busy = useRef(false);
  const [receipt, setReceipt] = useState<PatrolReceipt | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const employee = 'employeeId' in selection ? game.patrol.personnel.find((person) => person.id === selection.employeeId) : undefined;
  const profileId = selection.kind === 'hire' ? selection.profileId : employee?.profileId;
  const who = profileId ? profileName(profileId) : 'Community grant';
  const training = selection.kind === 'training' ? patrolTrainingQuote(game, selection.employeeId) : null;
  const quote = selection.kind === 'hire' ? patrolHireQuote(game, selection.profileId) : selection.kind === 'dismiss' ? patrolDismissQuote(game, selection.employeeId) : selection.kind === 'boost' ? patrolBoostQuote(game, selection.boostId) : training!;
  const title = selection.kind === 'hire' ? 'Review hire' : selection.kind === 'dismiss' ? 'Review dismissal' : selection.kind === 'training' ? 'Review training' : 'Community grant';
  const action = selection.kind === 'hire' ? 'Confirm hire' : selection.kind === 'dismiss' ? 'Confirm dismissal' : selection.kind === 'training' ? 'Start training' : 'Activate grant';
  const submit = () => {
    if (busy.current || !quote.ok) return;
    busy.current = true;
    const command: Command = selection.kind === 'hire' ? { type: 'hirePatrol', profileId: selection.profileId } : selection.kind === 'dismiss' ? { type: 'dismissPatrol', employeeId: selection.employeeId } : selection.kind === 'training' ? { type: 'startPatrolTraining', employeeId: selection.employeeId } : { type: 'activatePatrolBoost', boostId: selection.boostId };
    const result = act(command);
    if (result.ok && result.patrolReceipt) setReceipt(result.patrolReceipt);
    else { setFailure(result.ok ? 'The update completed without a receipt. Check the current roster.' : result.reason); busy.current = false; }
  };
  const confirmation = receipt?.kind === 'hire' ? `${who} hired` : receipt?.kind === 'dismiss' ? `${who} dismissed` : receipt?.kind === 'training' ? `${who} enrolled` : 'Community grant activated';
  return <Sheet open onClose={onClose} title={receipt ? 'Patrol update confirmed' : title} subtitle={who} className="patrol-sheet" interactionKey={receipt ? 'receipt' : 'review'} footer={receipt ? <Button block variant="primary" onClick={onClose}>Done</Button> : <div className="patrol-confirm-actions"><Button onClick={onClose}>Cancel</Button><Button variant={selection.kind === 'dismiss' ? 'danger' : 'primary'} disabled={!quote.ok} onClick={submit}>{action} · {moneyFull(quote.upfront)}</Button></div>}>
    <div className="patrol-commitment">{profileId && <div className="patrol-review-person"><PatrolPortrait profileId={profileId} size={108} /><strong>{who}</strong></div>}
      {receipt ? <div className="patrol-receipt" role="status"><Icon name="check" size={16} /><div><strong>{confirmation}</strong><p>{moneyFull(Math.abs(receipt.amount))} funding paid</p>{receipt.endsAt && <p>{receipt.kind === 'training' ? 'Training completes' : 'Grant ends'} {relativeTime(receipt.endsAt, game.department.clockHighWater)}</p>}{receipt.kind === 'training' ? <p>Current grade and payroll remain until training finishes.</p> : <p>{receipt.kind === 'boost' ? 'Net change while active' : 'Unboosted net change'} {rate(receipt.netDelta)}</p>}</div></div>
        : <>{training?.toGrade && <div className="patrol-training-plan"><h3>{PATROL_GRADES[training.toGrade].name}</h3><p>{PATROL_GRADES[training.toGrade].trainingHours}h training · department level {PATROL_GRADES[training.toGrade].departmentLevel} · {PATROL_GRADES[training.toGrade].serviceHours} funded service hours</p><p>Unboosted department net during training {rate(training.trainingNet)}. Wages and operating costs continue.</p><p>After completion</p></div>}<PatrolQuoteRows quote={quote} boost={selection.kind === 'boost'} />{training && quote.paybackHours !== null && <p className="patrol-explanation">Training payback includes the gross funding lost during training.</p>}{selection.kind === 'dismiss' && <p>Severance is paid now. This person leaves coverage and remains in department history.</p>}{selection.kind === 'boost' && <p>The grant affects patrol gross only. Its duration extends when purchased again.</p>}{(failure || quote.reason) && <p className="reason" role="status">{failure ?? quote.reason}</p>}</>}
    </div>
  </Sheet>;
}
