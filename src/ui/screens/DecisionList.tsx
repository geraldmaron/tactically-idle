// The live call's choice cards (moved from LiveView.tsx), one list for the game and the Scenario
// Lab: the stage prompt, the count, at most five cards (the selected one kept) with Show all, and
// `data-action-id` on each card so the lab can annotate the player's real cards. Store-free. Each
// available card names who would lead it and their number for it, and says when the decision point's
// threat would land on it (ActionView.threat).
import { Fragment, useState } from 'react';
import type { JSX } from 'react';
import type { ActionView, Id, Officer, RatingKey } from '../../sim/types';
import { Button } from '../components/ui';
import { Icon, actionIcon } from '../icons';
import { opMinutes } from '../format';
import { PeopleText } from '../people/PeopleText';
import { Transcript, type SpokenLine } from '../components/Transcript';
import { CONSEQUENCE_LABEL, OddsBar } from './OperationFeedback';
import { outcomePercentages, visibleDecisions } from './liveModels';
import { currentPortraitKey, portraitSource } from '../portraits/Portrait';

/** The officer facts a lead line reads. */
export type LeadOfficer = Pick<Officer, 'id' | 'firstName' | 'surname' | 'portrait' | 'role' | 'ratings'> & Pick<Partial<Officer>, 'identityId'>;

/** Rating words short enough for a card line at 320px; the review sheet has the full names. */
export const RATING_SHORT: Record<RatingKey, string> = {
  shooting: 'Shooting', composure: 'Composure', communication: 'Comms', awareness: 'Awareness', medical: 'Medical', coordination: 'Coord',
};

/** How the decision point's threat sits on one choice: it lands even when the choice goes well
 * ('slow'), only when it goes partly or badly ('risk'), or not at all. */
export function threatTag(a: Pick<ActionView, 'threat'>): { kind: 'slow' | 'risk'; text: string } | null {
  if (!a.threat?.bands.length) return null;
  return a.threat.bands.includes('favorable') ? { kind: 'slow', text: `Too slow: ${a.threat.label}` } : { kind: 'risk', text: `Risk: ${a.threat.label}` };
}

/** Who would lead this choice and their number for it ("Chen · Comms 72"), or null. */
export function leadLine(a: Pick<ActionView, 'officerIds' | 'keyRating'>, officers: Readonly<Record<Id, LeadOfficer>> | undefined): { officer: LeadOfficer; text: string } | null {
  const officer = officers?.[a.officerIds[0]];
  if (!officer) return null;
  return { officer, text: a.keyRating ? `${officer.surname} · ${RATING_SHORT[a.keyRating]} ${Math.round(officer.ratings[a.keyRating])}` : `${officer.surname} leads` };
}

/** A small face for inline rows (a span, so it can sit inside a card's button): the file portrait,
 * or the initials when there is none. Decorative; the row's text names the officer. */
export function LeadFace({ officer, size = 22 }: { officer: LeadOfficer; size?: number }) {
  const [failed, setFailed] = useState(false);
  const key = currentPortraitKey(officer);
  return <span className="lead-face" aria-hidden="true" style={{ width: size, height: size }}>
    {key && !failed ? <img src={portraitSource(key)} alt="" width={size} height={size} draggable={false} onError={() => setFailed(true)} />
      : <span className="lead-face-initials">{officer.firstName.slice(0, 1)}{officer.surname.slice(0, 1)}</span>}
  </span>;
}

/** The lead's face and number, and the threat tag: one wrapping row under the card text. */
function CardMeta({ a, officers }: { a: ActionView; officers?: Readonly<Record<Id, LeadOfficer>> }) {
  const lead = a.eligible ? leadLine(a, officers) : null;
  const threat = threatTag(a);
  if (!lead && !threat) return null;
  return <span className="callbtn-meta">
    {lead && <span className="callbtn-lead" aria-label={`Leads: ${lead.text}`}><LeadFace officer={lead.officer} /><span>{lead.text}</span></span>}
    {threat && <span className={`callbtn-threat callbtn-threat-${threat.kind}`}><Icon name="hourglass" size={12} />{threat.text}</span>}
  </span>;
}

/** `actions` are the stage's choices as the player sees them, with any reviewed choice already
 * forecast for its chosen squads. */
export function DecisionList({ prompt, exchange, actions, selectedId, expanded, officers, onSelect, onExpand }: { prompt: string; exchange?: readonly SpokenLine[]; actions: ActionView[]; selectedId: Id | null; expanded: boolean;
  /** The deployed officers, for each card's lead line; left out, cards show no lead. */
  officers?: Readonly<Record<Id, LeadOfficer>>;
  onSelect(id: Id): void; onExpand(): void }): JSX.Element {
  const decisions = visibleDecisions(actions, selectedId, expanded);
  const [opened, setOpened] = useState<ReadonlySet<Id>>(() => new Set());
  const toggle = (id: Id) => setOpened((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const open = actions.filter((action) => action.eligible).length;
  return <>
    {prompt && <p className="operation-stage-prompt"><PeopleText text={prompt} /></p>}
    <Transcript lines={exchange} label="On the line" />
    {actions.length > 0 && <p className="operation-choice-count">{open} available{actions.some((action) => !action.eligible) ? ` · ${actions.length - open} unavailable` : ''}. Tap one to review costs and odds.</p>}
    {actions.length === 0 ? (
      <p className="call-empty">No decisions available right now.</p>
    ) : (
      <div className="call-grid">
        {decisions.map((a, index) => {
          const on = selectedId === a.id;
          // Available choices lead as full cards; unavailable ones follow as slim rows that stay reviewable.
          const firstLocked = !a.eligible && (index === 0 || decisions[index - 1].eligible);
          return (
            <Fragment key={a.id}>
            {firstLocked && <p className="call-locked-label"><Icon name="lock" size={13} />Unavailable now</p>}
            {a.eligible && a.weighing ? <WeighedChoice action={a} on={on} open={opened.has(a.id)} officers={officers} onToggle={() => toggle(a.id)} onReview={() => onSelect(a.id)} /> : <button
              type="button"
              className={`callbtn${on ? ' callbtn-on' : ''}${a.eligible ? '' : ' callbtn-off'}`}
              data-action-id={a.id}
              aria-pressed={on}
              aria-label={`Review ${a.title}${a.eligible ? '' : ': requirements unmet'}`}
              onClick={() => onSelect(a.id)}
            >
              <Icon name={a.eligible ? actionIcon(a.icon) : 'lock'} size={!a.eligible ? 16 : actions.length > 2 ? 24 : 30} className="callbtn-icon" />
              <span className="callbtn-text">
                <span className="callbtn-title"><PeopleText text={a.title} /></span>
                <span className="callbtn-sum">
                  {!a.eligible && a.reason ? (
                    <>
                      <Icon name="lock" size={11} /> <PeopleText text={a.reason} />
                    </>
                  ) : (
                    <PeopleText text={a.summary} />
                  )}
                </span>
                {a.eligible && a.authority?.allowed && <span className="callbtn-command"><Icon name="radio" size={12} />{a.authority.reason}</span>}
                {a.eligible && a.deceives && <span className="callbtn-command callbtn-deceive"><Icon name="radio" size={12} />Command hasn’t approved this</span>}
                <CardMeta a={a} officers={officers} />
                {a.eligible && <span className="callbtn-forecast">
                  {!a.eventResult && <OddsBar likelihood={a.likelihood} mini />}
                  <span className="callbtn-forecast-text">{a.timeLabel ?? `~${opMinutes(a.timeCost)}`} · {!a.eventResult ? `${outcomePercentages(a.likelihood).favorable}% chance to go well · ` : ''}<span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>possible harm: {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span></span>
                </span>}
              </span>
            </button>}
            </Fragment>
          );
        })}
      </div>
    )}
    {actions.length > 5 && <Button block className="operation-more-choices" onClick={onExpand} aria-expanded={expanded}>{expanded ? 'Show fewer choices' : `Show all ${actions.length} choices`}</Button>}
  </>;
}

/** The odds and time line every available choice shows. */
function Forecast({ a }: { a: ActionView }) {
  return <span className="callbtn-forecast">
    {!a.eventResult && <OddsBar likelihood={a.likelihood} mini />}
    <span className="callbtn-forecast-text">{a.timeLabel ?? `~${opMinutes(a.timeCost)}`} · {!a.eventResult ? `${outcomePercentages(a.likelihood).favorable}% chance to go well · ` : ''}<span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>possible harm: {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span></span>
  </span>;
}

/** A choice with a pull and a cost (choice-weighing). Collapsed it is the title and the cost, so
 * several choices fit a phone screen; tapping the text opens the full summary, the pull, the cost
 * and the odds in place. Possible harm stays on the collapsed card (harm is never folded). Review is its own 44px button on every card, so reviewing never takes an
 * extra tap: expanding is for reading, Review is for deciding. */
function WeighedChoice({ action: a, on, open, officers, onToggle, onReview }: { action: ActionView; on: boolean; open: boolean; officers?: Readonly<Record<Id, LeadOfficer>>; onToggle(): void; onReview(): void }) {
  const panel = `choice-weigh-${a.id}`;
  return <div className={`callbtn callbtn-weighed${on ? ' callbtn-on' : ''}${open ? ' callbtn-open' : ''}`} data-action-id={a.id}>
    <button type="button" className="callbtn-expand" aria-expanded={open} aria-controls={panel} onClick={onToggle}>
      <Icon name={actionIcon(a.icon)} size={24} className="callbtn-icon" />
      <span className="callbtn-text">
        <span className="callbtn-title"><PeopleText text={a.title} /></span>
        {!open && <span className="callbtn-cost"><PeopleText text={a.weighing!.cost} /></span>}
      </span>
      <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} className="callbtn-chevron" />
    </button>
    {open && <div id={panel} className="callbtn-weigh">
      <p className="callbtn-full"><PeopleText text={a.summary} /></p>
      <p className="callbtn-weigh-line"><b>The pull:</b> <PeopleText text={a.weighing!.pull} /></p>
      <p className="callbtn-weigh-line callbtn-weigh-cost"><b>The cost:</b> <PeopleText text={a.weighing!.cost} /></p>
    </div>}
    {a.authority?.allowed && <span className="callbtn-command"><Icon name="radio" size={12} />{a.authority.reason}</span>}
    {a.deceives && <span className="callbtn-command callbtn-deceive"><Icon name="radio" size={12} />Command hasn’t approved this</span>}
    {/* Like harm, who leads and the threat are never folded away. */}
    <CardMeta a={a} officers={officers} />
    {open && <Forecast a={a} />}
    <button type="button" className="callbtn-review" aria-pressed={on} aria-label={`Review ${a.title}`} onClick={onReview}>
      {!open && <span className="callbtn-review-odds">{a.timeLabel ?? `~${opMinutes(a.timeCost)}`}{!a.eventResult ? ` · ${outcomePercentages(a.likelihood).favorable}% to go well` : ''} · <span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>harm {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span></span>}
      <span className="callbtn-review-label">Review<Icon name="chevronRight" size={14} /></span>
    </button>
  </div>;
}
