// Paid details on HQ (tap-earn): each tap is billable extra-duty work by the free officers of the
// squads on patrol (sim/department-taps.ts). It pays TAP_TUNING.base funding times the held
// multipliers and strains those officers up to the strained line, so the target shows how much room
// is left and, when there is none, why. Taps are batched into one tapEarn command every FLUSH_MS, so
// a fast thumb saves once per batch. A tap the books would not credit (over the rate cap or past the
// officers' room) shows nothing, so the chip never promises money the engine drops. The rate cap
// itself stays silent (owner 2026-10-21): a human thumb rarely reaches it, and the button still
// presses. Self-contained so the desk restyle can move it.
import { useEffect, useRef, useState } from 'react';
import { detailRoom, tapAllowance, tapValue, type DetailRoom } from '../../sim/department-taps';
import { getState, send, useGame } from '../store';
import { buzz } from '../audio/live-audio';
import { FundingDeltas, type FundingDelta } from './Finance';
import { Meter } from './ui';
import { Icon } from '../icons';
import { money } from '../format';
import './tap-earn.css';

const FLUSH_MS = 300;
const CHIP_MS = 1800;
const reducedMotion = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const names = (squads: string[]) => squads.length < 2 ? squads.join('') : `${squads.slice(0, -1).join(', ')} and ${squads.at(-1)}`;

/** The line under the label: what is left, or why nothing is. */
function roomLine(room: DetailRoom, value: number): string {
  if (room.block === 'no-patrol') return 'Put a squad on patrol to take paid details';
  if (room.block === 'none-free') return 'Every patrol officer is busy or hurt';
  if (room.block === 'at-line') return `${names(room.squads)} ${room.squads.length > 1 ? 'are' : 'is'} at the strain line. Details open again as they rest`;
  return `${money(room.taps * value)} more before ${names(room.squads)} ${room.squads.length > 1 ? 'are' : 'is'} strained`;
}

export function TapEarn() {
  const g = useGame();
  const pending = useRef(0);
  const flushTimer = useRef<number | null>(null);
  const nextKey = useRef(1);
  const stillTimer = useRef<number | null>(null);
  const [chips, setChips] = useState<FundingDelta[]>([]);
  const now = Date.now();
  const value = tapValue(g.department, now);
  const room = detailRoom(g, now);
  const blocked = room.block !== null;

  const flush = () => {
    if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
    flushTimer.current = null;
    const count = pending.current;
    pending.current = 0;
    if (count > 0) send({ type: 'tapEarn', count });
  };

  // Taps still waiting are filed when the target leaves the screen or the page hides.
  useEffect(() => {
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); flush(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onTap = () => {
    const at = Date.now();
    const state = getState();
    if (tapAllowance(state.department, at) - pending.current < 1 || detailRoom(state, at).taps - pending.current < 1) return;
    pending.current += 1;
    if (flushTimer.current === null) flushTimer.current = window.setTimeout(flush, FLUSH_MS);
    buzz(8);
    const amount = tapValue(state.department, at);
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

  const line = roomLine(room, value);
  const share = room.capacity > 0 ? (100 * room.room) / room.capacity : 0;
  return (
    <section className="tap-earn" aria-label="Paid details">
      <button type="button" className="tap-earn-target" onClick={onTap} disabled={blocked} aria-label={`Work paid details, ${money(value)} a tap. ${line}`}>
        <Icon name="tap" size={24} className="tap-earn-icon" />
        <span className="tap-earn-text">
          <strong>Work paid details</strong>
          <span className="tap-earn-line">{line}</span>
          {room.capacity > 0 && <Meter value={share} tone={share > 50 ? 'hi' : share > 20 ? 'mid' : 'lo'} label="Room before the strain line" valueText={`${Math.round(share)} percent`} />}
        </span>
        <FundingDeltas deltas={chips} />
      </button>
    </section>
  );
}
