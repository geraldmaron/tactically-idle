import { useEffect, useState } from 'react';
import { send, useGame } from '../store';
import type { GameState, Id } from '../../sim/types';
import type { ScenarioCard } from '../../sim/operation-selectors';
import { boardShortages } from '../../sim/board-suggestions';
import { Button, Chip, EmptyState, Section } from '../components/ui';
import { Face } from '../components/Face';
import { officerFaceStatus } from '../components/face-status';
import { squadReadiness } from '../../sim/department-selectors';
import { Sheet } from '../components/Sheet';
import { countdown, incidentMeta, useNow } from '../components/incident';
import { callTypeKind } from '../icons/CallTypeBadge';
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
import { bestFitSquad, joinNames, squadName } from './operation-squads';
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
  // The call closing first leads; a player with little time looks at the top card only.
  const live = [...boardPlan(entries)].sort((a, b) => a.incident.expiresAt - b.incident.expiresAt);
  const note = boardNote(g, now);
  const fresh = useFreshIncidents(g);
  const [noteOpen, setNoteOpen] = useState(false);
  const [kind, setKind] = useState<string | null>(null);
  const arrival = note.line ?? (note.nextAt ? `Next call ${relativeTime(note.nextAt, now)}` : null);
  const types = [...new Set(live.map((e) => e.scenario?.incident?.type ?? e.incident.type))];
  const shown = kind && types.includes(kind) ? live.filter((e) => (e.scenario?.incident?.type ?? e.incident.type) === kind) : live;
  const [lead, ...rest] = shown;
  // Back from a call's brief returns focus to its card (docs/ui-ux-audit.md, exit table).
  useEffect(() => {
    const id = callFlow.takeOpener();
    if (id) document.querySelector<HTMLElement>(`.cl-card[data-call-id="${CSS.escape(id)}"] .cl-card-button`)?.focus();
  }, []);

  return (<>
    <div className="page cl-board">
      {/* The board's head as a panel (canvas "Depth and Framed Sections"): when the next call lands in
          the bar, the Casebook as its action, then how many wait and the filters inside. */}
      <Section className="cl-board-strip" level="h1" title="Calls" icon="calls" tone="act" count={arrival ?? 'Calls arrive while the department works'}
        action={<a className="section-link" href="#casebook" onClick={(event) => { event.preventDefault(); document.getElementById('casebook')?.scrollIntoView({ block: 'start' }); }}>Casebook</a>}>
        <div className="cl-board-status">
          <span className="cl-board-count" role="status">{live.length === 0 ? 'No calls waiting' : `${live.length} ${live.length === 1 ? 'call' : 'calls'} waiting · skipping costs nothing`}</span>
          <button type="button" className="cl-info" aria-label="About skipping a call" onClick={() => setNoteOpen(true)}><Icon name="info" size={20} /></button>
        </div>
        {types.length > 1 && <div className="cl-filters" role="group" aria-label="Show calls of one kind">
          <button type="button" className="cl-filter" aria-pressed={!kind} onClick={() => setKind(null)}>All <span>{live.length}</span></button>
          {types.map((t) => {
            const n = live.filter((e) => (e.scenario?.incident?.type ?? e.incident.type) === t).length;
            return <button key={t} type="button" className={`cl-filter ct-badge--${callTypeKind(t).kind}`} aria-pressed={kind === t} onClick={() => setKind(kind === t ? null : t)}>
              <i className="cl-filter-dot" aria-hidden="true" />{incidentMeta(t).label} <span>{n}</span>
            </button>;
          })}
        </div>}
      </Section>
      <Sheet open={noteOpen} onClose={() => setNoteOpen(false)} title="Skipping a call" maxHeight="short" footer={<Button variant="primary" block onClick={() => setNoteOpen(false)}>Done</Button>}>
        <p>No penalty for skipping a call. One nobody takes goes to another unit.</p>
      </Sheet>
      {live.length === 0 && <EmptyState spot="noCalls" title="No calls right now">A call nobody takes goes to another unit. The next one arrives while the department works.{arrival ? ` ${arrival}.` : ''}</EmptyState>}
      {lead && <BoardCard g={g} entry={lead} now={now} isNew={fresh.has(lead.card.id)} onOpen={onOpen} />}
      {rest.length > 0 && <Section title="Also waiting" icon="list" count={`${rest.length} more ${rest.length === 1 ? 'call' : 'calls'}`}>
        <div className="cl-board-list panel-well" data-ui-list>
          {rest.map((e) => (
            <BoardCard key={e.card.id} g={g} entry={e} now={now} isNew={fresh.has(e.card.id)} onOpen={onOpen} compact />
          ))}
        </div>
      </Section>}
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
function Readiness({ g, card, now }: { g: GameState; card: ScenarioCard; now: number }) {
  const range = card.squadRange.min === card.squadRange.max ? (card.squadRange.min > 1 ? `${card.squadRange.min} squads` : null) : `${card.squadRange.min} to ${card.squadRange.max} squads`;
  const ready = card.eligibleSquadIds;
  // The faces are the squad the deploy step will open with, so the card shows who goes.
  const fit = bestFitSquad(ready.map((id) => ({ id, ...squadReadiness(g, id, now) })));
  const members = (fit ? g.squads.find((s) => s.id === fit)?.officerIds ?? [] : []).map((id) => g.officers[id]).filter((o) => !!o).slice(0, 4);
  return <>
    {members.length > 0 && <span className="cl-ready-faces" aria-hidden="true">{members.map((o) => <Face key={o.id} size="sm" kind="officer" officer={o} name={o.surname} status={officerFaceStatus(g, o.id, now)} />)}</span>}
    <span className={`cl-ready-text${ready.length === 0 ? ' cl-warn' : ''}`}>
      {ready.length === 0 ? 'No squad ready' : `${joinNames(ready.map((id) => squadName(g.squads, id)))} ready`}{range ? ` · ${range}` : ''}
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

function BoardCard({ g, entry, now, isNew, onOpen, compact = false }: { g: GameState; entry: BoardEntry; now: number; isNew: boolean; onOpen: (id: Id) => void; compact?: boolean }) {
  const { card, incident, scenario } = entry;
  const short = boardShortages(g, card.id, now);
  const spec = scenario?.incident;
  const left = incident.expiresAt - now;
  const soon = left < 15 * 60000;
  const span = incident.expiresAt - incident.arrivedAt;
  const timeShare = span > 0 ? left / span : undefined;
  // Each card names its own call's people; nobody is deployed yet.
  return (
    <GamePeopleProvider lexicon={scenario ? lexiconFor(scenario, null, []) : null}>
      <CallTile card={card} scenario={scenario} isNew={isNew} familyId={scenario?.locationFamilyId ?? spec?.familyId ?? incident.familyId} type={spec?.type ?? incident.type} tier={spec?.tier ?? incident.tier}
        facts={incident.newKind && <Chip tone="amber" icon="star">New kind of call</Chip>}
        short={compact ? [] : short}
        compact={compact} timeShare={timeShare} soon={soon}
        contentNote={<ThemeLine cardId={incident.id} />}
        warning={card.issues.length > 0 && <p className="cl-card-issue"><Icon name="warning" size={16} />{card.issues[0]}{card.issues.length > 1 ? ` (+${card.issues.length - 1} more)` : ''}</p>}
        timeLeft={compact ? countdown(left) : <span className={soon ? 'cl-warn' : undefined}>{countdown(left)} left{soon ? ', closing soon' : ''}</span>}
        readiness={<Readiness g={g} card={card} now={now} />}
        onOpen={() => onOpen(card.id)} />
    </GamePeopleProvider>
  );
}
