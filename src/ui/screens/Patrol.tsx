import { useEffect, useRef, useState } from 'react';
import {
  employedPatrol, PATROL_BOOSTS, PATROL_GRADES, patrolBoostQuote, patrolCandidates, patrolCapacity,
  patrolDismissQuote, patrolHireQuote, patrolProfile, patrolRates, patrolTrainingQuote, type PatrolQuote,
} from '../../sim/patrol';
import type { Command, GameState, Id, PatrolEmployee, PatrolGrade, PatrolReceipt } from '../../sim/types';
import { ManagerPortrait } from '../art/ManagerArt';
import { useBeat } from '../components/Beat';
import { useNav } from '../components/nav';
import { personaNote } from '../../content/personas';
import { rotation, turnIndex } from '../people/story-line';
import { useStoryClock } from '../people/story-clock';
import { TeamScene } from './TeamScene';
import { PlateArt, plateUrl } from '../art/Plates';
import { patrolEnrolledBeat, patrolSignedBeat } from './team-beats';
import { Sheet } from '../components/Sheet';
import { Button, Card, Chip, EmptyState, Meter, Row, Section } from '../components/ui';
import { duration, moneyFull, perHour, rate, relativeTime } from '../format';
import { Icon } from '../icons';
import { Face } from '../components/Face';
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
  return <>
    <PatrolScene game={game} onHire={() => setSelection({ kind: 'candidates' })} />
    <div className="page patrol-page">
    <PatrolSummary game={game} />
    <Section id="patrol-team-h" title="Patrol team" icon="people" hint="Coverage runs automatically. Patrol staff stay separate from SWAT squads.">
      {employees.length === 0 ? <EmptyState spot="noCandidates" title="No patrol staff">Hire into an authorized position to begin patrol coverage.</EmptyState>
        : <Card className="patrol-roster-card"><div className="patrol-roster" data-ui-list>{employees.map((employee) => <PatrolEmployeeCard key={employee.id} employee={employee} game={game} onReview={(kind) => setSelection({ kind, employeeId: employee.id })} />)}</div></Card>}
    </Section>
    <PatrolBoosts />
    {selection?.kind === 'candidates' ? <PatrolHiring onClose={() => setSelection(null)} onChoose={(profileId) => setSelection({ kind: 'hire', profileId })} />
      : selection && <PatrolCommitment key={JSON.stringify(selection)} selection={selection} onClose={() => setSelection(null)} />}
    </div>
  </>;
}

export function PatrolSummary({ game }: { game: GameState }) {
  const at = game.department.clockHighWater;
  const rates = patrolRates(game, at);
  return <section className="patrol-summary" aria-label="Patrol division">
    <div className="patrol-summary-net"><span>Patrol net after payroll and operations</span><strong>{rate(rates.net)}</strong></div>
    <dl className="patrol-money-grid patrol-money-strip"><div><dt>Gross</dt><dd>{rate(rates.gross)}</dd></div><div><dt>Payroll</dt><dd>{perHour(rates.wages)}</dd></div><div><dt>Operations</dt><dd>{perHour(rates.operating)}</dd></div></dl>
    {rates.factor > 1 && <p className="patrol-boost-active">×{rates.factor} patrol gross · {rate(rates.boostAmount)} extra</p>}
  </section>;
}

/** The garage scene (station rebuild, a place): the section switch over the garage, one line of counts, who is
 * covering and who is in training, and the patrol posts as people. An open post is a tap to hire. */
function PatrolScene({ game, onHire }: { game: GameState; onHire?: () => void }) {
  const employees = employedPatrol(game);
  const rates = patrolRates(game, game.department.clockHighWater);
  const training = employees.filter((employee) => employee.training);
  const covering = employees.filter((employee) => !employee.training);
  const first = (employee: PatrolEmployee) => patrolProfile(employee.profileId)?.firstName ?? 'Employee';
  const line = `${employees.length} of ${patrolCapacity(game)} positions · ${rates.productive > 0 ? `${rates.productive} providing coverage` : employees.length ? 'coverage paused for training' : 'positions open'}`;
  return <TeamScene section="patrol" line={line} label="Patrol garage" action={onHire ? <button type="button" className="section-link" onClick={onHire}>Hire patrol</button> : undefined}>
    <div className={`patrol-scene${rates.productive === 0 ? ' patrol-scene-idle' : ''}`} data-patrol-scene-state={employees.length === 0 ? 'empty' : training.length ? 'training' : 'covering'}>
      {employees.length > 0 && <p className="patrol-scene-who">{covering.length > 0 && <span>Covering: {covering.map(first).join(', ')}.</span>}{training.length > 0 && <span> In training: {training.map(first).join(', ')}.</span>}</p>}
      <div className="patrol-scene-posts" aria-label={`${employees.length} of ${patrolCapacity(game)} patrol positions filled`}>
        {Array.from({ length: patrolCapacity(game) }, (_, index) => {
          const employee = employees[index];
          return employee ? <button type="button" key={employee.id} className={`patrol-scene-post${employee.training ? ' patrol-scene-post-training' : ''}`} aria-label={`View ${profileName(employee.profileId)}, ${employee.training ? 'in training' : 'providing coverage'}`} onClick={() => { const card = document.querySelector<HTMLElement>(`[data-patrol-employee="${employee.id}"]`); card?.scrollIntoView({ block: 'center' }); card?.focus({ preventScroll: true }); }}><PatrolPortrait profileId={employee.profileId} size={40} /><span>{first(employee)}</span>{employee.training && <Icon name="mortarboard" size={16} />}</button>
            : <button type="button" className="patrol-scene-post patrol-scene-post-open" key={`open-${index}`} onClick={onHire} disabled={!onHire} aria-label={`Hire into open patrol position ${index + 1}`}><span className="patrol-scene-open-slot" aria-hidden="true"><Icon name="plus" size={24} /></span><span>Open</span></button>;
        })}
      </div>
    </div>
  </TeamScene>;
}

function PatrolEmployeeCard({ employee, game, onReview }: { employee: PatrolEmployee; game: GameState; onReview: (kind: 'dismiss' | 'training') => void }) {
  const grade = PATROL_GRADES[employee.grade];
  const next = employee.grade < 3 ? PATROL_GRADES[(employee.grade + 1) as PatrolGrade] : null;
  const training = employee.training;
  const readyToTrain = patrolTrainingQuote(game, employee.id).ok;
  const name = profileName(employee.profileId);
  const hours = next ? Math.min(employee.serviceHours, next.serviceHours) : 0;
  // A recorded fact about this person: their state, their note, or their hours on patrol (people/story-line.ts).
  // The line turns through everything recorded about them on the shared story clock and holds on the first under
  // reduced motion. Assistive technology gets the first line, fixed, so the text never changes under its cursor.
  const clock = useStoryClock();
  const person = { kind: 'patrol', employee, gradeName: (grade: PatrolGrade) => PATROL_GRADES[grade].name } as const;
  // First paint shows the first line (their state, when they have one); the turn starts with the clock.
  const shown = useRef<string | null>(null);
  const lines = rotation(person, game.department.clockHighWater);
  const story = lines[clock.still || shown.current === null ? 0 : turnIndex(lines.length, clock.now, employee.id)] ?? null;
  const spoken = lines[0] ?? null;
  // It fades in only when it turns over, never on first paint.
  const turned = shown.current !== null && !!story && shown.current !== story.text;
  useEffect(() => { shown.current = story?.text ?? null; });
  return <article className="patrol-item" data-patrol-employee={employee.id} tabIndex={-1} aria-label={name}>
    <Row lead={<Face size="sm" kind="patrol" src={patrolProfile(employee.profileId)?.portrait} />} title={name}
      detail={`Grade ${employee.grade} · ${grade.name} · ${training ? '$0/h' : perHour(grade.gross)}`}
      trail={<Chip tone={training ? 'blue' : 'good'} icon={training ? 'mortarboard' : 'check'}>{training ? 'In training' : 'Covering'}</Chip>} />
    <div className="patrol-item-foot">
      {story && <><p key={story.text} className={turned ? 'patrol-item-story patrol-item-story-turned' : 'patrol-item-story'} data-story={story.kind} aria-hidden="true">{story.text}</p>{spoken && <p className="sr-only">{spoken.text}</p>}</>}
      {training ? <p className="patrol-training-status">Grade changes when training finishes.</p>
        : next ? <div className="patrol-grade-progress"><span>{Math.floor(employee.serviceHours)} / {next.serviceHours} funded hours · Level {next.departmentLevel} required</span><Meter value={(hours / next.serviceHours) * 100} label={`Service toward ${next.name}`} valueText={`${Math.floor(employee.serviceHours)} of ${next.serviceHours} funded hours`} /></div>
          : <p className="patrol-training-status">Highest patrol grade</p>}
      <div className="patrol-card-actions">{next && <Button size="sm" variant={readyToTrain ? 'primary' : 'secondary'} onClick={() => onReview('training')} disabled={!!training} aria-label={`Review training for ${name}`}>{readyToTrain ? 'Train for next grade' : 'Review training'}</Button>}<Button size="sm" variant="ghost" onClick={() => onReview('dismiss')} aria-label={`Review dismissal for ${name}`}>Dismiss</Button></div>
    </div>
  </article>;
}

function PatrolHiring({ onClose, onChoose }: { onClose: () => void; onChoose: (profileId: Id) => void }) {
  const game = useGame();
  const candidates = patrolCandidates(game);
  return <Sheet open onClose={onClose} title="Hire patrol" subtitle={`${employedPatrol(game).length} of ${patrolCapacity(game)} authorized positions filled`} className="patrol-sheet">
    <div className="patrol-candidates">{candidates.length === 0 ? <EmptyState spot="noCandidates" title="No patrol candidates">Every available identity is already employed or offered elsewhere.</EmptyState> : candidates.map((person) => {
      const quote = patrolHireQuote(game, person.id);
      return <article className="patrol-card" data-patrol-candidate={person.id} key={person.id}><div className="patrol-person"><PatrolPortrait profileId={person.id} size={76} /><div><h3>{profileName(person.id)}</h3><span>{PATROL_GRADES[1].name}</span>{personaNote(person.id) && <p className="patrol-person-note">{personaNote(person.id)}</p>}</div></div><div className="patrol-candidate-terms"><span>Payroll {perHour(quote.wageDelta)} · Operations {perHour(quote.operatingDelta)}</span><strong>{rate(quote.netDelta)} unboosted net</strong></div>{quote.reason && <p className="reason">{quote.reason}</p>}<Button variant="primary" block disabled={!quote.ok} onClick={() => onChoose(person.id)} aria-label={`Review hire for ${profileName(person.id)}`}>Review hire · {moneyFull(quote.upfront)}</Button></article>;
    })}</div>
  </Sheet>;
}

/** The patrol people a grant lifts, standing on the garage plate. Anyone in training is dimmed: they
 * are off coverage, so the grant adds nothing for them until they are back. */
function BoostCrew({ game }: { game: GameState }) {
  const employees = employedPatrol(game);
  if (employees.length === 0) return <p className="patrol-boost-crew-note">No patrol staff yet. A grant lifts the gross of the people you hire in Team, Patrol.</p>;
  const first = (employee: PatrolEmployee) => patrolProfile(employee.profileId)?.firstName ?? 'Employee';
  const covering = employees.filter((employee) => !employee.training).length;
  return <div className="patrol-boost-crew">
    <p className="patrol-boost-crew-line">{covering > 0 ? `A grant lifts the gross these ${covering === 1 ? 'one person earns' : `${covering} earn`}` : 'Everyone is in training, so a grant adds nothing yet'}</p>
    <ul className="patrol-boost-crew-faces" aria-label="Patrol staff">
      {employees.map((employee) => <li key={employee.id} className={employee.training ? 'patrol-boost-crew-training' : undefined}>
        <PatrolPortrait profileId={employee.profileId} size={40} />
        <span>{first(employee)}</span>
        {employee.training && <Icon name="mortarboard" size={16} />}
      </li>)}
    </ul>
  </div>;
}

/** Reused by Team and Store; the same engine quote and confirmation handle either entry point. */
export function PatrolBoosts() {
  const game = useGame();
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const at = game.department.clockHighWater;
  const rates = patrolRates(game, at);
  const running = game.patrol.boosts.filter((boost) => boost.expiresAt > at);
  return <Section id="patrol-boosts-h" title="Patrol funding boosts" icon="trend">
    <div className="patrol-boost-hero plate" data-boost-state={running.length ? 'active' : 'idle'}>
      <PlateArt src={plateUrl('scene_patrol_garage')} />
      <p className="patrol-boost-hero-line">{running.length ? <>Boost running: <b>×{rates.factor}</b> patrol gross · {rate(rates.boostAmount)} extra</> : 'No boost running. Patrol earns its base rate.'}</p>
      <p className="patrol-boost-hero-net"><span>Patrol net</span><strong>{rate(rates.net)}</strong></p>
      <dl className="patrol-money-grid patrol-boost-hero-strip"><div><dt>Gross</dt><dd>{rate(rates.gross)}</dd></div><div><dt>Payroll</dt><dd>{perHour(rates.wages)}</dd></div><div><dt>Operations</dt><dd>{perHour(rates.operating)}</dd></div></dl>
      <BoostCrew game={game} />
    </div>
    <Card className="patrol-roster-card"><div className="patrol-boosts" data-ui-list>{Object.entries(PATROL_BOOSTS).map(([id, definition]) => {
      const quote = patrolBoostQuote(game, id);
      const active = game.patrol.boosts.find((boost) => boost.id === id && boost.expiresAt > at);
      return <div className="patrol-item" key={id}>
        <Row lead={<Icon name="trend" size={20} />} title={`Community grant · ×${definition.factor} for ${definition.hours}h`}
          detail={active ? `Active · ${duration(active.expiresAt - at)} remaining · extends the current rate` : `${rate(quote.netDelta)} net while active · est. ${moneyFull(quote.incrementalReturn)} back`}
          trail={<Button size="sm" disabled={!quote.ok} onClick={() => setSelectedId(id)} aria-label={active ? 'Extend grant' : 'Review grant'}>{active ? 'Extend' : 'Review'} · {moneyFull(quote.upfront)}</Button>} />
        {quote.reason && <p className="reason patrol-item-foot">{quote.reason}</p>}
      </div>;
    })}</div></Card>
    {selectedId && <PatrolCommitment selection={{ kind: 'boost', boostId: selectedId }} onClose={() => setSelectedId(null)} />}
  </Section>;
}

function PatrolQuoteRows({ quote, boost = false }: { quote: PatrolQuote; boost?: boolean }) {
  return <div className="patrol-quote"><dl className="patrol-money-grid"><div><dt>Cost now</dt><dd>{moneyFull(quote.upfront)}</dd></div><div><dt>{boost ? 'Net change while active' : 'Unboosted net change'}</dt><dd>{rate(quote.netDelta)}</dd></div>{!boost && <><div><dt>Payroll change</dt><dd>{rate(quote.wageDelta)}</dd></div><div><dt>Operations change</dt><dd>{rate(quote.operatingDelta)}</dd></div></>}</dl><p className="patrol-projection">Department net{boost ? '' : ' without boosts'}<strong>{rate(quote.netBefore)} <span aria-hidden="true">→</span><span className="sr-only"> to </span> {rate(quote.netAfter)}</strong></p>{quote.paybackHours !== null && <p>Estimated payback {Math.round(quote.paybackHours * 10) / 10} productive hours</p>}</div>;
}

export function PatrolCommitment({ selection, onClose }: { selection: Commitment; onClose: () => void }) {
  const game = useGame();
  const beat = useBeat();
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
    // A hire or a training start plays its beat in place of the success toast; the sheet still shows the receipt.
    const profile = profileId ? patrolProfile(profileId) : undefined;
    const result = beat.act(command, (res) => {
      if (!profile || !res.patrolReceipt) return null;
      if (selection.kind === 'hire') return patrolSignedBeat(profile, PATROL_GRADES[1].name);
      if (selection.kind === 'training' && training?.toGrade) return patrolEnrolledBeat(profile, PATROL_GRADES[training.toGrade].name, PATROL_GRADES[training.toGrade].trainingHours * 3_600_000);
      return null;
    });
    if (result.ok && result.patrolReceipt) setReceipt(result.patrolReceipt);
    else { setFailure(result.ok ? 'The update completed without a receipt. Check the current roster.' : result.reason); busy.current = false; }
  };
  const confirmation = receipt?.kind === 'hire' ? `${who} hired` : receipt?.kind === 'dismiss' ? `${who} dismissed` : receipt?.kind === 'training' ? `${who} enrolled` : 'Community grant activated';
  return <Sheet open onClose={onClose} title={receipt ? 'Patrol update confirmed' : title} subtitle={who} className="patrol-sheet" interactionKey={receipt ? 'receipt' : 'review'} footer={receipt ? <Button block variant="primary" onClick={onClose}>Done</Button> : <div className="patrol-confirm-actions"><Button onClick={onClose}>Cancel</Button><Button variant={selection.kind === 'dismiss' ? 'danger' : 'primary'} disabled={!quote.ok} onClick={submit}>{action} · {moneyFull(quote.upfront)}</Button></div>}>
    <div className="patrol-commitment">{profileId && <div className="patrol-review-person"><PatrolPortrait profileId={profileId} size={108} /><div className="patrol-review-who"><strong>{who}</strong><span>{employee ? `Grade ${employee.grade} · ${PATROL_GRADES[employee.grade].name}` : PATROL_GRADES[1].name}</span><Chip tone={selection.kind === 'dismiss' ? 'warn' : employee?.training ? 'blue' : 'good'} icon={selection.kind === 'hire' ? 'idcard' : employee?.training ? 'mortarboard' : 'check'}>{selection.kind === 'hire' ? 'Candidate' : employee?.training ? 'In training' : 'Covering'}</Chip>{selection.kind === 'hire' && personaNote(profileId) && <p className="patrol-person-note">{personaNote(profileId)}</p>}</div></div>}
      {receipt ? <div className="patrol-receipt" role="status"><Icon name="check" size={16} /><div><strong>{confirmation}</strong><p>{moneyFull(Math.abs(receipt.amount))} funding paid</p>{receipt.endsAt && <p>{receipt.kind === 'training' ? 'Training completes' : 'Grant ends'} {relativeTime(receipt.endsAt, game.department.clockHighWater)}</p>}{receipt.kind === 'training' ? <p>Current grade and payroll remain until training finishes.</p> : <p>{receipt.kind === 'boost' ? 'Net change while active' : 'Unboosted net change'} {rate(receipt.netDelta)}</p>}</div></div>
        : <>{training?.toGrade && <div className="patrol-training-plan"><h3>{PATROL_GRADES[training.toGrade].name}</h3><p>{PATROL_GRADES[training.toGrade].trainingHours}h training · department level {PATROL_GRADES[training.toGrade].departmentLevel} · {PATROL_GRADES[training.toGrade].serviceHours} funded service hours</p><p>Unboosted department net during training {rate(training.trainingNet)}. Wages and operating costs continue.</p><p>After completion</p></div>}<PatrolQuoteRows quote={quote} boost={selection.kind === 'boost'} />{training && quote.paybackHours !== null && <p className="patrol-explanation">Training payback includes the gross funding lost during training.</p>}{selection.kind === 'dismiss' && <p>Severance is paid now. This person leaves coverage and remains in department history.</p>}{selection.kind === 'boost' && <p>The grant affects patrol gross only. Its duration extends when purchased again.</p>}{(failure || quote.reason) && <p className="reason" role="status">{failure ?? quote.reason}</p>}</>}
    </div>
  </Sheet>;
}
