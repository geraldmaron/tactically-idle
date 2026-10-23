import { useEffect, useState } from 'react';
import type { DebriefResult } from '../../sim/types';
import { levelProgress } from '../../sim/department-level';
import { Card, Chip, EmptyState, Meter, SubHead } from './ui';
import { assetUrl } from '../art/assetUrl';
import { liveMoney, signed, signedMoney } from '../format';
import './settlement.css';

const SETTLE_MS = 900;
/** What the department held before this call settles: the balance and its service toward the next level. */
export type SettlementDepartment = { funding: number; level: number; service?: number };

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts from `from` to `to` once. With `still` (reduced motion, or a call that does not earn a beat)
 * it is the end value from the first frame. */
function useSettle(from: number, to: number, still: boolean): number {
  const [value, setValue] = useState(still ? to : from);
  useEffect(() => {
    if (still) { setValue(to); return; }
    const start = performance.now();
    let frame = 0;
    const step = (at: number) => {
      const k = Math.min(1, (at - start) / SETTLE_MS);
      setValue(from + (to - from) * (1 - (1 - k) ** 3));
      if (k < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [from, to, still]);
  return value;
}

/** The one settlement beat on the debrief: the funding balance counts up by the payout, the
 * department's service bar fills, and the rest of the result (trust, promotions, level) sits beside
 * them as chips. A death, a poor result or reduced motion shows the end state at once, with nothing
 * to celebrate. The money itself is paid by Next call (closeDebrief), as before. */
export function Settlement({ debrief: d, department, still: quiet = false }: { debrief: DebriefResult; department?: SettlementDepartment; still?: boolean }) {
  const still = quiet || reducedMotion();
  const before = department?.funding ?? 0;
  const funding = useSettle(before, before + d.fundingReward, still);
  const promotions = d.officerCondition.reduce((total, c) => total + (c.promotions?.length ?? 0), 0);
  const service = d.serviceEarned ?? 0;
  const from = department?.service !== undefined ? levelProgress({ level: department.level, service: department.service }) : null;
  const to = from && from.next !== null ? Math.min(100, (100 * (from.service + service - from.floor)) / (from.next - from.floor)) : 0;
  const start = from && from.next !== null ? Math.min(100, (100 * (from.service - from.floor)) / (from.next - from.floor)) : 0;
  const leveled = d.levelReached !== undefined && department !== undefined && d.levelReached > department.level;
  const [filled, setFilled] = useState(still);
  useEffect(() => {
    if (still) { setFilled(true); return; }
    const frame = window.requestAnimationFrame(() => setFilled(true));
    return () => window.cancelAnimationFrame(frame);
  }, [still]);
  const empty = d.fundingReward === 0 && d.trustDelta === 0 && !service && !promotions;
  return <Card className={`result-department result-settlement${still ? ' result-settlement-still' : ''}`}>
    <section className="result-rewards" aria-label="Rewards">
      <SubHead icon="cash">Settlement</SubHead>
      {d.fundingReward !== 0 && <div className="settle-funding">
        <img className="settle-cash" src={assetUrl('art/plates/tex_cash.webp')} alt="" aria-hidden="true" />
        <span className="settle-stack">
          <span className="settle-value" aria-hidden="true">{liveMoney(funding)}</span>
          <span className={`settle-delta${d.fundingReward < 0 ? ' tone-danger' : ' tone-mint'}`}>{signedMoney(d.fundingReward)} funding</span>
        </span>
        <span className="sr-only">Funding {signedMoney(d.fundingReward)}</span>
      </div>}
      {service !== 0 && <div className="settle-xp">
        <span className="settle-xp-label"><span>Department XP{from && from.next !== null ? ` · ${Math.max(0, from.next - from.service - service)} to level ${from.level + 1}` : ''}</span><b>{signed(service)}</b></span>
        {from && from.next !== null ? <Meter value={filled ? to : start} tone="mid" label="Service toward the next level" valueText={`${Math.round(to)} percent after this call`} /> : null}
      </div>}
      <div className="chips result-reward-chips">
        {d.trustDelta !== 0 && <Chip tone={d.trustDelta < 0 ? 'danger' : 'mint'} icon="shield">{signed(d.trustDelta, 1)} trust</Chip>}
        {promotions > 0 && <Chip tone="amber" icon="medal">{promotions === 1 ? '1 promotion' : `${promotions} promotions`}</Chip>}
        {leveled && <Chip tone="amber" icon="medal">Department level {d.levelReached}</Chip>}
      </div>
      {empty && <EmptyState compact icon="info" title="No funding or trust change" />}
    </section>
  </Card>;
}
