import { callFee } from '../../sim/operation';
import type { Department } from '../../sim/types';
import { useEffect, useRef, useState } from 'react';
import type { DebriefResult } from '../../sim/types';
import { levelProgress } from '../../sim/department-level';
import { Card, Chip, EmptyState, Meter } from './ui';
import { assetUrl } from '../art/assetUrl';
import { funding as fundingText, signed, signedMoney } from '../format';
import { Funds } from './Funds';
import { easeToward } from './Finance';
import { getScenario } from '../../sim/scenario-registry';
import { reducedMotion } from '../motion';
import './settlement.css';

/** What the department held before this call settles: the balance and its service toward the next level. */
export type SettlementDepartment = { funding: number; level: number; service?: number };

/** Counts from `from` to `to` once, with the resource bar's count-up (Finance easeToward). With `still`
 * (reduced motion, or a call that does not earn a beat) it is the end value from the first frame. */
function useSettle(from: number, to: number, still: boolean): number {
  const [value, setValue] = useState(still ? to : from);
  useEffect(() => {
    if (still) { setValue(to); return; }
    let current = from;
    let last = performance.now();
    let frame = 0;
    const step = (at: number) => {
      current = easeToward(current, to, at - last);
      last = at;
      setValue(current);
      if (current !== to) frame = window.requestAnimationFrame(step);
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
  // The balance before this call, read once per debrief: the live balance keeps ticking with patrol
  // income, and following it would replay the payout on every tick.
  const snapshot = useRef<{ runId: string; from: number } | null>(null);
  if (!snapshot.current || snapshot.current.runId !== d.runId) snapshot.current = { runId: d.runId, from: department?.funding ?? 0 };
  const before = snapshot.current.from;
  const funding = useSettle(before, before + d.fundingReward, still);
  // The board offers the call's full pay; the payout scales with the result (sim/operation.ts), so a
  // short payout says what it was measured against.
  const offeredScenario = getScenario(d.scenarioId);
  const offered = offeredScenario && department ? callFee({ department: department as Pick<Department, 'level'> as Department }, {}, offeredScenario) : undefined;
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
  const xp = d.officerCondition.reduce((total, c) => total + c.xpGained, 0);
  // Three reward tiles (canvas Debrief): funding counts up from nothing to the payout, then the team's
  // XP and the trust change. Each says its word under the number; a zero still shows, so the row never moves.
  const tiles = [
    { key: 'funding', tone: d.fundingReward < 0 ? 'harm' : 'good', value: <Funds value={Math.round(funding - before)} format="signed" />, word: 'Funding', spoken: `Funding ${signedMoney(d.fundingReward)}` },
    { key: 'xp', tone: 'act', value: signed(xp), word: 'XP', spoken: `${signed(xp)} experience for the team` },
    { key: 'trust', tone: d.trustDelta < 0 ? 'harm' : 'trust', value: signed(d.trustDelta, 1), word: 'Trust', spoken: `Trust ${signed(d.trustDelta, 1)}` },
  ] as const;
  return <Card className={`result-department result-settlement${still ? ' result-settlement-still' : ''}`}>
    <section className="result-rewards" aria-label="Rewards">
      <ul className="settle-tiles">{tiles.map((tile) => <li key={tile.key} className="settle-tile" data-tone={tile.tone}>
        {tile.key === 'funding' && <img className="settle-cash" src={assetUrl('art/plates/tex_cash.webp')} alt="" aria-hidden="true" />}
        <b aria-hidden="true">{tile.value}</b><span aria-hidden="true">{tile.word}</span><span className="sr-only">{tile.spoken}</span>
      </li>)}</ul>
      {offered !== undefined && offered > d.fundingReward && d.fundingReward > 0 && <p className="settle-offer">{`${fundingText(d.fundingReward)} of the ${fundingText(offered)} on offer. The pay follows how the call ended.`}</p>}
      {service !== 0 && <div className="settle-xp">
        <span className="settle-xp-label"><span>Department XP{from && from.next !== null ? ` · ${Math.max(0, from.next - from.service - service)} to level ${from.level + 1}` : ''}</span><b>{signed(service)}</b></span>
        {from && from.next !== null ? <Meter value={filled ? to : start} tone="mid" label="Service toward the next level" valueText={`${Math.round(to)} percent after this call`} /> : null}
      </div>}
      <div className="chips result-reward-chips">
        {promotions > 0 && <Chip tone="amber" icon="medal">{promotions === 1 ? '1 promotion' : `${promotions} promotions`}</Chip>}
        {leveled && <Chip tone="amber" icon="medal">Department level {d.levelReached}</Chip>}
      </div>
      {empty && <EmptyState compact icon="info" title="No funding or trust change" />}
    </section>
  </Card>;
}
