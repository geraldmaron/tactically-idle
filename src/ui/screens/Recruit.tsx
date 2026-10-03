import { recruitmentStatus } from '../../sim/roster';
import { personaNote } from '../../content/personas';
import { useRef, useState } from 'react';
import { useGame } from '../store';
import { projectHire, sortedCandidates, type Projection } from '../../sim/department-selectors';
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

export interface HireReceipt { candidate: Candidate; projection: Projection; index: number }

/** Keep a completed hire in its original slot until the player dismisses it. */
export function candidatesWithHireReceipt(candidates: Candidate[], receipt: HireReceipt | null): Candidate[] {
  if (!receipt || candidates.some((candidate) => candidate.id === receipt.candidate.id)) return candidates;
  const displayed = [...candidates];
  displayed.splice(Math.min(receipt.index, displayed.length), 0, receipt.candidate);
  return displayed;
}

/** Removing a receipt also removes its slot from every later receipt's position. */
export function dismissHireReceipt(receipts: HireReceipt[], candidateId: Id): HireReceipt[] {
  const dismissed = receipts.find((receipt) => receipt.candidate.id === candidateId);
  if (!dismissed) return receipts;
  return receipts.filter((receipt) => receipt.candidate.id !== candidateId).map((receipt) =>
    receipt.index > dismissed.index ? { ...receipt, index: receipt.index - 1 } : receipt);
}

export function Recruit() {
  const g = useGame();
  const [target, setTarget] = useState<Role | null>(null);
  const [hireFor, setHireFor] = useState<Id | null>(null);
  const [receipts, setReceipts] = useState<HireReceipt[]>([]);
  const candidates = [...receipts].sort((a, b) => a.index - b.index).reduce(candidatesWithHireReceipt, sortedCandidates(g));
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
          {candidates.map((c, index) => {
            const receipt = receipts.find((entry) => entry.candidate.id === c.id);
            return <CandidateCard key={c.id} c={c} now={now} open={hireFor === c.id || !!receipt}
              receipt={receipt?.projection}
              onToggle={() => setHireFor((current) => current === c.id ? null : c.id)}
              onHired={(projection) => { setReceipts((previous) => [...previous, { candidate: c, projection, index }]); setHireFor(null); }}
              onDone={() => setReceipts((previous) => dismissHireReceipt(previous, c.id))} />;
          })}
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

export function CandidateCard({ c, now, open, onToggle, onHired, receipt, onDone }: { c: Candidate; now: number; open: boolean; onToggle: () => void; onHired: (projection: Projection) => void; receipt?: Projection; onDone?: () => void }) {
  const g = useGame();
  const { act } = useToast();
  const hiring = useRef(false);
  const slot = useRef<HTMLDivElement>(null);
  const [receiptHeight, setReceiptHeight] = useState(0);
  const o = c.officer;
  const proj = receipt ?? (open ? projectHire(g, c.id) : null);
  const reviewId = `hire-review-${c.id}`;
  return (
    <div ref={slot} className="recruit-candidate-slot" style={receipt && receiptHeight ? { minHeight: receiptHeight } : undefined}>
    <Card className={`cand${receipt ? ' cand-hired' : ''}`}>
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
          disabled={!!receipt}
          aria-label={c.shortlisted ? `Remove ${o.surname} from shortlist` : `Shortlist ${o.surname}`}
          onClick={() => { if (!receipt) act({ type: 'shortlist', candidateId: c.id, on: !c.shortlisted }); }}
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
          {receipt ? <>Signing {money(receipt.upfront)} paid · Added to roster</> : <>Signing {money(c.signingCost)} · <Icon name="clock" size={13} /> leaves {relativeTime(c.expiresAt, now)}</>}
        </span>
        <Button className="recruit-review-toggle" size="sm" variant={open ? 'secondary' : 'primary'} aria-expanded={receipt ? undefined : open} aria-controls={open ? reviewId : undefined} aria-label={`${receipt ? 'Done reviewing hire for' : open ? 'Cancel hire review for' : 'Review hire for'} ${o.firstName} ${o.surname}`} onClick={(event) => { if (event.detail > 1) return; if (receipt) onDone?.(); else onToggle(); }}>
          {receipt ? 'Done' : open ? 'Cancel' : 'Review hire'}
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
            disabled={!!receipt || !proj.ok}
            onClick={() => {
              if (receipt || !proj.ok || hiring.current) return;
              hiring.current = true;
              const height = slot.current?.getBoundingClientRect().height ?? 0;
              if (act({ type: 'hire', candidateId: c.id }, `${o.surname} hired`).ok) { setReceiptHeight(height); onHired(proj); }
              else hiring.current = false;
            }}
          >
            {receipt ? 'Hired' : `Confirm hire · ${money(proj.upfront)}`}
          </Button>
          {receipt && <p className="recruit-hire-success" role="status"><Icon name="check" size={16} />{o.firstName} {o.surname} is now on your roster.</p>}
        </div>
      )}
    </Card>
    </div>
  );
}
