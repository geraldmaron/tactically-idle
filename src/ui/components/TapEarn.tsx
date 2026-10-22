// The HQ desk tap (tap-earn): each tap files a form for TAP_TUNING.base funding times the held
// multipliers (sim/department-taps.ts). Taps are batched into one tapEarn command every
// FLUSH_MS, so a fast thumb saves once per batch instead of once per tap. A tap the books would not
// credit (over the rate cap) shows nothing, so the chip never promises money the engine drops.
// Self-contained so the desk restyle can move it.
import { useEffect, useRef, useState } from 'react';
import { tapAllowance, tapValue } from '../../sim/department-taps';
import { getState, send, useGame } from '../store';
import { buzz } from '../audio/live-audio';
import { FundingDeltas, type FundingDelta } from './Finance';
import { Icon } from '../icons';
import { money } from '../format';
import './tap-earn.css';

const FLUSH_MS = 300;
const CHIP_MS = 1800;
const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function TapEarn() {
  const g = useGame();
  const pending = useRef(0);
  const flushTimer = useRef<number | null>(null);
  const nextKey = useRef(1);
  const stillTimer = useRef<number | null>(null);
  const [chips, setChips] = useState<FundingDelta[]>([]);
  const value = tapValue(g.department, Date.now());

  const flush = () => {
    if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    flushTimer.current = null;
    const count = pending.current;
    pending.current = 0;
    if (count > 0) send({ type: 'tapEarn', count });
  };

  // Taps still waiting are filed when the desk leaves the screen or the page hides.
  useEffect(() => {
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); flush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = () => {
    const now = Date.now();
    const dep = getState().department;
    if (tapAllowance(dep, now) - pending.current < 1) return;
    pending.current += 1;
    if (flushTimer.current === null) flushTimer.current = window.setTimeout(flush, FLUSH_MS);
    buzz(8);
    const amount = tapValue(dep, now);
    // Reduced motion: one still chip holding the running sum, cleared once taps stop. Otherwise a
    // chip per tap floats off and clears when its float ends.
    if (reducedMotion()) {
      setChips((list) => [{ key: 0, amount: (list[0]?.key === 0 ? list[0].amount : 0) + amount, label: '' }]);
      if (stillTimer.current !== null) window.clearTimeout(stillTimer.current);
      stillTimer.current = window.setTimeout(() => setChips([]), CHIP_MS);
      return;
    }
    const key = nextKey.current++;
    setChips((list) => [...list.filter((c) => c.key !== 0).slice(-3), { key, amount, label: '' }]);
    window.setTimeout(() => setChips((list) => list.filter((c) => c.key !== key)), CHIP_MS);
  };

  return (
    <section className="tap-earn" aria-label="Desk paperwork">
      <button type="button" className="tap-earn-target" onClick={onTap} aria-label={`File a report. Each one brings in ${money(value)}`}>
        <Icon name="edit" size={22} className="tap-earn-icon" />
        <span className="tap-earn-text">
          <strong>File a report</strong>
          <small>Each one brings in {money(value)}</small>
        </span>
        <FundingDeltas deltas={chips} />
      </button>
    </section>
  );
}
