import { useEffect, useRef } from 'react';
import { useDevelopmentBudget, useGame } from '../store';
import { useDevelopmentPurchase } from '../storefront/useDevelopmentPurchase';
import { nodeOptions } from '../../sim/department-selectors';
import type { NodeOption } from '../../sim/department-selectors';
import type { DevBranch, Id } from '../../sim/types';
import { Button, Chip, EmptyState, Card } from '../components/ui';
import { BRANCHES, BRANCH_META, NODE_STATUS_META } from '../components/labels';
import { Icon } from '../icons';
import { money } from '../format';

export function DevelopScreen({ embedded = false, highlightedNode, highlightRequest }: { embedded?: boolean; highlightedNode?: Id; highlightRequest?: number } = {}) {
  const g = useGame();
  const budget = useDevelopmentBudget();
  const purchases = useDevelopmentPurchase();
  const rootRef = useRef<HTMLDivElement>(null);
  // Combined DP exists only in this read-only preview; saved GameState retains earned DP.
  const preview = { ...g, department: { ...g.department, devPoints: budget.totalDP } };
  const opts = nodeOptions(preview);
  const byId = new Map(opts.map((o) => [o.node.id, o]));
  const dp = budget.totalDP;
  useEffect(() => {
    if (!highlightedNode) return;
    requestAnimationFrame(() => rootRef.current?.querySelector(`[data-development-node="${highlightedNode}"]`)?.scrollIntoView({ block: 'nearest' }));
  }, [highlightedNode, highlightRequest]);

  return (
    <div ref={rootRef} className={embedded ? "store-development" : "page"}>
      <div className="devhead">
        <div>
          <span className="kicker kicker-icon">
            <Icon name="chart" size={14} />
            AVAILABLE DEVELOPMENT POINTS
          </span>
          <strong className="devhead-dp">{Math.floor(dp * 1000) / 1000}</strong>
          <span className="store-dp-breakdown">Earned: {Math.floor(budget.earnedDP * 1000) / 1000} DP · Test: {Math.floor(budget.testDP * 1000) / 1000} DP</span>
        </div>
        <div className="devhead-r">
          <span className="kicker kicker-icon">
            <Icon name="cash" size={14} />
            FUNDING
          </span>
          <strong>{money(g.department.funding)}</strong>
        </div>
      </div>
      <p className="dim">Unlocks spend earned DP first, then allocated test DP. Funding is charged separately. Programs unlock purchases or courses; officers qualify only by completing training.</p>
      {opts.length === 0 && (
        <Card>
          <EmptyState icon="chart" title="No development nodes yet">
            Capabilities appear here as the department grows.
          </EmptyState>
        </Card>
      )}
      {BRANCHES.map((b) => {
        const nodes = sortByDepth(opts.filter((o) => o.node.branch === b), byId);
        return <Branch key={b} branch={b} nodes={nodes} byId={byId} purchases={purchases} earnedDP={budget.earnedDP} highlightedNode={highlightedNode} embedded={embedded} />;
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

type PurchaseApi = ReturnType<typeof useDevelopmentPurchase>;

function Branch({ branch, nodes, byId, purchases, earnedDP, highlightedNode, embedded }: { branch: DevBranch; nodes: NodeOption[]; byId: Map<Id, NodeOption>; purchases: PurchaseApi; earnedDP: number; highlightedNode?: Id; embedded: boolean }) {
  const meta = BRANCH_META[branch];
  const done = nodes.filter((n) => n.status === 'unlocked').length;
  return (
    <section className="branch" aria-labelledby={`${embedded ? 'store-' : ''}b-${branch}`}>
      <header className="branch-head">
        <span className="branch-icon">
          <Icon name={meta.icon} size={22} />
        </span>
        <div>
          <h2 id={`${embedded ? 'store-' : ''}b-${branch}`} className="section-title">
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
            <NodeCard key={n.node.id} o={n} byId={byId} last={i === nodes.length - 1} purchases={purchases} earnedDP={earnedDP} highlighted={highlightedNode === n.node.id} />
          ))}
        </ol>
      )}
    </section>
  );
}

function NodeCard({ o, byId, last, purchases, earnedDP, highlighted }: { o: NodeOption; byId: Map<Id, NodeOption>; last: boolean; purchases: PurchaseApi; earnedDP: number; highlighted: boolean }) {
  const g = useGame();
  const n = o.node;
  return (
    <li data-development-node={n.id} className={`node node-${o.status}${last ? ' node-last' : ''}${highlighted ? ' store-node-highlight' : ''}`}>
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
            <Button size="sm" variant="primary" disabled={o.status !== 'available' || !!o.reason || !!purchases.pendingNode} onClick={() => void purchases.purchase(n.id)}>
              {purchases.pendingNode === n.id ? 'Unlocking…' : 'Unlock'}
            </Button>
          </div>
        )}
        {o.status !== 'unlocked' && earnedDP < n.cost.dp && !o.reason && <p className="dim">Uses {Math.round(Math.max(0, earnedDP) * 1000) / 1000} earned + {Math.round((n.cost.dp - Math.max(0, earnedDP)) * 1000) / 1000} test DP.</p>}
        {purchases.failure?.nodeId === n.id && <p className="reason" role="alert">{purchases.failure.reason}</p>}
        {o.status === 'locked' && o.reason && <p className="reason">{o.reason}</p>}
        {o.status === 'available' && o.reason && <p className="reason">{o.reason}</p>}
      </div>
    </li>
  );
}
