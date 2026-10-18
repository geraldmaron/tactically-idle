// The Flow inspector (spec 3.3): whatever is selected on the canvas, in full. A node shows what the
// player reads there (the bound prompt and each prompt variant with when it shows), its choices with
// where each band goes, and how often runs reach it. A choice shows what the player is told before
// choosing and what can follow on each band. An ending shows its words, its run-class mix and every
// route into it. A ribbon shows the choices behind it. Every item has Play here and Note.
import type { ReactNode } from 'react';
import type { CallTree, TreeChoice, TreeNode, TreeOutcome } from '../../../../content/call-trees/types';
import { WEIGHTS } from '../../../../gen/incident/trees-v13/balance';
import type { LintFinding } from '../../../../gen/incident/trees-v13/dependencies';
import { humanizeNode, matchKey } from '../../../../gen/incident/trees-v13/graph';
import type { CallGraph, GraphEdge } from '../../../../gen/incident/trees-v13/graph';
import type { OutcomeBand, ActionView } from '../../../../sim/types';
import { actionIcon, Icon } from '../../../../ui/icons';
import { PeopleText } from '../../../../ui/people/PeopleText';
import type { Goal } from '../../jobs/protocol';
import type { ReachTally } from '../../jobs/tally';
import type { FlowBox, FlowLayout, FlowPath } from '../../model/flow-layout';
import type { Provenance } from '../../model/label';
import { percent } from '../../model/label';
import { wilson } from '../../model/stats';
import type { Selection } from '../../types';
import { BAND_WORDS, BandGlyph, cx, EffectChip, Glyph, LintGlyph, ProbValue, StackBar, Tag, WeightGlyph } from '../../viz';
import type { ConditionChip, TextContext } from './flow-text';
import { conditionChip, drawnWords, markLabel, stateChips } from './flow-text';

const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];
const DISPOSITION: Record<string, string> = {
  resolved: 'Authored as resolved', relief_partial: 'Authored as partly resolved', unresolved: 'Authored as unresolved',
  care_accepted: 'Authored as care accepted', followup_agreed: 'Authored as follow-up agreed',
};

export interface InspectorContext extends TextContext {
  graph: CallGraph; layout: FlowLayout; bind(text: string): string; tally: ReachTally | null; prov: Provenance;
  /** The node Play is on, and the engine's offer there (choices with their odds). */
  playNode: string | null; playViews: readonly ActionView[];
  findings: (id: string) => LintFinding[];
  titleOf(id: string): string;
  onPlay(goal: Goal): void; onNote(sel: Selection): void; onSelect(id: string): void; onForce(actionId: string, band: OutcomeBand): void;
  onKey(key: string): void;
  /** Raw ids in a sentence read as labels. */
  words(text: string): string;
}

export function FlowInspector({ target, ctx, onClose }: { target: { box?: FlowBox; path?: FlowPath } | null; ctx: InspectorContext; onClose(): void }) {
  if (!target || (!target.box && !target.path)) return null;
  const body = target.path ? <PathInspector path={target.path} ctx={ctx} /> : <BoxInspector box={target.box!} ctx={ctx} />;
  return (
    <aside className="lab-flow-inspector" aria-label="Inspector">
      <button type="button" className="lab-icon-button lab-flow-inspector-close" onClick={onClose} aria-label="Close the inspector" title="Close (Esc)"><Glyph name="close" /></button>
      {body}
    </aside>
  );
}

function BoxInspector({ box, ctx }: { box: FlowBox; ctx: InspectorContext }) {
  if (box.kind === 'node') return <NodeInspector box={box} ctx={ctx} />;
  if (box.kind === 'choice') return <ChoiceInspector box={box} ctx={ctx} />;
  if (box.kind === 'ending') return <EndingInspector box={box} ctx={ctx} />;
  if (box.kind === 'turn') return <TurnInspector box={box} ctx={ctx} />;
  return <JunctionInspector box={box} ctx={ctx} />;
}

// ---------------------------------------------------------------- shared pieces

function Reach({ n, ctx, what }: { n: number | null; ctx: InspectorContext; what: string }) {
  const runs = ctx.tally?.runs ?? 0;
  if (n === null || !runs) return <p className="lab-flow-insp-reach lab-muted">Reach shows once the runs are in.</p>;
  return (
    <p className="lab-flow-insp-reach">
      <ProbValue p={n / runs} prov={ctx.prov} ci={wilson(n, runs)} k={n} />
      <span className="lab-flow-insp-what">{what}</span>
    </p>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="lab-flow-insp-actions">{children}</div>;
}
function PlayButton({ goal, ctx, label = 'Play here' }: { goal: Goal; ctx: InspectorContext; label?: string }) {
  return <button type="button" className="lab-button lab-button-primary" onClick={() => ctx.onPlay(goal)} title="Find the shortest path there and open it in Play (P)"><Glyph name="play" size={12} />{label}</button>;
}
function NoteButton({ sel, ctx }: { sel: Selection; ctx: InspectorContext }) {
  return <button type="button" className="lab-button" onClick={() => ctx.onNote(sel)} title="Leave a review note on this (N)"><Glyph name="note" size={13} />Note</button>;
}

function Chips({ chips }: { chips: ConditionChip[] }) {
  if (!chips.length) return null;
  return (
    <span className="lab-flow-chips">
      {chips.map((chip, i) => (
        <span key={i} className={cx('lab-flow-cond', chip.kind === 'fact' && 'lab-flow-cond-fact', chip.holds === true && 'lab-flow-cond-yes', chip.holds === false && 'lab-flow-cond-no')}
          title={chip.kind === 'fact' ? (chip.holds === undefined ? 'Hidden truth, decided by the situation' : chip.holds ? 'True in this call’s situation' : 'Not true in this call’s situation') : undefined}>
          {chip.kind === 'fact' && <Glyph name="situation" size={11} />}{chip.text}
          {chip.holds !== undefined && <Glyph name={chip.holds ? 'clean' : 'close'} size={11} />}
        </span>
      ))}
    </span>
  );
}

function Findings({ list }: { list: LintFinding[] }) {
  if (!list.length) return null;
  return (
    <ul className="lab-flow-insp-lint">
      {list.map(f => <li key={f.id}><LintGlyph severity={f.severity} size={13} /><span>{f.message}</span></li>)}
    </ul>
  );
}

const nodeOf = (tree: CallTree, id: string): TreeNode | undefined => tree.nodes.find(node => node.id === id);
const choiceOf = (tree: CallTree, node: string, choice: string): TreeChoice | undefined => nodeOf(tree, node)?.choices.find(c => c.id === choice);

/** Where an edge goes, in words. */
function targetText(ctx: InspectorContext, e: Pick<GraphEdge, 'to'>): string {
  if (e.to.startsWith('turn:')) {
    const group = e.to.slice(5);
    const drawn = ctx.graph.turnDrawn[group];
    return drawn ? `${ctx.titleOf(`node:${drawn}`)} (drawn turn)` : `a drawn turn (${group.replace(/_/g, ' ')})`;
  }
  return ctx.titleOf(e.to);
}

function Route({ e, ctx }: { e: GraphEdge; ctx: InspectorContext }) {
  const target = e.to.startsWith('turn:') ? (ctx.graph.turnDrawn[e.to.slice(5)] ? `node:${ctx.graph.turnDrawn[e.to.slice(5)]}` : null) : e.to;
  const chips = e.conditions.flatMap(c => conditionChip(ctx, c));
  return (
    <li className={cx('lab-flow-route', !e.inCall && 'lab-flow-route-ghost')}>
      <span className="lab-flow-route-to">
        {e.drawn && <span className="lab-flow-route-drawn"><Glyph name="drawn" size={11} />{drawnWords(e)}</span>}
        <button type="button" className="lab-chip lab-chip-route" disabled={!target} onClick={() => target && ctx.onSelect(target)}>
          {e.to.startsWith('ending:') ? <Glyph name="ending" size={11} /> : <Glyph name="node" size={11} />}
          <span className="lab-chip-text">{targetText(ctx, e)}</span>
        </button>
      </span>
      <Chips chips={chips} />
      {!e.inCall && e.pruned && <span className="lab-flow-route-why">Dropped in this call: {ctx.words(e.pruned)}</span>}
    </li>
  );
}

// ---------------------------------------------------------------- node

function NodeInspector({ box, ctx }: { box: FlowBox; ctx: InspectorContext }) {
  const node = nodeOf(ctx.tree, box.treeId);
  if (!node) return null;
  const human = humanizeNode(node, ctx.bind);
  const choices = ctx.graph.choices.filter(c => c.node === node.id);
  const writes = [...(ctx.deps?.keys.values() ?? [])].filter(entry => entry.key.startsWith('mark:') && entry.writers.some(site => site.node === node.id));
  return (
    <>
      <header className="lab-flow-insp-head">
        <h2 className="lab-flow-insp-title">{human.title}</h2>
        <span className="lab-flow-insp-kind">{ctx.tree.stageLabels[node.stage] ?? node.stage} · decision point</span>
      </header>
      {box.ghost && box.reason && <p className="lab-flow-insp-ghost"><Tag variant="xray">not in this call</Tag> {box.reason}</p>}
      <Reach n={box.n} ctx={ctx} what="of runs reach this point" />
      <Actions>
        <PlayButton goal={{ node: node.id }} ctx={ctx} />
        <NoteButton sel={{ kind: 'node', node: node.id }} ctx={ctx} />
      </Actions>
      <section className="lab-flow-insp-section">
        <h3 className="lab-flow-insp-sub">The player reads</h3>
        <p className="lab-flow-prompt"><PeopleText text={ctx.bind(node.prompt)} /></p>
        {(node.promptIf ?? []).map((variant, i) => (
          <details key={i} className="lab-flow-variant">
            <summary>Instead, when <Chips chips={stateChips(ctx, variant.when)} /></summary>
            <p className="lab-flow-prompt"><PeopleText text={ctx.bind(variant.prompt)} /></p>
          </details>
        ))}
      </section>
      <section className="lab-flow-insp-section">
        <h3 className="lab-flow-insp-sub">Choices ({choices.filter(c => c.inCall).length}{choices.some(c => !c.inCall) ? ` of ${choices.length}` : ''})</h3>
        <ol className="lab-flow-choices">
          {choices.map(c => {
            const choice = choiceOf(ctx.tree, c.node, c.choice);
            if (!choice) return null;
            const odds = ctx.tally?.odds[`${c.node}/${c.choice}`];
            const view = ctx.playNode === node.id ? ctx.playViews.find(v => v.id === c.actionId) : undefined;
            return (
              <li key={c.choice} className={cx('lab-flow-choice-row', !c.inCall && 'lab-flow-route-ghost')}>
                <button type="button" className="lab-flow-choice-name" onClick={() => ctx.onSelect(`choice:${c.node}/${c.choice}`)}>
                  <Icon name={actionIcon(choice.icon)} size={15} /><span><PeopleText text={ctx.bind(choice.title)} /></span>
                </button>
                <span className="lab-flow-choice-odds">
                  {view ? <span title="Engine odds now, at the Play step (squad in Play)">{view.eligible ? `${percent(view.likelihood.favorable)} goes well now` : <><Glyph name="lock" size={11} />locked now</>}</span>
                    : odds && odds.n ? <span title={`Across ${odds.n} visits in these runs`}>≈ {percent(odds.min)} to {percent(odds.max)} goes well · {odds.n.toLocaleString('en-US')} visits</span>
                      : c.inCall ? <span className="lab-muted">no visits yet</span> : <span className="lab-muted">{ctx.words(c.pruned ?? '')}</span>}
                </span>
                <BandTargets ctx={ctx} node={c.node} choice={c.choice} />
              </li>
            );
          })}
        </ol>
      </section>
      {writes.length > 0 && (
        <section className="lab-flow-insp-section">
          <h3 className="lab-flow-insp-sub">Choices here can set</h3>
          <span className="lab-flow-chips">
            {writes.map(entry => <EffectChip key={entry.key} kind="writes" label={entry.label} count={entry.readers.length} title={`Read in ${entry.readers.length} places; open in Dependencies`} onClick={() => ctx.onKey(entry.key)} />)}
          </span>
        </section>
      )}
      <Findings list={ctx.findings(box.id)} />
    </>
  );
}

/** For a choice: each band's targets as compact chips. */
function BandTargets({ ctx, node, choice }: { ctx: InspectorContext; node: string; choice: string }) {
  const edges = ctx.graph.edges.filter(e => e.node === node && e.choice === choice);
  return (
    <span className="lab-flow-band-targets">
      {BANDS.map(band => {
        const targets = [...new Set(edges.filter(e => e.band === band && e.inCall).map(e => targetText(ctx, e)))];
        if (!targets.length) return null;
        return (
          <span key={band} className="lab-flow-band-target">
            <BandGlyph band={band} size={12} />
            <span>{targets.length > 2 ? `${targets.slice(0, 2).join(', ')} +${targets.length - 2}` : targets.join(', ')}</span>
          </span>
        );
      })}
    </span>
  );
}

// ---------------------------------------------------------------- choice

function ChoiceInspector({ box, ctx }: { box: FlowBox; ctx: InspectorContext }) {
  const choice = box.node && box.choice ? choiceOf(ctx.tree, box.node, box.choice) : undefined;
  if (!choice || !box.node) return null;
  const node = box.node;
  const entry = ctx.graph.choices.find(c => c.node === node && c.choice === choice.id);
  const atNode = ctx.playNode === node;
  const view = atNode ? ctx.playViews.find(v => v.id === entry?.actionId) : undefined;
  const odds = ctx.tally?.odds[`${node}/${choice.id}`];
  return (
    <>
      <header className="lab-flow-insp-head">
        <span className="lab-flow-insp-crumb">{ctx.titleOf(`node:${node}`)} ›</span>
        <h2 className="lab-flow-insp-title"><Icon name={actionIcon(choice.icon)} size={18} /><PeopleText text={ctx.bind(choice.title)} /></h2>
      </header>
      {box.ghost && box.reason && <p className="lab-flow-insp-ghost"><Tag variant="xray">not in this call</Tag> {box.reason}</p>}
      <Reach n={box.n} ctx={ctx} what="of runs take this choice" />
      {odds && odds.n > 0 && <p className="lab-flow-insp-note">Goes well ≈ {percent(odds.min)} to {percent(odds.max)} across {odds.n.toLocaleString('en-US')} visits (engine odds at each visit)</p>}
      <Actions>
        {entry && <PlayButton goal={{ offered: entry.actionId }} ctx={ctx} />}
        <NoteButton sel={{ kind: 'choice', node, choice: choice.id }} ctx={ctx} />
      </Actions>
      {entry && (
        <div className="lab-flow-force">
          <span className="lab-flow-force-label">{atNode ? 'Play this result, staying on Flow' : 'Play this result: open Play at this point first'}</span>
          {BANDS.map(band => (
            <button key={band} type="button" className="lab-button" disabled={!atNode || !view?.eligible} onClick={() => ctx.onForce(entry.actionId, band)}
              title={view ? `${BAND_WORDS[band]} at ${percent(view.likelihood[band])} now` : undefined}>
              <BandGlyph band={band} size={12} />{BAND_WORDS[band]}{view ? ` ${percent(view.likelihood[band])}` : ''}
            </button>
          ))}
        </div>
      )}
      <section className="lab-flow-insp-section">
        <h3 className="lab-flow-insp-sub">On the card</h3>
        <p className="lab-flow-prompt"><PeopleText text={view?.eligible ? view.summary : withLead(ctx.bind(choice.summary))} /></p>
        {!view?.eligible && choice.summary.includes('{lead}') && <p className="lab-flow-insp-note">The game puts the lead officer’s surname where this says “the lead officer”.</p>}
        <dl className="lab-flow-previews">
          {BANDS.map(band => <div key={band}><dt><BandGlyph band={band} words size={12} /></dt><dd><PeopleText text={ctx.bind(choice.preview[band])} /></dd></div>)}
        </dl>
      </section>
      {BANDS.map(band => (
        <section key={band} className="lab-flow-insp-section">
          <h3 className="lab-flow-insp-sub"><BandGlyph band={band} words size={12} /></h3>
          <ol className="lab-flow-outcomes">
            {choice.outcomes[band].map((outcome, i) => <OutcomeRow key={i} outcome={outcome} index={i} band={band} node={node} choice={choice.id} ctx={ctx} />)}
          </ol>
        </section>
      ))}
      {choice.onlyIf && <p className="lab-flow-insp-note">Offered only when <Chips chips={stateChips(ctx, choice.onlyIf)} /></p>}
      <Findings list={ctx.findings(box.id)} />
    </>
  );
}

function OutcomeRow({ outcome, index, band, node, choice, ctx }: { outcome: TreeOutcome; index: number; band: OutcomeBand; node: string; choice: string; ctx: InspectorContext }) {
  const edges = ctx.graph.edges.filter(e => e.node === node && e.choice === choice && e.band === band && e.outcome === index);
  const chips = [...(edges[0]?.conditions ?? []).flatMap(c => conditionChip(ctx, c))];
  const effects: string[] = [
    ...(outcome.mark ?? []).map(m => `sets ${markLabel(ctx, m).charAt(0).toLowerCase()}${markLabel(ctx, m).slice(1)}`),
    ...(outcome.safe ?? []).map(r => `${r.replace(/_/g, ' ')} out safe`),
    ...(outcome.reveal ?? []).map(f => `reveals ${(ctx.tree.facts[f]?.label ?? f).toLowerCase()}`),
    ...Object.entries(outcome.harm ?? {}).map(([r, h]) => `${r.replace(/_/g, ' ')} ${h}`),
    ...(outcome.officer ? [`officer ${outcome.officer}`] : []),
    ...(outcome.fire ? ['fires at the team (drawn)'] : []),
  ];
  return (
    <li className={cx('lab-flow-outcome', !outcome.next && !outcome.force && !outcome.cascade && 'lab-flow-addendum')}>
      <Chips chips={chips} />
      <p className="lab-flow-result"><PeopleText text={ctx.bind(outcome.text)} /></p>
      {effects.length > 0 && <span className="lab-flow-effects">{effects.map(e => <span key={e} className="lab-chip lab-chip-effect"><Glyph name="writes" size={11} />{e}</span>)}</span>}
      {edges.length > 0 ? <ul className="lab-flow-routes">{edges.map(e => <Route key={e.id} e={e} ctx={ctx} />)}</ul>
        : <span className="lab-flow-route-why">Adds to the routed line; goes nowhere by itself.</span>}
    </li>
  );
}

// ---------------------------------------------------------------- ending

function EndingInspector({ box, ctx }: { box: FlowBox; ctx: InspectorContext }) {
  const ending = ctx.tree.endings[box.treeId];
  if (!ending) return null;
  const into = ctx.graph.edges.filter(e => e.to === box.id);
  const reached = ctx.tally?.endings[box.treeId];
  return (
    <>
      <header className="lab-flow-insp-head">
        <h2 className="lab-flow-insp-title">{box.weight && <WeightGlyph weight={box.weight} size={16} />}<PeopleText text={ctx.bind(ending.title)} /></h2>
        <span className="lab-flow-insp-kind">Ending · {DISPOSITION[ending.disposition] ?? ending.disposition}</span>
      </header>
      {box.ghost && box.reason && <p className="lab-flow-insp-ghost"><Tag variant="xray">not in this call</Tag> {box.reason}</p>}
      <Reach n={box.n} ctx={ctx} what="of runs end here" />
      {reached && reached.n > 0 && (
        <div className="lab-flow-insp-mix">
          <StackBar label="How runs that ended here scored" parts={[...WEIGHTS].reverse().map(w => ({ key: w, value: reached.weights[w] ?? 0, tone: w, label: w }))} />
          <span className="lab-flow-insp-note">How the {reached.n.toLocaleString('en-US')} runs that ended here scored: {[...WEIGHTS].reverse().filter(w => reached.weights[w]).map(w => `${w} ${reached.weights[w]}`).join(', ')}</span>
        </div>
      )}
      <Actions>
        <PlayButton goal={{ ending: box.treeId }} ctx={ctx} />
        <NoteButton sel={{ kind: 'ending', ending: box.treeId }} ctx={ctx} />
      </Actions>
      <section className="lab-flow-insp-section">
        <h3 className="lab-flow-insp-sub">The player reads</h3>
        <p className="lab-flow-prompt"><PeopleText text={ctx.bind(ending.summary)} /></p>
      </section>
      <section className="lab-flow-insp-section">
        <h3 className="lab-flow-insp-sub">Reached from ({into.length})</h3>
        <ul className="lab-flow-sources">
          {into.map(e => {
            const choice = choiceOf(ctx.tree, e.node, e.choice);
            const n = ctx.tally ? (ctx.tally.edges[keyOf(e)] ?? 0) : null;
            return (
              <li key={e.id} className={cx(!e.inCall && 'lab-flow-route-ghost')}>
                <button type="button" className="lab-flow-source" onClick={() => ctx.onSelect(`node:${e.node}`)}>
                  <span>{ctx.titleOf(`node:${e.node}`)} › <PeopleText text={ctx.bind(choice?.title ?? e.choice)} /></span>
                  <BandGlyph band={e.band} size={12} />
                  {e.drawn && <span className="lab-flow-route-drawn"><Glyph name="drawn" size={11} />{drawnWords(e)}</span>}
                  {n !== null && <span className="lab-flow-source-n">{n.toLocaleString('en-US')} runs</span>}
                </button>
                <Chips chips={e.conditions.flatMap(c => conditionChip(ctx, c))} />
              </li>
            );
          })}
          {box.treeId === 'handed_over' && <li className="lab-muted">Reached only when no choice is left.</li>}
        </ul>
      </section>
      <Findings list={ctx.findings(box.id)} />
    </>
  );
}

const keyOf = (e: GraphEdge) => matchKey({ node: e.node, choice: e.choice, band: e.band, drawn: e.drawn, to: e.to });

// ---------------------------------------------------------------- turn, junction, ribbon

function TurnInspector({ box, ctx }: { box: FlowBox; ctx: InspectorContext }) {
  const members = ctx.tree.turns?.[box.treeId] ?? [];
  const drawn = ctx.graph.turnDrawn[box.treeId];
  return (
    <>
      <header className="lab-flow-insp-head">
        <h2 className="lab-flow-insp-title"><Glyph name="turn" size={16} />Turn: {box.treeId.replace(/_/g, ' ')}</h2>
        <span className="lab-flow-insp-kind">One of {members.length} nodes is drawn per call, ≈ 1 in {members.length} calls each (draw weights)</span>
      </header>
      <ul className="lab-flow-sources">
        {members.map(m => (
          <li key={m}>
            <button type="button" className="lab-flow-source" onClick={() => ctx.onSelect(`node:${m}`)}>
              <span>{ctx.titleOf(`node:${m}`)}</span>
              {drawn === m ? <Tag variant="xray">drawn in this call</Tag> : drawn ? <span className="lab-muted">not drawn here</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function JunctionInspector({ box, ctx }: { box: FlowBox; ctx: InspectorContext }) {
  const out = ctx.layout.paths.filter(p => p.from === box.id);
  const choice = box.node && box.choice ? choiceOf(ctx.tree, box.node, box.choice) : undefined;
  return (
    <>
      <header className="lab-flow-insp-head">
        <span className="lab-flow-insp-crumb">{box.node ? ctx.titleOf(`node:${box.node}`) : ''} › {choice ? <PeopleText text={ctx.bind(choice.title)} /> : null}</span>
        <h2 className="lab-flow-insp-title"><Glyph name="drawn" size={16} />Drawn result{box.band ? <> after <BandGlyph band={box.band} words size={12} /></> : null}</h2>
        <span className="lab-flow-insp-kind">No band decides these: the engine draws one when the choice commits.</span>
      </header>
      <ul className="lab-flow-sources">
        {out.map(p => (
          <li key={p.id}>
            <button type="button" className="lab-flow-source" onClick={() => ctx.onSelect(p.to)}>
              <span>{p.drawn ? drawnWords({ via: p.via, drawn: p.drawn as GraphEdge['drawn'] }) : ''} → {ctx.titleOf(p.to)}</span>
              {p.n !== null && <span className="lab-flow-source-n">{p.n.toLocaleString('en-US')} runs</span>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function PathInspector({ path, ctx }: { path: FlowPath; ctx: InspectorContext }) {
  const edges = ctx.graph.edges.filter(e => path.edges.includes(e.id));
  const choices = [...new Map(edges.map(e => [`${e.node}/${e.choice}`, e])).values()];
  const runs = ctx.tally?.runs ?? 0;
  const what = path.kind === 'drawn' ? `Drawn result: ${drawnWords({ via: path.via, drawn: path.drawn as GraphEdge['drawn'] })}` : path.kind === 'turn' ? 'Turn drawn per call'
    : path.kind === 'choice' ? 'Choice taken' : path.band ? BAND_WORDS[path.band] : '';
  return (
    <>
      <header className="lab-flow-insp-head">
        <span className="lab-flow-insp-crumb">{ctx.titleOf(path.from)} → {ctx.titleOf(path.to)}</span>
        <h2 className="lab-flow-insp-title">{path.band && <BandGlyph band={path.band} size={16} />}{what}</h2>
      </header>
      {path.n !== null && runs > 0 && (
        <p className="lab-flow-insp-reach">
          <ProbValue p={path.n / runs} prov={ctx.prov} ci={wilson(path.n, runs)} k={path.n} />
          <span className="lab-flow-insp-what">{path.n === 0 ? 'never taken in these runs' : 'of runs take this route'}</span>
        </p>
      )}
      {path.ghost && <p className="lab-flow-insp-ghost"><Tag variant="xray">not in this call</Tag> {ctx.words(edges.find(e => e.pruned)?.pruned ?? 'Dropped in this call.')}</p>}
      {choices.length > 0 && (
        <section className="lab-flow-insp-section">
          <h3 className="lab-flow-insp-sub">Choices behind it</h3>
          <ul className="lab-flow-sources">
            {choices.map(e => {
              const choice = choiceOf(ctx.tree, e.node, e.choice);
              const conditions = edges.filter(x => x.node === e.node && x.choice === e.choice).flatMap(x => x.conditions.flatMap(c => conditionChip(ctx, c)));
              return (
                <li key={`${e.node}/${e.choice}`}>
                  <button type="button" className="lab-flow-source" onClick={() => ctx.onSelect(`choice:${e.node}/${e.choice}`)}>
                    <span><PeopleText text={ctx.bind(choice?.title ?? e.choice)} /></span>
                  </button>
                  <Chips chips={dedupe(conditions)} />
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <Actions>
        {edges[0] && <PlayButton goal={{ offered: ctx.graph.choices.find(c => c.node === edges[0].node && c.choice === edges[0].choice)?.actionId ?? '' }} ctx={ctx} label="Play to this choice" />}
      </Actions>
    </>
  );
}

const dedupe = (chips: ConditionChip[]) => [...new Map(chips.map(c => [`${c.text}|${c.holds}`, c])).values()];

/** `{lead}` is the engine's: the lead officer's surname, known only once a squad is chosen. */
const withLead = (text: string) => text.replace(/\{lead\}/g, (_match, at: number) => (at === 0 || /[.!?]\s*$/.test(text.slice(0, at)) ? 'The lead officer' : 'the lead officer'));
