// Where an officer sits: one control for the officer sheet and the hire receipt. A squad with room
// takes them in one tap; a full squad asks who they replace and swaps the two in one step, so the
// player never has to empty a place first. Officers on a call queue their move instead.
import { useState } from 'react';
import type { Officer, SquadId } from '../../sim/types';
import { swapCheck, ROSTER_TUNING } from '../../sim/roster';
import { useGame } from '../store';
import { useToast } from './toast';
import { Button } from './ui';
import { OfficerRow } from './OfficerRow';
import { officerFaceStatus } from './face-status';
import { Icon } from '../icons';
import { perHour } from '../format';
import './squad-placement.css';

export function SquadPlacement({ officer: o }: { officer: Officer }) {
  const g = useGame();
  const { act } = useToast();
  const [swapInto, setSwapInto] = useState<SquadId | null>(null);
  const onCall = o.assignment?.kind === 'operation';
  const queued = g.pendingSquadMoves?.find((m) => m.officerId === o.id && !m.dropped);
  const from = o.squadId ? g.squads.find((s) => s.id === o.squadId) : undefined;
  const target = swapInto ? g.squads.find((s) => s.id === swapInto) : undefined;
  const now = Date.now();

  const moveTo = (squadId: SquadId) => {
    const name = g.squads.find((s) => s.id === squadId)?.name;
    const done = onCall ? (squadId === o.squadId ? 'Queued move withdrawn' : `${o.surname} joins ${name} when the call ends`) : `${o.surname} joins ${name}`;
    if (act({ type: 'assignToSquad', officerId: o.id, squadId }, done).ok) setSwapInto(null);
  };
  const pick = (squadId: SquadId) => {
    const squad = g.squads.find((s) => s.id === squadId)!;
    if (squad.id === o.squadId && !queued) return;
    const full = squad.officerIds.length >= ROSTER_TUNING.squadSize && squad.id !== o.squadId;
    if (full && !onCall) setSwapInto((current) => current === squadId ? null : squadId);
    else moveTo(squadId);
  };

  return (
    <div className="placement stack-sm">
      {!from && !onCall && <p className="note placement-bench"><Icon name="user" size={16} />Unassigned. Still paid {perHour(o.wage)} and resting, but can't go on a call until they're in a squad.</p>}
      {queued && <p className="note squad-queued-note"><Icon name="clock" size={16} />After this call, {queued.squadId ? `joins ${g.squads.find((s) => s.id === queued.squadId)?.name ?? `squad ${queued.squadId}`}` : 'leaves the squad'}</p>}
      {g.squads.length === 0
        ? <span className="dim">Create a squad first under Squads.</span>
        : <div className="chips" role="group" aria-label={`Squad for ${o.surname}`}>
          {g.squads.map((s) => {
            const here = o.squadId === s.id;
            const full = !here && s.officerIds.length >= ROSTER_TUNING.squadSize;
            return <Button key={s.id} size="sm" variant={here ? 'primary' : 'secondary'} aria-pressed={here || swapInto === s.id}
              aria-label={`${s.name}, ${s.officerIds.length} of ${ROSTER_TUNING.squadSize}${here ? ', current squad' : full && !onCall ? ', full, choose who to swap' : ''}`}
              onClick={() => pick(s.id)}>
              {s.id} · {s.name}<span className="placement-count">{s.officerIds.length}/{ROSTER_TUNING.squadSize}</span>{full && !onCall && <Icon name="handover" size={16} />}{queued?.squadId === s.id ? ' · queued' : ''}
            </Button>;
          })}
        </div>}
      {target && <section className="placement-swap" aria-label={`Swap ${o.surname} into ${target.name}`}>
        <p className="placement-swap-head">{target.name} is full. Who does {o.surname} replace? They {from ? `move to ${from.name}` : 'go to Unassigned'}.</p>
        <div className="officer-rows placement-swap-list" data-ui-list>
          {target.officerIds.map((id) => g.officers[id]).filter((x): x is Officer => !!x).map((b) => {
            const check = swapCheck(g, o.id, b.id);
            const leads = target.leaderId === b.id;
            return <div key={b.id} className={check.ok ? undefined : 'placement-swap-off'}>
              <OfficerRow officer={b} now={now} leader={leads} faceStatus={officerFaceStatus(g, b.id, g.department.clockHighWater)}
                actionLabel={`Swap ${o.surname} in for ${b.surname}`}
                onClick={() => {
                  if (!check.ok) { act({ type: 'swapSquadMembers', officerId: o.id, withId: b.id }); return; }
                  const where = from ? from.name : 'Unassigned';
                  if (act({ type: 'swapSquadMembers', officerId: o.id, withId: b.id }, `${o.surname} joins ${target.name}${leads ? ' and leads it' : ''}. ${b.surname} to ${where}`).ok) setSwapInto(null);
                }} />
              {!check.ok && <p className="placement-swap-reason">{check.reason}</p>}
            </div>;
          })}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setSwapInto(null)}>Cancel swap</Button>
      </section>}
    </div>
  );
}
