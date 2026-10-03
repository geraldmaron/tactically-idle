import { recruitmentStatus } from '../../sim/roster';
import { personaNote } from '../../content/personas';
import { useRef, useState } from 'react';
import { useGame } from '../store';
import { projectHire, sortedCandidates } from '../../sim/department-selectors';
import type { Candidate, Id, Role } from '../../sim/types';
import { Button, Card, Chip, EmptyState, KV, Section } from '../components/ui';
import { useToast } from '../components/toast';
import { CERT_ICON, CERT_LABEL, RATING_META, ROLES, ROLE_META, TRAIT_INFO } from '../components/labels';
import { CareerMini } from '../components/Career';
import { Portrait } from '../portraits/Portrait';
import { ChoiceRail } from '../components/ChoiceRail';
import { agePortraitProps } from './helpers';
import { Icon } from '../icons';
import { money, perHour, rate, relativeTime } from '../format';
import './recruit.css';

export function Recruit() {
  const g = useGame();
  const [target, setTarget] = useState<Role | null>(null);
  const [hireFor, setHireFor] = useState<Id | null>(null);
  const candidates = sortedCandidates(g);
  const roster = Object.keys(g.officers).length;
  const full = roster >= g.department.rosterCap;
  const now = Date.now();
  const recruitment = recruitmentStatus(g, now);

  return (
    <Section
      title="Recruit"
      icon="user"
      id="recruit-h"
      hint={`Roster ${roster}/${g.department.rosterCap}${full ? ' (full: dismiss or expand capacity to hire)' : ''}. Hiring adds the wage to every hour.`}
    >
      <Card>
        <RecruitRefresh target={target} onTargetChange={setTarget} />
      </Card>
      {candidates.length === 0 ? (
        <Card>
          <EmptyState icon="people" title={recruitment.exhausted ? "Recruitment reserve exhausted" : "No candidates right now"}>
            {recruitment.exhausted ? "Every available person in this campaign has served or reached retirement age. Retired officers will not return under a new name." : "Refresh the pool to see new recruits. New personnel arrive as existing officers move through their careers."}
          </EmptyState>
        </Card>
      ) : (
        <div className="stack">
          {candidates.map((c) => (
            <CandidateCard key={c.id} c={c} now={now} open={hireFor === c.id} onToggle={() => setHireFor((current) => current === c.id ? null : c.id)} onHired={() => setHireFor(null)} />
          ))}
        </div>
      )}
    </Section>
  );
}

export function RecruitRefresh({ target, onTargetChange }: { target: Role | null; onTargetChange: (role: Role | null) => void }) {
  const { act } = useToast();
  return <div className="recruit-refresh">
    <strong className="recruit-refresh-title">Role for next refresh</strong>
    <ChoiceRail<Role | 'any'> value={target ?? 'any'} onChange={(role) => onTargetChange(role === 'any' ? null : role)} label="Role for next candidate refresh" grow options={[
      { value: 'any', label: 'Any' },
      ...ROLES.map((role) => ({ value: role, label: ROLE_META[role].label })),
    ]} />
    <p className="recruit-refresh-hint">Choose the role to target when you refresh candidates.</p>
    <Button size="sm" icon="refresh" onClick={() => act(target ? { type: 'refreshCandidates', targetRole: target } : { type: 'refreshCandidates' })}>
      Refresh candidates
    </Button>
  </div>;
}

export function CandidateCard({ c, now, open, onToggle, onHired }: { c: Candidate; now: number; open: boolean; onToggle: () => void; onHired: () => void }) {
  const g = useGame();
  const { act } = useToast();
  const hiring = useRef(false);
  const o = c.officer;
  const proj = open ? projectHire(g, c.id) : null;
  const reviewId = `hire-review-${c.id}`;
  return (
    <Card className="cand">
      <div className="cand-top">
        <div className="cand-portrait">
          <Portrait officer={o} size={58} {...agePortraitProps(g, o, now)} />
        </div>
        <div className="cand-id">
          <strong className="cand-name">
            {o.firstName} {o.surname}
          </strong>
          <span className="chips">
            <Chip icon={ROLE_META[o.role].icon}>{ROLE_META[o.role].label}</Chip>
            <Chip tone="amber" icon="cash">{perHour(o.wage)}</Chip>
          </span>
        </div>
        <button
          type="button"
          className={`icon-btn${c.shortlisted ? ' icon-btn-on' : ''}`}
          aria-pressed={c.shortlisted}
          aria-label={c.shortlisted ? `Remove ${o.surname} from shortlist` : `Shortlist ${o.surname}`}
          onClick={() => act({ type: 'shortlist', candidateId: c.id, on: !c.shortlisted })}
        >
          <Icon name="bookmark" size={20} />
        </button>
      </div>
      {personaNote(o.identityId) && <p className="dim persona-note">{personaNote(o.identityId)}</p>}
      <CareerMini officer={o} prior />
      <ul className="miniratings">
        {RATING_META.map((r) => (
          <li key={r.key}>
            <span>
              <Icon name={r.icon} size={12} />
              {r.short}
            </span>
            <b>{Math.round(o.ratings[r.key])}</b>
          </li>
        ))}
      </ul>
      {(o.certs.length > 0 || o.traits.length > 0) && (
        <div className="chips">
          {o.certs.map((x) => (
            <Chip key={x} tone="mint" icon={CERT_ICON[x]}>
              {CERT_LABEL[x]}
            </Chip>
          ))}
          {o.traits.map((t) => (
            <Chip key={t} icon={TRAIT_INFO[t].icon} title={TRAIT_INFO[t].condition}>
              {TRAIT_INFO[t].label}
            </Chip>
          ))}
        </div>
      )}
      <div className="cand-foot">
        <span className="dim cand-meta">
          <Icon name="cash" size={13} />
          Signing {money(c.signingCost)} · <Icon name="clock" size={13} /> leaves {relativeTime(c.expiresAt, now)}
        </span>
        <Button size="sm" variant={open ? 'secondary' : 'primary'} aria-expanded={open} aria-controls={open ? reviewId : undefined} aria-label={`${open ? 'Cancel hire review for' : 'Review hire for'} ${o.firstName} ${o.surname}`} onClick={onToggle}>
          {open ? 'Cancel' : 'Review hire'}
        </Button>
      </div>
      {open && proj && (
        <div className="confirm recruit-hire-review" id={reviewId} role="region" aria-label={`Hire ${o.firstName} ${o.surname}`}>
          <h3>Hire {o.firstName} {o.surname}</h3>
          <KV k="Signing cost" v={money(proj.upfront)} />
          <KV k="Wage change" v={`${proj.wageDelta >= 0 ? '+' : '-'}${perHour(Math.abs(proj.wageDelta))}`} />
          <KV k="Net funding" v={`${rate(proj.netBefore)} → ${rate(proj.netAfter)}`} tone={proj.netAfter < 0 ? 'danger' : undefined} />
          {!proj.ok && proj.reason && (
            <p className="note note-warn">
              <Icon name="lock" size={16} />
              {proj.reason}
            </p>
          )}
          <Button
            variant="primary"
            block
            disabled={!proj.ok}
            onClick={() => {
              if (!proj.ok || hiring.current) return;
              hiring.current = true;
              if (act({ type: 'hire', candidateId: c.id }, `${o.surname} hired`).ok) onHired();
              else hiring.current = false;
            }}
          >
            Confirm hire · {money(proj.upfront)}
          </Button>
        </div>
      )}
    </Card>
  );
}
