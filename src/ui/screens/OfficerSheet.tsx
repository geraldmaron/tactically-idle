// The service jacket (canvas E2, officer-profile): who this officer is, in the order a player earns it. It opens on
// the jacket (portrait, pressure line, radio sample, traits, the ivory card, memory, bonds); what they cost and
// bring sits under Skills, their record under Career and their stress under Care. One full-height sheet opened from
// anywhere through navigation, so Back closes it. Actions stay in the footer.
import './officer-profile.css';
import { useState } from 'react';
import { COURSES } from '../../content/courses';
import { CERT_NAME } from '../../content/certs';
import { useGame } from '../store';
import { careerInfo, projectDismiss, recoveryInfo } from '../../sim/department-selectors';
import { learningPace } from '../../sim/career';
import { detailCheck, detailRate } from '../../sim/detail';
import type { Id, Officer } from '../../sim/types';
import { SquadPlacement } from '../components/SquadPlacement';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { ChoiceRail } from '../components/ChoiceRail';
import { Button, Chip, RatingBars } from '../components/ui';
import { JacketHero, JacketStory } from './team/Jacket';
import { AftercareSheet } from './team/Aftercare';
import { Overflow } from '../components/Overflow';
import { rankedName } from '../components/OfficerRow';
import { RetirementChip, useCareerSnapshot } from '../components/Career';
import { OfficerProgress, RankLadder } from '../components/OfficerProgress';
import { RANKS } from '../../content/ranks';
import { formatGameDate } from '../../sim/calendar';
import { StressDisplay, StressGuide } from '../components/StressDisplay';
import { useToast } from '../components/toast';
import type { StatusKey } from '../components/labels';
import { CERT_ICON, ROLE_META, STATUS_META, TRAIT_INFO } from '../components/labels';
import { officerStatus } from './squad-model';
import { Icon } from '../icons';
import { funding, fundingRate, relativeTime, yearsText } from '../format';
import { Funds } from '../components/Funds';
import { officerRates } from '../../sim/economy';
import { PACE_LABEL } from './Recruit';

export type ProfileTab = 'overview' | 'skills' | 'career' | 'care';

export function OfficerSheet({ officerId, onClose, initialTab = 'overview' }: { officerId: Id | null; onClose: () => void; initialTab?: ProfileTab }) {
  const g = useGame();
  const o = officerId ? g.officers[officerId] : undefined;
  const [tab, setTab] = useState<ProfileTab>(initialTab);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  // Aftercare opens over the jacket, so the decision is made where the note is read.
  const [aftercare, setAftercare] = useState<Id | null>(null);
  const close = () => { setConfirmDismiss(false); setTab('overview'); setAftercare(null); onClose(); };
  return <>
    <Sheet open={!!o} onClose={close} title={o ? rankedName(o) : ''} className="profile-sheet" interactionKey={confirmDismiss ? 'dismiss' : 'profile'}
      footer={o ? <ProfileActions o={o} confirmDismiss={confirmDismiss} setConfirmDismiss={setConfirmDismiss} onClose={close} /> : undefined}>
      {o && <ProfileBody o={o} tab={tab} setTab={setTab} onAftercare={setAftercare} />}
    </Sheet>
    <AftercareSheet imprintId={o ? aftercare : null} onClose={() => setAftercare(null)} />
  </>;
}

function ProfileBody({ o, tab, setTab, onAftercare }: { o: Officer; tab: ProfileTab; setTab: (tab: ProfileTab) => void; onAftercare: (imprintId: Id) => void }) {
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
  const away = !!statusText || !!info.blocker;
  const pace = learningPace(o);
  const detail = detailRate(o);
  return (
    <div className="profile">
      <JacketHero o={o} />
      <ChoiceRail value={tab} kind="tabs" grow label="Profile sections" panelId="profile-panel" onChange={setTab} options={[
        { value: 'overview', label: 'Jacket' }, { value: 'skills', label: 'Skills' }, { value: 'career', label: 'Career' }, { value: 'care', label: 'Care' },
      ]} />
      <div id="profile-panel" role="tabpanel" className="profile-panel jacket-panel">
        {tab === 'overview' && <>
          <JacketStory o={o} onAftercare={onAftercare} />
          {/* The one readiness line: why they are off a call, and when they are back. Stress history is in Care. */}
          {away && <p className={`jacket-ready tone-${info.blocker ? 'warn' : 'mint'}`} aria-label="Readiness">
            <Icon name={info.blocker ? 'lock' : STATUS_META[statusKey].icon} size={16} />
            <span>{statusText ?? STATUS_META[statusKey].label}{info.blocker ? <> · {info.blocker}{info.deployableAt !== null && <>, ready {relativeTime(info.deployableAt, now)}</>}</> : null}</span>
          </p>}
        </>}
        {tab === 'skills' && <Skills o={o} pace={pace} detail={detail} squadName={squad ? `${squad.name}${isLeader ? ', leader' : ''}` : 'Unassigned'} age={career.age} service={career.service} retirement={career.retirement} />}
        {tab === 'career' && <CareerTab o={o} />}
        {tab === 'care' && <CareTab o={o} factors={info.factors} />}
      </div>
    </div>
  );
}

function Skills({ o, pace, detail, squadName, age, service, retirement }: { o: Officer; pace: ReturnType<typeof learningPace>; detail: number | null; squadName: string; age: number; service: number; retirement: ReturnType<typeof useCareerSnapshot>['retirement'] }) {
  return <div className="profile-stack">
    <p className="profile-facts"><span>{ROLE_META[o.role].label}</span><span>{squadName}</span><span>Age {age}</span><span>{yearsText(service)} served</span></p>
    {retirement && <div className="chips"><RetirementChip date={retirement.date} inDays={retirement.inDays} compact /></div>}
    <dl className="profile-value" aria-label="Cost and value">
      <div><dt>Wage</dt><dd><Funds value={o.wage} format="perHour" /></dd></div>
      <div><dt>Learns</dt><dd className={pace === 'fast' ? 'tone-mint' : pace === 'slow' ? 'tone-danger' : undefined}>{PACE_LABEL[pace]}</dd></div>
      <div><dt>Teaching</dt><dd className={detail === null ? 'dim' : 'tone-mint'}>{detail === null ? 'No cert' : <>+<Funds value={detail} format="perHour" /></>}</dd></div>
    </dl>
    {o.traits.length > 0 && <section aria-label="Traits"><h3 className="profile-head">Traits</h3><ul className="profile-traits">{o.traits.map((t) => {
      // A trait a promotion granted names its cause (swat-officer-stories: earned traits cite the call).
      const earned = o.promotions?.find((p) => RANKS[p.rank].trait === t);
      return <li key={t}><strong><Icon name={TRAIT_INFO[t].icon} size={16} />{TRAIT_INFO[t].label}</strong><span>{TRAIT_INFO[t].condition}</span>
        {earned && <span className="profile-trait-origin">Earned on promotion to {RANKS[earned.rank].title}, {earned.cause}, {formatGameDate(earned.day)}.</span>}</li>;
    })}</ul></section>}
    <OfficerProgress officer={o} />
    <section aria-label="Skills"><h3 className="profile-head">Skills</h3><RatingBars ratings={o.ratings} label="Skills out of 100" /></section>
    <section aria-label="Qualifications">
      <h3 className="profile-head">Qualifications</h3>
      {o.certs.length > 0 ? <div className="chips">{o.certs.map((c) => <Chip key={c} tone="mint" icon={CERT_ICON[c]}>{CERT_NAME[c]}</Chip>)}</div>
        : <p className="dim">No qualifications yet. Courses grant them on completion, and a qualified officer can teach.</p>}
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
  return (
    <div className="stack-sm">
      <SquadPlacement officer={o} />
      <div className="chips">
        {o.squadId && <Button size="sm" variant="ghost" icon="x" onClick={() => act({ type: 'assignToSquad', officerId: o.id, squadId: null }, onCall ? `${o.surname} leaves the squad when the call ends` : `${o.surname} moved to Unassigned`)}>{onCall ? 'Remove after the call' : 'Remove from squad'}</Button>}
        {squad && squad.leaderId !== o.id && <Button size="sm" icon="star" onClick={() => act({ type: 'setLeader', squadId: squad.id, officerId: o.id }, `${o.surname} now leads ${squad.name}`)}>Set as leader</Button>}
      </div>
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
      <div><dt>Brought in</dt><dd><Funds value={o.career.earned ?? 0} /></dd></div>
      <div><dt>Net now</dt><dd className={net < 0 ? 'tone-danger' : 'tone-mint'}><Funds value={net} format="rate" /></dd></div>
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
    <section className="profile-care-card" aria-label="Stress"><h3 className="profile-head"><Icon name="heart" size={16} />Stress</h3><StressDisplay value={o.stress} /></section>
    {o.injury && o.injury.until > Date.now() && <p className="note note-warn"><Icon name="bandage" size={14} />{o.injury.label}, healed {relativeTime(o.injury.until, Date.now())}</p>}
    {factors.length > 0 && <section className="profile-care-card" aria-label="Recovery"><h3 className="profile-head"><Icon name="moon" size={16} />Recovery</h3><ul className="factors">{factors.map((f, i) => <li key={i}>{f}</li>)}</ul></section>}
    <StressGuide />
  </div>;
}

/** Training is the sheet's move; teaching and dismissal sit in the overflow, so the destructive
 * action is never a peer of the everyday one. */
function ProfileActions({ o, confirmDismiss, setConfirmDismiss, onClose }: { o: Officer; confirmDismiss: boolean; setConfirmDismiss: (on: boolean) => void; onClose: () => void }) {
  const g = useGame();
  const nav = useNav();
  const { act, notify } = useToast();
  if (confirmDismiss) return <DismissConfirm officer={o} onCancel={() => setConfirmDismiss(false)} onDone={onClose} />;
  const detail = detailCheck(g, o.id);
  const training = o.assignment?.kind === 'training' ? o.assignment : null;
  return <div className="profile-actions">
    <Button variant="primary" icon="mortarboard" aria-label={training ? `View ${COURSES[training.courseId]?.name ?? 'current course'}` : `Train ${o.surname}`}
      onClick={() => { onClose(); nav.openTraining({ officerId: o.id, courseId: training?.courseId }); }}>{training ? 'View course' : 'Send to training'}</Button>
    <Overflow up label={`More for ${o.surname}`}>
      <Button variant="ghost" icon="book" aria-disabled={!detail.ok} className={detail.ok ? undefined : 'btn-soft-off'}
        aria-label={detail.ok ? `Send ${o.surname} on a ${detail.hours} hour instructor detail for ${funding(detail.fee)}` : `Instructor detail unavailable. ${detail.reason ?? ''}`}
        onClick={() => {
          if (!detail.ok) { notify(detail.reason ?? 'Not available now', { tone: 'error' }); return; }
          act({ type: 'startDetail', officerId: o.id }, `${o.surname} teaches for ${detail.hours} hours, ${funding(detail.fee)} on return`);
        }}>Teach{detail.ok && <> for <Funds value={detail.fee} /></>}</Button>
      <Button variant="ghost" icon="trash" aria-label={`Dismiss ${o.surname}`} onClick={() => setConfirmDismiss(true)}>Dismiss</Button>
    </Overflow>
  </div>;
}

export function DismissConfirm({ officer, onCancel, onDone }: { officer: Officer; onCancel: () => void; onDone: () => void }) {
  const g = useGame();
  const { act } = useToast();
  const p = projectDismiss(g, officer.id, Date.now());
  const squad = officer.squadId ? g.squads.find((s) => s.id === officer.squadId) : undefined;
  const left = squad ? squad.officerIds.filter((id) => id !== officer.id) : [];
  const nextLead = squad?.leaderId === officer.id && left[0] ? g.officers[left[0]] : undefined;
  return (
    <div className="confirm profile-dismiss">
      <p>Dismiss {officer.firstName} {officer.surname}? Severance {funding(p.upfront)}, wages {fundingRate(p.wageDelta)}, department net {fundingRate(p.netBefore)} becomes {fundingRate(p.netAfter)}.</p>
      {squad && <p className="dim">{squad.name} drops to {left.length} of 4{nextLead ? ` and ${nextLead.surname} takes the lead` : squad.leaderId === officer.id ? ' with no leader' : ''}. Fill the place from Unassigned or Hire.</p>}
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
