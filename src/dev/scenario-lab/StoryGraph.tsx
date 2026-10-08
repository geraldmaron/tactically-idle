// The story graph of a call tree: nodes in stage columns, endings on the right, an edge for every
// band and hidden-truth branch. Nodes this call can reach (after its turn draws) are solid; the
// turn nodes another call would draw are dashed. Selecting a node lists its choices and where each
// band goes, and opens its cards.
import { useMemo, useState } from 'react';
import type { CallTree, TreeIf, TreeNode } from '../../content/call-trees/types';
import { reachableNodes, resolveNext } from '../../gen/incident/trees-v13/compile';
import type { OutcomeBand } from '../../sim/types';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const BAND_COLOR: Record<OutcomeBand, string> = { favorable: 'var(--mint)', mixed: 'var(--amber)', adverse: 'var(--danger)' };
const COL_W = 250, NODE_W = 200, NODE_H = 44, ROW_H = 60, PAD = 16;
const STAGE_ORDER = ['assess', 'adapt', 'resolve'] as const;

interface Edge { from: string; to: string; band: OutcomeBand; turn: boolean }

export function StoryGraph({ tree, seed, bind, selected, onSelect }: {
  tree: CallTree; seed: number; bind: (text: string) => string; selected: string; onSelect: (node: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const layout = useMemo(() => {
    const reach = new Set(reachableNodes(tree, seed).map(node => node.id));
    const pos = new Map<string, { x: number; y: number }>();
    STAGE_ORDER.forEach((stage, column) => tree.nodes.filter(node => node.stage === stage)
      .forEach((node, row) => pos.set(node.id, { x: PAD + column * COL_W, y: PAD + row * ROW_H })));
    Object.keys(tree.endings).forEach((ending, row) => pos.set(`end:${ending}`, { x: PAD + 3 * COL_W, y: PAD + row * (NODE_H + 8) }));
    const edges: Edge[] = [];
    const seen = new Set<string>();
    for (const node of tree.nodes) for (const choice of node.choices) for (const band of BANDS) for (const outcome of choice.outcomes[band]) {
      if (!outcome.next) continue;
      const targets = 'ending' in outcome.next ? [`end:${outcome.next.ending}`] : 'node' in outcome.next ? [outcome.next.node] : (tree.turns?.[outcome.next.turn] ?? []);
      for (const to of targets) {
        const key = `${node.id}>${to}>${band}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({ from: node.id, to, band, turn: 'turn' in outcome.next });
      }
    }
    const height = Math.max(...[...pos.values()].map(p => p.y)) + NODE_H + PAD;
    return { reach, pos, edges, height, width: PAD * 2 + 3 * COL_W + NODE_W };
  }, [tree, seed]);
  const node = tree.nodes.find(entry => entry.id === selected) ?? tree.nodes[0];
  const focus = hover ?? selected;

  return (
    <section className="sl-panel">
      <div className="sl-panel-head"><h2>Story graph</h2><span className="sl-dim">{tree.nodes.length} decision points · {Object.keys(tree.endings).length} endings · solid: reachable in this call</span></div>
      <div className="sl-scroll">
        <svg className="sl-graph" width={layout.width} height={layout.height} role="img" aria-label={`Story graph of ${tree.title}`}>
          {STAGE_ORDER.map((stage, column) => <text key={stage} x={PAD + column * COL_W} y={10} className="sl-graph-col">{tree.stageLabels[stage]}</text>)}
          <text x={PAD + 3 * COL_W} y={10} className="sl-graph-col">Endings</text>
          {layout.edges.map((edge, i) => {
            const a = layout.pos.get(edge.from), b = layout.pos.get(edge.to);
            if (!a || !b) return null;
            const lit = edge.from === focus || edge.to === focus;
            const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
            const back = x2 <= x1;
            const d = back ? `M${x1},${y1} C${x1 + 60},${y1} ${x2 + NODE_W + 60},${y2} ${x2 + NODE_W},${y2}` : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
            return <path key={i} d={d} fill="none" stroke={BAND_COLOR[edge.band]} strokeWidth={lit ? 2 : 1} strokeDasharray={edge.turn ? '4 3' : undefined} opacity={lit ? 0.95 : 0.18} />;
          })}
          {tree.nodes.map(entry => {
            const p = layout.pos.get(entry.id)!;
            const reachable = layout.reach.has(entry.id);
            return (
              <g key={entry.id} transform={`translate(${p.x},${p.y})`} className="sl-graph-node" onClick={() => onSelect(entry.id)} onMouseEnter={() => setHover(entry.id)} onMouseLeave={() => setHover(null)}>
                <rect width={NODE_W} height={NODE_H} rx={5} className={entry.id === selected ? 'sel' : ''} strokeDasharray={reachable ? undefined : '4 3'} opacity={reachable ? 1 : 0.55} />
                <text x={8} y={17} className="sl-graph-id">{entry.id}{entry.id === tree.root ? ' (start)' : ''}</text>
                <text x={8} y={33} className="sl-graph-sub">{entry.choices.length} choices{entry.promptIf?.length ? ` · ${entry.promptIf.length + 1} prompts` : ''}</text>
              </g>
            );
          })}
          {Object.entries(tree.endings).map(([id, ending]) => {
            const p = layout.pos.get(`end:${id}`)!;
            return (
              <g key={id} transform={`translate(${p.x},${p.y})`} className="sl-graph-node end" onMouseEnter={() => setHover(`end:${id}`)} onMouseLeave={() => setHover(null)}>
                <rect width={NODE_W} height={NODE_H} rx={5} className={`disp-${ending.disposition}`} />
                <text x={8} y={17} className="sl-graph-id">{id}</text>
                <text x={8} y={33} className="sl-graph-sub">{ending.disposition}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <NodeDetail tree={tree} node={node} seed={seed} bind={bind} />
    </section>
  );
}

function NodeDetail({ tree, node, seed, bind }: { tree: CallTree; node: TreeNode; seed: number; bind: (text: string) => string }) {
  const safeBind = (text: string) => { try { return bind(text); } catch { return text; } };
  const where = (next: NonNullable<TreeNode['choices'][number]['outcomes']['favorable'][number]['next']>) => {
    if ('ending' in next) return `ending ${next.ending}`;
    if ('turn' in next) { const drawn = resolveNext(tree, next, seed); return `turn ${next.turn} → ${'node' in drawn ? drawn.node : ''} this call`; }
    return next.node;
  };
  return (
    <div className="sl-node-detail">
      <h3>{node.id} · {tree.stageLabels[node.stage]}</h3>
      <p>{safeBind(node.prompt)}</p>
      {(node.promptIf ?? []).map((entry, i) => <p key={i} className="sl-dim">When {[...(entry.when.marks ?? []), ...(entry.when.notMarks ?? []).map(m => `not ${m}`), ...(entry.when.safe ?? []).map(r => `${r} safe`), ...(entry.when.notSafe ?? []).map(r => `${r} not safe`)].join(', ')}: {safeBind(entry.prompt)}</p>)}
      <div className="sl-scroll">
        <table className="sl-table">
          <thead><tr><th>Choice</th><th>Opens when</th>{BANDS.map(band => <th key={band}>{band}</th>)}</tr></thead>
          <tbody>
            {node.choices.map(choice => (
              <tr key={choice.id}>
                <td><strong>{safeBind(choice.title)}</strong><br /><span className="sl-dim">{choice.check.kind} {choice.check.difficulty ? `${choice.check.difficulty > 0 ? '+' : ''}${choice.check.difficulty}` : '±0'} · {choice.minutes} min{choice.span ? ` (${choice.span})` : ''}</span></td>
                <td className="sl-dim">{choice.onlyIf ? JSON.stringify(choice.onlyIf) : 'always'}{choice.requires ? ` · needs ${JSON.stringify(choice.requires)}` : ''}</td>
                {BANDS.map(band => (
                  <td key={band}>
                    {choice.outcomes[band].map((outcome, i) => (
                      <div key={i} className="sl-outcome-line">
                        {outcome.if && <span className="sl-chip">if {([] as TreeIf[]).concat(outcome.if).map(c => 'fact' in c ? `${c.fact}=${c.is}` : 'meter' in c ? `${c.meter}${c.is === false ? ' not' : ''} ${[...([] as string[]).concat(c.stance ?? []), ...(c.agitationAtLeast !== undefined ? [`agitation ${c.agitationAtLeast}+`] : [])].join('/')}` : 'low' in c ? `${c.clock} ${c.low ? 'low' : 'not low'}` : `${c.clock} ${c.out ? 'out' : 'not out'}`).join(' & ')}</span>}
                        {outcome.moves && <span className="sl-chip" title="Meter events (sim/meters.ts), scaled by the subject's volatility">{Object.entries(outcome.moves).map(([role, events]) => `${role} ${([] as string[]).concat(events).join('+')}`).join(', ')}</span>}
                        {outcome.when && <span className="sl-chip">when {JSON.stringify(outcome.when)}</span>}
                        {outcome.next && <span className="sl-chip">→ {where(outcome.next)}</span>}
                        {outcome.harm && <span className="sl-chip warn">harm {Object.entries(outcome.harm).map(([role, severity]) => `${role} ${severity}`).join(', ')}</span>}
                        {outcome.officer && <span className="sl-chip warn">officer {outcome.officer}</span>}
                        {outcome.fire && <span className="sl-chip warn" title="Who is hit is drawn when the decision commits (sim/drawn-effects.ts)">{outcome.fire.from} fires: drawn</span>}
                        {outcome.force && <span className="sl-chip warn" title="Less-lethal or firearm by gear, range and who is close; severity drawn">force on {outcome.force.on}: fatal → {outcome.force.next.fatal ? where(outcome.force.next.fatal) : 'never'}, hurt → {where(outcome.force.next.hurt)}, missed → {where(outcome.force.next.none)}</span>}
                        <div>{safeBind(outcome.text)}</div>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
