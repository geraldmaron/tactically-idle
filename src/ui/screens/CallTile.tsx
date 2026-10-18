// A call's board card (moved from OpsBoard), rendered from props alone so the Scenario Lab shows
// the player's real card. Store-free. Its styles are app.css and ops-visual.css, which the board
// (and the lab's frame) load; importing them here would move them in the game's cascade.
import type { JSX, ReactNode } from 'react';
import type { ScenarioCard } from '../../sim/operation-selectors';
import type { IncidentType, ScenarioDefinition } from '../../sim/scenario-types';
import { Card, Chip } from '../components/ui';
import { DifficultyChip, FloorsChip, TierChevrons, familyBlurb, incidentMeta, scenarioFloorCount, settingIcon } from '../components/incident';
import { Icon } from '../icons';
import { PeopleText } from '../people/PeopleText';

/** A compact call tile: a type badge with tier pips, the title and place, a two-line summary, a fact
 * row and a footer with the time left and Prepare. The full brief lives on the Prepare screen.
 * The board also passes legacy cards, which can lack a scenario, family, type or tier. */
export function CallTile({ card, scenario, familyId, type, tier, isNew = false, facts, footer, warning }: { card: ScenarioCard; scenario: ScenarioDefinition | null; familyId: string | null; type: IncidentType | string | null; tier: number | null;
  isNew?: boolean; facts?: ReactNode; footer?: ReactNode; warning?: ReactNode }): JSX.Element {
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
      <p className="opboard-summary"><PeopleText text={card.summary} /></p>
      <div className="chips opboard-facts">
        {diff && <DifficultyChip band={diff.band} />}
        <Chip icon="people">{card.squadRange.min === card.squadRange.max ? `${card.squadRange.min} squad` : `${card.squadRange.min}–${card.squadRange.max} squads`}</Chip>
        <FloorsChip floors={floors} />
        {card.variantLabel !== card.title && <Chip>{card.variantLabel}</Chip>}
        {(!scenario) && <Chip icon="clock">{card.pressureLabel}</Chip>}
        {facts}
      </div>
      {warning}
      <div className="optile-foot">{footer}</div>
    </Card>
  );
}
