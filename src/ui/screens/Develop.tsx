// "All upgrades": the plain index of every development, grouped by room, folded below the room cards on
// Build. It exists so a player can find any step by name; the rooms (build/RoomSheet.tsx) are where steps
// are read and bought. Backlog P4 removes it once prerequisite discovery and return-to-item are proven.
import type { NodeOption } from '../../sim/department-selectors';
import type { Id } from '../../sim/types';
import { Row } from '../components/ui';
import { CostTag } from './build-parts';
import { NodeGlyph } from './build/NodeGlyph';
import { nodeSummary, stepQuote, stepState, type RoomView } from './build/room-model';
import './development.css';

export function UpgradeIndex({ views, funding, onOpen }: { views: readonly RoomView[]; funding: number; onOpen: (nodeId: Id) => void }) {
  return <div className="upgrade-index">{views.map((view) => <section key={view.room.id} aria-label={view.room.name}>
    <h3 className="upgrade-room">{view.room.name}</h3>
    <div className="card" data-ui-list>{view.options.map((o) => <UpgradeRow key={o.node.id} option={o} funding={funding} onOpen={() => onOpen(o.node.id)} />)}</div>
  </section>)}</div>;
}

function UpgradeRow({ option: o, funding, onOpen }: { option: NodeOption; funding: number; onOpen: () => void }) {
  const state = stepState(o);
  const quote = stepQuote(o, funding);
  const needs = quote.blocker && state === 'locked' ? quote.blocker : nodeSummary(o);
  return <Row className="upgrade-row" data={{ 'data-development-node': o.node.id, 'data-state': state }}
    lead={<span className="upgrade-glyph"><NodeGlyph option={o} size={32} /></span>}
    title={o.node.name} detail={needs} trail={<CostTag part="value" quote={quote} />}
    label={`${o.node.name}. ${state === 'owned' ? 'Built' : state === 'locked' ? quote.blocker : state === 'ready' ? 'Ready to build' : 'Needs funding'}. ${nodeSummary(o)}`}
    onClick={onOpen} />;
}
