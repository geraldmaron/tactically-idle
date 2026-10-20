// The live call's choice cards (moved from LiveView.tsx), one list for the game and the Scenario
// Lab: the stage prompt, the count, at most five cards (the selected one kept) with Show all, and
// `data-action-id` on each card so the lab can annotate the player's real cards. Store-free.
import { Fragment, useState } from 'react';
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
            {a.eligible && a.weighing ? <WeighedChoice action={a} on={on} open={opened.has(a.id)} onToggle={() => toggle(a.id)} onReview={() => onSelect(a.id)} /> : <button
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
function WeighedChoice({ action: a, on, open, onToggle, onReview }: { action: ActionView; on: boolean; open: boolean; onToggle(): void; onReview(): void }) {
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
    {open && <Forecast a={a} />}
    <button type="button" className="callbtn-review" aria-pressed={on} aria-label={`Review ${a.title}`} onClick={onReview}>
      {!open && <span className="callbtn-review-odds">{a.timeLabel ?? `~${opMinutes(a.timeCost)}`}{!a.eventResult ? ` · ${outcomePercentages(a.likelihood).favorable}% to go well` : ''} · <span className={`callbtn-harm callbtn-harm-${a.consequenceLevel}`}>harm {CONSEQUENCE_LABEL[a.consequenceLevel].toLowerCase()}</span></span>}
      <span className="callbtn-review-label">Review<Icon name="chevronRight" size={14} /></span>
    </button>
  </div>;
}
