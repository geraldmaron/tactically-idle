import { useGame } from '../store';
import { nodeOptions } from '../../sim/department-selectors';
import type { NodeOption } from '../../sim/department-selectors';
import type { DevBranch, Id } from '../../sim/types';
import { Button, Chip, EmptyState, Card } from '../components/ui';
import { useToast } from '../components/toast';
import { BRANCHES, BRANCH_META, NODE_STATUS_META } from '../components/labels';
import { Icon } from '../icons';
import { money } from '../format';

export function DevelopScreen() {
  const g = useGame();
  const opts = nodeOptions(g);
  const byId = new Map(opts.map((o) => [o.node.id, o]));
  const dp = g.department.devPoints;

  return (
    <div className="page">
      <div className="devhead">
        <div>
          <span className="kicker kicker-icon">
            <Icon name="chart" size={14} />
            DEVELOPMENT POINTS
          </span>
          <strong className="devhead-dp">{Math.floor(dp * 10) / 10}</strong>
        </div>
        <div className="devhead-r">
          <span className="kicker kicker-icon">
            <Icon name="cash" size={14} />
            FUNDING
          </span>
          <strong>{money(g.department.funding)}</strong>
        </div>
      </div>
      {opts.length === 0 && (
        <Card>
          <EmptyState icon="chart" title="No development nodes yet">
            Capabilities appear here as the department grows.
          </EmptyState>
        </Card>
      )}
      {BRANCHES.map((b) => {
        const nodes = sortByDepth(opts.filter((o) => o.node.branch === b), byId);
        return <Branch key={b} branch={b} nodes={nodes} byId={byId} />;
      })}
    </div>
  );
}

function sortByDepth(nodes: NodeOption[], byId: Map<Id, NodeOption>): NodeOption[] {
  const memo = new Map<Id, number>();
  const depth = (id: Id, seen: Set<Id>): number => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return 0;
    const n = byId.get(id);
    if (!n) return 0;
    seen.add(id);
    const d = n.node.requires.length === 0 ? 0 : 1 + Math.max(...n.node.requires.map((r) => depth(r, seen)));
    seen.delete(id);
    memo.set(id, d);
    return d;
  };
  return [...nodes].sort((a, b) => depth(a.node.id, new Set()) - depth(b.node.id, new Set()) || a.node.cost.dp - b.node.cost.dp);
}

function Branch({ branch, nodes, byId }: { branch: DevBranch; nodes: NodeOption[]; byId: Map<Id, NodeOption> }) {
  const meta = BRANCH_META[branch];
  const done = nodes.filter((n) => n.status === 'unlocked').length;
  return (
    <section className="branch" aria-labelledby={`b-${branch}`}>
      <header className="branch-head">
        <span className="branch-icon">
          <Icon name={meta.icon} size={22} />
        </span>
        <div>
          <h2 id={`b-${branch}`} className="section-title">
            {meta.label}
          </h2>
          <span className="dim">{meta.blurb}</span>
        </div>
        <Chip tone={done === nodes.length && nodes.length > 0 ? 'mint' : 'neutral'}>
          {done}/{nodes.length}
        </Chip>
      </header>
      {nodes.length === 0 ? (
        <p className="dim branch-empty">Nothing here yet.</p>
      ) : (
        <ol className="rail">
          {nodes.map((n, i) => (
            <NodeCard key={n.node.id} o={n} byId={byId} last={i === nodes.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}

function NodeCard({ o, byId, last }: { o: NodeOption; byId: Map<Id, NodeOption>; last: boolean }) {
  const g = useGame();
  const { act } = useToast();
  const n = o.node;
  return (
    <li className={`node node-${o.status}${last ? ' node-last' : ''}`}>
      <span className="node-dot" aria-hidden="true">
        {o.status === 'unlocked' ? <Icon name="check" size={12} strokeWidth={3} /> : o.status === 'locked' ? <Icon name="lock" size={11} /> : <Icon name="unlock" size={11} />}
      </span>
      <div className="node-card">
        <div className="node-top">
          <strong className="node-name">{n.name}</strong>
          <Chip tone={NODE_STATUS_META[o.status].tone} icon={NODE_STATUS_META[o.status].icon}>
            {NODE_STATUS_META[o.status].label}
          </Chip>
        </div>
        <p className="node-desc">{n.description}</p>
        {o.effects.length > 0 && (
          <ul className="bullets node-effects">
            {o.effects.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {n.requires.length > 0 && (
          <p className="node-req">
            <span className="dim">Needs</span>{' '}
            {n.requires.map((r) => {
              const done = g.department.unlockedNodes.includes(r);
              return (
                <span key={r} className={`req${done ? ' req-done' : ''}`}>
                  <Icon name={done ? 'check' : 'lock'} size={12} />
                  {byId.get(r)?.node.name ?? r}
                </span>
              );
            })}
          </p>
        )}
        {o.status !== 'unlocked' && (
          <div className="node-foot">
            <span className="node-cost">
              <Chip icon="chart">{n.cost.dp} DP</Chip>
              {n.cost.funding > 0 && <Chip icon="cash">{money(n.cost.funding)}</Chip>}
            </span>
            <Button size="sm" variant="primary" disabled={o.status !== 'available'} onClick={() => act({ type: 'unlockNode', nodeId: n.id }, `${n.name} unlocked`)}>
              Unlock
            </Button>
          </div>
        )}
        {o.status === 'locked' && o.reason && <p className="reason">{o.reason}</p>}
        {o.status === 'available' && o.reason && <p className="reason">{o.reason}</p>}
      </div>
    </li>
  );
}
