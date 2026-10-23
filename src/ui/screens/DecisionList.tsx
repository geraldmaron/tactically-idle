// The live call's choice cards (moved from LiveView.tsx), one list for the game and the Scenario
// Lab: the stage prompt, the count, at most five cards (the selected one kept) with Show all, and
// `data-action-id` on each card so the lab can annotate the player's real cards. Store-free. Each
// available card names who would lead it and their number for it. The threat itself shows once, as
// the strip's bar (owner, 2026-10-20: no tag repeats it); a card's minutes turn red when the threat
// would land on it even if it goes well, amber when only a worse result lets it land. What every card
// shares (the threat, the source pulling hardest) sits once above them in What matters now, and a
// tap on a card opens its review (owner, 2026-10-21).
import { Fragment, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import type { ActionView, Id, Officer, RatingKey } from '../../sim/types';
import { Button } from '../components/ui';
import { Icon, actionIcon } from '../icons';
import { opMinutes } from '../format';
import { PeopleText } from '../people/PeopleText';
import { Transcript, type SpokenLine } from '../components/Transcript';
import { CONSEQUENCE_LABEL } from './OperationFeedback';
import { outcomePercentages, visibleDecisions } from './liveModels';
import { gaugeReachTag, type GaugeReach } from './fill-gauge';
import { currentPortraitKey, portraitSource } from '../portraits/Portrait';

/** The officer facts a lead line reads. */
export type LeadOfficer = Pick<Officer, 'id' | 'firstName' | 'surname' | 'portrait' | 'role' | 'ratings'> & Pick<Partial<Officer>, 'identityId'>;

/** Rating words short enough for a card line at 320px; the review sheet has the full names. */
export const RATING_SHORT: Record<RatingKey, string> = {
  shooting: 'Shooting', composure: 'Composure', communication: 'Comms', awareness: 'Awareness', medical: 'Medical', coordination: 'Coord',
};

/** How the decision point's threat sits on one choice: it lands even when the choice goes well
 * ('slow'), only when it goes partly or badly ('risk'), or not at all. The bands count the open
 * decision's stall (sim/operation-selectors.ts, docs/call-pressure.md), so a choice turns "Too slow"
 * while the player waits, before anything is committed. */
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

/** A choice's minutes, coloured by the threat (threatTag) instead of a tag beside them; the words
 * stay for screen readers. */
function ChoiceTime({ a }: { a: ActionView }) {
  const threat = threatTag(a);
  const text = a.timeLabel ?? `~${opMinutes(a.timeCost)}`;
  return threat ? <span className={`callbtn-time callbtn-time-${threat.kind}`} title={threat.text}>{text}<span className="sr-only">, {threat.kind === 'slow' ? 'too slow, the threat lands' : 'the threat can land'}</span></span> : <span>{text}</span>;
}

/** The lead's face and number: one wrapping row under the card text. */
function CardMeta({ a, officers, reach = [] }: { a: ActionView; officers?: Readonly<Record<Id, LeadOfficer>>; reach?: GaugeReach[] }) {
  const lead = a.eligible ? leadLine(a, officers) : null;
  if (!lead && !reach.length) return null;
  return <span className="callbtn-meta">
    {lead && <span className="callbtn-lead" aria-label={`Leads: ${lead.text}`}><LeadFace officer={lead.officer} /><span>{lead.text}</span></span>}
    {reach.map((r) => <span key={`${r.label}:${r.effect}`} className="callbtn-gauge"><Icon name="crowd" size={12} />{gaugeReachTag(r)}</span>)}
  </span>;
}

/** `actions` are the stage's choices as the player sees them, with any reviewed choice already
 * forecast for its chosen squads. Tapping a card opens its review sheet (owner, 2026-10-21: one tap
 * to review, no separate expand); the pull and the full reading live in the sheet. */
export function DecisionList({ prompt, exchange, actions, selectedId, expanded, officers, reach, team, guidance, onSelect, onExpand }: { reach?: Record<Id, GaugeReach[]>; prompt: string; exchange?: readonly SpokenLine[]; actions: ActionView[]; selectedId: Id | null; expanded: boolean;
  /** The deployed officers, for each card's lead line; left out, cards show no lead. */
  officers?: Readonly<Record<Id, LeadOfficer>>;
  /** Who's on it, set between the moment and the choices, because every card names one of them to lead. */
  team?: ReactNode;
  /** What matters now, above the cards. */
  guidance?: ReactNode;
  onSelect(id: Id): void;
  onExpand(): void }): JSX.Element {
  const decisions = visibleDecisions(actions, selectedId, expanded);
  const open = actions.filter((action) => action.eligible).length;
  return <>
    {prompt && <p className="operation-stage-prompt"><PeopleText text={prompt} /></p>}
    <Transcript lines={exchange} label="On the line" />
    {team}
    {guidance}
    {actions.length > 0 && <h3 className="operation-choice-count">Your call<span>{open} open{actions.length > open ? ` · ${actions.length - open} locked` : ''}</span></h3>}
    {actions.length === 0 ? (
      <p className="call-empty">No decisions available right now.</p>
    ) : (
      <div className="call-grid">
        {decisions.map((a, index) => {
          const on = selectedId === a.id;
          // Available choices lead as full cards; unavailable ones follow as slim rows that stay reviewable.
          const firstLocked = !a.eligible && (index === 0 || decisions[index - 1].eligible);
          const forecast = `choice-forecast-${a.id}`;
          return (
            <Fragment key={a.id}>
            {firstLocked && <p className="call-locked-label"><Icon name="lock" size={13} />Unavailable now</p>}
            <button
              type="button"
              className={`callbtn${on ? ' callbtn-on' : ''}${a.eligible ? '' : ' callbtn-off'}${a.eligible && a.weighing ? ' callbtn-weighed' : ''}`}
              data-action-id={a.id}
              data-primary={a.eligible && index === decisions.findIndex((d) => d.eligible) ? true : undefined}
              aria-pressed={on}
              aria-label={`Review ${a.title}${a.eligible ? '' : ': requirements unmet'}`}
              aria-describedby={a.eligible ? forecast : undefined}
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
                  ) : a.weighing ? (
                    // A weighed choice reads as its cost; the pull and the full summary are in the sheet.
                    <span className="callbtn-cost"><PeopleText text={a.weighing.cost} /></span>
                  ) : (
                    <PeopleText text={a.summary} />
                  )}
                </span>
                {a.eligible && a.authority?.allowed && <span className="callbtn-command"><Icon name="radio" size={12} />{a.authority.reason}</span>}
                {a.eligible && a.deceives && <span className="callbtn-command callbtn-deceive"><Icon name="radio" size={12} />Command hasn’t approved this</span>}
                {/* Who leads and possible harm are never folded away. */}
                <CardMeta a={a} officers={officers} reach={reach?.[a.id]} />
                {a.eligible && <Forecast a={a} id={forecast} />}
              </span>
            </button>
            </Fragment>
          );
        })}
      </div>
    )}
    {actions.length > 5 && <Button block className="operation-more-choices" onClick={onExpand} aria-expanded={expanded}>{expanded ? 'Show fewer choices' : `Show all ${actions.length} choices`}</Button>}
  </>;
}

/** A number padded to `width` digits with figure spaces, which are a digit wide in tabular type and
 * never collapse: a live number then keeps its width and its place as it ticks from 10 to 9. */
export const padDigits = (n: number, width: number) => String(n).padStart(width, '\u2007');
/** "Now" in the minutes' place once the threat lands, padded to the width of "12 min" in the
 * monospaced digits it replaces, so it takes the same box and nothing beside it moves. */
export const NOW_LABEL = 'Now'.padStart(6, '\u2007');

/** The card's odds as a thin bar whose three bands all start at its left edge, stacked: as the stall
 * moves the odds, each band only grows or shrinks, so no band moves (a flex row of bands would slide
 * the later two, which the browser counts as a layout shift). */
function CardOdds({ likelihood }: Pick<ActionView, 'likelihood'>) {
  const p = outcomePercentages(likelihood);
  return <span className="odds-bar odds-bar-mini odds-stack" role="img" aria-label={`${p.favorable}% goes well, ${p.mixed}% complications, ${p.adverse}% goes badly`}>
    <i className="odds-adverse" style={{ width: '100%' }} />
    <i className="odds-mixed" style={{ width: `${p.favorable + p.mixed}%` }} />
    <i className="odds-favorable" style={{ width: `${p.favorable}%` }} />
  </span>;
}

/** The odds, harm and time every available choice shows, once each (docs/ui-ux-audit.md): the bar,
 * then "90% goes well · Harm low · ~4 min". The chance holds a fixed width of tabular digits, so the
 * line never rewraps as the stall moves it. */
function Forecast({ a, id }: { a: ActionView; id: string }) {
  return <span className="callbtn-forecast">
    {!a.eventResult && <CardOdds likelihood={a.likelihood} />}
    <span className="callbtn-forecast-text" id={id}>
      {!a.eventResult && <span>{padDigits(outcomePercentages(a.likelihood).favorable, 2)}% goes well</span>}
      <span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>Harm {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span>
      <ChoiceTime a={a} />
    </span>
  </span>;
}
