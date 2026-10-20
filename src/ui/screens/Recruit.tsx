import { recruitmentStatus } from '../../sim/roster';
import { personaNote } from '../../content/personas';
import { useRef, useState } from 'react';
import { useGame } from '../store';
import { projectHire, sortedCandidates, type Projection } from '../../sim/department-selectors';
import type { Candidate, Id } from '../../sim/types';
import { Button, Card, Chip, EmptyState, RatingBars, Section } from '../components/ui';
import { RankChip } from '../components/RankInsignia';
import { useToast } from '../components/toast';
import { CERT_ICON, ROLE_META, TRAIT_INFO } from '../components/labels';
import { RetirementChip, useCareerSnapshot } from '../components/Career';
import { Portrait } from '../portraits/Portrait';
import { agePortraitProps } from './helpers';
import { Icon } from '../icons';
import { money, perHour, rate, relativeTime, yearsText } from '../format';
import './recruit.css';
import './squad-visual.css';
import { CERT_NAME } from '../../content/certs';
import { ISSUE_RADIO, issueKit } from '../../content/issue-kit';
import { ITEMS } from '../../content/items';
import { GearArtFrame } from '../art/GearArt';
import { Sheet } from '../components/Sheet';
import { learningPace, type LearningPace } from '../../sim/career';
import { detailRate } from '../../sim/detail';

export const PACE_LABEL: Record<LearningPace, string> = { fast: 'Fast', steady: 'Steady', slow: 'Slowly' };

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
      action={<RecruitRefresh />}
      hint={full ? `Roster full at ${roster}/${g.department.rosterCap}. Dismiss someone or expand capacity to hire.` : `Roster ${roster}/${g.department.rosterCap}. Each hire adds their wage every hour.`}
    >
      {candidates.length === 0 ? (
        <Card>
          <EmptyState icon="people" title={recruitment.exhausted ? "Recruitment reserve exhausted" : "No candidates right now"}>
            {recruitment.exhausted ? "Every available person in this campaign has served or reached retirement age. Retired officers will not return under a new name." : "Refresh the pool to see new recruits. New personnel arrive as existing officers move through their careers."}
          </EmptyState>
        </Card>
      ) : (
        <div className="cand-list">
          {candidates.map((c, index) => {
            const receipt = receipts.find((entry) => entry.candidate.id === c.id);
            return <CandidateCard key={c.id} c={c} now={now} open={hireFor === c.id}
              receipt={receipt?.projection}
              onToggle={() => setHireFor((current) => current === c.id ? null : c.id)}
              onHired={(projection) => setReceipts((previous) => [...previous, { candidate: c, projection, index }])}
              onDone={() => setReceipts((previous) => dismissHireReceipt(previous, c.id))} />;
          })}
        </div>
      )}
    </Section>
  );
}

export function RecruitRefresh() {
  const { act } = useToast();
  return <div className="recruit-refresh">
    <Button size="sm" icon="refresh" onClick={() => act({ type: 'refreshCandidates' })}>
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
  const career = useCareerSnapshot(o);
  return (
    <div ref={slot} className="recruit-candidate-slot" style={receipt && receiptHeight ? { minHeight: receiptHeight } : undefined}>
    <Card className={`cand${receipt ? ' cand-hired' : ''}`}>
      <div className="cand-top">
        <div className="cand-portrait">
          <Portrait officer={o} size={56} {...agePortraitProps(g, o, now)} />
        </div>
        <div className="cand-id">
          <strong className="cand-name">
            {o.firstName} {o.surname}
          </strong>
          <span className="cand-facts">
            <span><Icon name={ROLE_META[o.role].icon} size={13} />{ROLE_META[o.role].label}</span>
            <span><Icon name="cake" size={13} />Age {career.age}</span>
            <span title="Prior service"><Icon name="medal" size={13} />{yearsText(career.service)} prior</span>
          </span>
          <span className="chips">
            <Chip tone="amber" icon="cash">{perHour(o.wage)}</Chip>
            <RankChip rank={career.rank} />
            {career.retirement && <RetirementChip date={career.retirement.date} inDays={career.retirement.inDays} compact />}
          </span>
        </div>
        <button
          type="button"
          className={`icon-btn cand-shortlist${c.shortlisted ? ' icon-btn-on' : ''}`}
          aria-pressed={c.shortlisted}
          disabled={!!receipt}
          aria-label={c.shortlisted ? `Remove ${o.surname} from shortlist` : `Shortlist ${o.surname}`}
          onClick={() => { if (!receipt) act({ type: 'shortlist', candidateId: c.id, on: !c.shortlisted }); }}
        >
          <Icon name="bookmark" size={20} />
        </button>
      </div>
      <RatingBars ratings={o.ratings} dense label={`${o.firstName} ${o.surname} ratings`} />
      {(o.certs.length > 0 || o.traits.length > 0) && (
        <div className="chips">
          {o.certs.map((x) => (
            <Chip key={x} tone="mint" icon={CERT_ICON[x]}>
              {CERT_NAME[x]}
            </Chip>
          ))}
          {o.traits.map((t) => (
            <Chip key={t} icon={TRAIT_INFO[t].icon} title={TRAIT_INFO[t].condition}>
              {TRAIT_INFO[t].label}
            </Chip>
          ))}
        </div>
      )}
      {personaNote(o.identityId) && <p className="dim persona-note">{personaNote(o.identityId)}</p>}
      <div className="cand-foot">
        <span className="dim cand-meta">
          <Icon name="cash" size={13} />
          {receipt ? <>Signing {money(receipt.upfront)} paid · Added to roster</> : <>Signing {money(c.signingCost)} · <Icon name="clock" size={13} /> leaves {relativeTime(c.expiresAt, now)}</>}
        </span>
        <Button className="recruit-review-toggle" size="sm" variant={receipt ? 'secondary' : 'primary'} aria-haspopup={receipt ? undefined : 'dialog'} aria-expanded={receipt ? undefined : open} aria-label={`${receipt ? 'Done reviewing hire for' : 'Review hire for'} ${o.firstName} ${o.surname}`} onClick={(event) => { if (event.detail > 1) return; if (receipt) onDone?.(); else onToggle(); }}>
          {receipt ? 'Done' : 'Review hire'}
        </Button>
      </div>
      {proj && <HireContract c={c} proj={proj} hired={!!receipt} open={open} onClose={onToggle} onConfirm={() => {
        if (receipt || !proj.ok || hiring.current) return;
        hiring.current = true;
        const height = slot.current?.getBoundingClientRect().height ?? 0;
        if (act({ type: 'hire', candidateId: c.id }, `${o.surname} hired`).ok) { setReceiptHeight(height); onHired(proj); }
        else hiring.current = false;
      }} />}
    </Card>
    </div>
  );
}

/** The hire as a contract (hire-contract-card): what it costs now, what it costs every hour, where
 * that leaves the department's rate, and the kit the officer brings. Money is drawn as bars on one
 * scale so the trade reads before the numbers do. */
export function HireContract({ c, proj, hired, open, onClose, onConfirm }: { c: Candidate; proj: Projection; hired: boolean; open: boolean; onClose: () => void; onConfirm: () => void }) {
  const g = useGame();
  const o = c.officer;
  const funding = hired ? g.department.funding + proj.upfront : g.department.funding;
  const after = funding - proj.upfront;
  const kit = issueKit(o);
  const kitCost = c.issueKit ?? 0;
  const scale = Math.max(1, Math.abs(proj.netBefore), Math.abs(proj.netAfter));
  const short = proj.netAfter < 0;
  const pace = learningPace(o);
  const detail = detailRate(o);
  return (
    <Sheet open={open} onClose={onClose} interactionKey={hired ? 'hired' : 'review'} title={`Hire ${o.firstName} ${o.surname}`} className="hire-contract"
      subtitle={<span className="chips"><Chip icon={ROLE_META[o.role].icon}>{ROLE_META[o.role].label}</Chip><Chip tone="amber" icon="cash">{perHour(o.wage)}</Chip></span>}
      footer={hired
        ? <><p className="recruit-hire-success" role="status"><Icon name="check" size={16} />{o.firstName} {o.surname} is now on your roster{kit.length ? ', with their kit in the Armory' : ''}.</p><Button variant="primary" block onClick={onClose}>Done</Button></>
        : <Button variant="primary" block disabled={!proj.ok} onClick={onConfirm}>Confirm hire · {money(proj.upfront)}</Button>}>
      <div className="contract">
        <section className="contract-sign" aria-label="Due at signing">
          <span className="contract-label">Due at signing</span>
          <strong className="contract-hero">{money(proj.upfront)}</strong>
          {kitCost > 0 && <span className="dim">Includes {money(kitCost)} of issue kit</span>}
          <span className="contract-funds" role="img" aria-label={`Funding ${money(funding)} now, ${money(after)} after signing`}>
            <i className="contract-funds-left" style={{ width: `${Math.max(0, Math.min(100, (after / Math.max(1, funding)) * 100))}%` }} />
            <i className="contract-funds-spent" style={{ width: `${Math.max(0, Math.min(100, (proj.upfront / Math.max(1, funding)) * 100))}%` }} />
          </span>
          <span className="contract-funds-legend"><span>Now {money(funding)}</span><span className={after < 0 ? 'tone-danger' : undefined}>After {money(after)}</span></span>
        </section>
        <section className="contract-rate" aria-label="Every hour">
          <span className="contract-label">Every hour</span>
          <span className="contract-rate-row"><span>Wages</span><b className="tone-danger">-{perHour(proj.wageDelta)}</b></span>
          <span className="contract-gauge" role="img" aria-label={`Department net ${rate(proj.netBefore)} now, ${rate(proj.netAfter)} after hiring`}>
            <span className="contract-gauge-row"><span>Now</span><span className="contract-gauge-bar"><i className={proj.netBefore < 0 ? 'neg' : 'pos'} style={{ width: `${(Math.abs(proj.netBefore) / scale) * 100}%` }} /></span><b className={proj.netBefore < 0 ? 'tone-danger' : 'tone-mint'}>{rate(proj.netBefore)}</b></span>
            <span className="contract-gauge-row"><span>After</span><span className="contract-gauge-bar"><i className={short ? 'neg' : 'pos'} style={{ width: `${(Math.abs(proj.netAfter) / scale) * 100}%` }} /></span><b className={short ? 'tone-danger' : 'tone-mint'}>{rate(proj.netAfter)}</b></span>
          </span>
        </section>
        <section className="contract-value" aria-label="Value">
          <span className="contract-label">Value</span>
          <span className="contract-rate-row"><span>Learns from calls</span><b className={pace === 'fast' ? 'tone-mint' : pace === 'slow' ? 'tone-danger' : undefined}>{PACE_LABEL[pace]}</b></span>
          <span className="contract-rate-row"><span>Instructor detail</span><b className={detail === null ? 'dim' : 'tone-mint'}>{detail === null ? 'Needs a certification' : `+${perHour(detail)}`}</b></span>
        </section>
        {kit.length > 0 && <section className="contract-kit" aria-label="Brings">
          <span className="contract-label">Brings</span>
          <ul>{kit.map((itemId, i) => <li key={`${itemId}-${i}`}><GearArtFrame itemId={itemId} size={30} /><span>{ITEMS[itemId]?.name ?? itemId}</span>{itemId === ISSUE_RADIO && <span className="dim">Provided</span>}</li>)}</ul>
        </section>}
        {!hired && !proj.ok && proj.reason && <p className="note note-warn"><Icon name="lock" size={16} />{proj.reason}</p>}
      </div>
    </Sheet>
  );
}
