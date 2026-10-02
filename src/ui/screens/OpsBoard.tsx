import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { send, useGame } from '../store';
import type { GameState, Id } from '../../sim/types';
import type { ScenarioCard } from '../../sim/operation-selectors';
import type { ScenarioDefinition } from '../../sim/scenario-types';
import { Button, Card, Chip, EmptyState, Section } from '../components/ui';
import { DifficultyChip, TierChevrons, TimeLeft, familyBlurb, incidentMeta, settingIcon, useNow } from '../components/incident';
import { Icon } from '../icons';
import { relativeTime } from '../format';
import { boardEntries, boardNote, incidentsOf, practiceEntries } from './helpers';
import type { BoardEntry, PracticeEntry } from './helpers';

/**
 * Ops board: live incidents (arrive over time, close if nobody takes them), then standing assignments
 * and practice replays. Viewing the board marks incidents seen; the NEW badge is kept for this visit.
 */
export function OpsBoard({ onPrepare }: { onPrepare: (id: Id) => void }) {
  const g = useGame();
  const now = useNow(1000);
  const entries = boardEntries(g, now).filter((e) => e.incident.expiresAt > now);
  const practice = practiceEntries(g, now);
  const note = boardNote(g, now);
  const fresh = useFreshIncidents(g);
  const arrival = note.line ?? (note.nextAt ? `Next call expected ${relativeTime(note.nextAt, now)}` : null);

  return (
    <div className="page">
      <Section
        title="Incident board"
        icon="pin"
        hint="Calls come in over time while the department is on duty. A call nobody takes is handed to another unit; nothing is lost."
      >
        {entries.length === 0 ? (
          <Card>
            <EmptyState icon="hourglass" title="No open incidents">
              New incidents arrive over time and stay open for a while. Check back soon, or run a practice scenario below.
            </EmptyState>
          </Card>
        ) : (
          <div className="stack">
            {entries.map((e) => (
              <IncidentCardView key={e.card.id} entry={e} now={now} isNew={fresh.has(e.card.id)} onPrepare={onPrepare} />
            ))}
          </div>
        )}
        {arrival && (
          <p className="arrival">
            <Icon name="clock" size={15} />
            {arrival}
          </p>
        )}
      </Section>

      <Section title="Standing and practice" icon="flag" hint="Standing assignments and past incidents. Past incidents replay as practice: no rewards, no consequences.">
        {practice.length === 0 ? (
          <Card>
            <EmptyState icon="flag" title="Nothing to practise yet">
              Finished incidents appear here so you can replay them with a different squad or kit.
            </EmptyState>
          </Card>
        ) : (
          <div className="stack">
            {practice.map((p) => (
              <PracticeCardView key={p.card.id} entry={p} onPrepare={onPrepare} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/**
 * Remembers which incidents were unseen when the board was opened, then marks them seen. The NEW badge
 * therefore stays for this visit and is gone on the next. Guarded: the command may not exist yet.
 */
function useFreshIncidents(g: GameState): Set<Id> {
  const [fresh, setFresh] = useState<Set<Id>>(() => new Set(incidentsOf(g).filter((i) => !i.seen).map((i) => i.id)));
  const tried = useRef(0);
  const unseen = incidentsOf(g).filter((i) => !i.seen);
  const key = unseen.map((i) => i.id).join('|');
  useEffect(() => {
    if (unseen.length === 0) return;
    setFresh((prev) => {
      const next = new Set(prev);
      unseen.forEach((i) => next.add(i.id));
      return next.size === prev.size ? prev : next;
    });
    if (tried.current >= 3) return;
    tried.current++;
    try {
      send({ type: 'markIncidentsSeen' });
    } catch {
      /* the department handler has not landed yet; the board still works */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return fresh;
}

function CardBody({ card, scenario, familyId, type, tier, children }: { card: ScenarioCard; scenario: ScenarioDefinition | null; familyId: string | null; type: string | null; tier: number | null; children?: ReactNode }) {
  const meta = incidentMeta(type);
  const blurb = familyBlurb(familyId);
  const diff = scenario?.difficulty;
  return (
    <>
      <div className="opboard-head">
        <span className="opboard-kind">
          <Icon name={type ? meta.icon : settingIcon(card.setting)} size={18} />
          {type ? meta.label : card.setting.toUpperCase()}
        </span>
        <span className="opboard-code">{card.code}</span>
      </div>
      <h3 className="opboard-title">{card.title}</h3>
      {blurb && (
        <p className="opboard-where">
          <Icon name={settingIcon(card.setting)} size={14} />
          {blurb}
        </p>
      )}
      {(tier !== null || diff) && (
        <div className="opboard-tier">
          {tier !== null && (
            <span className="tierline">
              <TierChevrons tier={tier} />
              <span className="dim">Tier {tier}</span>
            </span>
          )}
          {diff && <DifficultyChip band={diff.band} />}
        </div>
      )}
      {diff && diff.drivers.length > 0 && (
        <p className="opboard-drivers">
          <Icon name="gauge" size={14} />
          <span>
            Driven by: {diff.drivers.slice(0, 3).join(', ')}
            <span className="dim"> (from what is known)</span>
          </span>
        </p>
      )}
      <p className="opboard-summary">{card.summary}</p>
      <div className="chips">
        <Chip icon="question" tone="amber">
          {card.variantLabel}
        </Chip>
        <Chip icon="clock">{card.pressureLabel}</Chip>
        <Chip icon="people">{card.squadRange.min === card.squadRange.max ? `${card.squadRange.min} squad` : `${card.squadRange.min}–${card.squadRange.max} squads`}</Chip>
      </div>
      {children}
    </>
  );
}

function Eligibility({ card }: { card: ScenarioCard }) {
  return (
    <>
      <div className="opboard-elig">
        <span className="dim">
          <Icon name="people" size={14} /> Eligible squads
        </span>
        {card.eligibleSquadIds.length === 0 ? (
          <Chip tone="warn">None ready</Chip>
        ) : (
          card.eligibleSquadIds.map((id) => (
            <Chip key={id} tone="mint" icon="check">
              {id}
            </Chip>
          ))
        )}
      </div>
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
    </>
  );
}

function IncidentCardView({ entry, now, isNew, onPrepare }: { entry: BoardEntry; now: number; isNew: boolean; onPrepare: (id: Id) => void }) {
  const { card, incident, scenario } = entry;
  const spec = scenario?.incident;
  return (
    <Card className={`opboard${isNew ? ' opboard-new' : ''}`}>
      {isNew && (
        <span className="newbadge">
          <Icon name="bell" size={12} />
          NEW
        </span>
      )}
      <CardBody card={card} scenario={scenario} familyId={spec?.familyId ?? scenario?.locationFamilyId ?? incident.familyId} type={spec?.type ?? incident.type} tier={spec?.tier ?? incident.tier}>
        <TimeLeft expiresAt={incident.expiresAt} now={now} />
        <Eligibility card={card} />
        <Button variant="primary" block onClick={() => onPrepare(card.id)}>
          Prepare
        </Button>
      </CardBody>
    </Card>
  );
}

function PracticeCardView({ entry, onPrepare }: { entry: PracticeEntry; onPrepare: (id: Id) => void }) {
  const { card, scenario, kind } = entry;
  const spec = scenario?.incident;
  return (
    <Card className="opboard">
      <CardBody card={card} scenario={scenario} familyId={spec?.familyId ?? scenario?.locationFamilyId ?? null} type={spec?.type ?? null} tier={spec?.tier ?? null}>
        {kind === 'replay' ? (
          <p className="note note-amber">
            <Icon name="refresh" size={16} />
            Past incident: replays as practice only.
          </p>
        ) : (
          <Eligibility card={card} />
        )}
        <Button variant={kind === 'replay' ? 'secondary' : 'primary'} block onClick={() => onPrepare(card.id)}>
          {kind === 'replay' ? 'Replay as practice' : 'Prepare'}
        </Button>
      </CardBody>
    </Card>
  );
}
