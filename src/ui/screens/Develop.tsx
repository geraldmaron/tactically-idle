import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { DEV_NODES } from '../../content/dev-tree';
import { COURSES } from '../../content/courses';
import { ITEMS } from '../../content/items';
import { describeEffect } from '../../sim/develop';
import { nodeOptions, type NodeOption } from '../../sim/department-selectors';
import { developmentTierDefinition, tierLabel } from '../../sim/development-tiers';
import type { DevBranch, Id } from '../../sim/types';
import { Sheet } from '../components/Sheet';
import { useNav } from '../components/nav';
import { Button, Chip, Row } from '../components/ui';
import { BRANCHES, BRANCH_META } from '../components/labels';
import { Icon } from '../icons';
import { BRANCH_ICON } from '../icons/kit';
import { GearArt } from '../art/GearArt';
import { EmblemArt, branchEmblemId } from '../art/EmblemArt';
import { moneyFull as money, money as compactMoney } from '../format';
import { useGame } from '../store';
import type { MilestoneView } from '../../sim/grants';
import { milestoneShare, milestoneView } from '../../sim/grants';
import { useDevelopmentPurchase } from '../storefront/useDevelopmentPurchase';
import { CostTag, Segments, type CostQuote } from './build-parts';
import './development.css';

export type DevelopmentFilter = 'all' | 'available' | 'owned';
export function filterDevelopmentOptions(options: NodeOption[], branch: DevBranch | 'all', filter: DevelopmentFilter): NodeOption[] {
  return options.filter((option) => (branch === 'all' || option.node.branch === branch)
    && (filter === 'all' || (filter === 'owned' ? option.currentTier > 0 : option.quote.ok)));
}

/** What the player has to spend; nodes mark when funding falls short. */
export interface DevelopmentBudget { funding: number }

/** The development to point the player at: the cheapest that can be bought now, else the cheapest
 * whose prerequisites are met, so there is always one clear next step while any remains. */
export function nextDevelopment(options: NodeOption[]): NodeOption | null {
  const open = options.filter((o) => o.targetTier && o.status !== 'locked' && o.quote.cost);
  const byCost = (a: NodeOption, b: NodeOption) => a.quote.cost!.funding - b.quote.cost!.funding || a.node.id.localeCompare(b.node.id);
  return [...open.filter((o) => o.quote.ok)].sort(byCost)[0] ?? [...open].sort(byCost)[0] ?? null;
}

export interface TrackRow { option: NodeOption; depth: number; parentId: Id | null }
/** A branch as one research track (develop-track): roots in authored order, each followed by what it
 * opens, indented one step per prerequisite, so every edge runs down and to the right. */
export function trackRows(nodes: NodeOption[]): TrackRow[] {
  const ids = new Set(nodes.map((o) => o.node.id));
  const parentOf = (o: NodeOption) => o.node.requires.find((id) => ids.has(id)) ?? null;
  const rows: TrackRow[] = [];
  const visit = (o: NodeOption, depth: number) => {
    rows.push({ option: o, depth, parentId: parentOf(o) });
    for (const child of nodes.filter((x) => parentOf(x) === o.node.id)) visit(child, depth + 1);
  };
  for (const root of nodes.filter((o) => parentOf(o) === null)) visit(root, 0);
  return rows;
}

export function DevelopScreen({ highlightedNode, highlightRequest, openHighlighted = false }: { highlightedNode?: Id; highlightRequest?: number; openHighlighted?: boolean }) {
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [purchased, setPurchased] = useState<{ nodeId: Id; tier: number } | null>(null);
  const g = useGame();
  const purchases = useDevelopmentPurchase();
  const rootRef = useRef<HTMLDivElement>(null);
  const options = nodeOptions(g);
  const next = nextDevelopment(options);
  const [branch, setBranch] = useState<DevBranch>(() => (highlightedNode && DEV_NODES[highlightedNode]?.branch) || next?.node.branch || BRANCHES[0]);
  const wallet: DevelopmentBudget = { funding: g.department.funding };
  const selected = options.find((option) => option.node.id === selectedId);
  const open = (id: Id) => { setSelectedId(id); setPurchased(null); };
  const progress = (id: DevBranch) => {
    const scoped = options.filter((option) => option.node.branch === id);
    return { owned: scoped.filter((option) => option.currentTier > 0).length, total: scoped.length, ready: scoped.filter((option) => option.quote.ok).length };
  };
  const rows = trackRows(options.filter((option) => option.node.branch === branch));

  useEffect(() => {
    if (!highlightedNode || !DEV_NODES[highlightedNode]) return;
    setBranch(DEV_NODES[highlightedNode].branch);
    setSelectedId(openHighlighted ? highlightedNode : null);
    setPurchased(null);
    if (openHighlighted) return;
    const frame = requestAnimationFrame(() => {
      const target = rootRef.current?.querySelector<HTMLElement>(`[data-development-node="${highlightedNode}"]`);
      target?.scrollIntoView({ block: 'nearest' });
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [highlightedNode, highlightRequest, openHighlighted]);

  const buyNext = async () => {
    if (!next?.targetTier || !next.quote.ok) { if (next) { setBranch(next.node.branch); open(next.node.id); } return; }
    const tier = next.targetTier;
    const result = await purchases.purchase(next.node.id, tier);
    if (result?.ok) { setBranch(next.node.branch); setSelectedId(next.node.id); setPurchased({ nodeId: next.node.id, tier }); }
  };
  return <div ref={rootRef} className="page develop-page">
    {/* Funding, the rate and the level live in the resource bar; this screen says each once there. */}
    <h2 className="sr-only">Department development</h2>
    {next && <div className="dev-next" data-ready={next.quote.ok ? 'yes' : undefined}>
      <button type="button" className="dev-next-open" onClick={() => { setBranch(next.node.branch); open(next.node.id); }}
        aria-label={`Next up: ${next.node.name}${next.maxTier > 1 && next.targetTier ? ` tier ${tierLabel(next.targetTier)}` : ''}, ${costText(next)}${next.milestone ? `, or ${milestoneText(next.milestone)}` : ''}. ${next.quote.ok ? 'Ready to buy' : next.reason ?? ''}`}>
        <NodeGlyph option={next} size={48} />
        <span className="dev-next-main">
          <span className="sr-only">Next up, {BRANCH_META[next.node.branch].label}</span>
          <strong>{next.node.name}{next.maxTier > 1 && next.targetTier ? ` ${tierLabel(next.targetTier)}` : ''}</strong>
          <span className="dev-next-fx">{nodeSummary(next)}</span>
          {next.milestone && <MilestoneLine view={next.milestone} share={milestoneShare(g, next.milestone)} />}
        </span>
      </button>
      <Button variant={next.quote.ok ? 'primary' : 'quiet'} className="dev-next-buy" disabled={!!purchases.pendingNode}
        aria-label={next.quote.ok ? `Buy ${next.node.name} for ${money(next.quote.cost!.funding)}` : `${next.node.name} costs ${money(next.quote.cost!.funding)}. ${next.reason ?? ''}`}
        onClick={() => void buyNext()}>{compactMoney(next.quote.cost!.funding)}</Button>
    </div>}
    {/* Five branches as named chips that wrap, a dot when one holds a development ready to buy. */}
    <div className="dev-branch-chips" role="tablist" aria-label="Development branches">{BRANCHES.map((id) => {
      const { owned, total, ready } = progress(id);
      const name = BRANCH_META[id].label;
      return <button key={id} type="button" role="tab" aria-selected={branch === id} className={`dev-branch-chip${branch === id ? ' dev-branch-chip-on' : ''}`} onClick={() => setBranch(id)}
        aria-label={`${name}, ${owned} of ${total} owned${ready ? `, ${ready} ready` : ''}`}><Icon name={BRANCH_ICON[id]} size={16} />{name}<span className="dev-chip-count">{owned}/{total}</span>{ready > 0 && <i className="dev-tab-dot" aria-hidden="true" />}</button>;
    })}</div>
    <p className="dev-branch-blurb">{BRANCH_META[branch].blurb}</p>
    <Track rows={rows} wallet={wallet} nextId={next?.node.id ?? null} highlightedNode={highlightedNode} onOpen={open} />
    {selected && <DevelopmentDetail option={selected} onClose={() => setSelectedId(null)} pending={!!purchases.pendingNode}
      failure={purchases.failure?.nodeId === selected.node.id ? purchases.failure.reason : null}
      purchasedTier={purchased?.nodeId === selected.node.id ? purchased.tier : null}
      onOpenNode={open}
      onPurchase={async () => {
        const target = selected.targetTier;
        if (!target) return;
        const result = await purchases.purchase(selected.node.id, target);
        if (result?.ok) setPurchased({ nodeId: selected.node.id, tier: target });
      }} />}
  </div>;
}

interface Edge { key: string; d: string; owned: boolean }
/** The track and its drawn edges. Edges are measured from the rendered medals, so they follow the
 * real layout at any width and text size: down from the parent, then across to the child. */
function Track({ rows, wallet, nextId, highlightedNode, onOpen }: { rows: TrackRow[]; wallet: DevelopmentBudget; nextId: Id | null; highlightedNode?: Id; onOpen: (id: Id) => void }) {
  const ref = useRef<HTMLOListElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const signature = rows.map((row) => `${row.option.node.id}:${row.option.currentTier}`).join('|');
  useLayoutEffect(() => {
    const list = ref.current;
    if (!list) return;
    const measure = () => {
      const box = list.getBoundingClientRect();
      const medal = (id: Id) => list.querySelector<HTMLElement>(`[data-medal="${id}"]`)?.getBoundingClientRect();
      setEdges(rows.flatMap((row) => {
        if (!row.parentId) return [];
        const from = medal(row.parentId), to = medal(row.option.node.id);
        if (!from || !to) return [];
        const x = from.left + from.width / 2 - box.left, y0 = from.bottom - box.top;
        const y1 = to.top + to.height / 2 - box.top, x1 = to.left - box.left;
        const owned = rows.find((r) => r.option.node.id === row.parentId)!.option.currentTier > 0;
        return [{ key: `${row.parentId}-${row.option.node.id}`, d: `M ${x} ${y0} V ${y1 - 8} Q ${x} ${y1} ${x + 8} ${y1} H ${x1}`, owned }];
      }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="dev-track-wrap">
    <svg className="dev-edges" aria-hidden="true">{edges.map((edge) => <path key={edge.key} d={edge.d} data-owned={edge.owned ? 'yes' : undefined} />)}</svg>
    <ol ref={ref} className="dev-track card" data-ui-list>
      {rows.map((row) => <li key={row.option.node.id} data-parent={row.parentId ?? undefined} style={{ '--depth': row.depth } as CSSProperties}>
        <DevelopmentTile option={row.option} budget={wallet} next={row.option.node.id === nextId} highlighted={highlightedNode === row.option.node.id} onOpen={() => onOpen(row.option.node.id)} />
      </li>)}
    </ol>
  </div>;
}

/** Gear art when a development unlocks equipment, else the emblem of the course it unlocks or of its branch. */
function NodeGlyph({ option: o, size }: { option: NodeOption; size: number }) {
  const item = o.node.effects.find((effect): effect is Extract<typeof effect, { kind: 'unlockItem' }> => effect.kind === 'unlockItem');
  const course = o.node.effects.find((effect): effect is Extract<typeof effect, { kind: 'unlockCourse' }> => effect.kind === 'unlockCourse');
  const iconSize = Math.round(size * 0.66);
  return <span className="dev-glyph" aria-hidden="true">{item ? <GearArt itemId={item.itemId} size={size} />
    : course ? <EmblemArt id={course.courseId} icon="mortarboard" size={size} iconSize={iconSize} />
    : <EmblemArt id={branchEmblemId(o.node.branch)} icon={BRANCH_META[o.node.branch].icon} size={size} iconSize={iconSize} />}</span>;
}

function costText(o: NodeOption): string {
  return o.quote.cost ? `costs ${money(o.quote.cost.funding)}` : '';
}

/** 'granted at Level 4, 3 of 4', for labels. */
export function milestoneText(view: MilestoneView): string {
  return `granted at ${view.label}${view.met ? '' : `, ${view.have} of ${view.need}`}`;
}

/** The free route beside the price: the milestone, how far along it is, and a thin bar. */
function MilestoneLine({ view, share, compact = false }: { view: MilestoneView; share: number; compact?: boolean }) {
  return <span className={`dev-milestone${compact ? ' dev-milestone-compact' : ''}`} data-met={view.met ? 'yes' : undefined} aria-hidden="true">
    <span className="dev-milestone-text"><Icon name="medal" size={11} />Free at {view.label}<b>{view.met ? 'Reached' : `${view.have} of ${view.need}`}</b></span>
    <span className="dev-milestone-bar"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
  </span>;
}

export type TileState = 'owned' | 'ready' | 'short' | 'locked';
export function tileState(o: NodeOption): TileState {
  if (!o.targetTier) return 'owned';
  if (o.status === 'locked') return 'locked';
  return o.reason ? 'short' : 'ready';
}

/** One line on what a development does next: what it unlocks, else its next effect. */
export function nodeSummary(o: NodeOption): string {
  const effects = o.targetTier ? (o.node.tiers ? developmentTierDefinition(o.node, o.targetTier)?.effects ?? o.node.effects : o.node.effects) : [];
  const unlocks = effects.flatMap((effect) => effect.kind === 'unlockItem' ? [ITEMS[effect.itemId]?.name ?? effect.itemId] : effect.kind === 'unlockCourse' ? [COURSES[effect.courseId]?.name ?? effect.courseId] : []);
  if (unlocks.length) return `Unlocks ${unlocks.join(' and ')}`;
  const lines = (o.targetTier ? o.effects : o.currentEffects).filter((line) => !UNLOCK_LINE.test(line));
  return lines[0] ?? o.node.description;
}

/** The tag a row or card shows, read from the development's own quote: its price, what blocks it
 * (a missing prerequisite or short funding) and the milestone that grants it free. */
export function developmentQuote(o: NodeOption, shortFunding: boolean): CostQuote {
  const state = tileState(o);
  const cost = o.quote.cost;
  const missing = o.quote.missingPrerequisites.map((id) => DEV_NODES[id]?.name ?? id);
  const blocker = state === 'locked' ? `Needs ${missing.join(' and ')}` : shortFunding ? 'Needs funding' : undefined;
  const free = o.milestone ? { label: o.milestone.label, met: o.milestone.met, have: o.milestone.have, need: o.milestone.need } : undefined;
  return { state, price: cost?.funding ?? null, blocker, free, done: o.maxTier > 1 ? 'Max' : 'Owned' };
}

/** What a development opens, from the effects of the tier it buys next (or all its tiers once owned). */
export function nodeUnlocks(o: NodeOption): { key: string; itemId: string | null; name: string }[] {
  const effects = o.node.tiers ? (o.targetTier ? developmentTierDefinition(o.node, o.targetTier)?.effects ?? o.node.effects : o.node.tiers.flatMap((tier) => tier.effects)) : o.node.effects;
  return effects.flatMap((effect): { key: string; itemId: string | null; name: string }[] => effect.kind === 'unlockItem' ? [{ key: effect.itemId, itemId: effect.itemId, name: ITEMS[effect.itemId]?.name ?? effect.itemId }]
    : effect.kind === 'unlockCourse' ? [{ key: effect.courseId, itemId: null, name: COURSES[effect.courseId]?.name ?? effect.courseId }] : []);
}

export function DevelopmentTile({ option: o, budget, highlighted, next = false, onOpen }: {
  option: NodeOption; budget: DevelopmentBudget; highlighted: boolean; next?: boolean; onOpen: () => void;
}) {
  const state = tileState(o);
  const tiered = o.maxTier > 1;
  const cost = o.quote.cost;
  const shortFunding = !!cost && budget.funding < cost.funding;
  const needs = o.quote.missingPrerequisites.map((id) => DEV_NODES[id]?.name ?? id);
  const quote = developmentQuote(o, shortFunding);
  const unlocks = nodeUnlocks(o);
  const label = [
    o.node.name,
    unlocks.length && state !== 'owned' ? `Unlocks ${unlocks.map((u) => u.name).join(', ')}` : '',
    state === 'owned' ? (tiered ? 'Fully upgraded' : 'Owned') : state === 'locked' ? `Locked, needs ${needs.join(' and ')}` : state === 'ready' ? 'Ready to buy' : shortFunding ? 'Needs more funding' : 'Not ready',
    tiered ? `Tier ${o.currentTier} of ${o.maxTier}` : '',
    cost ? `Next ${costText(o)}` : '',
    o.milestone ? `Or ${milestoneText(o.milestone)}` : o.granted ? `Granted at ${o.granted.milestone}` : '',
    next ? 'Suggested next' : '',
  ].filter(Boolean).join('. ');
  return <button type="button" data-development-node={o.node.id} data-state={state}
    className={`dev-node${o.currentTier > 0 ? ' dev-node-progress' : ''}${highlighted ? ' store-node-highlight' : ''}`}
    aria-label={label} onClick={onOpen}>
    <span className="dev-medal" data-medal={o.node.id}>
      <NodeGlyph option={o} size={40} />
      {state === 'owned' && <span className="dev-medal-badge dev-badge-owned"><Icon name="check" size={11} strokeWidth={3} /></span>}
      {state === 'locked' && <span className="dev-medal-badge dev-badge-locked"><Icon name="lock" size={11} /></span>}
    </span>
    <span className="dev-node-main" aria-hidden="true">
      <span className="dev-node-title"><strong>{o.node.name}</strong></span>
      {unlocks.length > 0 && state !== 'owned'
        ? <span className="dev-node-unlocks"><span className="dev-thumbs">{unlocks.slice(0, 5).map((unlock) => <span key={unlock.key} className="dev-thumb">{unlock.itemId ? <GearArt itemId={unlock.itemId} size={24} /> : <Icon name="mortarboard" size={16} />}</span>)}</span>Unlocks {unlocks.length}</span>
        : <span className="dev-node-fx">{state === 'owned' ? (o.currentEffects.filter((line) => !UNLOCK_LINE.test(line))[0] ?? 'Active') : nodeSummary(o)}</span>}
      {o.granted && !o.milestone ? <span className="dev-node-granted"><Icon name="medal" size={16} />Granted at {o.granted.milestone}</span> : null}
      <CostTag part="note" quote={quote} />
      {tiered && <span className="dev-node-steps"><Segments done={o.currentTier} total={o.maxTier} /><span>Tier {o.currentTier} of {o.maxTier}</span></span>}
    </span>
    {/* Prices stay quiet on rows: the sheet buys, and amber belongs to the one Next card. */}
    <span className="dev-node-side" aria-hidden="true"><CostTag part="value" quote={quote} /></span>
  </button>;
}

const BASELINE: Record<string, string[]> = {
  personnel_academy: ['1 total training slot'],
  intel_records: ['$0/h records funding'],
  wellbeing_peer_support: ['Standard stress recovery (x1)'],
  logistics_equipment_manager: ['Standard repair prices and reusable-gear wear', 'Automatic servicing unavailable'],
};
const UNLOCK_LINE = /^Unlocks (course|purchase):/;

export function DevelopmentDetail({ option: o, onClose, pending, failure, purchasedTier, onPurchase, onOpenNode }: {
  option: NodeOption; onClose: () => void; pending: boolean; failure: string | null; purchasedTier: number | null; onPurchase: () => void;
  /** Opens a prerequisite's own sheet, so a locked development points at what unlocks it. */
  onOpenNode?: (id: Id) => void;
}) {
  const nav = useNav();
  const game = useGame();
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
      <p className="dev-buy-effect"><Icon name="check" size={16} /><span><b>You get</b> {nodeSummary(o)}</span></p>
      {shortReason && <p className="dev-buy-reason">{shortReason}</p>}
      <div className="dev-buy-ways">
        <div className="dev-buy-way">
          <span className="dev-label">Buy now</span>
          <Button variant="primary" disabled={!o.quote.ok || pending} onClick={onPurchase}>{pending ? 'Upgrading…' : `${tiered ? `Buy tier ${tierLabel(o.targetTier)}` : 'Buy'} for ${money(o.quote.cost.funding)}`}</Button>
        </div>
        {o.milestone && <div className="dev-buy-way dev-buy-free">
          <span className="dev-label">Or free</span>
          <MilestoneLine view={o.milestone} share={milestoneShare(game, o.milestone)} />
          <span className="dim dev-buy-free-note">{o.milestone.met ? 'Grants when the prerequisites are owned' : 'Grants itself when reached'}</span>
        </div>}
      </div>
    </div> : <p className="dim dev-buy-done"><Icon name="check" size={14} />{tiered ? 'Fully upgraded. All benefits are active.' : 'Program owned. Its unlocks are active.'}</p>
  }>
    <div className="dev-detail">
      <p className="dim">{o.node.description}</p>
      {o.granted && purchasedTier === null && <p className="development-success"><Icon name="medal" size={14} /> {tiered ? `Tier ${tierLabel(o.currentTier)} was granted` : 'Granted'} at {o.granted.milestone}.</p>}
      {purchasedTier !== null && <p className="development-success" role="status">{tiered ? `Tier ${tierLabel(purchasedTier)} purchased` : 'Program unlocked'}. The benefits below are now active.</p>}
      {o.node.requires.length > 0 && <section aria-labelledby="dev-needs"><h3 id="dev-needs" className="dev-label">Needs first</h3>
        <div className="dev-needs card" data-ui-list>{o.node.requires.map((id) => {
          const owned = !missing.includes(id);
          const need = DEV_NODES[id];
          return <Row key={id} className="dev-need" lead={<span className="dev-need-well"><Icon name={owned ? 'check' : 'lock'} size={16} /></span>}
            title={need?.name ?? id} detail={owned ? 'Owned' : onOpenNode ? 'Open it to buy' : 'Required'}
            trail={<Chip tone={owned ? 'good' : 'warn'}>{owned ? 'Owned' : 'Required'}</Chip>}
            onClick={!owned && onOpenNode ? () => onOpenNode(id) : undefined} />;
        })}</div></section>}
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
              <span className="dev-ladder-cost">{state === 'current' ? 'Current' : state === 'owned' ? 'Owned' : `${compactMoney(definition.cost.funding)} or ${milestoneView(game, definition.grant).label}`}{(state === 'next' || state === 'later') && <span className="sr-only">, {state}</span>}</span>
            </li>;
          })}
        </ol></section>}
      {(training || gear || staff) && <div className="dev-links">
        {training && <Button size="sm" icon="mortarboard" onClick={() => { onClose(); nav.openTraining(trainingCourse ? { certId: COURSES[trainingCourse.courseId]?.grants.cert } : undefined); }}>Open Training</Button>}
        {gear && <Button size="sm" icon="gear" onClick={() => { onClose(); if (gearItem) nav.openEquipment({ itemId: gearItem.itemId }); else nav.go('gear'); }}>Open Armory</Button>}
        {staff && <Button size="sm" icon="people" onClick={() => { onClose(); nav.go('hq'); }}>Open Command Staff</Button>}
      </div>}
      {failure && <p className="reason" role="alert">{failure}</p>}
    </div>
  </Sheet>;
}
