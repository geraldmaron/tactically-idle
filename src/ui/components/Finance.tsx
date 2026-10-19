// Live department money (funding-ledger): the top bar's balance moves as it changes, every
// discrete event floats up from it as a signed chip, and one Finance view explains the hourly
// rate and lists recent events. Nothing here invents money: between ticks the balance follows the
// settled rate only while it is really accruing, and it snaps to the saved value on every tick.
import { useEffect, useRef, useState } from 'react';
import type { GameState, LedgerEntry, LedgerKind } from '../../sim/types';
import { budget } from '../../sim/department-selectors';
import { ECONOMY_TUNING, HOUR_MS } from '../../sim/economy';
import { Icon, type IconName } from '../icons';
import { duration, money, moneyFull, perHour, rate, relativeTime, signedMoney } from '../format';
import './finance.css';

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Funding as of `now`: the settled balance plus the hourly rate since settlement, but only inside
 * the accrual window and never below zero, exactly as settle() will book it. */
export function liveFunding(g: GameState, now: number): number {
  const d = g.department;
  const window = d.lastInteractionAt + ECONOMY_TUNING.capMs;
  const until = Math.min(now, window);
  if (until <= d.lastSettledAt) return d.funding;
  return Math.max(0, d.funding + (budget(g).net * (until - d.lastSettledAt)) / HOUR_MS);
}

export interface FundingDelta { key: number; amount: number; label: string }

/** The balance to show and the deltas floating off it. Deltas come from new ledger entries only;
 * the ledger already present when the view mounts is history, not news. */
export function useLiveFunding(g: GameState): { shown: number; deltas: FundingDelta[] } {
  const ledger = g.department.ledger ?? [];
  const lastSeq = ledger.reduce((max, e) => Math.max(max, e.seq), 0);
  const seen = useRef(lastSeq);
  const [deltas, setDeltas] = useState<FundingDelta[]>([]);
  const [shown, setShown] = useState(() => g.department.funding);
  const shownRef = useRef(shown);
  const gRef = useRef(g);
  gRef.current = g;

  useEffect(() => {
    if (lastSeq <= seen.current) { seen.current = lastSeq; return; }
    const fresh = ledger.filter((e) => e.seq > seen.current);
    seen.current = lastSeq;
    if (reducedMotion() || !fresh.length) return;
    // One chip per frame of news: several events at once read as their sum.
    const amount = fresh.reduce((sum, e) => sum + e.amount, 0);
    if (Math.round(amount) === 0) return;
    const delta = { key: lastSeq, amount, label: fresh.length === 1 ? fresh[0].label : `${fresh.length} changes` };
    setDeltas((list) => [...list.slice(-2), delta]);
    const timer = window.setTimeout(() => setDeltas((list) => list.filter((d) => d.key !== delta.key)), 1800);
    return () => window.clearTimeout(timer);
  }, [lastSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (reducedMotion()) { setShown(g.department.funding); return; }
    const timer = window.setInterval(() => {
      const target = liveFunding(gRef.current, Date.now());
      const current = shownRef.current;
      // Ease toward the target: a payout counts up over about half a second, accrual just follows.
      const next = Math.abs(target - current) < 1 ? target : current + (target - current) * 0.35;
      shownRef.current = next;
      setShown(next);
    }, 100);
    return () => window.clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { shown: reducedMotion() ? g.department.funding : shown, deltas };
}

export function FundingDeltas({ deltas }: { deltas: FundingDelta[] }) {
  if (!deltas.length) return null;
  return <span className="fund-deltas" aria-hidden="true">
    {deltas.map((d) => <span key={d.key} className={`fund-delta ${d.amount < 0 ? 'fund-delta-out' : 'fund-delta-in'}`}>{signedMoney(d.amount)}</span>)}
  </span>;
}

const KIND_ICON: Record<LedgerKind, IconName> = {
  payout: 'checkcircle', signing: 'user', severance: 'user', purchase: 'box', training: 'mortarboard', development: 'sprout',
  service: 'wrench', salvage: 'refresh', restock: 'refresh', staff: 'people', detail: 'medal',
};

/** The hourly rate as two bars on one scale, the line items, and recent events. */
export function FinanceDetail({ g, now = Date.now() }: { g: GameState; now?: number }) {
  const b = budget(g);
  const costs = b.wages + b.staff + b.operating + b.supplies;
  const scale = Math.max(1, b.gross, costs);
  const d = g.department;
  const window = d.lastInteractionAt + ECONOMY_TUNING.capMs;
  const left = window - now;
  const entries = [...(d.ledger ?? [])].reverse().slice(0, 20);
  return <div className="finance">
    <div className="finance-hero">
      <p className="finance-balance">{moneyFull(liveFunding(g, now))}</p>
      <span className={`finance-rate ${b.net < 0 ? 'tone-danger' : 'tone-mint'}`}><Icon name="trend" size={14} />{rate(b.net)}</span>
    </div>
    {left <= 0 ? <p className="note note-warn finance-window"><Icon name="clock" size={14} />Hourly income and costs are paused. They resume with your next order.</p>
      : left < 6 * HOUR_MS && <p className="dim finance-window"><Icon name="clock" size={14} />Hourly income and costs stop in {duration(left)} unless you give an order.</p>}
    <div className="finance-flow" role="img" aria-label={`Income ${perHour(b.gross)}, costs ${perHour(costs)}, net ${rate(b.net)}`}>
      <span className="finance-flow-row"><span>Income</span><span className="finance-bar"><i className="finance-bar-in" style={{ width: `${(b.gross / scale) * 100}%` }} /></span><b className="tone-mint">+{perHour(b.gross)}</b></span>
      <span className="finance-flow-row"><span>Costs</span><span className="finance-bar"><i className="finance-bar-out" style={{ width: `${(costs / scale) * 100}%` }} /></span><b className="tone-danger">-{perHour(costs)}</b></span>
    </div>
    <dl className="finance-lines">
      <div><dt>Base allocation</dt><dd>+{perHour(b.base)}</dd></div>
      <div><dt>Patrol work</dt><dd>+{perHour(b.patrol)}</dd></div>
      {b.nodeIncome !== 0 && <div><dt>Development income</dt><dd>+{perHour(b.nodeIncome)}</dd></div>}
      <div><dt>Officer wages</dt><dd>-{perHour(b.wages)}</dd></div>
      {b.staff > 0 && <div><dt>Command staff</dt><dd>-{perHour(b.staff)}</dd></div>}
      <div><dt>Facilities</dt><dd>-{perHour(b.operating)}</dd></div>
      <div><dt>Routine supplies</dt><dd>-{perHour(b.supplies)}</dd></div>
      <div className="finance-lines-dp"><dt>Development points</dt><dd>{b.devPointsPerHour.toFixed(1)}/h</dd></div>
    </dl>
    <h3 className="finance-head">Recent activity</h3>
    {entries.length === 0 ? <p className="dim">No payouts, purchases or fees yet. Hourly income and costs show as the rate above.</p>
      : <ul className="finance-activity">{entries.map((e) => <ActivityRow key={e.seq} e={e} now={now} />)}</ul>}
  </div>;
}

function ActivityRow({ e, now }: { e: LedgerEntry; now: number }) {
  return <li>
    <span className={`finance-kind finance-kind-${e.amount < 0 ? 'out' : 'in'}`}><Icon name={KIND_ICON[e.kind] ?? 'cash'} size={14} /></span>
    <span className="finance-activity-main"><strong>{e.label}</strong><span className="dim">{relativeTime(e.at, now)} · balance {money(e.after)}</span></span>
    <b className={e.amount < 0 ? 'tone-danger' : 'tone-mint'}>{signedMoney(e.amount)}</b>
  </li>;
}
