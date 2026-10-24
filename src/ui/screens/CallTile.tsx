// A call's board card (moved from OpsBoard), rendered from props alone so the Scenario Lab shows
// the player's real card. Store-free. Its styles are calls.css, which the board (and the lab's frame)
// load; importing them here would move them in the game's cascade.
import type { JSX, ReactNode } from 'react';
import { callTier, type ScenarioCard } from '../../sim/operation-selectors';
import type { BoardShortage } from '../../sim/board-suggestions';
import { CERT_NAME } from '../../content/certs';
import { CERT_ICON } from '../components/labels';
import type { IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { placeTags, scenarioFloorCount, scenarioPlaceName, settingIcon, TierChevrons } from '../components/incident';
import { CallTypeBadge } from '../icons/CallTypeBadge';
import { Icon, itemIcon } from '../icons';
import { PeopleText } from '../people/PeopleText';
import { PlateArt, placeFor, sceneFor } from '../art/Plates';
import { funding, money } from '../format';
import { Funds } from '../components/Funds';

/** A call on the board (docs/ui-ux-audit.md, "Calls"): the scene with the call type and the time
 * left, the title and place, the three-line hook, one warning line, then who can go and what it
 * pays on one row. The whole card opens the call (`onOpen`), so there is no Prepare button. The
 * board also passes legacy cards, which can lack a scenario, family, type or tier. */
export function CallTile({ card, scenario, familyId, type, isNew = false, facts, footer, warning, contentNote, short = [], timeLeft, timeShare, soon = false, compact = false, readiness, onOpen }: { card: ScenarioCard; scenario: ScenarioDefinition | null; familyId: string | null; type: IncidentType | string | null; tier: number | null;
  isNew?: boolean; facts?: ReactNode; footer?: ReactNode; warning?: ReactNode; contentNote?: ReactNode; short?: BoardShortage[];
  /** "7h 48m left", on the scene. */
  timeLeft?: ReactNode;
  /** Share of the call's window still open, 0 to 1, drawn as a bar that drains. */
  timeShare?: number;
  /** Closing soon: the bar and the time turn to warning. */
  soon?: boolean;
  /** A row instead of a card: the building as a thumbnail, the hook in two lines, the facts on one. */
  compact?: boolean;
  /** Who can go: "Alpha ready · 1 squad", with the letter badge. */
  readiness?: ReactNode;
  onOpen?: () => void }): JSX.Element {
  const tags = placeTags(familyId, scenarioPlaceName(scenario));
  const blurb = tags.kind;
  const tier = scenario ? callTier(scenario.id) : null;
  const floors = scenarioFloorCount(scenario);
  const place = [tags.name, blurb, floors > 1 ? `${floors} floors` : null, card.variantLabel !== card.title ? card.variantLabel : null].filter(Boolean).join(' · ');
  // What the engine will pay at most (callFee, carried on the card by scenarioCards): the tier table times the
  // funding scale for the card's own investigation. The authored reward is only a fallback for a card built
  // without a state (the Lab's frame).
  const pay = scenario?.rewards ? { ...scenario.rewards, funding: card.fee ?? scenario.rewards.funding } : undefined;
  const bar = timeShare === undefined ? null
    : <span className={`cl-card-time${soon ? ' cl-card-time-soon' : ''}`} aria-hidden="true"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, timeShare)) * 100)}%` }} /></span>;
  if (compact) return (
    <article className={`cl-row${isNew ? ' cl-card-new' : ''}${onOpen ? ' cl-card-open' : ''}`} data-call-id={card.id}
      onClick={onOpen ? (e) => { if (!(e.target as HTMLElement).closest('button, a, input, select, textarea, label')) onOpen(); } : undefined}>
      <span className="cl-row-thumb plate" aria-hidden="true">
        <PlateArt src={placeFor(familyId) ?? sceneFor(type ?? undefined)} />
        {type && <CallTypeBadge type={type} size={20} />}
      </span>
      <div className="cl-row-main">
        <div className="cl-row-head">
          <h3 className="cl-row-title">
            {onOpen ? <button type="button" className="cl-card-button" data-primary onClick={onOpen} aria-label={`Open ${card.title}${blurb ? `, ${blurb}` : ''}`}>{card.title}</button> : card.title}
          </h3>
          {isNew && <span className="cl-card-newmark">New</span>}
          {timeLeft && <span className={`cl-row-left${soon ? ' cl-warn' : ''}`}>{timeLeft}</span>}
        </div>
        {place && <p className="cl-row-place">{place}</p>}
        <p className="cl-row-hook"><PeopleText text={card.summary} /></p>
        <div className="cl-row-meta">
          {pay && <span className="cl-row-pay" aria-label={`Pays up to ${funding(pay.funding)} and ${pay.xp} experience.`}><b><Funds value={pay.funding} /></b><span className="cl-row-xp">{pay.xp} XP</span></span>}
          <span className="cl-card-ready">{readiness}</span>
        </div>
        {warning}
        {bar}
      </div>
    </article>
  );
  return (
    <article className={`cl-card${isNew ? ' cl-card-new' : ''}${onOpen ? ' cl-card-open' : ''}`} data-call-id={card.id}
      onClick={onOpen ? (e) => { if (!(e.target as HTMLElement).closest('button, a, input, select, textarea, label')) onOpen(); } : undefined}>
      <div className="cl-card-scene plate">
        <PlateArt src={placeFor(familyId) ?? sceneFor(type ?? undefined)} />
        <div className="cl-card-scene-top">
          <span className="cl-card-type">
            {type ? <CallTypeBadge type={type} size={24} label /> : <span className="cl-card-setting"><Icon name={settingIcon(card.setting)} size={20} />{card.setting}</span>}
          </span>
          <span className="cl-card-scene-end">
            {tier !== null && <span className="cl-card-tier" title="The call's tier"><TierChevrons tier={tier} />Tier {tier}</span>}
            {isNew && <span className="cl-card-newmark">New</span>}
            {timeLeft && <span className="cl-card-left">{timeLeft}</span>}
          </span>
        </div>
        <div className="cl-card-scene-id">
          <h3 className="cl-card-title">
            {onOpen ? <button type="button" className="cl-card-button" data-primary onClick={onOpen} aria-label={`Open ${card.title}${blurb ? `, ${blurb}` : ''}`}>{card.title}</button> : card.title}
          </h3>
          {place && <div className="cl-card-place-row">
            <span className="cl-card-place-mark" aria-hidden="true"><Icon name={settingIcon(card.setting)} size={16} /></span>
            <p className="cl-card-place">{place}</p>
          </div>}
        </div>
      </div>
      {bar}
      <div className="cl-card-body">
        <p className="cl-card-hook"><PeopleText text={card.summary} /></p>
        {contentNote}
        {(facts || !scenario) && <div className="cl-card-facts">
          {!scenario && <span className="cl-card-fact"><Icon name="clock" size={16} />{card.pressureLabel}</span>}
          {facts}
        </div>}
        <BringRow short={short} />
        {warning}
        {(readiness || pay || onOpen) && <div className="cl-card-foot">
          <span className="cl-card-ready">{readiness}</span>
          {pay && <span className="cl-card-pay" aria-label={`Pays up to ${funding(pay.funding)} and ${pay.xp} experience. How the call ends sets what it pays.`}>
            <span className="cl-card-pay-top" aria-hidden="true"><Icon name="funds" size={16} /><span className="cl-card-pay-up">Up to</span> <b>{money(pay.funding)}</b></span>
            <span className="cl-card-pay-xp" aria-hidden="true"><Icon name="level" size={16} />{pay.xp} XP</span>
          </span>}
          {onOpen && <Icon name="chevronRight" size={20} className="cl-card-chevron" />}
        </div>}
        {footer}
      </div>
    </article>
  );
}

const BRING_CHIPS = 3;

/** One shortage as the chip shows it, and as a screen reader hears it. */
function shortageText(x: BoardShortage): { text: string; label: string } {
  if (x.kind === 'cert') return { text: `${CERT_NAME[x.id]} 0`, label: `${CERT_NAME[x.id]}, no officer free to deploy holds it` };
  return { text: x.need > 1 ? `${x.label} ${x.have}/${x.need}` : `${x.label} ${x.have}`, label: `${x.label}, ${x.have} ready of ${x.need} needed` };
}

/** What the department is short of for this call: at most three chips, the rest as +N. Hidden when nothing is short. */
export function BringRow({ short }: { short: BoardShortage[] }): JSX.Element | null {
  if (!short.length) return null;
  const shown = short.slice(0, BRING_CHIPS);
  const rest = short.slice(BRING_CHIPS);
  return (
    <div className="optile-bring" role="group" aria-label="Short for this call">
      <span className="optile-bring-label" aria-hidden="true">Bring</span>
      {shown.map((x) => {
        const { text, label } = shortageText(x);
        return <span key={x.kind === 'cert' ? x.id : x.itemIds.join('|')} className="chip chip-warn" aria-label={label}>
          <Icon name={x.kind === 'cert' ? CERT_ICON[x.id] : itemIcon(x.itemIds[0])} size={16} />{text}
        </span>;
      })}
      {rest.length > 0 && <span className="chip chip-neutral" aria-label={`${rest.length} more short, ${rest.map((x) => shortageText(x).label).join('; ')}`}>+{rest.length}</span>}
    </div>
  );
}
