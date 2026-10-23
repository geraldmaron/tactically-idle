// Live department money (funding-ledger): the top bar's balance moves as it changes, every
// discrete event floats up from it as a signed chip, and one Finance view explains the hourly
// rate and lists recent events. Nothing here invents money: between ticks the balance follows the
// settled rate only while it is really accruing, and it snaps to the saved value on every tick.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GameState, LedgerEntry, LedgerKind, SquadDuty } from '../../sim/types';
import { budget } from '../../sim/department-selectors';
import { ECONOMY_TUNING, HOUR_MS, officerRates } from '../../sim/economy';
import { fullName } from '../../sim/officer';
import { Icon, type IconName } from '../icons';
import { duration, money, moneyFull, perHour, rate, relativeTime, signedMoney } from '../format';
import './finance.css';
import { assetUrl } from '../art/assetUrl';
import { useGame } from '../store';
import { nextPatrolEventTime } from '../../sim/patrol';

const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface FundingFeedback {
  pending: number;
  arrival: number;
}
const FundingContext = createContext<FundingFeedback>({ pending: 0, arrival: 0 });
export const useFundingFeedback = () => useContext(FundingContext);
export const CASH_FLIGHT_MS = 650;
export const MAX_CASH_SPRITES = 24;

/** One shell-owned layer. It presents receipts; it never dispatches or changes saved money. */
export function FundingFeedbackProvider({ children }: { children: ReactNode }) {
  const game = useGame();
  const ledger = game.department.ledger ?? [];
  const lastSeq = ledger.reduce((max, entry) => Math.max(max, entry.seq), 0);
  const layer = useRef<HTMLDivElement>(null);
  const seen = useRef(lastSeq);
  const observedAmounts = useRef<WeakMap<object, number> | null>(null);
  if (!observedAmounts.current) {
    observedAmounts.current = new WeakMap();
    for (const entry of ledger) observedAmounts.current.set(entry, entry.amount);
  }
  const mounted = useRef(true);
  const flights = useRef(new Map<number, { amount: number; finish: () => void }>());
  const [pending, setPending] = useState(0);
  const [arrival, setArrival] = useState(0);
  const reconcile = useCallback(() => {
    for (const flight of [...flights.current.values()]) flight.finish();
  }, []);
  useEffect(() => {
    mounted.current = true;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('visibilitychange', reconcile);
    media.addEventListener('change', reconcile);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', reconcile);
      media.removeEventListener('change', reconcile);
      reconcile();
    };
  }, [reconcile]);

  const collect = useCallback((sequence: number, amount: number, origin: { x: number; y: number }, actions: number) => {
    if (!mounted.current || flights.current.has(sequence) || amount <= 0) return;
    const host = layer.current;
    const target = host?.parentElement?.querySelector<HTMLElement>('[data-funding-target]');
    if (!host || !target || reducedMotion() || document.hidden || typeof target.animate !== 'function') {
      setArrival((n) => n + 1); return;
    }
    const box = host.getBoundingClientRect();
    const destination = target.getBoundingClientRect();
    const x = destination.x + destination.width / 2;
    const y = destination.y + destination.height / 2;
    const hit = document.elementFromPoint(x, y);
    if (!hit || !target.contains(hit)) { setArrival((n) => n + 1); return; }
    // A backlog can only affect presentation: finish the oldest flight before admitting more.
    while (host.childElementCount > MAX_CASH_SPRITES - 3) flights.current.values().next().value?.finish();
    const sprites: HTMLImageElement[] = [];
    let finished = false;
    let timer = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      for (const sprite of sprites) { sprite.getAnimations().forEach((a) => a.cancel()); sprite.remove(); }
      flights.current.delete(sequence);
      if (mounted.current) {
        setPending([...flights.current.values()].reduce((sum, f) => sum + f.amount, 0));
        setArrival((n) => n + 1);
      }
    };
    flights.current.set(sequence, { amount, finish });
    setPending([...flights.current.values()].reduce((sum, f) => sum + f.amount, 0));
    const count = Math.min(3, Math.max(1, actions));
    for (let i = 0; i < count; i++) {
      const sprite = document.createElement('img');
      sprite.src = assetUrl('art/plates/tex_cash.webp');
      sprite.alt = '';
      sprite.className = 'cash-sprite';
      host.append(sprite); sprites.push(sprite);
      const sx = origin.x - box.x - 18, sy = origin.y - box.y - 18;
      const ex = x - box.x - 18, ey = y - box.y - 18;
      const fan = (i - (count - 1) / 2) * 28;
      // Sample a cubic arc into compositor keyframes. React never advances particles per frame.
      const fx = sx + fan, fy = sy - 34;
      const frames: Keyframe[] = [
        { transform: `translate(${sx}px, ${sy}px) scale(.5) rotate(-12deg)`, opacity: 0, offset: 0 },
        { transform: `translate(${fx}px, ${fy}px) scale(1.15) rotate(${fan / 2}deg)`, opacity: 1, offset: .2 },
      ];
      for (let step = 1; step <= 12; step++) {
        const t = step / 12, u = 1 - t;
        const cx = u ** 3 * fx + 3 * u ** 2 * t * (fx + fan * 1.5) + 3 * u * t ** 2 * (ex + 50) + t ** 3 * ex;
        const cy = u ** 3 * fy + 3 * u ** 2 * t * (fy - 80) + 3 * u * t ** 2 * (ey + 30) + t ** 3 * ey;
        frames.push({ transform: `translate(${cx}px, ${cy}px) scale(${1.15 - .7 * t}) rotate(${fan / 2 * u}deg)`, opacity: t > .9 ? (1 - t) * 10 : 1, offset: .2 + .8 * t });
      }
      sprite.animate(frames, { duration: CASH_FLIGHT_MS, delay: i * 35, easing: 'cubic-bezier(.35,0,.65,1)', fill: 'both' });
    }
    timer = window.setTimeout(finish, CASH_FLIGHT_MS + (count - 1) * 35);
  }, []);

  // Patrol accrual is already in the authoritative ledger when this runs. The scene marker only
  // decides whether to present the flight; leaving HQ, reduced motion, and spending reconcile at once.
  useEffect(() => {
    if (lastSeq <= seen.current) { seen.current = lastSeq; return; }
    const fresh = ledger.filter((entry) => entry.seq > seen.current);
    seen.current = lastSeq;
    if (fresh.some((entry) => entry.kind !== 'patrol')) reconcile();
    const patrol = fresh.map((entry) => {
      const previous = observedAmounts.current!.get(entry) ?? 0;
      observedAmounts.current!.set(entry, entry.amount);
      return { entry, amount: entry.amount - previous };
    }).filter(({ entry, amount }) => entry.kind === 'patrol' && amount > 0);
    const source = document.querySelector<HTMLElement>('[data-patrol-funding-origin]');
    if (!patrol.length || !source) return;
    const rect = source.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return;
    const amount = patrol.reduce((sum, posting) => sum + posting.amount, 0);
    collect(lastSeq, amount, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, Math.min(3, patrol.length + 1));
  }, [collect, lastSeq, ledger, reconcile]);
  useEffect(() => {
    if (!document.querySelector('[data-patrol-funding-origin]')) reconcile();
  });
  return <FundingContext.Provider value={{ pending, arrival }}>{children}<div ref={layer} className="funding-flight-layer" aria-hidden="true" /></FundingContext.Provider>;
}

/** Funding as of `now`: the settled balance plus the hourly rate since settlement, but only inside
 * the accrual window and never below zero, exactly as settle() will book it. */
export function liveFunding(g: GameState, now: number): number {
  const d = g.department;
  const window = d.lastInteractionAt + ECONOMY_TUNING.capMs;
  // Do not project the old rate through a boost expiry or patrol-training boundary. The engine
  // settles that boundary exactly; the display holds there for at most one tick, then continues
  // from the new authoritative state and rate.
  const patrolBoundary = nextPatrolEventTime(g, d.lastSettledAt);
  const until = Math.min(now, window, patrolBoundary ?? Number.POSITIVE_INFINITY);
  if (until <= d.lastSettledAt) return d.funding;
  return Math.max(0, d.funding + (budget(g).net * (until - d.lastSettledAt)) / HOUR_MS);
}

export interface FundingDelta { key: number; amount: number; label: string }

/** The balance to show and the deltas floating off it. Deltas come from new ledger entries only;
 * the ledger already present when the view mounts is history, not news. */
export function useLiveFunding(g: GameState): { shown: number; deltas: FundingDelta[] } {
  const feedback = useFundingFeedback();
  const pendingRef = useRef(feedback.pending);
  pendingRef.current = feedback.pending;
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
    if (fresh.some((entry) => entry.amount < 0)) {
      shownRef.current = g.department.funding;
      setShown(g.department.funding);
    }
    const visual = document.querySelector('[data-patrol-funding-origin]') ? fresh : fresh.filter((entry) => entry.kind !== 'patrol');
    if (reducedMotion() || !visual.length) return;
    // One chip per frame of news: several events at once read as their sum.
    // A folded entry announces only its newest posting; the rest was announced when it happened.
    const amount = visual.reduce((sum, e) => sum + (e.latest ?? e.amount), 0);
    if (Math.round(amount) === 0) return;
    const delta = { key: lastSeq, amount, label: visual.length === 1 ? visual[0].label : `${visual.length} changes` };
    setDeltas((list) => [...list.slice(-2), delta]);
    const timer = window.setTimeout(() => setDeltas((list) => list.filter((d) => d.key !== delta.key)), 1800);
    return () => window.clearTimeout(timer);
  }, [lastSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Frame-bound so the balance climbs smoothly. The ease is time-based (35% of the gap per 100ms),
    // so a payout still counts up over about half a second at any frame rate, and the view only
    // re-renders when the shown whole-dollar figure changes.
    let frame = 0;
    let last = performance.now();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      shownRef.current = gRef.current.department.funding;
      setShown(shownRef.current);
    };
    media.addEventListener('change', onMotion);
    const step = (at: number) => {
      const target = Math.max(0, liveFunding(gRef.current, Date.now()) - pendingRef.current);
      const current = shownRef.current;
      if (media.matches) {
        shownRef.current = target;
        if (Math.round(target) !== Math.round(current)) setShown(target);
        frame = window.requestAnimationFrame(step);
        return;
      }
      const k = 1 - Math.pow(0.65, Math.min(1000, at - last) / 100);
      last = at;
      const next = Math.abs(target - current) < 1 ? target : current + (target - current) * k;
      shownRef.current = next;
      if (Math.round(next) !== Math.round(current)) setShown(next);
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => { window.cancelAnimationFrame(frame); media.removeEventListener('change', onMotion); };
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
  service: 'wrench', salvage: 'refresh', restock: 'refresh', staff: 'people', detail: 'medal', patrol: 'patrol',
};

/** The hourly rate as two bars on one scale, the line items, and recent events. */
export function FinanceDetail({ g, now = Date.now() }: { g: GameState; now?: number }) {
  const b = budget(g);
  const costs = b.wages + b.patrolWages + b.staff + b.operating + b.patrolOperating + b.supplies;
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
      <div><dt>Patrol service</dt><dd>+{perHour(b.patrolBase)}</dd></div>
      {b.patrolBoost > 0 && <div><dt>Patrol boost</dt><dd>+{perHour(b.patrolBoost)}</dd></div>}
      {b.nodeIncome !== 0 && <div><dt>Development income</dt><dd>+{perHour(b.nodeIncome)}</dd></div>}
      <div><dt>SWAT payroll</dt><dd>-{perHour(b.wages)}</dd></div>
      <div><dt>Patrol payroll</dt><dd>-{perHour(b.patrolWages)}</dd></div>
      <div><dt>Patrol operations</dt><dd>-{perHour(b.patrolOperating)}</dd></div>
      {b.staff > 0 && <div><dt>Command staff</dt><dd>-{perHour(b.staff)}</dd></div>}
      <div><dt>Facilities</dt><dd>-{perHour(b.operating)}</dd></div>
      <div><dt>Routine supplies</dt><dd>-{perHour(b.supplies)}</dd></div>
    </dl>
    <OfficerMoney g={g} />
    <h3 className="finance-head">Recent activity</h3>
    {entries.length === 0 ? <p className="dim">No payouts, purchases or fees yet. Hourly income and costs show as the rate above.</p>
      : <ul className="finance-activity">{entries.map((e) => <ActivityRow key={e.seq} e={e} now={now} />)}</ul>}
  </div>;
}

const DUTY_LABEL: Record<SquadDuty, string> = { standby: 'On standby', rest: 'Resting' };

/** Each tactical officer's hourly contribution: instructor details less their wage. */
export function OfficerMoney({ g, now = Date.now() }: { g: GameState; now?: number }) {
  const per = officerRates(g, Math.max(now, g.department.lastSettledAt));
  const squadDuty = new Map(g.squads.flatMap((s) => s.officerIds.map((id) => [id, s.duty] as const)));
  const rows = Object.values(g.officers)
    .map((o) => ({ o, r: per[o.id] }))
    .sort((a, b) => b.r.net - a.r.net || a.o.surname.localeCompare(b.o.surname));
  if (!rows.length) return null;
  const doing = (o: GameState['officers'][string], r: (typeof rows)[number]['r']) =>
    r.detail > 0 ? 'Instructor detail'
      : o.assignment?.kind === 'training' ? 'In training'
      : o.assignment?.kind === 'operation' ? 'On a call'
      : o.injury && o.injury.until > now ? 'Injured'
      : DUTY_LABEL[squadDuty.get(o.id) ?? 'standby'] ?? 'Unassigned';
  return <section className="finance-officers" aria-label="Money by officer">
    <h3 className="finance-head">By officer</h3>
    <ul className="finance-officer-list">{rows.map(({ o, r }) => <li key={o.id}>
      <span className="finance-activity-main"><strong>{fullName(o)}</strong><span className="dim">{doing(o, r)} · wage {perHour(r.wage)}{o.career.earned ? ` · brought in ${money(o.career.earned)}` : ''}</span></span>
      <b className={r.net < 0 ? 'tone-danger' : 'tone-mint'}>{rate(r.net)}</b>
    </li>)}</ul>
  </section>;
}

function ActivityRow({ e, now }: { e: LedgerEntry; now: number }) {
  return <li>
    <span className={`finance-kind finance-kind-${e.amount < 0 ? 'out' : 'in'}`}><Icon name={KIND_ICON[e.kind] ?? 'cash'} size={14} /></span>
    <span className="finance-activity-main"><strong>{e.label}</strong><span className="dim">{relativeTime(e.at, now)} · balance {money(e.after)}</span></span>
    <b className={e.amount < 0 ? 'tone-danger' : 'tone-mint'}>{signedMoney(e.amount)}</b>
  </li>;
}
