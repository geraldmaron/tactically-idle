import './squad-visual.css';
import { personaNote } from '../../content/personas';
import { useState } from 'react';
import { useGame } from '../store';
import { careerInfo, projectDismiss, recoveryInfo } from '../../sim/department-selectors';
import { gameDay } from '../../sim/calendar';
import type { Id, Officer, SquadId } from '../../sim/types';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { COURSES } from '../../content/courses';
import { Button, Chip, ExperienceChip, KV, OfficerStatusChip, RatingBars, SubHead } from '../components/ui';
import { RetirementChip, useCareerSnapshot } from '../components/Career';
import { OfficerProgress } from '../components/OfficerProgress';
import { StressDisplay, StressGuide } from '../components/StressDisplay';
import { useToast } from '../components/toast';
import type { StatusKey } from '../components/labels';
import { CERT_ICON, CERT_LABEL, ROLE_META, TRAIT_INFO } from '../components/labels';
import { officerStatus } from './squad-model';
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
  const injured = !!o.injury && o.injury.until > now;
  const career = useCareerSnapshot(o);
  const statusKey: StatusKey = officerStatus(o, now);
  const statusText = injured ? `Injured: ${o.injury!.label}` : o.assignment?.kind === 'training' ? `Training · ${relativeTime(o.assignment.endsAt, now)}` : o.assignment?.kind === 'operation' ? 'On operation' : undefined;
  const persona = personaNote(o.identityId);

  return (
    <div className="osheet">
      <div className="osheet-hero">
        <div className="osheet-portrait">
          <Portrait officer={o} size={92} {...agePortraitProps(g, o, now)} />
          {isLeader && <span className="osheet-leader" title="Squad leader"><Icon name="star" size={13} /></span>}
        </div>
        <div className="osheet-id">
          <div className="chips">
            <Chip icon={ROLE_META[o.role].icon}>{ROLE_META[o.role].label}</Chip>
            {squad ? <Chip tone="blue" icon={isLeader ? 'star' : 'people'}>{squad.id} · {squad.name}{isLeader ? ' · leader' : ''}</Chip> : <Chip icon="user">Unassigned</Chip>}
            <OfficerStatusChip status={statusKey}>{statusText}</OfficerStatusChip>
            <ExperienceChip band={career.band} />
            {career.retirement && <RetirementChip date={career.retirement.date} inDays={career.retirement.inDays} compact />}
          </div>
          <p className="osheet-facts">
            <span><Icon name="cash" size={13} />{perHour(o.wage)}</span>
            <span><Icon name="cake" size={13} />Age {career.age}</span>
            <span><Icon name="medal" size={13} />{yearsText(career.service)}</span>
          </p>
        </div>
      </div>
      {persona && <p className="dim persona-note">{persona}</p>}

      <div className="osheet-gauges">
        <OfficerProgress officer={o} day={gameDay(g, Math.max(now, g.department.clockHighWater))} />
        <div className="osheet-stress">
          <StressDisplay value={o.stress} />
          {info.blocker ? (
            <p className="osheet-avail tone-warn"><Icon name="lock" size={14} />{info.blocker}{info.deployableAt !== null && <span> · ready {relativeTime(info.deployableAt, now)}</span>}</p>
          ) : (
            <p className="osheet-avail tone-mint"><Icon name="check" size={14} />Ready for a call</p>
          )}
        </div>
      </div>

      <SubHead icon="gauge">Skills</SubHead>
      <RatingBars ratings={o.ratings} label="Skills out of 100" />

      {(o.certs.length > 0 || o.traits.length > 0) && <>
        <SubHead icon="medal">Qualifications and traits</SubHead>
        {o.certs.length > 0 && <div className="chips">
          {o.certs.map((c) => (
            <Chip key={c} tone="mint" icon={CERT_ICON[c]}>
              {CERT_LABEL[c]}
            </Chip>
          ))}
        </div>}
        {o.traits.length > 0 && <ul className="traits">
          {o.traits.map((t) => (
            <li key={t}>
              <strong>
                <Icon name={TRAIT_INFO[t].icon} size={14} />
                {TRAIT_INFO[t].label}
              </strong>
              <span>{TRAIT_INFO[t].condition}</span>
            </li>
          ))}
        </ul>}
      </>}
      {o.certs.length === 0 && <p className="dim osheet-none">No qualifications yet. Courses grant them on completion.</p>}

      <SubHead icon="people">Squad</SubHead>
      <SquadControls o={o} />

      <div className="osheet-actions">
        <Button icon="mortarboard" onClick={() => { onClose(); nav.openTraining({ officerId: o.id }); }}>Train {o.surname}</Button>
        {o.assignment?.kind === 'training' && <Button onClick={() => {
          const courseId = o.assignment?.kind === 'training' ? o.assignment.courseId : undefined;
          onClose(); nav.openTraining({ officerId: o.id, courseId });
        }}>View {COURSES[o.assignment.courseId]?.name ?? 'current course'}</Button>}
      </div>

      <CareerSection o={o} />

      <details className="osheet-more">
        <summary>Recovery and stress</summary>
        {info.factors.length > 0 && (
          <ul className="factors">
            {info.factors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        )}
        <StressGuide />
      </details>

      <div className="osheet-dismiss">
        {!confirmDismiss ? (
          <Button variant="danger" size="sm" icon="trash" onClick={() => setConfirmDismiss(true)}>
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
  const effects = info?.effects.filter((effect) => !effect.startsWith('Needs ') || !effect.includes('xp per rating point')) ?? [];
  const outlook = info?.outlook && !(ret && info.outlook.includes(ret.date)) ? info.outlook : null;
  return (
    <div className="career">
      {ret && (
        <div className="note note-warn career-retire">
          <Icon name="retire" size={16} />
          <span>
            Retiring on {ret.date}, {ret.inDays === 1 ? '1 day' : `${ret.inDays} days`} left. {sentence(ret.reason)} They leave the roster and any squad on that day.
          </span>
        </div>
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
      {(info || effects.length > 0 || outlook) && <details className="osheet-more">
        <summary>Career</summary>
        {info && (
          <p className="career-dates dim">
            <Icon name="calendar" size={13} />
            Born {info.born} · joined service {info.serviceStart}
          </p>
        )}
        {effects.length > 0 && (
          <ul className="career-effects">
            {effects.map((e, i) => (
              <li key={i}>
                <Icon name="chevronRight" size={13} />
                {e}
              </li>
            ))}
          </ul>
        )}
        {outlook && (
          <p className="career-outlook">
            <Icon name="flag" size={14} />
            {outlook}
          </p>
        )}
      </details>}
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
