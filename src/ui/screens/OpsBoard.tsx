import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { send, useGame } from '../store';
import type { GameState, Id } from '../../sim/types';
import type { ScenarioCard } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { Button, Card, Chip, Section } from '../components/ui';
import { DifficultyChip, FloorsChip, TierChevrons, TimeLeftBar, familyBlurb, incidentMeta, scenarioFloorCount, settingIcon, useNow } from '../components/incident';
import { Icon } from '../icons';
import { relativeTime } from '../format';
import { BOARD_LIMIT, boardEntries, boardNote, boardPlan, incidentsOf } from './helpers';
import type { BoardEntry } from './helpers';
import { Casebook } from './Casebook';
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
    <div className="page opboard-page">
      <Section title="Call-outs" icon="pin" hint="SWAT is called when someone is armed, there is a threat, and they won't come out. A call nobody takes goes to another unit.">
        <div className="opboard-count" role="status">
          <span className="opboard-slots" aria-hidden="true">
            {Array.from({ length: BOARD_LIMIT }, (_, i) => <i key={i} data-slot={i < live.length ? 'live' : 'open'} />)}
          </span>
          <span>{live.length === 0 ? 'No call-outs right now' : <><strong>{live.length}</strong> live {live.length === 1 ? 'call' : 'calls'}</>}</span>
        </div>
        <div className="stack opboard-list">
          {live.map((e) => (
            <IncidentCardView key={e.card.id} entry={e} now={now} isNew={fresh.has(e.card.id)} squadCount={squadCount} onPrepare={onPrepare} />
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

/** A compact call tile: a type badge with tier pips, the title and place, a two-line summary, a fact
 * row and a footer with the time left and Prepare. The full brief lives on the Prepare screen. */
function CallTile({ card, scenario, familyId, type, tier, isNew = false, facts, footer, warning }: { card: ScenarioCard; scenario: ScenarioDefinition | null; familyId: string | null; type: string | null; tier: number | null; isNew?: boolean; facts?: ReactNode; footer: ReactNode; warning?: ReactNode }) {
  const meta = incidentMeta(type);
  const blurb = familyBlurb(familyId);
  const diff = scenario?.difficulty;
  const floors = scenarioFloorCount(scenario);
  return (
    <Card className={`opboard optile${isNew ? ' opboard-new' : ''}`}>
      <div className="optile-top">
        <span className={`optile-badge optile-band-${diff?.band ?? 'none'}`}>
          <Icon name={type ? meta.icon : settingIcon(card.setting)} size={24} />
          {tier !== null && <TierChevrons tier={tier} />}
        </span>
        <div className="optile-main">
          <div className="opboard-head">
            <span className="opboard-kind">{type ? meta.label : card.setting.toUpperCase()}</span>
            <span className="opboard-code">{card.code}</span>
            {isNew && (
              <span className="newbadge">
                <Icon name="bell" size={12} />
                NEW
              </span>
            )}
          </div>
          <h3 className="opboard-title">{card.title}</h3>
          {blurb && (
            <p className="opboard-where">
              <Icon name={settingIcon(card.setting)} size={13} />
              <span>{blurb}</span>
            </p>
          )}
        </div>
      </div>
      <p className="opboard-summary">{card.summary}</p>
      <div className="chips opboard-facts">
        {diff && <DifficultyChip band={diff.band} />}
        <Chip icon="people">{card.squadRange.min === card.squadRange.max ? `${card.squadRange.min} squad` : `${card.squadRange.min}–${card.squadRange.max} squads`}</Chip>
        <FloorsChip floors={floors} />
        {card.variantLabel !== card.title && <Chip>{card.variantLabel}</Chip>}
        {(!scenario || scenario.version < 4) && <Chip icon="clock">{card.pressureLabel}</Chip>}
        {facts}
      </div>
      {warning}
      <div className="optile-foot">{footer}</div>
    </Card>
  );
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

function IncidentCardView({ entry, now, isNew, squadCount, onPrepare }: { entry: BoardEntry; now: number; isNew: boolean; squadCount: number; onPrepare: (id: Id) => void }) {
  const { card, incident, scenario } = entry;
  const spec = scenario?.incident;
  return (
    <CallTile card={card} scenario={scenario} isNew={isNew} familyId={scenario?.locationFamilyId ?? spec?.familyId ?? incident.familyId} type={spec?.type ?? incident.type} tier={spec?.tier ?? incident.tier}
      facts={incident.newKind && <Chip tone="amber" icon="star">New kind of call</Chip>}
      warning={<Eligibility card={card} squadCount={squadCount} />}
      footer={<>
        <TimeLeftBar arrivedAt={incident.arrivedAt} expiresAt={incident.expiresAt} now={now} />
        <Button variant="primary" className="optile-go" onClick={() => onPrepare(card.id)}>Prepare</Button>
      </>} />
  );
}

