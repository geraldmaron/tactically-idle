import { useEffect, useRef, useState } from 'react';
import { DEV_NODES } from '../../content/dev-tree';
import { COURSES } from '../../content/courses';
import { describeEffect } from '../../sim/develop';
import { nodeOptions, type NodeOption } from '../../sim/department-selectors';
import { developmentTierDefinition, tierLabel } from '../../sim/development-tiers';
import type { DevBranch, Id } from '../../sim/types';
import { PointPacks } from '../components/PointPacks';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { Button, Chip, EmptyState } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { BRANCHES, BRANCH_META } from '../components/labels';
import { Icon } from '../icons';
import { moneyFull as money, money as compactMoney } from '../format';
import { useDevelopmentBudget, useGame } from '../store';
import { useDevelopmentPurchase } from '../storefront/useDevelopmentPurchase';
import './development.css';

export type DevelopmentFilter = 'all' | 'available' | 'owned';
export function filterDevelopmentOptions(options: NodeOption[], branch: DevBranch | 'all', filter: DevelopmentFilter): NodeOption[] {
  return options.filter((option) => (branch === 'all' || option.node.branch === branch)
    && (filter === 'all' || (filter === 'owned' ? option.currentTier > 0 : option.quote.ok)));
}

export function DevelopScreen({ highlightedNode, highlightRequest }: { highlightedNode?: Id; highlightRequest?: number }) {
  const [pointsOpen, setPointsOpen] = useState(false);
  const [branch, setBranch] = useState<DevBranch | 'all'>('all');
  const [filter, setFilter] = useState<DevelopmentFilter>('all');
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [purchased, setPurchased] = useState<{ nodeId: Id; tier: number } | null>(null);
  const g = useGame();
  const budget = useDevelopmentBudget();
  const purchases = useDevelopmentPurchase();
  const rootRef = useRef<HTMLDivElement>(null);
  // Combined DP is a preview only; persisted state retains earned DP separately.
  const preview = { ...g, department: { ...g.department, devPoints: budget.totalDP } };
  const options = nodeOptions(preview);
  const filtered = filterDevelopmentOptions(options, branch, filter);
  const selected = options.find((option) => option.node.id === selectedId);

  useEffect(() => {
    if (!highlightedNode || !DEV_NODES[highlightedNode]) return;
    setBranch('all');
    setFilter('all');
    setSelectedId(null);
    setPurchased(null);
    const frame = requestAnimationFrame(() => {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-development-node="${highlightedNode}"]`);
      target?.scrollIntoView({ block: 'nearest' });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [highlightedNode, highlightRequest]);

  return <div ref={rootRef} className="page develop-page">
    <header className="development-balance">
      <h2 className="section-title">Department development</h2>
      <div className="development-balance-row"><div className="chips"><Chip icon="chart">{Math.floor(budget.totalDP * 100) / 100} DP</Chip><Chip icon="cash">{compactMoney(g.department.funding)}</Chip></div>
        <Button size="sm" onClick={() => setPointsOpen(true)}>Get Points</Button></div>
    </header>
    <p className="dim development-intro">Upgrade services or unlock equipment and courses.</p>
    <PointPacks open={pointsOpen} onClose={() => setPointsOpen(false)} />
    <ChoiceRail value={branch} onChange={setBranch} label="Development branches" options={[
      { value: 'all', label: 'All branches' }, ...BRANCHES.map((id) => ({ value: id, label: <><Icon name={BRANCH_META[id].icon} size={16} />{BRANCH_META[id].label}</> })),
    ]} />
    <ChoiceRail value={filter} onChange={setFilter} label="Development ownership" grow options={[
      { value: 'all', label: 'All' }, { value: 'available', label: 'Available' }, { value: 'owned', label: 'Owned' },
    ]} />
    <p className="dim development-count" role="status">{filtered.length} developments{filter === 'available' ? ' ready to buy' : filter === 'owned' ? ' owned' : ''}</p>
    {!filtered.length && <EmptyState icon="chart" title="No developments match">Choose another branch or show all developments.</EmptyState>}
    {BRANCHES.map((id) => {
      const nodes = filtered.filter((option) => option.node.branch === id);
      return nodes.length ? <section key={id} className="development-branch" aria-labelledby={`b-${id}`}>
        <h2 id={`b-${id}`} className="section-title"><Icon name={BRANCH_META[id].icon} size={18} /> {BRANCH_META[id].label}</h2>
        <div className="development-cards">{nodes.map((option) => <DevelopmentCard key={option.node.id} option={option} highlighted={highlightedNode === option.node.id} onOpen={() => { setSelectedId(option.node.id); setPurchased(null); }} />)}</div>
      </section> : null;
    })}
    {selected && <DevelopmentDetail option={selected} onClose={() => setSelectedId(null)} pending={!!purchases.pendingNode}
      failure={purchases.failure?.nodeId === selected.node.id ? purchases.failure.reason : null}
      purchasedTier={purchased?.nodeId === selected.node.id ? purchased.tier : null}
      onPurchase={async () => {
        const target = selected.targetTier;
        if (!target) return;
        const result = await purchases.purchase(selected.node.id, target);
        if (result?.ok) setPurchased({ nodeId: selected.node.id, tier: target });
      }} />}
  </div>;
}

export function DevelopmentCard({ option: o, highlighted, onOpen }: { option: NodeOption; highlighted: boolean; onOpen: () => void }) {
  const label = o.maxTier > 1 ? o.currentTier ? `Tier ${tierLabel(o.currentTier)} / ${tierLabel(o.maxTier)}` : 'Not owned' : o.currentTier ? 'Owned' : 'Not owned';
  return <article tabIndex={highlighted ? -1 : undefined} data-development-node={o.node.id} className={`development-card node-${o.status}${highlighted ? ' store-node-highlight' : ''}`}>
    <div className="node-top"><h3 className="node-name">{o.node.name}</h3><Chip tone={o.currentTier ? 'mint' : 'neutral'}>{label}</Chip></div>
    <p className="development-benefit"><span className="dim">{o.targetTier ? o.maxTier > 1 ? `Next · Tier ${tierLabel(o.targetTier)}` : 'Unlocks' : 'Current'}</span><br />{o.effects.join(' · ')}</p>
    <div className="node-foot">
      {o.quote.cost ? <span className="node-cost"><Chip icon="chart">{o.quote.cost.dp} DP</Chip><Chip icon="cash">{money(o.quote.cost.funding)}</Chip></span> : <span className="dim">{o.maxTier > 1 ? 'Maximum tier' : 'One-time program owned'}</span>}
      <Button size="sm" onClick={onOpen} aria-label={`${o.targetTier ? 'Upgrade' : 'View'} ${o.node.name}`}>{o.targetTier ? 'Upgrade' : 'Details'}</Button>
    </div>
    {o.reason && <p className="reason">{o.reason}</p>}
  </article>;
}

export function DevelopmentDetail({ option: o, onClose, pending, failure, purchasedTier, onPurchase }: {
  option: NodeOption; onClose: () => void; pending: boolean; failure: string | null; purchasedTier: number | null; onPurchase: () => void;
}) {
  const nav = useNav();
  const currentLabel = o.currentTier ? o.maxTier > 1 ? `Tier ${tierLabel(o.currentTier)}` : 'Owned' : 'Not owned';
  const nextLabel = o.targetTier ? o.maxTier > 1 ? `Tier ${tierLabel(o.targetTier)}` : 'Owned' : o.maxTier > 1 ? 'Maximum tier' : 'Complete';
  const baseline: Record<string, string[]> = {
    personnel_academy: ['1 total training slot'],
    intel_records: ['$0/h records funding'],
    wellbeing_peer_support: ['Standard stress recovery (x1)'],
    logistics_equipment_manager: ['Standard repair prices and reusable-gear wear', 'Automatic servicing unavailable'],
  };
  const allEffects = o.node.tiers?.flatMap((tier) => tier.effects) ?? o.node.effects;
  const training = allEffects.some((effect) => effect.kind === 'unlockCourse' || effect.kind === 'trainingSlots');
  const gear = allEffects.some((effect) => ['unlockItem', 'equipmentManager', 'loadoutPresets', 'restockRules'].includes(effect.kind));
  const trainingCourse = allEffects.find((effect) => effect.kind === 'unlockCourse');
  const gearItem = allEffects.find((effect) => effect.kind === 'unlockItem');
  return <Sheet open onClose={onClose} title={o.node.name} subtitle={BRANCH_META[o.node.branch].label} className="development-sheet" footer={
    o.targetTier && o.quote.cost ? <div className="development-purchase">
      <strong>{o.quote.cost.dp} DP + {money(o.quote.cost.funding)} funding</strong>
      <Button variant="primary" disabled={!o.quote.ok || pending} onClick={onPurchase}>{pending ? 'Upgrading…' : o.maxTier > 1 ? `Upgrade to tier ${tierLabel(o.targetTier)}` : 'Unlock program'}</Button>
    </div> : <p className="dim">{o.maxTier > 1 ? 'Maximum tier reached. All listed benefits are active.' : 'Program owned. Its unlocks are active.'}</p>
  }>
    <div className="stack development-detail">
      <p className="dim">{o.node.description}</p>
      {purchasedTier !== null && <p className="development-success" role="status">{o.maxTier > 1 ? `Tier ${tierLabel(purchasedTier)} purchased` : 'Program unlocked'}. Your department now has the current benefits below.</p>}
      <div className="development-comparison" aria-label="Current to next benefits">
        <section><h3>Current · {currentLabel}</h3><EffectList effects={o.currentEffects.length ? o.currentEffects : baseline[o.node.id] ?? ['No benefits from this development yet']} /></section>
        <span className="development-arrow" aria-hidden="true">→</span>
        <section><h3>Next · {nextLabel}</h3><EffectList effects={o.targetTier ? o.effects : [o.maxTier > 1 ? 'All tiers complete' : 'Program unlocks active']} /></section>
      </div>
      <section className="development-prerequisites"><h3>Prerequisites</h3>{o.node.requires.length ? <ul className="bullets">{o.node.requires.map((id) => <li key={id}>{DEV_NODES[id]?.name ?? id} · {o.quote.missingPrerequisites.includes(id) ? 'Required' : 'Owned'}</li>)}</ul> : <p className="dim">None</p>}</section>
      {o.maxTier > 1 && <section><h3>Tier ladder</h3><p className="dim">Each price buys one tier. Benefits shown are the total at that tier.</p><ol className="development-ladder">{Array.from({ length: o.maxTier }, (_, index) => {
        const tier = index + 1;
        const definition = developmentTierDefinition(o.node, tier)!;
        return <li key={tier} aria-current={o.currentTier === tier ? 'step' : undefined}><div className="node-top"><strong>Tier {tierLabel(tier)}</strong><Chip tone={o.currentTier >= tier ? 'mint' : tier === o.targetTier ? 'amber' : 'neutral'}>{o.currentTier === tier ? 'Current' : o.currentTier > tier ? 'Owned' : tier === o.targetTier ? 'Next' : 'Later'}</Chip></div><EffectList effects={definition.effects.map(describeEffect)} /><span className="dim">{definition.cost.dp} DP + {money(definition.cost.funding)} funding</span></li>;
      })}</ol></section>}
      {(training || gear) && <div className="row-actions">
        {training && <Button onClick={() => { onClose(); nav.openTraining(trainingCourse ? { certId: COURSES[trainingCourse.courseId]?.grants.cert } : undefined); }}>Open Training</Button>}
        {gear && <Button onClick={() => { onClose(); if (gearItem) nav.openEquipment({ itemId: gearItem.itemId }); else nav.setGearSection('inventory'); }}>Open Gear</Button>}
      </div>}
      {o.reason && <p className="reason">{o.reason}</p>}
      {failure && <p className="reason" role="alert">{failure}</p>}
    </div>
  </Sheet>;
}

function EffectList({ effects }: { effects: string[] }) {
  return <ul className="bullets development-effects">{effects.map((effect, index) => <li key={index}>{effect}</li>)}</ul>;
}
