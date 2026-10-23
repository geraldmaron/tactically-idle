import { useNav } from '../components/nav';
import { Row } from '../components/ui';
import { DEV_NODES } from '../../content/dev-tree';
import { CostTag, Segments, type CostQuote } from './build-parts';
import { Icon, type IconName } from '../icons';
import { DevelopScreen, nextDevelopment } from './Develop';
import { employedPatrol, patrolCapacity } from '../../sim/patrol';
import { nodeOptions } from '../../sim/department-selectors';
import type { DevBranch, Id } from '../../sim/types';
import { useGame } from '../store';
import { Disclosure } from '../components/Disclosure';
import { GearArt } from '../art/GearArt';
import { PlateArt, plateUrl } from '../art/Plates';
import { money } from '../format';
import './build.css';

const FACILITIES: { branch: DevBranch; name: string; icon: IconName; item?: Id }[] = [
  { branch: 'personnel', name: 'Personnel office', icon: 'desk' },
  { branch: 'field', name: 'Training floor', icon: 'shooting' },
  { branch: 'intel', name: 'Information room', icon: 'binoculars', item: 'thermal_imager' },
  { branch: 'wellbeing', name: 'Recovery room', icon: 'bed' },
  { branch: 'logistics', name: 'Equipment bay', icon: 'van', item: 'support_van' },
];

/** Department facilities and development. Equipment purchases live in the Store. */
export function BuildScreen() {
  const nav = useNav();
  const game = useGame();
  const options = nodeOptions(game);
  const capacity = patrolCapacity(game);
  const next = game.department.level < 3 ? { level: 3, positions: 8 } : game.department.level < 6 ? { level: 6, positions: 12 } : null;
  return <div className="page facility-build-page">
    <h1 className="section-title build-title"><Icon name="build" size={24} />Build</h1>
    <section className="facility-plan" aria-label="Department facility plan">
      <div className="facility-plan-scene plate" aria-hidden="true"><PlateArt src={plateUrl('scene_facilities_plan')} /></div>
      <h2 className="facility-plan-label"><Icon name="build" size={16} />Department plan</h2>
      <div className="facility-building card" data-ui-list>
        {FACILITIES.map((facility) => {
          const branch = options.filter((option) => option.node.branch === facility.branch);
          const option = nextDevelopment(branch) ?? branch.find((row) => row.targetTier) ?? branch[0];
          if (!option) return null;
          const complete = branch.filter((row) => !row.targetTier).length;
          const cost = option.quote.cost?.funding;
          const locked = option.status === 'locked';
          const missing = option.quote.missingPrerequisites.map((id) => DEV_NODES[id]?.name ?? id);
          const quote: CostQuote = !option.targetTier ? { state: 'owned', done: 'Complete' }
            : { state: locked ? 'locked' : option.quote.ok ? 'ready' : 'short', price: cost ?? null, blocker: locked ? `Needs ${missing.join(' and ')}` : option.quote.ok ? undefined : 'Needs funding' };
          return <Row key={facility.branch} className={`facility-room facility-room-${facility.branch}${option.quote.ok ? ' facility-room-ready' : ''}`}
            onClick={() => nav.openDevelopment(option.node.id)}
            label={`${facility.name}. ${complete} of ${branch.length} improvements complete. ${option.node.name}${cost ? `, ${money(cost)}` : ''}. ${option.quote.ok ? 'Available to improve' : option.reason ?? 'Complete'}`}
            lead={<span className="facility-object" aria-hidden="true">{facility.item ? <GearArt itemId={facility.item} size={40} /> : <Icon name={facility.icon} size={24} />}</span>}
            title={facility.name}
            detail={<span className="facility-detail"><Segments done={complete} total={branch.length} /><span>{complete}/{branch.length} · {option.node.name}</span></span>}
            trail={<CostTag quote={quote} />} />;
        })}
      </div>
    </section>
    <section className="build-capacity" aria-label="Patrol positions">
      <Row className="facility-patrol" lead={<span className="facility-object" aria-hidden="true"><Icon name="people" size={24} /></span>}
        title={`${employedPatrol(game).length} / ${capacity} patrol positions filled`}
        detail={<span className="facility-detail facility-detail-wrap"><Segments done={employedPatrol(game).length} total={capacity} /><span>Department level {game.department.level} · {next ? `${next.positions} positions at department level ${next.level}` : 'All 12 patrol positions authorized'}</span></span>} />
    </section>
    <Disclosure name="all-department-upgrades" summary="All upgrades" icon="build">
      <DevelopScreen highlightedNode={nav.developmentNode} highlightRequest={nav.developmentRequest} openHighlighted />
    </Disclosure>
  </div>;
}
