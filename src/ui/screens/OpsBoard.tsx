import { useEffect, useState } from 'react';
import { send, useGame } from '../store';
import type { GameState, Id } from '../../sim/types';
import type { ScenarioCard } from '../../sim/operation-selectors';
import { boardShortages } from '../../sim/board-suggestions';
import { Button, Chip, Section } from '../components/ui';
import { TimeLeftBar, useNow } from '../components/incident';
import { Icon } from '../icons';
import { relativeTime } from '../format';
import { BOARD_LIMIT, boardEntries, boardNote, boardPlan, incidentsOf } from './helpers';
import type { BoardEntry } from './helpers';
import { Casebook } from './Casebook';
import { CallTile } from './CallTile';
import { ScreenBanner } from '../art/Plates';
import { GamePeopleProvider } from '../people/PeopleText';
import { lexiconFor } from '../people/lexicon';
import './ops-visual.css';

/**
 * Ops board: the live call-outs, at most BOARD_LIMIT. Calls arrive over time and close if nobody
 * takes them; between call-outs the board is empty and the department works its idle loop. The
 * casebook stays below as the record of calls taken. Viewing the board marks incidents seen; the
 * NEW badge is kept for this visit.
 */
export function OpsBoard({ onPrepare }: { onPrepare: (id: Id) => void }) {
  const g = useGame();
  const now = useNow(1000);
  const entries = boardEntries(g, now).filter((e) => e.incident.expiresAt > now);
  const live = boardPlan(entries);
  const note = boardNote(g, now);
  const fresh = useFreshIncidents(g);
  const arrival = note.line ?? (note.nextAt ? `Next call expected ${relativeTime(note.nextAt, now)}` : null);
  const squadCount = g.squads.filter((squad) => squad.officerIds.length > 0).length;

  return (
    <>
    <ScreenBanner id="ops" kicker="Dispatch" title="Call-outs" line="SWAT is called when someone is armed, there is a threat, and they won't come out. A call nobody takes goes to another unit." />
    <div className="page opboard-page">
      <Section title="Live calls" icon="pin">
        <div className="opboard-count" role="status">
          <span className="opboard-slots" aria-hidden="true">
            {Array.from({ length: BOARD_LIMIT }, (_, i) => <i key={i} data-slot={i < live.length ? 'live' : 'open'} />)}
          </span>
          <span>{live.length === 0 ? 'No call-outs right now' : <><strong>{live.length}</strong> live {live.length === 1 ? 'call' : 'calls'}</>}</span>
        </div>
        <div className="stack opboard-list">
          {live.map((e) => (
            <IncidentCardView key={e.card.id} g={g} entry={e} now={now} isNew={fresh.has(e.card.id)} squadCount={squadCount} onPrepare={onPrepare} />
          ))}
        </div>
        {arrival && (
          <p className="arrival">
            <Icon name="clock" size={15} />
            {arrival}
          </p>
        )}
      </Section>

      <Casebook state={g} />
    </div>
    </>
  );
}

/**
 * Remembers which incidents were unseen when the board was opened, then marks them seen. The NEW badge
 * therefore stays for this visit and is gone on the next.
 */
function useFreshIncidents(g: GameState): Set<Id> {
  const [fresh, setFresh] = useState<Set<Id>>(() => new Set(incidentsOf(g).filter((i) => !i.seen).map((i) => i.id)));
  const unseen = incidentsOf(g).filter((i) => !i.seen);
  const key = unseen.map((i) => i.id).join('|');
  useEffect(() => {
    if (unseen.length === 0) return;
    setFresh((prev) => {
      const next = new Set(prev);
      unseen.forEach((i) => next.add(i.id));
      return next.size === prev.size ? prev : next;
    });
    send({ type: 'markIncidentsSeen' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return fresh;
}

/** Eligibility only earns space when something is wrong; every squad ready is the normal case. */
function Eligibility({ card, squadCount }: { card: ScenarioCard; squadCount: number }) {
  if (card.issues.length === 0 && card.eligibleSquadIds.length > 0 && card.eligibleSquadIds.length >= squadCount) return null;
  return (
    <div className="opboard-elig">
      <span className="opboard-elig-squads">
        <Icon name="people" size={14} />
        {card.eligibleSquadIds.length === 0 ? <Chip tone="warn">None ready</Chip> : card.eligibleSquadIds.map((id) => <Chip key={id} tone="mint" icon="check">{id}</Chip>)}
      </span>
      {card.issues.length > 0 && (
        <ul className="issues">
          {card.issues.map((i, k) => (
            <li key={k}>
              <Icon name="warning" size={14} />
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IncidentCardView({ g, entry, now, isNew, squadCount, onPrepare }: { g: GameState; entry: BoardEntry; now: number; isNew: boolean; squadCount: number; onPrepare: (id: Id) => void }) {
  const { card, incident, scenario } = entry;
  const short = boardShortages(g, card.id, now);
  const spec = scenario?.incident;
  // Each card names its own call's people; nobody is deployed yet.
  return (
    <GamePeopleProvider lexicon={scenario ? lexiconFor(scenario, null, []) : null}>
      <CallTile card={card} scenario={scenario} isNew={isNew} familyId={scenario?.locationFamilyId ?? spec?.familyId ?? incident.familyId} type={spec?.type ?? incident.type} tier={spec?.tier ?? incident.tier}
        facts={incident.newKind && <Chip tone="amber" icon="star">New kind of call</Chip>}
        short={short}
        warning={<Eligibility card={card} squadCount={squadCount} />}
        footer={<>
          <TimeLeftBar arrivedAt={incident.arrivedAt} expiresAt={incident.expiresAt} now={now} />
          <Button variant="primary" className="optile-go" onClick={() => onPrepare(card.id)}>Prepare</Button>
        </>} />
    </GamePeopleProvider>
  );
}

