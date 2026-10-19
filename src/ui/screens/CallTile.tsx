// A call's board card (moved from OpsBoard), rendered from props alone so the Scenario Lab shows
// the player's real card. Store-free. Its styles are app.css and ops-visual.css, which the board
// (and the lab's frame) load; importing them here would move them in the game's cascade.
import type { JSX, ReactNode } from 'react';
import type { ScenarioCard } from '../../sim/operation-selectors';
import type { BoardShortage } from '../../sim/board-suggestions';
import { CERT_NAME } from '../../content/certs';
import { CERT_ICON } from '../components/labels';
import type { IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { Card, Chip } from '../components/ui';
import { DifficultyChip, FloorsChip, TierChevrons, familyBlurb, incidentMeta, scenarioFloorCount, settingIcon } from '../components/incident';
import { Icon, itemIcon } from '../icons';
import { PeopleText } from '../people/PeopleText';
import { PlateArt, sceneFor } from '../art/Plates';
import { money } from '../format';

/** A compact call tile: a type badge with tier pips, the title and place, a two-line summary, a fact
 * row and a footer with the time left and Prepare. The full brief lives on the Prepare screen.
 * The board also passes legacy cards, which can lack a scenario, family, type or tier. */
export function CallTile({ card, scenario, familyId, type, tier, isNew = false, facts, footer, warning, short = [] }: { card: ScenarioCard; scenario: ScenarioDefinition | null; familyId: string | null; type: IncidentType | string | null; tier: number | null;
  isNew?: boolean; facts?: ReactNode; footer?: ReactNode; warning?: ReactNode; short?: BoardShortage[] }): JSX.Element {
  const meta = incidentMeta(type);
  const blurb = familyBlurb(familyId);
  const diff = scenario?.difficulty;
  const floors = scenarioFloorCount(scenario);
  return (
    <Card className={`opboard optile${isNew ? ' opboard-new' : ''}`}>
      {/* The scene: the call type's painted plate behind the type, case number and title. */}
      <div className="optile-top plate optile-scene">
        <PlateArt src={sceneFor(type ?? undefined)} />
        <span className={`optile-badge optile-band-${diff?.band ?? 'none'}`}>
          <Icon name={type ? meta.icon : settingIcon(card.setting)} size={22} />
          {tier !== null && <TierChevrons tier={tier} />}
        </span>
        <div className="optile-main">
          <div className="opboard-head">
            <span className="opboard-kind">{type ? meta.label : card.setting.toUpperCase()}</span>
            <span className="opboard-code mono">{card.code}</span>
          </div>
          <h3 className="opboard-title">{card.title}</h3>
          {blurb && (
            <p className="opboard-where">
              <Icon name={settingIcon(card.setting)} size={13} />
              <span>{blurb}</span>
            </p>
          )}
        </div>
        {isNew && <span className="newbadge stamp stamp-amber">New</span>}
      </div>
      <p className="opboard-summary"><PeopleText text={card.summary} /></p>
      <div className="chips opboard-facts">
        {diff && <DifficultyChip band={diff.band} />}
        <Chip icon="people">{card.squadRange.min === card.squadRange.max ? `${card.squadRange.min} squad` : `${card.squadRange.min}–${card.squadRange.max} squads`}</Chip>
        <FloorsChip floors={floors} />
        {card.variantLabel !== card.title && <Chip>{card.variantLabel}</Chip>}
        {(!scenario) && <Chip icon="clock">{card.pressureLabel}</Chip>}
        {facts}
      </div>
      {scenario?.rewards && <p className="optile-rewards" aria-label={`Pays up to ${money(scenario.rewards.funding)}, ${scenario.rewards.devPoints} development points and ${scenario.rewards.xp} experience. How the call ends sets what it pays.`}>
        <span className="optile-rewards-label" aria-hidden="true">Up to</span>
        <span aria-hidden="true"><Icon name="cash" size={14} />{money(scenario.rewards.funding)}</span>
        <span aria-hidden="true"><Icon name="chart" size={14} />{scenario.rewards.devPoints} DP</span>
        <span aria-hidden="true"><Icon name="star" size={14} />{scenario.rewards.xp} XP</span>
      </p>}
      <BringRow short={short} />
      {warning}
      <div className="optile-foot">{footer}</div>
    </Card>
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
          <Icon name={x.kind === 'cert' ? CERT_ICON[x.id] : itemIcon(x.itemIds[0])} size={13} />{text}
        </span>;
      })}
      {rest.length > 0 && <span className="chip chip-neutral" aria-label={`${rest.length} more short, ${rest.map((x) => shortageText(x).label).join('; ')}`}>+{rest.length}</span>}
    </div>
  );
}
