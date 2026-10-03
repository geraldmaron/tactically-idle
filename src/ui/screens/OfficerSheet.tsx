import { personaNote } from '../../content/personas';
import { useState } from 'react';
import { useGame } from '../store';
import { careerInfo, projectDismiss, recoveryInfo } from '../../sim/department-selectors';
import { gameDay } from '../../sim/calendar';
import type { Id, Officer, SquadId } from '../../sim/types';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { COURSES } from '../../content/courses';
import { Button, Chip, ExperienceChip, KV, Meter, ReadinessBar, OfficerStatusChip, SubHead } from '../components/ui';
import { RetirementChip, useCareerSnapshot } from '../components/Career';
import { OfficerProgress } from '../components/OfficerProgress';
import { StressGuide } from '../components/StressDisplay';
import { useToast } from '../components/toast';
import type { StatusKey } from '../components/labels';
import { BAND_SHORT, CERT_ICON, CERT_LABEL, RATING_META, ROLE_META, TRAIT_INFO, bandOf, ratingTone } from '../components/labels';
import { Portrait } from '../portraits/Portrait';
import { agePortraitProps } from './helpers';
import { Icon } from '../icons';
import { money, perHour, rate, relativeTime, signedMoney, yearsText } from '../format';

export function OfficerSheet({ officerId, onClose }: { officerId: Id | null; onClose: () => void }) {
  const g = useGame();
  const o = officerId ? g.officers[officerId] : undefined;
  return (
    <Sheet
      open={!!o}
      onClose={onClose}
      title={o ? `${o.firstName} ${o.surname}` : ''}
      subtitle={o ? `${ROLE_META[o.role].label} · ${perHour(o.wage)} wage` : undefined}
    >
      {o && <OfficerBody o={o} onClose={onClose} />}
    </Sheet>
  );
}

function OfficerBody({ o, onClose }: { o: Officer; onClose: () => void }) {
  const g = useGame();
  const now = Date.now();
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const info = recoveryInfo(g, o.id, now);
  const nav = useNav();
  const squad = o.squadId ? g.squads.find((s) => s.id === o.squadId) : undefined;
  const isLeader = squad?.leaderId === o.id;
  const band = bandOf(o);
  const injured = !!o.injury && o.injury.until > now;
  const career = useCareerSnapshot(o);
  const statusKey: StatusKey = injured ? 'injured' : o.assignment?.kind === 'training' ? 'training' : o.assignment?.kind === 'operation' ? 'deployed' : band;

  return (
    <div className="osheet">
      <div className="osheet-top">
        <div className="osheet-portrait">
          <Portrait officer={o} size={84} {...agePortraitProps(g, o, now)} />
        </div>
        <div className="osheet-id">
          <div className="chips">
            <Chip icon={ROLE_META[o.role].icon}>{ROLE_META[o.role].label}</Chip>
            {squad ? <Chip tone="blue" icon={isLeader ? 'star' : 'people'}>{squad.name}{isLeader ? ' · leader' : ''}</Chip> : <Chip icon="user">Unassigned</Chip>}
          </div>
          <div className="chips">
            <OfficerStatusChip status={statusKey} />
            <ExperienceChip band={career.band} />
            {career.retirement && <RetirementChip date={career.retirement.date} inDays={career.retirement.inDays} compact />}
          </div>
          <KV icon="cash" k="Wage" v={perHour(o.wage)} />
        </div>
      </div>

      <OfficerProgress officer={o} day={gameDay(g, Math.max(now, g.department.clockHighWater))} />
      {personaNote(o.identityId) && <p className="dim persona-note">{personaNote(o.identityId)}</p>}

      <SubHead icon="gauge">Skills · out of 100</SubHead>
      <ul className="ratings">
        {RATING_META.map((r) => (
          <li key={r.key} className="rating">
            <span className="rating-label">
              <Icon name={r.icon} size={16} />
              {r.label}
            </span>
            <Meter value={o.ratings[r.key]} tone={ratingTone(o.ratings[r.key])} label={r.label} />
            <span className="rating-val">{Math.round(o.ratings[r.key])}</span>
          </li>
        ))}
      </ul>

      <CareerSection o={o} />

      <SubHead icon="medal">Qualifications</SubHead>
      {o.certs.length === 0 ? (
        <p className="dim">None yet. Courses grant certifications on completion.</p>
      ) : (
        <div className="chips">
          {o.certs.map((c) => (
            <Chip key={c} tone="mint" icon={CERT_ICON[c]}>
              {CERT_LABEL[c]}
            </Chip>
          ))}
        </div>
      )}

      <SubHead icon="star">Traits</SubHead>
      {o.traits.length === 0 ? (
        <p className="dim">No traits.</p>
      ) : (
        <ul className="traits">
          {o.traits.map((t) => (
            <li key={t}>
              <strong>
                <Icon name={TRAIT_INFO[t].icon} size={16} />
                {TRAIT_INFO[t].label}
              </strong>
              <span>{TRAIT_INFO[t].condition}</span>
            </li>
          ))}
        </ul>
      )}

      <SubHead icon="pulse">Condition</SubHead>
      <div className="cond">
        <ReadinessBar stress={o.stress} withText />
        <StressGuide />
        <KV icon="info" k="Status" v={injured ? `Injured: ${o.injury!.label}` : BAND_SHORT[band]} />
        {info.blocker ? (
          <p className="note note-warn">
            <Icon name="lock" size={16} />
            {info.blocker}
          </p>
        ) : (
          <p className="note note-mint">
            <Icon name="check" size={16} />
            Ready for a call.
          </p>
        )}
        {info.deployableAt !== null && <KV icon="clock" k="Ready again" v={relativeTime(info.deployableAt, now)} />}
        {info.factors.length > 0 && (
          <ul className="factors">
            {info.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
        <KV
          icon="pin"
          k="Assignment"
          v={
            o.assignment?.kind === 'training'
              ? `Training, ${relativeTime(o.assignment.endsAt, now)}`
              : o.assignment?.kind === 'operation'
                ? 'On operation'
                : 'Available'
          }
        />
      </div>

      <SubHead icon="people">Squad</SubHead>
      <SquadControls o={o} />

      <SubHead icon="mortarboard">Training</SubHead>
      <p className="dim">Choose a certification or skills course in Training. This officer will be selected for you.</p>
      <Button icon="mortarboard" onClick={() => { onClose(); nav.openTraining({ officerId: o.id }); }}>Train {o.surname}</Button>
      {o.assignment?.kind === 'training' && <Button onClick={() => {
        const courseId = o.assignment?.kind === 'training' ? o.assignment.courseId : undefined;
        onClose(); nav.openTraining({ officerId: o.id, courseId });
      }}>View {COURSES[o.assignment.courseId]?.name ?? 'current course'}</Button>}

      <SubHead icon="trash">Dismiss</SubHead>
      {!confirmDismiss ? (
        <Button variant="danger" size="sm" onClick={() => setConfirmDismiss(true)}>
          Dismiss {o.surname}…
        </Button>
      ) : (
        <DismissConfirm
          officer={o}
          onCancel={() => setConfirmDismiss(false)}
          onDone={() => {
            setConfirmDismiss(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

function SquadControls({ o }: { o: Officer }) {
  const g = useGame();
  const { act } = useToast();
  const squad = o.squadId ? g.squads.find((s) => s.id === o.squadId) : undefined;
  return (
    <div className="stack-sm">
      <div className="chips">
        {g.squads.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant={o.squadId === s.id ? 'primary' : 'secondary'}
            aria-pressed={o.squadId === s.id}
            onClick={() => o.squadId !== s.id && act({ type: 'assignToSquad', officerId: o.id, squadId: s.id as SquadId })}
          >
            {s.id} · {s.name}
          </Button>
        ))}
        {g.squads.length === 0 && <span className="dim">Create a squad first (Squad tab).</span>}
        {o.squadId && (
          <Button size="sm" variant="ghost" icon="x" onClick={() => act({ type: 'assignToSquad', officerId: o.id, squadId: null })}>
            Remove from squad
          </Button>
        )}
      </div>
      {squad && squad.leaderId !== o.id && (
        <Button size="sm" icon="star" onClick={() => act({ type: 'setLeader', squadId: squad.id, officerId: o.id }, `${o.surname} now leads ${squad.name}`)}>
          Set as leader
        </Button>
      )}
    </div>
  );
}

function DismissConfirm({ officer, onCancel, onDone }: { officer: Officer; onCancel: () => void; onDone: () => void }) {
  const g = useGame();
  const { act } = useToast();
  const p = projectDismiss(g, officer.id, Date.now());
  return (
    <div className="confirm">
      <p>
        Dismiss {officer.firstName} {officer.surname}? Assigned gear returns to the department.
      </p>
      <KV k="Severance" v={money(p.upfront)} />
      <KV k="Wage change" v={`${signedMoney(p.wageDelta)}/h`} />
      <KV k="Net funding" v={`${rate(p.netBefore)} → ${rate(p.netAfter)}`} />
      {!p.ok && p.reason && <p className="note note-warn">{p.reason}</p>}
      <div className="row-actions">
        <Button variant="secondary" onClick={onCancel}>
          Keep
        </Button>
        <Button
          variant="danger"
          disabled={!p.ok}
          onClick={() => {
            if (act({ type: 'dismiss', officerId: officer.id }, `${officer.surname} dismissed`).ok) onDone();
          }}
        >
          Confirm dismissal
        </Button>
      </div>
    </div>
  );
}

function CareerSection({ o }: { o: Officer }) {
  const g = useGame();
  const { act } = useToast();
  const now = Date.now();
  const snap = useCareerSnapshot(o);
  const info = careerInfo(g, o.id, now);
  const [confirm, setConfirm] = useState(false);
  const ret = info?.retirement ?? (snap.retirement ? { ...snap.retirement, canRetain: false, retainReason: null, retainCost: null } : null);
  const retainable = !!ret && ret.canRetain;
  return (
    <>
      <SubHead icon="calendar">Career</SubHead>
      <div className="career">
        <div className="chips">
          <Chip icon="cake">Age {Math.floor(info?.age ?? snap.age)}</Chip>
          <Chip icon="medal">{yearsText(info?.serviceYears ?? snap.service)} service</Chip>
          <ExperienceChip band={info?.experience ?? snap.band} />
        </div>
        {info && (
          <p className="career-dates dim">
            <Icon name="calendar" size={13} />
            Born {info.born} · joined service {info.serviceStart}
          </p>
        )}
        {ret && (
          <div className="note note-warn career-retire">
            <Icon name="retire" size={16} />
            <span>
              Retiring on {ret.date}, {ret.inDays === 1 ? '1 day' : `${ret.inDays} days`} left. {sentence(ret.reason)} They leave the roster and any squad on that day.
            </span>
          </div>
        )}
        {info && info.effects.length > 0 && (
          <ul className="career-effects">
            {info.effects.filter((effect) => !effect.startsWith('Needs ') || !effect.includes('xp per rating point')).map((e, i) => (
              <li key={i}>
                <Icon name="chevronRight" size={13} />
                {e}
              </li>
            ))}
          </ul>
        )}
        {info?.outlook && !(ret && info.outlook.includes(ret.date)) && (
          <p className="career-outlook">
            <Icon name="flag" size={14} />
            {info.outlook}
          </p>
        )}
        {ret && retainable && !confirm && (
          <Button size="sm" variant="primary" icon="handover" onClick={() => setConfirm(true)}>
            Offer retention{ret.retainCost ? ` · ${ret.retainCost}` : ''}
          </Button>
        )}
        {ret && !retainable && ret.retainReason && (
          <p className="dim career-outlook">
            <Icon name="lock" size={14} />
            {ret.retainReason}
          </p>
        )}
        {ret && retainable && confirm && (
          <div className="confirm">
            <p>
              Offer {o.surname} a raise to stay on? {ret.retainCost ? `Cost: ${ret.retainCost}. ` : ''}This can be done once, and the officer may still decline.
            </p>
            <div className="row-actions">
              <Button size="sm" onClick={() => setConfirm(false)}>
                Not now
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon="check"
                onClick={() => {
                  if (act({ type: 'offerRetention', officerId: o.id }, `Retention offered to ${o.surname}`).ok) setConfirm(false);
                }}
              >
                Confirm offer
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** A reason such as 'age' or 'Chose to retire after a long career' as a closing sentence. */
function sentence(reason: string): string {
  const named: Record<string, string> = { age: 'Mandatory retirement age.', service: 'Long service.', burnout: 'Burnout.' };
  if (named[reason]) return named[reason];
  const t = reason.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
