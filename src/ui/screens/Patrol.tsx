import { useEffect, useRef, useState } from 'react';
import {
  employedPatrol, PATROL_BOOSTS, PATROL_GRADES, PATROL_HIRE_COST, PATROL_SEVERANCE_HOURS, patrolBoostQuote, patrolCandidates, patrolCapacity,
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
import { duration, funding, fundingPerHour, fundingRate, relativeTime } from '../format';
import { Funds } from '../components/Funds';
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
    <PatrolSummary game={game} onHire={() => setSelection({ kind: 'candidates' })} />
    <Section id="patrol-team-h" title="Patrol team" icon="patrol" count={employees.length ? `${employees.length} on staff` : undefined}>
      {employees.length === 0 ? <EmptyState spot="noCandidates" title="No patrol staff">Hire into an authorized position to begin patrol coverage.</EmptyState>
        : <div className="patrol-roster panel-well" data-ui-list>{employees.map((employee) => <PatrolEmployeeCard key={employee.id} employee={employee} game={game} onReview={(kind) => setSelection({ kind, employeeId: employee.id })} />)}</div>}
    </Section>
    <PatrolBoosts compact />
    <PatrolHistory game={game} />
    {selection?.kind === 'candidates' ? <PatrolHiring onClose={() => setSelection(null)} onChoose={(profileId) => setSelection({ kind: 'hire', profileId })} />
      : selection && <PatrolCommitment key={JSON.stringify(selection)} selection={selection} onClose={() => setSelection(null)} />}
    </div>
  </>;
}

export function PatrolSummary({ game, onHire }: { game: GameState; onHire?: () => void }) {
  const at = game.department.clockHighWater;
  const rates = patrolRates(game, at);
  // What gross becomes: kept, payroll and operations as one bar on the gross (canvas pass, 2026-10-24).
  const gross = Math.max(1, rates.gross);
  const share = (n: number) => `${Math.max(0, Math.min(100, (n / gross) * 100))}%`;
  // An open post as an offer with its numbers: a new patrol officer's net and how long the signing takes to pay back.
  const open = patrolCapacity(game) - employedPatrol(game).length;
  const first = PATROL_GRADES[1];
  const perHire = first.gross - first.wage - first.operating;
  // A framed panel (canvas "Depth and Framed Sections"): what patrol keeps in the bar, the split under it.
  return <Section className="patrol-summary" label="Patrol division" title="Patrol net" icon="funds" count="After payroll and operations" action={<strong className="patrol-summary-rate"><Funds value={rates.net} format="rate" /></strong>}>
    {rates.gross > 0 && <div className="patrol-split" role="img" aria-label={`Of ${fundingPerHour(rates.gross)} earned, ${fundingPerHour(Math.max(0, rates.net))} kept, ${fundingPerHour(rates.wages)} payroll and ${fundingPerHour(rates.operating)} operations`}>
      <i className="patrol-split-kept" style={{ width: share(rates.net) }} />
      <i className="patrol-split-payroll" style={{ width: share(rates.wages) }} />
      <i className="patrol-split-ops" style={{ width: share(rates.operating) }} />
    </div>}
    <dl className="patrol-money-grid patrol-money-strip"><div><dt>Gross</dt><dd><Funds value={rates.gross} format="rate" /></dd></div><div><dt>Payroll</dt><dd><Funds value={rates.wages} format="perHour" /></dd></div><div><dt>Operations</dt><dd><Funds value={rates.operating} format="perHour" /></dd></div></dl>
    {rates.factor > 1 && <p className="patrol-boost-active">×{rates.factor} patrol gross · <Funds value={rates.boostAmount} format="rate" /> extra</p>}
    {onHire && open > 0 && perHire > 0 && <div className="patrol-hire-offer">
      <span className="patrol-hire-offer-main"><strong>Fill an open post</strong><span><Funds value={perHire} format="rate" /> net · pays back in {Math.ceil(PATROL_HIRE_COST / perHire)}h</span></span>
      <Button variant="primary" size="sm" onClick={onHire} aria-label={`Hire patrol for ${funding(PATROL_HIRE_COST)}`}>Hire · <Funds value={PATROL_HIRE_COST} /></Button>
    </div>}
  </Section>;
}

/** Each face's caption on the garage scene says their grade, so a row of portraits says whose they are. */
const PATROL_GRADE_SHORT: Record<keyof typeof PATROL_GRADES, string> = { 1: 'Officer', 2: 'Senior', 3: 'FTO' };

/** The garage scene (station rebuild, a place): the section switch over the garage, one line of counts, who is
 * covering and who is in training, and the patrol posts as people. An open post is a tap to hire. */
function PatrolScene({ game, onHire }: { game: GameState; onHire?: () => void }) {
  const employees = employedPatrol(game);
  const rates = patrolRates(game, game.department.clockHighWater);
  const training = employees.filter((employee) => employee.training);
  const first = (employee: PatrolEmployee) => patrolProfile(employee.profileId)?.firstName ?? 'Employee';
  const line = `${employees.length} of ${patrolCapacity(game)} positions · ${rates.productive > 0 ? `${rates.productive} providing coverage` : employees.length ? 'coverage paused for training' : 'positions open'}`;
  return <TeamScene section="patrol" line={line} label="Patrol garage">
    <div className={`patrol-scene${rates.productive === 0 ? ' patrol-scene-idle' : ''}`} data-patrol-scene-state={employees.length === 0 ? 'empty' : training.length ? 'training' : 'covering'}>
      <div className="patrol-scene-posts" aria-label={`${employees.length} of ${patrolCapacity(game)} patrol positions filled`}>
        {Array.from({ length: patrolCapacity(game) }, (_, index) => {
          const employee = employees[index];
          return employee ? <button type="button" key={employee.id} className={`patrol-scene-post${employee.training ? ' patrol-scene-post-training' : ''}`} aria-label={`View ${profileName(employee.profileId)}, ${employee.training ? 'in training' : 'providing coverage'}`} onClick={() => { const card = document.querySelector<HTMLElement>(`[data-patrol-employee="${employee.id}"]`); card?.scrollIntoView({ block: 'center' }); card?.focus({ preventScroll: true }); }}><PatrolPortrait profileId={employee.profileId} size={40} /><span>{first(employee)}</span><small className="patrol-scene-grade">{employee.training ? 'Training' : PATROL_GRADE_SHORT[employee.grade]}</small>{employee.training && <Icon name="mortarboard" size={16} />}</button>
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
  const [open, setOpen] = useState(false);
  const at = game.department.clockHighWater;
  const quote = next ? patrolTrainingQuote(game, employee.id) : null;
  // One row (canvas Team Patrol): the face, the name, grade and status, a meter toward the next grade (or
  // through the course), and one trail: Train when it can start now, the course's time left, the hours,
  // or why a full meter cannot train yet. The row's name opens a sheet with the rest.
  const meter = training ? Math.max(0, Math.min(100, (100 * (at - training.startedAt)) / Math.max(1, training.endsAt - training.startedAt)))
    : next ? (hours / next.serviceHours) * 100 : 100;
  const meterText = training ? `Training, ${duration(Math.max(0, training.endsAt - at))} left` : next ? `${Math.floor(employee.serviceHours)} of ${next.serviceHours} funded hours toward ${next.name}` : 'Highest patrol grade';
  const trail = readyToTrain && !training ? <Button size="sm" variant="primary" onClick={() => onReview('training')} aria-label={`Train ${name} for ${next!.name}`}>Train</Button>
    : training ? <Chip tone="blue" icon="mortarboard">{duration(Math.max(0, training.endsAt - at))}</Chip>
      : !next ? <Chip tone="good">Top grade</Chip>
        : employee.serviceHours >= next.serviceHours ? <button type="button" className="patrol-row-why" onClick={() => setOpen(true)}>{quote && !quote.ok && quote.reason ? `Level ${next.departmentLevel}` : 'Review'}</button>
          : <span className="patrol-row-hours">{Math.floor(employee.serviceHours)}/{next.serviceHours}h</span>;
  return <article className="patrol-item patrol-row" data-patrol-employee={employee.id} tabIndex={-1} aria-label={name}>
    <Row lead={<Face size="sm" kind="patrol" src={patrolProfile(employee.profileId)?.portrait} />}
      title={<button type="button" className="patrol-row-name" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={`${name}, ${grade.name}, ${training ? 'in training' : 'covering'}. ${meterText}. Open`}>{name}</button>}
      detail={<span className="patrol-row-detail"><span>{grade.name} · <span className={training ? 'patrol-row-training' : 'tone-mint'}>{training ? 'in training' : 'covering'}</span></span>
        <span className="patrol-row-meter" data-tone={training ? 'info' : readyToTrain ? 'act' : 'info'} role="img" aria-label={meterText}><i style={{ width: `${Math.max(2, meter)}%` }} /></span></span>}
      trail={trail} />
    <Sheet open={open} onClose={() => setOpen(false)} title={name} maxHeight="short"
      footer={<div className="row-actions">{next && <Button variant={readyToTrain ? 'primary' : 'secondary'} onClick={() => { setOpen(false); onReview('training'); }} disabled={!!training} aria-label={`Review training for ${name}`}>{readyToTrain ? 'Train for next grade' : 'Review training'}</Button>}<Button variant="ghost" onClick={() => { setOpen(false); onReview('dismiss'); }} aria-label={`Review dismissal for ${name}`}>Dismiss</Button></div>}>
      <div className="patrol-item-foot">
        <p className="patrol-sheet-grade">{`Grade ${employee.grade} · ${grade.name} · ${training ? fundingPerHour(0) : fundingPerHour(grade.gross)}`}</p>
        {story && <><p key={story.text} className={turned ? 'patrol-item-story patrol-item-story-turned' : 'patrol-item-story'} data-story={story.kind} aria-hidden="true">{story.text}</p>{spoken && <p className="sr-only">{spoken.text}</p>}</>}
        {training ? <p className="patrol-training-status">Grade changes when training finishes.</p>
          : next ? <div className="patrol-grade-progress"><span>{Math.floor(employee.serviceHours)} / {next.serviceHours} funded hours · Level {next.departmentLevel} required</span><Meter value={(hours / next.serviceHours) * 100} label={`Service toward ${next.name}`} valueText={`${Math.floor(employee.serviceHours)} of ${next.serviceHours} funded hours`} /></div>
            : <p className="patrol-training-status">Highest patrol grade</p>}
        {quote && !quote.ok && quote.reason && !training && next && employee.serviceHours >= next.serviceHours && <p className="patrol-training-status">{quote.reason}</p>}
      </div>
    </Sheet>
  </article>;
}

/** Everyone who has left the patrol roster, newest first. A departed identity stays on record and is never offered again. */
function PatrolHistory({ game }: { game: GameState }) {
  const departed = game.patrol.personnel.filter((person) => person.dismissedAt !== null).sort((a, b) => b.dismissedAt! - a.dismissedAt!);
  if (departed.length === 0) return null;
  const now = game.department.clockHighWater;
  return <Section id="patrol-history-h" title="Department history" icon="idcard" hint="Former patrol staff stay on record and cannot be hired again.">
    <div className="patrol-roster panel-well" data-ui-list>{departed.map((person) => <article className="patrol-item" key={person.id} aria-label={profileName(person.profileId)}>
      <Row lead={<Face size="sm" kind="patrol" src={patrolProfile(person.profileId)?.portrait} />} title={profileName(person.profileId)}
        detail={`Grade ${person.grade} · ${PATROL_GRADES[person.grade].name} · ${Math.floor(person.serviceHours)} funded ${Math.floor(person.serviceHours) === 1 ? 'hour' : 'hours'} · left ${relativeTime(person.dismissedAt!, now)}`} />
    </article>)}</div>
  </Section>;
}

function PatrolHiring({ onClose, onChoose }: { onClose: () => void; onChoose: (profileId: Id) => void }) {
  const game = useGame();
  const candidates = patrolCandidates(game);
  return <Sheet open onClose={onClose} title="Hire patrol" subtitle={`${employedPatrol(game).length} of ${patrolCapacity(game)} authorized positions filled`} className="patrol-sheet">
    <div className="patrol-candidates">{candidates.length === 0 ? <EmptyState spot="noCandidates" title="No patrol candidates">Every available identity is already employed or offered elsewhere.</EmptyState> : candidates.map((person) => {
      const quote = patrolHireQuote(game, person.id);
      return <article className="patrol-card" data-patrol-candidate={person.id} key={person.id}><div className="patrol-person"><PatrolPortrait profileId={person.id} size={76} /><div><h3>{profileName(person.id)}</h3><span>{PATROL_GRADES[1].name}</span>{personaNote(person.id) && <p className="patrol-person-note">{personaNote(person.id)}</p>}</div></div><div className="patrol-candidate-terms"><span>Payroll <Funds value={quote.wageDelta} format="perHour" /> · Operations <Funds value={quote.operatingDelta} format="perHour" /></span><strong><Funds value={quote.netDelta} format="rate" /> unboosted net</strong></div>{quote.reason && <p className="reason">{quote.reason}</p>}<Button variant="primary" block disabled={!quote.ok} onClick={() => onChoose(person.id)} aria-label={`Review hire for ${profileName(person.id)}`}>Review hire · <Funds value={quote.upfront} format="full" /></Button></article>;
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
        <small className="patrol-scene-grade">{employee.training ? 'Training' : PATROL_GRADE_SHORT[employee.grade]}</small>
        {employee.training && <Icon name="mortarboard" size={16} />}
      </li>)}
    </ul>
  </div>;
}

/** Patrol funding boosts live in Team, Patrol (the Store sells looks and lifetime items, not funding pace). `compact`
 * is the Patrol section's form: one line on what is running, then the grants, since the net and its split sit
 * in the panel above. Without it the section brings its own garage plate and net, for any screen that shows it alone. */
export function PatrolBoosts({ compact = false }: { compact?: boolean } = {}) {
  const game = useGame();
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const at = game.department.clockHighWater;
  const rates = patrolRates(game, at);
  const running = game.patrol.boosts.filter((boost) => boost.expiresAt > at);
  return <Section id="patrol-boosts-h" title="Patrol funding boosts" icon="trend" hint={compact ? (running.length ? undefined : 'No boost running. Patrol earns its base rate.') : undefined}>
    {compact && running.length > 0 && <p className="patrol-boost-active">Boost running: ×{rates.factor} patrol gross · <Funds value={rates.boostAmount} format="rate" /> extra</p>}
    {!compact && <div className="patrol-boost-hero plate" data-boost-state={running.length ? 'active' : 'idle'}>
      <PlateArt src={plateUrl('scene_patrol_garage')} />
      <p className="patrol-boost-hero-line">{running.length ? <>Boost running: <b>×{rates.factor}</b> patrol gross · <Funds value={rates.boostAmount} format="rate" /> extra</> : 'No boost running. Patrol earns its base rate.'}</p>
      <p className="patrol-boost-hero-net"><span>Patrol net</span><strong><Funds value={rates.net} format="rate" /></strong></p>
      <dl className="patrol-money-grid patrol-boost-hero-strip"><div><dt>Gross</dt><dd><Funds value={rates.gross} format="rate" /></dd></div><div><dt>Payroll</dt><dd><Funds value={rates.wages} format="perHour" /></dd></div><div><dt>Operations</dt><dd><Funds value={rates.operating} format="perHour" /></dd></div></dl>
      <BoostCrew game={game} />
    </div>}
    <Card className="patrol-roster-card"><div className="patrol-boosts" data-ui-list>{Object.entries(PATROL_BOOSTS).map(([id, definition]) => {
      const quote = patrolBoostQuote(game, id);
      const active = game.patrol.boosts.find((boost) => boost.id === id && boost.expiresAt > at);
      return <div className="patrol-item" key={id}>
        <Row lead={<Icon name="trend" size={20} />} title={`Community grant · ×${definition.factor} for ${definition.hours}h`}
          detail={active ? `Active · ${duration(active.expiresAt - at)} remaining · extends the current rate` : `Net ${fundingRate(quote.netDelta)} while active · est. ${funding(quote.incrementalReturn)} back`}
          trail={<Button size="sm" disabled={!quote.ok} onClick={() => setSelectedId(id)} aria-label={active ? 'Extend grant' : 'Review grant'}>{active ? 'Extend' : 'Review'} · <Funds value={quote.upfront} format="full" /></Button>} />
        {quote.reason && <p className="reason patrol-item-foot">{quote.reason}</p>}
      </div>;
    })}</div></Card>
    {selectedId && <PatrolCommitment selection={{ kind: 'boost', boostId: selectedId }} onClose={() => setSelectedId(null)} />}
  </Section>;
}

function PatrolQuoteRows({ quote, boost = false, costLabel = 'Cost' }: { quote: PatrolQuote; boost?: boolean; costLabel?: string }) {
  return <div className="patrol-quote"><dl className="patrol-money-grid"><div><dt>{costLabel}</dt><dd><Funds value={quote.upfront} format="full" /></dd></div><div><dt>{boost ? 'Net change while active' : 'Unboosted net change'}</dt><dd><Funds value={quote.netDelta} format="rate" /></dd></div>{!boost && <><div><dt>Payroll change</dt><dd><Funds value={quote.wageDelta} format="rate" /></dd></div><div><dt>Operations change</dt><dd><Funds value={quote.operatingDelta} format="rate" /></dd></div></>}</dl><p className="patrol-projection">Department net{boost ? '' : ' without boosts'}<strong><Funds value={quote.netBefore} format="rate" /> <span aria-hidden="true">→</span><span className="sr-only"> to </span> <Funds value={quote.netAfter} format="rate" /></strong></p>{quote.paybackHours !== null && <p>Estimated payback {Math.round(quote.paybackHours * 10) / 10} productive hours</p>}</div>;
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
  const dismissal = selection.kind === 'dismiss' ? patrolDismissQuote(game, selection.employeeId) : null;
  const quote = selection.kind === 'hire' ? patrolHireQuote(game, selection.profileId) : dismissal ? dismissal : selection.kind === 'boost' ? patrolBoostQuote(game, selection.boostId) : training!;
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
  return <Sheet open onClose={onClose} title={receipt ? 'Patrol update confirmed' : title} subtitle={who} className="patrol-sheet" interactionKey={receipt ? 'receipt' : 'review'} footer={receipt ? <Button block variant="primary" onClick={onClose}>Done</Button> : <div className="patrol-confirm-actions"><Button onClick={onClose}>Cancel</Button><Button variant={selection.kind === 'dismiss' ? 'danger' : 'primary'} disabled={!quote.ok} onClick={submit}>{action} · <Funds value={quote.upfront} format="full" /></Button></div>}>
    <div className="patrol-commitment">{profileId && <div className="patrol-review-person"><PatrolPortrait profileId={profileId} size={108} /><div className="patrol-review-who"><strong>{who}</strong><span>{employee ? `Grade ${employee.grade} · ${PATROL_GRADES[employee.grade].name}` : PATROL_GRADES[1].name}</span><Chip tone={selection.kind === 'dismiss' ? 'warn' : employee?.training ? 'blue' : 'good'} icon={selection.kind === 'hire' ? 'idcard' : employee?.training ? 'mortarboard' : 'check'}>{selection.kind === 'hire' ? 'Candidate' : employee?.training ? 'In training' : 'Covering'}</Chip>{selection.kind === 'hire' && personaNote(profileId) && <p className="patrol-person-note">{personaNote(profileId)}</p>}</div></div>}
      {receipt ? <div className="patrol-receipt" role="status"><Icon name="check" size={16} /><div><strong>{confirmation}</strong><p>{receipt.amount === 0 ? 'No funding paid' : `${funding(Math.abs(receipt.amount))} paid`}</p>{receipt.endsAt && <p>{receipt.kind === 'training' ? 'Training completes' : 'Grant ends'} {relativeTime(receipt.endsAt, game.department.clockHighWater)}</p>}{receipt.kind === 'dismiss' && <p>They stay in department history and cannot be hired again.</p>}{receipt.kind === 'training' ? <p>Current grade and payroll remain until training finishes.</p> : <p>{receipt.kind === 'boost' ? 'Net change while active' : 'Unboosted net change'} <Funds value={receipt.netDelta} format="rate" /></p>}</div></div>
        : <>{training?.toGrade && <div className="patrol-training-plan"><h3>{PATROL_GRADES[training.toGrade].name}</h3><p>{PATROL_GRADES[training.toGrade].trainingHours}h training · department level {PATROL_GRADES[training.toGrade].departmentLevel} · {PATROL_GRADES[training.toGrade].serviceHours} funded service hours</p><p>Unboosted department net during training <Funds value={training.trainingNet} format="rate" />. Wages and operating costs continue.</p><p>After completion</p></div>}<PatrolQuoteRows quote={quote} boost={selection.kind === 'boost'} costLabel={dismissal ? 'Severance paid' : 'Cost'} />{training && quote.paybackHours !== null && <p className="patrol-explanation">Training payback includes the gross funding lost during training.</p>}{dismissal && <p className="patrol-explanation">{dismissal.severance > dismissal.upfront ? `Severance is ${funding(dismissal.severance)}, ${PATROL_SEVERANCE_HOURS} hours of wages. Funding covers ${funding(dismissal.upfront)} and the rest is waived.` : `Severance is ${funding(dismissal.severance)}, ${PATROL_SEVERANCE_HOURS} hours of wages, taken from funding.`} They leave the patrol roster and stay in department history.</p>}{selection.kind === 'boost' && <p>The grant affects patrol gross only. Its duration extends when purchased again.</p>}{(failure || quote.reason) && <p className="reason" role="status">{failure ?? quote.reason}</p>}</>}
    </div>
  </Sheet>;
}
