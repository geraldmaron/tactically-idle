import { useEffect, useState } from 'react';
import { send, useGame } from '../store';
import type { GameState, Id } from '../../sim/types';
import type { ScenarioCard } from '../../sim/operation-selectors';
import { boardShortages } from '../../sim/board-suggestions';
import { Chip, EmptyState } from '../components/ui';
import { countdown, useNow } from '../components/incident';
import { Icon } from '../icons';
import { relativeTime } from '../format';
import { boardEntries, boardNote, boardPlan, incidentsOf } from './helpers';
import type { BoardEntry } from './helpers';
import { Casebook } from './Casebook';
import { CallTile } from './CallTile';
import { GamePeopleProvider } from '../people/PeopleText';
import { lexiconFor } from '../people/lexicon';
import { cardDescriptors } from '../settings/CardWarning';
import { CARD_THEME_WORDS, CARD_WARNING_TEXT, joinThemes } from '../settings/labels';
import { useSettings } from '../settings/SettingsControls';
import { joinNames, squadName } from './operation-squads';
import { callFlow } from './call-flow';
import './ops-visual.css';

/**
 * The Calls board: the calls waiting, at most BOARD_LIMIT. Calls arrive over time and close if nobody
 * takes them; between calls the board is empty and the department works its idle loop. The
 * casebook stays below as the record of calls taken. Viewing the board marks incidents seen; the
 * New mark is kept for this visit. Skipping costs nothing, said once here and never on a card.
 */
export function OpsBoard({ onOpen }: { onOpen: (id: Id) => void }) {
  const g = useGame();
  const now = useNow(1000);
  const entries = boardEntries(g, now).filter((e) => e.incident.expiresAt > now);
  const live = boardPlan(entries);
  const note = boardNote(g, now);
  const fresh = useFreshIncidents(g);
  const arrival = note.line ?? (note.nextAt ? `Next ${relativeTime(note.nextAt, now)}` : null);
  // Back from a call's brief returns focus to its card (docs/ui-ux-audit.md, exit table).
  useEffect(() => {
    const id = callFlow.takeOpener();
    if (id) document.querySelector<HTMLElement>(`.cl-card[data-call-id="${CSS.escape(id)}"] .cl-card-button`)?.focus();
  }, []);

  return (<>
    <div className="page cl-board">
      <h1 className="section-title cl-board-title"><Icon name="calls" size={24} />Calls</h1>
      <header className="cl-board-head">
        <h2 className="cl-board-count" role="status">{live.length === 0 ? 'No calls waiting' : `${live.length} ${live.length === 1 ? 'call' : 'calls'} waiting`}</h2>
        <p className="cl-board-meta">
          {arrival && <span className="cl-board-next"><Icon name="clock" size={14} />{arrival}</span>}
          <a className="cl-board-link" href="#casebook" onClick={(event) => { event.preventDefault(); document.getElementById('casebook')?.scrollIntoView({ block: 'start' }); }}>Casebook</a>
        </p>
      </header>
      {live.length === 0
        ? <EmptyState spot="noCalls" title="No calls right now">A call nobody takes goes to another unit. The next one arrives while the department works.</EmptyState>
        : <p className="cl-board-note">No penalty for skipping a call. One nobody takes goes to another unit.</p>}
      <div className="cl-board-list">
        {live.map((e) => (
          <BoardCard key={e.card.id} g={g} entry={e} now={now} isNew={fresh.has(e.card.id)} onOpen={onOpen} />
        ))}
      </div>
      <div id="casebook" className="cl-board-casebook"><Casebook state={g} /></div>
    </div>
  </>);
}

/**
 * Remembers which incidents were unseen when the board was opened, then marks them seen. The New mark
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

/** Who can go, on one row: the ready squads by name with their letter, and how many the call takes.
 * The first thing in the way, when something is, in warning colour. */
function Readiness({ g, card }: { g: GameState; card: ScenarioCard }) {
  const range = card.squadRange.min === card.squadRange.max ? `${card.squadRange.min} squad${card.squadRange.min > 1 ? 's' : ''}` : `${card.squadRange.min} to ${card.squadRange.max} squads`;
  const ready = card.eligibleSquadIds;
  return <>
    <span className="cl-ready-badges" aria-hidden="true">{ready.slice(0, 3).map((id) => <span key={id} className="squad-badge">{id}</span>)}</span>
    <span className={`cl-ready-text${ready.length === 0 ? ' cl-warn' : ''}`}>
      {ready.length === 0 ? 'No squad ready' : `${joinNames(ready.map((id) => squadName(g.squads, id)))} ready`} · {range}
    </span>
  </>;
}

/** The call's themes in one line, when the player keeps warnings on (settings, Card warnings). */
function ThemeLine({ cardId }: { cardId: Id }) {
  const on = useSettings().cardWarnings === 'all';
  const descriptors = cardDescriptors(cardId);
  if (!on || descriptors.length === 0) return null;
  return <p className="cl-card-warning" role="note">{CARD_WARNING_TEXT.involves} {joinThemes(descriptors.map((d) => CARD_THEME_WORDS[d]))}.</p>;
}

function BoardCard({ g, entry, now, isNew, onOpen }: { g: GameState; entry: BoardEntry; now: number; isNew: boolean; onOpen: (id: Id) => void }) {
  const { card, incident, scenario } = entry;
  const short = boardShortages(g, card.id, now);
  const spec = scenario?.incident;
  const left = incident.expiresAt - now;
  const soon = left < 15 * 60000;
  // Each card names its own call's people; nobody is deployed yet.
  return (
    <GamePeopleProvider lexicon={scenario ? lexiconFor(scenario, null, []) : null}>
      <CallTile card={card} scenario={scenario} isNew={isNew} familyId={scenario?.locationFamilyId ?? spec?.familyId ?? incident.familyId} type={spec?.type ?? incident.type} tier={spec?.tier ?? incident.tier}
        facts={incident.newKind && <Chip tone="amber" icon="star">New kind of call</Chip>}
        short={short}
        contentNote={<ThemeLine cardId={incident.id} />}
        warning={card.issues.length > 0 && <p className="cl-card-issue"><Icon name="warning" size={14} />{card.issues[0]}{card.issues.length > 1 ? ` (+${card.issues.length - 1} more)` : ''}</p>}
        timeLeft={<span className={soon ? 'cl-warn' : undefined}>{countdown(left)} left{soon ? ', closing soon' : ''}</span>}
        readiness={<Readiness g={g} card={card} />}
        onOpen={() => onOpen(card.id)} />
    </GamePeopleProvider>
  );
}
