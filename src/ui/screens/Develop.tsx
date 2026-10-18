import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { DEV_NODES } from '../../content/dev-tree';
import { COURSES } from '../../content/courses';
import { ITEMS } from '../../content/items';
import { describeEffect } from '../../sim/develop';
import { nodeOptions, type NodeOption } from '../../sim/department-selectors';
import { developmentTierDefinition, tierLabel } from '../../sim/development-tiers';
import type { DevBranch, Id } from '../../sim/types';
import { PointPacks } from '../components/PointPacks';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { Button } from '../components/ui';
import { ChoiceRail } from '../components/ChoiceRail';
import { BRANCHES, BRANCH_META } from '../components/labels';
import { Icon } from '../icons';
import { GearArt } from '../art/GearArt';
import { moneyFull as money, money as compactMoney } from '../format';
import { useDevelopmentBudget, useGame } from '../store';
import { useDevelopmentPurchase } from '../storefront/useDevelopmentPurchase';
import './development.css';

export type DevelopmentFilter = 'all' | 'available' | 'owned';
export function filterDevelopmentOptions(options: NodeOption[], branch: DevBranch | 'all', filter: DevelopmentFilter): NodeOption[] {
  return options.filter((option) => (branch === 'all' || option.node.branch === branch)
    && (filter === 'all' || (filter === 'owned' ? option.currentTier > 0 : option.quote.ok)));
}

/** What the player has to spend; tiles mark the resource that falls short. */
export interface DevelopmentBudget { dp: number; funding: number }

export function DevelopScreen({ highlightedNode, highlightRequest }: { highlightedNode?: Id; highlightRequest?: number }) {
  const [pointsOpen, setPointsOpen] = useState(false);
  const [branch, setBranch] = useState<DevBranch | 'all'>('all');
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [purchased, setPurchased] = useState<{ nodeId: Id; tier: number } | null>(null);
  const g = useGame();
  const budget = useDevelopmentBudget();
  const purchases = useDevelopmentPurchase();
  const rootRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const columns = useTileColumns(treeRef);
  // Combined DP is a preview only; persisted state retains earned DP separately.
  const preview = { ...g, department: { ...g.department, devPoints: budget.totalDP } };
  const options = nodeOptions(preview);
  const wallet: DevelopmentBudget = { dp: budget.totalDP, funding: g.department.funding };
  const ready = filterDevelopmentOptions(options, branch, 'available');
  const selected = options.find((option) => option.node.id === selectedId);
  const open = (id: Id) => { setSelectedId(id); setPurchased(null); };
  const progress = (id: DevBranch | 'all') => {
    const scoped = options.filter((option) => id === 'all' || option.node.branch === id);
    return { owned: scoped.filter((option) => option.currentTier > 0).length, total: scoped.length };
  };

  useEffect(() => {
    if (!highlightedNode || !DEV_NODES[highlightedNode]) return;
    setBranch('all');
    setSelectedId(null);
    setPurchased(null);
    const frame = requestAnimationFrame(() => {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-development-node="${highlightedNode}"]`);
      target?.scrollIntoView({ block: 'nearest' });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [highlightedNode, highlightRequest]);

  const dpShown = Math.floor(budget.totalDP * 100) / 100;
  return <div ref={rootRef} className="page develop-page">
    <header className="dev-head">
      <h2 className="sr-only">Department development</h2>
      <span className="dev-stat" aria-label={`${dpShown} development points`}><Icon name="chart" size={16} /><b>{dpShown}</b><small>DP</small></span>
      <span className="dev-stat" aria-label={`${money(g.department.funding)} funding`}><Icon name="cash" size={16} /><b>{compactMoney(g.department.funding)}</b></span>
      <Button size="sm" className="dev-get" icon="plus" onClick={() => setPointsOpen(true)}>Get Points</Button>
    </header>
    <PointPacks open={pointsOpen} onClose={() => setPointsOpen(false)} />
    <ChoiceRail value={branch} onChange={setBranch} label="Development branches" options={(['all', ...BRANCHES] as const).map((id) => {
      const { owned, total } = progress(id);
      const name = id === 'all' ? 'All' : BRANCH_META[id].label;
      return { value: id, accessibleLabel: `${name}, ${owned} of ${total} owned`,
        label: <>{id !== 'all' && <Icon name={BRANCH_META[id].icon} size={16} />}{name}<span className="choice-rail-count">{owned}/{total}</span></> };
    })} />
    <section className="dev-ready" aria-labelledby="dev-ready-title">
      <h3 id="dev-ready-title" className="dev-label">Ready to buy <span className="dev-label-count">{ready.length}</span></h3>
      {ready.length ? <ul className="dev-ready-list">{ready.map((option) => <li key={option.node.id}>
        <button type="button" className="dev-ready-item" onClick={() => open(option.node.id)}
          aria-label={`${option.node.name}, ${costText(option)}`}>
          <NodeGlyph option={option} size={26} />
          <span className="dev-ready-name">{option.node.name}{option.maxTier > 1 && option.targetTier ? ` ${tierLabel(option.targetTier)}` : ''}</span>
          {option.quote.cost && <span className="dev-ready-cost">{option.quote.cost.dp} DP · {compactMoney(option.quote.cost.funding)}</span>}
        </button>
      </li>)}</ul> : <p className="dev-ready-empty">Nothing yet. Calls earn DP and funding.</p>}
    </section>
    <div ref={treeRef} className="dev-branches">
      {BRANCHES.filter((id) => branch === 'all' || branch === id).map((id) => {
        const nodes = options.filter((option) => option.node.branch === id);
        const cells = layoutBranch(nodes, columns);
        const { owned, total } = progress(id);
        return <section key={id} className="dev-branch" aria-labelledby={`dev-b-${id}`}>
          <h3 id={`dev-b-${id}`} className="dev-branch-title"><Icon name={BRANCH_META[id].icon} size={16} />{BRANCH_META[id].label}
            <span className="dev-branch-bar" aria-hidden="true"><i style={{ width: `${total ? (owned / total) * 100 : 0}%` }} /></span>
            <span className="dev-branch-count" aria-label={`${owned} of ${total} owned`}>{owned}/{total}</span></h3>
          <ol className="dev-grid" style={{ '--dev-cols': columns } as CSSProperties}>
            {cells.map((cell) => <li key={cell.option.node.id} style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}>
              <DevelopmentTile option={cell.option} link={cell.link} budget={wallet} highlighted={highlightedNode === cell.option.node.id} onOpen={() => open(cell.option.node.id)} />
            </li>)}
          </ol>
        </section>;
      })}
    </div>
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

const TILE_MIN = 76;
const TILE_GAP = 10;
/** Columns that keep every tile at least TILE_MIN wide: three at 320, four at 390. */
export function tileColumns(width: number): number {
  return Math.max(3, Math.min(5, Math.floor((width + TILE_GAP) / (TILE_MIN + TILE_GAP))));
}
function useTileColumns(ref: RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(4);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => { if (element.clientWidth) setColumns(tileColumns(element.clientWidth)); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

export interface TreeCell { option: NodeOption; row: number; col: number; link: 'left' | 'up' | null }
/**
 * Lays a branch out as a small tech tree on a fixed grid. Each prerequisite chain runs left to right
 * along its longest path; a second child sits directly under its parent. Larger chains go first and
 * stand-alone programs fill the gaps, so a branch takes one or two rows on a phone.
 */
export function layoutBranch(nodes: NodeOption[], columns: number): TreeCell[] {
  const ids = new Set(nodes.map((option) => option.node.id));
  const parentOf = (option: NodeOption) => option.node.requires.find((id) => ids.has(id)) ?? null;
  const childrenOf = (id: Id) => nodes.filter((option) => parentOf(option) === id);
  const height = (option: NodeOption): number => 1 + Math.max(0, ...childrenOf(option.node.id).map(height));
  const groups = nodes.filter((option) => parentOf(option) === null).map((root, index) => {
    const main: NodeOption[] = [];
    for (let at: NodeOption | undefined = root; at; at = [...childrenOf(at.node.id)].sort((a, b) => height(b) - height(a))[0]) main.push(at);
    const side: NodeOption[] = [];
    const collect = (option: NodeOption) => { for (const child of childrenOf(option.node.id)) { if (!main.includes(child)) side.push(child); collect(child); } };
    collect(root);
    return { main, side, index };
  }).sort((a, b) => (b.main.length + b.side.length) - (a.main.length + a.side.length) || a.index - b.index);

  const taken = new Set<string>();
  const free = (row: number, col: number) => col >= 0 && col < columns && !taken.has(`${row}:${col}`);
  const at = new Map<Id, { row: number; col: number }>();
  const cells: Omit<TreeCell, 'link'>[] = [];
  const put = (option: NodeOption, row: number, col: number) => { taken.add(`${row}:${col}`); at.set(option.node.id, { row, col }); cells.push({ option, row, col }); };
  const firstFree = () => { for (let row = 0; ; row++) for (let col = 0; col < columns; col++) if (free(row, col)) return { row, col }; };
  for (const group of groups) {
    const run = Math.min(group.main.length, columns);
    const underMain = group.side.filter((option) => group.main.slice(0, run).some((parent) => parent.node.id === parentOf(option)));
    let slot: { row: number; col: number } | null = null;
    for (let row = 0; !slot; row++) for (let col = 0; col + run <= columns && !slot; col++) {
      const fits = Array.from({ length: run }, (_, index) => free(row, col + index)).every(Boolean)
        && underMain.every((option) => free(row + 1, col + group.main.findIndex((parent) => parent.node.id === parentOf(option))));
      if (fits) slot = { row, col };
    }
    group.main.forEach((option, index) => {
      if (index < run) put(option, slot!.row, slot!.col + index);
      else { const spot = firstFree(); put(option, spot.row, spot.col); }
    });
    for (const option of group.side) {
      const parent = at.get(parentOf(option)!)!;
      const spot = free(parent.row + 1, parent.col) ? { row: parent.row + 1, col: parent.col } : firstFree();
      put(option, spot.row, spot.col);
    }
  }
  return cells.sort((a, b) => a.row - b.row || a.col - b.col).map((cell) => {
    const parentId = parentOf(cell.option);
    const parent = parentId ? at.get(parentId) : undefined;
    const link = !parent ? null : parent.row === cell.row && parent.col === cell.col - 1 ? 'left' : parent.col === cell.col && parent.row === cell.row - 1 ? 'up' : null;
    return { ...cell, link };
  });
}

/** Gear art when a development unlocks equipment, else a course or branch symbol. */
function NodeGlyph({ option: o, size }: { option: NodeOption; size: number }) {
  const item = o.node.effects.find((effect): effect is Extract<typeof effect, { kind: 'unlockItem' }> => effect.kind === 'unlockItem');
  const course = o.node.effects.some((effect) => effect.kind === 'unlockCourse');
  return <span className="dev-glyph" aria-hidden="true">{item ? <GearArt itemId={item.itemId} size={size} /> : <Icon name={course ? 'mortarboard' : BRANCH_META[o.node.branch].icon} size={Math.round(size * 0.66)} />}</span>;
}

/** Long program names drop the trailing "program" on the tile; the full name stays in the label and sheet. */
const TILE_NAMES: Record<string, string> = { logistics_presets: 'Saved sets', logistics_armored_support: 'Armored rescue' };
export function tileName(id: Id, name: string): string {
  return TILE_NAMES[id] ?? (name.split(' ').length > 2 ? name.replace(/ program$/i, '') : name);
}

function costText(o: NodeOption): string {
  return o.quote.cost ? `costs ${o.quote.cost.dp} DP and ${money(o.quote.cost.funding)}` : '';
}

export type TileState = 'owned' | 'ready' | 'short' | 'locked';
export function tileState(o: NodeOption): TileState {
  if (!o.targetTier) return 'owned';
  if (o.status === 'locked') return 'locked';
  return o.reason ? 'short' : 'ready';
}

export function DevelopmentTile({ option: o, link = null, budget, highlighted, onOpen }: {
  option: NodeOption; link?: TreeCell['link']; budget: DevelopmentBudget; highlighted: boolean; onOpen: () => void;
}) {
  const state = tileState(o);
  const tiered = o.maxTier > 1;
  const cost = o.quote.cost;
  const shortDp = !!cost && budget.dp < cost.dp;
  const shortFunding = !!cost && budget.funding < cost.funding;
  const extra = o.node.effects.filter((effect) => effect.kind === 'unlockItem').length - 1;
  const needs = o.quote.missingPrerequisites.map((id) => DEV_NODES[id]?.name ?? id);
  const label = [
    o.node.name,
    state === 'owned' ? (tiered ? 'Fully upgraded' : 'Owned') : state === 'locked' ? `Locked, needs ${needs.join(' and ')}` : state === 'ready' ? 'Ready to buy' : `Needs more ${[shortDp && 'DP', shortFunding && 'funding'].filter(Boolean).join(' and ')}`,
    tiered ? `Tier ${o.currentTier} of ${o.maxTier}` : '',
    cost ? `Next ${costText(o)}` : '',
  ].filter(Boolean).join('. ');
  return <button type="button" data-development-node={o.node.id} data-state={state} data-link={link ?? undefined}
    className={`dev-tile${o.currentTier > 0 ? ' dev-tile-progress' : ''}${highlighted ? ' store-node-highlight' : ''}`}
    aria-label={label} onClick={onOpen}>
    <span className="dev-medal">
      <NodeGlyph option={o} size={38} />
      {extra > 0 && <span className="dev-medal-more">+{extra}</span>}
      {state === 'owned' && <span className="dev-medal-badge dev-badge-owned"><Icon name="check" size={11} strokeWidth={3} /></span>}
      {state === 'locked' && <span className="dev-medal-badge dev-badge-locked"><Icon name="lock" size={11} /></span>}
    </span>
    <span className="dev-tile-name">{tileName(o.node.id, o.node.name)}</span>
    {tiered && <span className="dev-pips" aria-hidden="true">{Array.from({ length: o.maxTier }, (_, index) => <i key={index} data-on={index < o.currentTier ? 'yes' : undefined} />)}</span>}
    {cost ? <span className="dev-cost" aria-hidden="true"><span data-short={shortDp ? 'yes' : undefined}>{cost.dp} DP</span><span data-short={shortFunding ? 'yes' : undefined}>{compactMoney(cost.funding)}</span></span>
      : <span className="dev-cost dev-cost-done" aria-hidden="true">{tiered ? 'Max' : 'Owned'}</span>}
  </button>;
}

const BASELINE: Record<string, string[]> = {
  personnel_academy: ['1 total training slot'],
  intel_records: ['$0/h records funding'],
  wellbeing_peer_support: ['Standard stress recovery (x1)'],
  logistics_equipment_manager: ['Standard repair prices and reusable-gear wear', 'Automatic servicing unavailable'],
};
const UNLOCK_LINE = /^Unlocks (course|purchase):/;

export function DevelopmentDetail({ option: o, onClose, pending, failure, purchasedTier, onPurchase }: {
  option: NodeOption; onClose: () => void; pending: boolean; failure: string | null; purchasedTier: number | null; onPurchase: () => void;
}) {
  const nav = useNav();
  const tiered = o.maxTier > 1;
  const allEffects = o.node.tiers?.flatMap((tier) => tier.effects) ?? o.node.effects;
  const training = allEffects.some((effect) => effect.kind === 'unlockCourse' || effect.kind === 'trainingSlots');
  const gear = allEffects.some((effect) => ['unlockItem', 'equipmentManager', 'loadoutPresets', 'restockRules'].includes(effect.kind));
  const trainingCourse = allEffects.find((effect) => effect.kind === 'unlockCourse');
  const gearItem = allEffects.find((effect) => effect.kind === 'unlockItem');
  const staff = allEffects.some((effect) => effect.kind === 'commandStaff' || effect.kind === 'equipmentManager');
  const unlocks = allEffects.flatMap((effect): { key: string; itemId: string | null; name: string }[] => effect.kind === 'unlockItem' ? [{ key: effect.itemId, itemId: effect.itemId, name: ITEMS[effect.itemId]?.name ?? effect.itemId }]
    : effect.kind === 'unlockCourse' ? [{ key: effect.courseId, itemId: null, name: COURSES[effect.courseId]?.name ?? effect.courseId }] : []);
  const gives = (tiered ? [] : (o.targetTier ? o.effects : o.currentEffects)).filter((line) => !UNLOCK_LINE.test(line));
  const baseline = BASELINE[o.node.id];
  const missing = o.quote.missingPrerequisites;
  const shortReason = o.reason && !missing.length ? o.reason : null;
  return <Sheet open onClose={onClose} title={o.node.name} subtitle={<>{BRANCH_META[o.node.branch].label} · {o.currentTier ? tiered ? `Tier ${tierLabel(o.currentTier)} of ${tierLabel(o.maxTier)}` : 'Owned' : 'Not owned'}</>} className="development-sheet" footer={
    o.targetTier && o.quote.cost ? <div className="dev-buy">
      {shortReason && <p className="dev-buy-reason">{shortReason}</p>}
      <span className="dev-buy-cost"><b>{o.quote.cost.dp} DP</b><b>{money(o.quote.cost.funding)}</b></span>
      <Button variant="primary" disabled={!o.quote.ok || pending} onClick={onPurchase}>{pending ? 'Upgrading…' : tiered ? `Upgrade to tier ${tierLabel(o.targetTier)}` : 'Unlock program'}</Button>
    </div> : <p className="dim dev-buy-done"><Icon name="check" size={14} />{tiered ? 'Fully upgraded. All benefits are active.' : 'Program owned. Its unlocks are active.'}</p>
  }>
    <div className="dev-detail">
      <p className="dim">{o.node.description}</p>
      {purchasedTier !== null && <p className="development-success" role="status">{tiered ? `Tier ${tierLabel(purchasedTier)} purchased` : 'Program unlocked'}. The benefits below are now active.</p>}
      {o.node.requires.length > 0 && <section aria-labelledby="dev-needs"><h3 id="dev-needs" className="dev-label">Needs first</h3>
        <ul className="dev-chips">{o.node.requires.map((id) => {
          const owned = !missing.includes(id);
          return <li key={id} className={`dev-chip dev-chip-${owned ? 'owned' : 'missing'}`}><Icon name={owned ? 'check' : 'lock'} size={13} />{DEV_NODES[id]?.name ?? id}<span className="sr-only"> · {owned ? 'Owned' : 'Required'}</span></li>;
        })}</ul></section>}
      {unlocks.length > 0 && <section aria-labelledby="dev-unlocks"><h3 id="dev-unlocks" className="dev-label">Unlocks</h3>
        <ul className="dev-chips">{unlocks.map((unlock) => <li key={unlock.key} className="dev-chip">{unlock.itemId ? <GearArt itemId={unlock.itemId} size={22} /> : <Icon name="mortarboard" size={14} />}{unlock.name}</li>)}</ul></section>}
      {gives.length > 0 && <section aria-labelledby="dev-gives"><h3 id="dev-gives" className="dev-label">{o.targetTier ? 'Gives' : 'Active'}</h3><ul className="dev-lines">{gives.map((line, index) => <li key={index}>{line}</li>)}</ul></section>}
      {tiered && <section aria-labelledby="dev-ladder"><h3 id="dev-ladder" className="dev-label">Tier ladder <span className="dev-label-note">Totals at each tier</span></h3>
        <ol className="dev-ladder">
          {baseline && <li data-state={o.currentTier === 0 ? 'current' : 'owned'}><span className="dev-ladder-tier">Base</span><span className="dev-ladder-fx">{baseline.join(' · ')}</span><span className="dev-ladder-cost">{o.currentTier === 0 ? 'Current' : ''}</span></li>}
          {Array.from({ length: o.maxTier }, (_, index) => {
            const tier = index + 1;
            const definition = developmentTierDefinition(o.node, tier)!;
            const state = o.currentTier === tier ? 'current' : o.currentTier > tier ? 'owned' : tier === o.targetTier ? 'next' : 'later';
            return <li key={tier} data-state={state} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="dev-ladder-tier">{tierLabel(tier)}</span>
              <span className="dev-ladder-fx">{definition.effects.map(describeEffect).join(' · ')}</span>
              <span className="dev-ladder-cost">{state === 'current' ? 'Current' : state === 'owned' ? 'Owned' : `${definition.cost.dp} DP · ${money(definition.cost.funding)}`}{(state === 'next' || state === 'later') && <span className="sr-only">, {state}</span>}</span>
            </li>;
          })}
        </ol></section>}
      {(training || gear || staff) && <div className="dev-links">
        {training && <Button size="sm" icon="mortarboard" onClick={() => { onClose(); nav.openTraining(trainingCourse ? { certId: COURSES[trainingCourse.courseId]?.grants.cert } : undefined); }}>Open Training</Button>}
        {gear && <Button size="sm" icon="gear" onClick={() => { onClose(); if (gearItem) nav.openEquipment({ itemId: gearItem.itemId }); else nav.setGearSection('inventory'); }}>Open Gear</Button>}
        {staff && <Button size="sm" icon="people" onClick={() => { onClose(); nav.go('hq'); }}>Open Command Staff</Button>}
      </div>}
      {failure && <p className="reason" role="alert">{failure}</p>}
    </div>
  </Sheet>;
}
