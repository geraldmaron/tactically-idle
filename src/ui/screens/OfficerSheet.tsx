// The officer profile (officer-profile): who this officer is, what they cost and bring, how ready
// they are, and what you can do with them. One full-height sheet opened from anywhere through
// navigation, so Back closes it. The hero and readiness are always in view; detail sits behind
// three tabs; actions stay in the footer.
import './officer-profile.css';
import { useState } from 'react';
import { personaNote } from '../../content/personas';
import { COURSES } from '../../content/courses';
import { CERT_NAME } from '../../content/certs';
import { useGame } from '../store';
import { careerInfo, projectDismiss, recoveryInfo } from '../../sim/department-selectors';
import { learningPace } from '../../sim/career';
import { detailCheck, detailRate } from '../../sim/detail';
import type { Id, Officer, SquadId } from '../../sim/types';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { ChoiceRail } from '../components/ChoiceRail';
import { Button, Chip, OfficerStatusChip, RatingBars } from '../components/ui';
import { RankChip } from '../components/RankInsignia';
import { RetirementChip, useCareerSnapshot } from '../components/Career';
import { OfficerProgress, RankLadder } from '../components/OfficerProgress';
import { RANKS } from '../../content/ranks';
import { formatGameDate } from '../../sim/calendar';
import { StressDisplay, StressGuide } from '../components/StressDisplay';
import { useToast } from '../components/toast';
import type { StatusKey } from '../components/labels';
import { CERT_ICON, ROLE_META, TRAIT_INFO } from '../components/labels';
import { officerStatus } from './squad-model';
import { Portrait } from '../portraits/Portrait';
import { agePortraitProps } from './helpers';
import { Icon } from '../icons';
import { money, perHour, rate, ratePerMinute, relativeTime, signedMoney, yearsText } from '../format';
import { officerRates } from '../../sim/economy';
import { PACE_LABEL } from './Recruit';

export type ProfileTab = 'overview' | 'career' | 'care';

export function OfficerSheet({ officerId, onClose, initialTab = 'overview' }: { officerId: Id | null; onClose: () => void; initialTab?: ProfileTab }) {
  const g = useGame();
  const o = officerId ? g.officers[officerId] : undefined;
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const close = () => { setConfirmDismiss(false); setTab('overview'); onClose(); };
  return (
    <Sheet open={!!o} onClose={close} title={o ? `${o.firstName} ${o.surname}` : ''} className="profile-sheet" interactionKey={confirmDismiss ? 'dismiss' : 'profile'}
      footer={o ? <ProfileActions o={o} confirmDismiss={confirmDismiss} setConfirmDismiss={setConfirmDismiss} onClose={close} /> : undefined}>
      {o && <ProfileBody o={o} tab={tab} setTab={setTab} />}
    </Sheet>
  );
}

function ProfileBody({ o, tab, setTab }: { o: Officer; tab: ProfileTab; setTab: (tab: ProfileTab) => void }) {
  const g = useGame();
  const now = Date.now();
  const info = recoveryInfo(g, o.id, now);
  const squad = o.squadId ? g.squads.find((s) => s.id === o.squadId) : undefined;
  const isLeader = squad?.leaderId === o.id;
  const career = useCareerSnapshot(o);
  const statusKey: StatusKey = officerStatus(o, now);
  const injured = !!o.injury && o.injury.until > now;
  const statusText = injured ? `Injured, ${o.injury!.label}` : o.assignment?.kind === 'training' ? `Training, back ${relativeTime(o.assignment.endsAt, now)}`
    : o.assignment?.kind === 'detail' ? `Teaching, back ${relativeTime(o.assignment.endsAt, now)}` : o.assignment?.kind === 'operation' ? 'On a call' : undefined;
  const pace = learningPace(o);
  const detail = detailRate(o);
  const persona = personaNote(o.identityId);
  return (
    <div className="profile">
      <section className="profile-hero" aria-label="Officer">
        <div className="profile-portrait">
          <Portrait officer={o} size={96} {...agePortraitProps(g, o, now)} />
          {isLeader && <span className="profile-leader" title="Squad leader"><Icon name="star" size={13} /></span>}
        </div>
        <div className="profile-id">
          <div className="chips">
            <Chip icon={ROLE_META[o.role].icon}>{ROLE_META[o.role].label}</Chip>
            {squad ? <Chip tone="blue" icon={isLeader ? 'star' : 'people'}>{squad.name}{isLeader ? ', leader' : ''}</Chip> : <Chip icon="user">Unassigned</Chip>}
            <RankChip rank={career.rank} />
            {career.retirement && <RetirementChip date={career.retirement.date} inDays={career.retirement.inDays} compact />}
          </div>
          <p className="profile-facts"><span><Icon name="cake" size={13} />Age {career.age}</span><span><Icon name="medal" size={13} />{yearsText(career.service)} served</span></p>
        </div>
      </section>
      <dl className="profile-value" aria-label="Cost and value">
        <div><dt>Wage</dt><dd className="tone-danger">-{perHour(o.wage)}</dd></div>
        <div><dt>Learns</dt><dd className={pace === 'fast' ? 'tone-mint' : pace === 'slow' ? 'tone-danger' : undefined}>{PACE_LABEL[pace]}</dd></div>
        <div><dt>Teaching</dt><dd className={detail === null ? 'dim' : 'tone-mint'}>{detail === null ? 'No cert' : `+${perHour(detail)}`}</dd></div>
      </dl>
      <section className="profile-ready" aria-label="Readiness">
        <OfficerStatusChip status={statusKey}>{statusText}</OfficerStatusChip>
        <StressDisplay value={o.stress} compact />
        <p className={`profile-avail ${info.blocker ? 'tone-warn' : 'tone-mint'}`}>
          <Icon name={info.blocker ? 'lock' : 'check'} size={14} />
          {info.blocker ? <>{info.blocker}{info.deployableAt !== null && <> · ready {relativeTime(info.deployableAt, now)}</>}</> : 'Ready for a call'}
        </p>
      </section>
      {persona && <p className="dim persona-note">{persona}</p>}
      <ChoiceRail value={tab} kind="tabs" grow label="Profile sections" panelId="profile-panel" onChange={setTab} options={[
        { value: 'overview', label: 'Overview' }, { value: 'career', label: 'Career' }, { value: 'care', label: 'Care' },
      ]} />
      <div id="profile-panel" role="tabpanel" className="profile-panel">
        {tab === 'overview' && <Overview o={o} />}
        {tab === 'career' && <CareerTab o={o} />}
        {tab === 'care' && <CareTab o={o} factors={info.factors} />}
      </div>
    </div>
  );
}

function Overview({ o }: { o: Officer }) {
  return <div className="profile-stack">
    <OfficerProgress officer={o} />
    <section aria-label="Skills"><h3 className="profile-head">Skills</h3><RatingBars ratings={o.ratings} label="Skills out of 100" /></section>
    <section aria-label="Qualifications and traits">
      <h3 className="profile-head">Qualifications and traits</h3>
      {o.certs.length > 0 ? <div className="chips">{o.certs.map((c) => <Chip key={c} tone="mint" icon={CERT_ICON[c]}>{CERT_NAME[c]}</Chip>)}</div>
        : <p className="dim">No qualifications yet. Courses grant them on completion, and a qualified officer can teach.</p>}
      {o.traits.length > 0 && <ul className="profile-traits">{o.traits.map((t) => {
        // A trait a promotion granted names its cause (swat-officer-stories: earned traits cite the call).
        const earned = o.promotions?.find((p) => RANKS[p.rank].trait === t);
        return <li key={t}><strong><Icon name={TRAIT_INFO[t].icon} size={14} />{TRAIT_INFO[t].label}</strong><span>{TRAIT_INFO[t].condition}</span>
          {earned && <span className="profile-trait-origin">Earned on promotion to {RANKS[earned.rank].title}, {earned.cause}, {formatGameDate(earned.day)}.</span>}</li>;
      })}</ul>}
    </section>
    <section aria-label="Squad"><h3 className="profile-head">Squad</h3><SquadControls o={o} /></section>
  </div>;
}

function SquadControls({ o }: { o: Officer }) {
  const g = useGame();
  const { act } = useToast();
  const squad = o.squadId ? g.squads.find((s) => s.id === o.squadId) : undefined;
  // An officer out on a call keeps their squad until it ends; the move waits and shows as queued.
  const onCall = o.assignment?.kind === 'operation';
  const queued = g.pendingSquadMoves?.find((m) => m.officerId === o.id && !m.dropped);
  const moveTo = (squadId: SquadId | null) => {
    const target = squadId ? g.squads.find((s) => s.id === squadId)?.name : undefined;
    const done = !onCall ? undefined : squadId === o.squadId ? 'Queued move withdrawn' : target ? `${o.surname} joins ${target} when the call ends` : `${o.surname} leaves the squad when the call ends`;
    act({ type: 'assignToSquad', officerId: o.id, squadId }, done);
  };
  return (
    <div className="stack-sm">
      {queued && <p className="note squad-queued-note"><Icon name="clock" size={14} />After this call, {queued.squadId ? `joins ${g.squads.find((s) => s.id === queued.squadId)?.name ?? `squad ${queued.squadId}`}` : 'leaves the squad'}</p>}
      <div className="chips">
        {g.squads.map((s) => (
          <Button key={s.id} size="sm" variant={o.squadId === s.id ? 'primary' : 'secondary'} aria-pressed={o.squadId === s.id}
            onClick={() => (o.squadId !== s.id || queued) && moveTo(s.id as SquadId)}>
            {s.id} · {s.name}{queued?.squadId === s.id ? ' · queued' : ''}
          </Button>
        ))}
        {g.squads.length === 0 && <span className="dim">Create a squad first on the Squad tab.</span>}
        {o.squadId && <Button size="sm" variant="ghost" icon="x" onClick={() => moveTo(null)}>{onCall ? 'Remove after the call' : 'Remove from squad'}</Button>}
      </div>
      {squad && squad.leaderId !== o.id && <Button size="sm" icon="star" onClick={() => act({ type: 'setLeader', squadId: squad.id, officerId: o.id }, `${o.surname} now leads ${squad.name}`)}>Set as leader</Button>}
    </div>
  );
}

function CareerTab({ o }: { o: Officer }) {
  const g = useGame();
  const { act } = useToast();
  const now = Date.now();
  const snap = useCareerSnapshot(o);
  const info = careerInfo(g, o.id, now);
  const [confirm, setConfirm] = useState(false);
  const ret = info?.retirement ?? (snap.retirement ? { ...snap.retirement, canRetain: false, retainReason: null, retainCost: null } : null);
  const retainable = !!ret && ret.canRetain;
  const effects = info?.effects.filter((effect) => !/ XP to |the top rank/.test(effect)) ?? [];
  const outlook = info?.outlook && !(ret && info.outlook.includes(ret.date)) ? info.outlook : null;
  const net = officerRates(g, Math.max(now, g.department.lastSettledAt))[o.id]?.net ?? -o.wage;
  return <div className="profile-stack career">
    <dl className="profile-record" aria-label="Service record">
      <div><dt>Calls</dt><dd>{o.career.operations}</dd></div>
      <div><dt>Went well</dt><dd className="tone-mint">{o.career.favorable}</dd></div>
      <div><dt>Went badly</dt><dd className="tone-danger">{o.career.adverse}</dd></div>
      <div><dt>Brought in</dt><dd>{money(o.career.earned ?? 0)}</dd></div>
      <div><dt>Net now</dt><dd className={net < 0 ? 'tone-danger' : 'tone-mint'}>{ratePerMinute(net)}</dd></div>
    </dl>
    {ret && <div className="note note-warn career-retire"><Icon name="retire" size={16} /><span>Retiring on {ret.date}, {ret.inDays === 1 ? '1 day' : `${ret.inDays} days`} left. {sentence(ret.reason)} They leave the roster and any squad on that day.</span></div>}
    {ret && retainable && !confirm && <Button size="sm" variant="primary" icon="handover" onClick={() => setConfirm(true)}>Offer retention{ret.retainCost ? ` · ${ret.retainCost}` : ''}</Button>}
    {ret && !retainable && ret.retainReason && <p className="dim career-outlook"><Icon name="lock" size={14} />{ret.retainReason}</p>}
    {ret && retainable && confirm && <div className="confirm">
      <p>Offer {o.surname} a raise to stay on? {ret.retainCost ? `It costs ${ret.retainCost}. ` : ''}This can be done once, and the officer may still decline.</p>
      <div className="row-actions">
        <Button size="sm" onClick={() => setConfirm(false)}>Not now</Button>
        <Button size="sm" variant="primary" icon="check" onClick={() => { if (act({ type: 'offerRetention', officerId: o.id }, `Retention offered to ${o.surname}`).ok) setConfirm(false); }}>Confirm offer</Button>
      </div>
    </div>}
    <RankLadder officer={o} />
    {info && <p className="career-dates dim"><Icon name="calendar" size={13} />Born {info.born} · joined service {info.serviceStart}</p>}
    {effects.length > 0 && <ul className="career-effects">{effects.map((e, i) => <li key={i}><Icon name="chevronRight" size={13} />{e}</li>)}</ul>}
    {outlook && <p className="career-outlook"><Icon name="flag" size={14} />{outlook}</p>}
  </div>;
}

function CareTab({ o, factors }: { o: Officer; factors: string[] }) {
  return <div className="profile-stack">
    <StressDisplay value={o.stress} />
    {o.injury && o.injury.until > Date.now() && <p className="note note-warn"><Icon name="bandage" size={14} />{o.injury.label}, healed {relativeTime(o.injury.until, Date.now())}</p>}
    {factors.length > 0 && <section aria-label="Recovery"><h3 className="profile-head">Recovery</h3><ul className="factors">{factors.map((f, i) => <li key={i}>{f}</li>)}</ul></section>}
    <StressGuide />
  </div>;
}

/** Train, teach and dismiss: always in reach at the bottom of the sheet. */
function ProfileActions({ o, confirmDismiss, setConfirmDismiss, onClose }: { o: Officer; confirmDismiss: boolean; setConfirmDismiss: (on: boolean) => void; onClose: () => void }) {
  const g = useGame();
  const nav = useNav();
  const { act, notify } = useToast();
  if (confirmDismiss) return <DismissConfirm officer={o} onCancel={() => setConfirmDismiss(false)} onDone={onClose} />;
  const detail = detailCheck(g, o.id);
  const training = o.assignment?.kind === 'training' ? o.assignment : null;
  return <div className="profile-actions">
    <Button icon="mortarboard" aria-label={training ? `View ${COURSES[training.courseId]?.name ?? 'current course'}` : `Train ${o.surname}`}
      onClick={() => { onClose(); nav.openTraining({ officerId: o.id, courseId: training?.courseId }); }}>{training ? 'Course' : 'Train'}</Button>
    <Button icon="book" aria-disabled={!detail.ok} className={detail.ok ? undefined : 'btn-soft-off'}
      aria-label={detail.ok ? `Send ${o.surname} on a ${detail.hours} hour instructor detail for ${money(detail.fee)}` : `Instructor detail unavailable. ${detail.reason ?? ''}`}
      onClick={() => {
        if (!detail.ok) { notify(detail.reason ?? 'Not available now', { tone: 'error' }); return; }
        act({ type: 'startDetail', officerId: o.id }, `${o.surname} teaches for ${detail.hours} hours, ${money(detail.fee)} on return`);
      }}>Teach{detail.ok ? ` · +${money(detail.fee)}` : ''}</Button>
    <Button variant="ghost" icon="trash" aria-label={`Dismiss ${o.surname}`} onClick={() => setConfirmDismiss(true)}>Dismiss</Button>
  </div>;
}

export function DismissConfirm({ officer, onCancel, onDone }: { officer: Officer; onCancel: () => void; onDone: () => void }) {
  const g = useGame();
  const { act } = useToast();
  const p = projectDismiss(g, officer.id, Date.now());
  return (
    <div className="confirm profile-dismiss">
      <p>Dismiss {officer.firstName} {officer.surname}? Severance {money(p.upfront)}, wages {signedMoney(p.wageDelta)}/h, department {rate(p.netBefore)} becomes {rate(p.netAfter)}.</p>
      {!p.ok && p.reason && <p className="note note-warn">{p.reason}</p>}
      <div className="row-actions">
        <Button variant="secondary" onClick={onCancel}>Keep</Button>
        <Button variant="danger" disabled={!p.ok} onClick={() => { if (act({ type: 'dismiss', officerId: officer.id }, `${officer.surname} dismissed`).ok) onDone(); }}>Confirm dismissal</Button>
      </div>
    </div>
  );
}

/** A reason such as 'age' or 'Chose to retire after a long career' as a closing sentence. */
function sentence(reason: string): string {
  const named: Record<string, string> = { age: 'Mandatory retirement age.', service: 'Long service.', burnout: 'Burnout.' };
  if (named[reason]) return named[reason];
  const t = reason.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
