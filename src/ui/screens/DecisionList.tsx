// The live call's choice cards (moved from LiveView.tsx), one list for the game and the Scenario
// Lab: the stage prompt, the count, at most five cards (the selected one kept) with Show all, and
// `data-action-id` on each card so the lab can annotate the player's real cards. Store-free.
import { Fragment } from 'react';
import type { JSX } from 'react';
import type { ActionView, Id } from '../../sim/types';
import { Button } from '../components/ui';
import { Icon, actionIcon } from '../icons';
import { opMinutes } from '../format';
import { PeopleText } from '../people/PeopleText';
import { Transcript, type SpokenLine } from '../components/Transcript';
import { CONSEQUENCE_LABEL, OddsBar } from './OperationFeedback';
import { outcomePercentages, visibleDecisions } from './liveModels';

/** `actions` are the stage's choices as the player sees them, with any reviewed choice already
 * forecast for its chosen squads. */
export function DecisionList({ prompt, exchange, actions, selectedId, expanded, onSelect, onExpand }: { prompt: string; exchange?: readonly SpokenLine[]; actions: ActionView[]; selectedId: Id | null; expanded: boolean;
  onSelect(id: Id): void; onExpand(): void }): JSX.Element {
  const decisions = visibleDecisions(actions, selectedId, expanded);
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
            <button
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
                {a.eligible && <span className="callbtn-forecast">
                  {!a.eventResult && <OddsBar likelihood={a.likelihood} mini />}
                  <span className="callbtn-forecast-text">{a.timeLabel ?? `~${opMinutes(a.timeCost)}`} · {!a.eventResult ? `${outcomePercentages(a.likelihood).favorable}% chance to go well · ` : ''}<span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>possible harm: {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span></span>
                </span>}
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
