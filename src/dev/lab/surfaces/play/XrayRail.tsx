// The X-ray rail (spec 3.2): what the player can't see, beside what they can. The truth strip (the
// situation's hidden facts on tape, with what the team knows of each), "This moment" (one compact row
// per choice offered at this state, in the order of the player's cards, with the engine's odds, where
// each band goes, the minutes and the dilemma flags; the selected row opens into its full note), and
// the state, clocks and people at this moment.
import { useMemo, useState } from 'react';
import { requirementTree } from '../../../../gen/incident/trees-v13/dependencies';
import type { DependencyIndex } from '../../../../gen/incident/trees-v13/dependencies';
import { stanceOf } from '../../../../sim/meters';
import type { OutcomeBand } from '../../../../sim/types';
import { useLab } from '../../context';
import type { DilemmaRow } from '../../model/dilemma';
import { percent } from '../../model/label';
import type { Frame, Session } from '../../model/session';
import { clockRows, endedSummary, keysSet, notOfferedHere, personTruth, truthStrip, whereIs } from '../../model/xray';
import type { ChoiceXray } from '../../model/xray';
import { BAND_WORDS, cx, FlagGlyph, Glyph, KeyChip, PeopleGlyph, RouteChip, Tag, WeightGlyph } from '../../viz';
import type { PeopleKind } from '../../viz';
import { CompareRail } from './CompareRail';
import { FullNote } from './FullNote';
import type { Leads } from './FullNote';
import { WhyPanel } from './WhyPanel';

const TEAM: Record<string, string> = { unknown: 'team: unknown', reported: 'team: reported', confirmed: 'team: confirmed', disproved: 'team: ruled out' };
const BANDS: readonly OutcomeBand[] = ['favorable', 'mixed', 'adverse'];

function TruthStrip({ session, frame, tape, onTape, narrow }: { session: Session; frame: Frame; tape: boolean; onTape(): void; narrow: boolean }) {
  const run = frame.state.activeRun;
  const facts = run ? truthStrip(session.scenario, run) : [];
  const [open, setOpen] = useState(!narrow);
  return (
    <section className="lab-truth" aria-label="Hidden truth">
      <header className="lab-xray-head">
        <button type="button" className="lab-xray-fold" aria-expanded={open} onClick={() => setOpen(value => !value)}>
          <Glyph name="situation" /><span className="lab-xray-title">Truth</span><span className="lab-muted">situation {session.situation + 1} of 3{!open ? ` · ${facts.filter(fact => fact.truth).length} of ${facts.length} true` : ''}</span>
          <Glyph name="caret" size={12} className={open ? undefined : 'lab-rot-270'} />
        </button>
        <button type="button" className={cx('lab-toggle', tape && 'lab-toggle-on')} aria-pressed={tape} onClick={onTape} title="Tape tags beside people in the frame (T)">
          <span>Tape in frame</span><i className="lab-toggle-dot" aria-hidden="true" />
        </button>
      </header>
      {open && (
        <ul className="lab-truth-list">
          {facts.map(fact => (
            <li key={fact.fact} className="lab-truth-row">
              <span className="lab-truth-label">{fact.label}</span>
              <Tag variant="tape" title="Hidden truth in this situation">{fact.truth ? 'true' : 'false'}</Tag>
              <span className={cx('lab-truth-team', `lab-truth-${fact.team}`)}>{TEAM[fact.team]}</span>
            </li>
          ))}
          {!facts.length && <li className="lab-muted">This call has no hidden facts.</li>}
        </ul>
      )}
    </section>
  );
}

function MomentRow({ x, n, d, selected, onSelect, onHover }: { x: ChoiceXray; n: number; d: DilemmaRow | undefined; selected: boolean; onSelect(): void; onHover(on: boolean): void }) {
  const flags = d?.flags ?? [];
  return (
    <button type="button" className={cx('lab-row', selected && 'lab-row-on', !x.view.eligible && 'lab-row-locked')} aria-expanded={selected}
      onClick={onSelect} onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)} onFocus={() => onHover(true)} onBlur={() => onHover(false)}>
      <span className="lab-row-n" data-lab-row={x.actionId}>{n}</span>
      <span className="lab-row-title">
        <span className="lab-row-name">{x.title}</span>
        {x.shown === 'behind-show-all' && <Tag>behind Show all</Tag>}
      </span>
      {x.view.eligible ? <>
        <span className="lab-row-odds" title={`Goes well ${percent(x.view.likelihood.favorable)}: engine, now`}>{percent(x.view.likelihood.favorable)}</span>
        <span className="lab-row-routes">
          {BANDS.map(band => {
            const route = x.bands[band];
            // How many different places a drawn result can send this band.
            const ways = new Set(route.drawn.flatMap(entry => entry.results.flatMap(result => result.to ? [result.to.title] : []))).size;
            const to = route.to ?? null;
            return <RouteChip key={band} band={band} to={to ? { kind: to.kind, title: to.title } : null} drawnWays={!route.to ? ways : undefined} harm={route.mayHarm}
              title={`${BAND_WORDS[band]} ${percent(route.p)} → ${to ? to.title : 'a drawn result decides'}`} />;
          })}
        </span>
        <span className="lab-row-min" title="Expected minutes (engine)">{x.view.timeLabel ?? `${x.view.timeCost} min`}</span>
        <span className="lab-row-flags">{flags.map((flag, i) => <FlagGlyph key={i} flag={flag.kind} />)}</span>
      </> : (
        <span className="lab-row-lock"><Glyph name="lock" size={12} /><span>{x.view.reason ?? 'Locked'}</span></span>
      )}
    </button>
  );
}

function NotOffered({ session, frame, deps }: { session: Session; frame: Frame; deps: DependencyIndex | null }) {
  const rows = notOfferedHere(session, frame);
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) return null;
  return (
    <details className="lab-moment-off">
      <summary>Not offered here ({rows.length})</summary>
      <ul>
        {rows.map(row => (
          <li key={row.actionId}>
            <button type="button" className="lab-moment-off-row" aria-expanded={open === row.actionId} onClick={() => setOpen(open === row.actionId ? null : row.actionId)}>
              <Glyph name="lock" size={12} />{row.title}
            </button>
            {open === row.actionId && <WhyPanel session={session} frame={frame} deps={deps} req={requirementTree(session.tree, { choice: [row.node, row.choice] })} target={{ choice: [row.node, row.choice] }} reason={null} />}
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatePanels({ session, frame, deps, tape }: { session: Session; frame: Frame; deps: DependencyIndex | null; tape: boolean }) {
  const [tab, setTab] = useState<'state' | 'clocks' | 'people'>('state');
  const { navigate } = useLab();
  const run = frame.state.activeRun;
  if (!run) return null;
  const keys = keysSet(session, frame.state, deps);
  const clocks = clockRows(session.scenario, run);
  const people = (session.scenario.incidentPeople ?? []);
  const bindings = session.scenario.story?.bindings.people ?? {};
  return (
    <section className="lab-panels" aria-label="State at this moment">
      <div className="lab-panels-tabs" role="tablist">
        {(['state', 'clocks', 'people'] as const).map(entry => (
          <button key={entry} type="button" role="tab" aria-selected={tab === entry} className={cx('lab-panels-tab', tab === entry && 'lab-panels-tab-on')} onClick={() => setTab(entry)}>
            {entry === 'state' ? `State (${keys.length})` : entry === 'clocks' ? `Clocks (${clocks.length})` : `People (${people.length})`}
          </button>
        ))}
      </div>
      {tab === 'state' && (
        <div className="lab-panels-body">
          {keys.length ? <div className="lab-panels-keys">{keys.map(key => (
            <span key={key.key} className="lab-panels-key">
              <KeyChip label={key.label} set onClick={() => navigate({ tab: 'deps', sel: { kind: 'key', key: key.key } })} />
              <span className="lab-muted">{key.readers ? `read later by ${key.readers}` : 'no later line reads it'}</span>
            </span>
          ))}</div> : <p className="lab-muted">Nothing set yet: no marks, nobody out.</p>}
          <p className="lab-panels-scalars">Pressure <b>{Math.round(run.pressure)}</b> · call progress <b>{Math.round(run.objective)}</b> · civilian safety <b>{Math.round(run.civilianSafety)}</b> · <b>{Math.round(run.clock)}</b> min in</p>
        </div>
      )}
      {tab === 'clocks' && (
        <div className="lab-panels-body">
          {clocks.length ? clocks.map(clock => (
            <div key={clock.id} className={cx('lab-clock', clock.low && 'lab-clock-low', clock.out && 'lab-clock-out')}>
              <span className="lab-clock-label"><Glyph name="clock" size={13} />{clock.label}</span>
              <span className="lab-clock-bar" role="img" aria-label={`${Math.round(clock.value)} of 100`}><i style={{ width: `${Math.max(0, Math.min(100, clock.value))}%` }} /></span>
              <span className="lab-clock-left">{clock.out ? 'out' : clock.stopped ? 'stopped' : clock.minutesLeft !== null ? `${clock.minutesLeft} min left` : 'no rate'}{!clock.rateKnown && !clock.out ? <span className="lab-muted"> (team can't see the rate)</span> : null}</span>
              {clock.latest && <span className="lab-clock-cue">Last cue: {clock.latest}</span>}
            </div>
          )) : <p className="lab-muted">No clock runs in this situation.</p>}
        </div>
      )}
      {tab === 'people' && (
        <ul className="lab-panels-body lab-people">
          {people.map(person => {
            const kind = (bindings[person.id]?.publicKind === 'subject' ? 'subject' : bindings[person.id]?.publicKind === 'civilian' ? 'civilian' : 'person') as PeopleKind;
            const meters = run.meters?.[person.id];
            return (
              <li key={person.id} className="lab-person">
                <PeopleGlyph kind={kind} />
                <span className="lab-person-name">{person.label}</span>
                {meters && <span className="lab-person-stance" title={`Agitation ${Math.round(meters.agitation)}, rapport ${Math.round(meters.rapport)}`}>{stanceOf(meters)}</span>}
                {tape && <Tag variant="tape" title="Hidden truth">{personTruth(person)}</Tag>}
                {run.personCasualties?.[person.id] && <span className="lab-tone-hurt"><Glyph name="hurt" size={11} />{run.personCasualties[person.id].severity}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function XrayRail(p: {
  narrow: boolean; session: Session; frame: Frame; rows: ChoiceXray[]; dilemma: DilemmaRow[]; deps: DependencyIndex | null; selectedId: string | null; who: string; aiming: boolean;
  onSelect(id: string): void; onHover(id: string | null): void; onForce(id: string, band: OutcomeBand): void; onForceDrawn(id: string, band: OutcomeBand, drawn: string[]): void;
  onRoll(id: string): void; leads: Record<string, Leads>; onLeads(id: string): void; onNote(): void;
}) {
  const { url, navigate } = useLab();
  const where = whereIs(p.session, p.frame.state);
  const ended = useMemo(() => endedSummary(p.session, p.frame.state), [p.session, p.frame]);
  const byId = useMemo(() => new Map(p.dilemma.map(row => [row.actionId, row])), [p.dilemma]);
  const header = `engine · at this state · ${p.who}`;
  const at = p.rows.findIndex(row => row.actionId === p.selectedId);
  const selected = at >= 0 ? { x: p.rows[at], n: at + 1 } : null;
  return (
    <div className="lab-xray">
      <TruthStrip session={p.session} frame={p.frame} tape={url.truth} onTape={() => navigate({ truth: !url.truth }, 'replace')} narrow={p.narrow} />
      <section className="lab-moment" aria-label="This moment">
        <header className="lab-moment-head">
          <span className="lab-xray-title">This moment</span>
          {where && <span className="lab-moment-where">{where.kind === 'node' ? where.title : 'Call ended'}</span>}
          <span className="lab-moment-prov" title="Odds and routes from one exact engine state, for this squad">{header}</span>
          <button type="button" className={cx('lab-toggle', url.vs && 'lab-toggle-on')} aria-pressed={!!url.vs} disabled={p.session.squad.kind === 'game'}
            title={p.session.squad.kind === 'game' ? 'A call from the game keeps its own draw' : 'The same picks under a second instance, side by side'}
            onClick={() => navigate({ vs: url.vs ? null : { kit: url.call?.kit === 'day1' ? 'none' : 'day1' } }, 'replace')}>
            <span>Compare</span><i className="lab-toggle-dot" aria-hidden="true" />
          </button>
        </header>
        {ended ? (
          <div className="lab-ended">
            <p className="lab-ended-title"><WeightGlyph weight={ended.weight} words /><span>{ended.ending.title}</span></p>
            {ended.authored && ended.disposition && ended.authored !== ended.disposition && (
              <p className="lab-ended-note">Authored ending says {ended.authored.replace(/_/g, ' ')}; the debrief scored {ended.disposition.replace(/_/g, ' ')} from where people ended up.</p>
            )}
            {ended.lines.length > 0 && <ul className="lab-ended-lines">{ended.lines.map((line, i) => <li key={i}><span>{line.text}</span><b className={line.trust < 0 ? 'lab-tone-badly' : line.trust > 0 ? 'lab-tone-well' : undefined}>{line.trust > 0 ? '+' : ''}{line.trust}</b></li>)}</ul>}
          </div>
        ) : p.rows.length === 0 ? <p className="lab-muted lab-moment-empty">No choice is offered here. A stage continuation or the failed-response report is in the frame.</p> : (
          <>
            <div className="lab-moment-cols" aria-hidden="true">
              <span>#</span><span>Choice</span><span>Well</span><span>Goes well · Complications · Goes badly → where</span><span>Time</span><span />
            </div>
            <ol className="lab-moment-list">
              {p.rows.map((x, i) => {
                const selected = x.actionId === p.selectedId;
                return (
                  <li key={x.actionId} className={cx('lab-moment-item', selected && 'lab-moment-item-on')}>
                    <MomentRow x={x} n={i + 1} d={byId.get(x.actionId)} selected={selected} onSelect={() => p.onSelect(x.actionId)} onHover={on => p.onHover(on ? x.actionId : null)} />
                  </li>
                );
              })}
            </ol>
            <NotOffered session={p.session} frame={p.frame} deps={p.deps} />
            {selected && (
              <section className="lab-note-panel" aria-label={`Full note: ${selected.x.title}`}>
                <header className="lab-note-panel-head">
                  <span className="lab-row-n">{selected.n}</span>
                  <span className="lab-note-panel-title">{selected.x.title}</span>
                  {!selected.x.view.eligible && <span className="lab-note-panel-lock"><Glyph name="lock" size={12} />locked here</span>}
                </header>
                <FullNote key={selected.x.actionId} session={p.session} frame={p.frame} x={selected.x} d={byId.get(selected.x.actionId)} rows={p.rows} deps={p.deps} who={p.who} aiming={p.aiming}
                  leads={p.leads[selected.x.actionId]} onForce={band => p.onForce(selected.x.actionId, band)} onForceDrawn={(band, drawn) => p.onForceDrawn(selected.x.actionId, band, drawn)}
                  onRoll={() => p.onRoll(selected.x.actionId)} onLeads={() => p.onLeads(selected.x.actionId)} onNote={p.onNote} />
              </section>
            )}
          </>
        )}
      </section>
      {url.vs && p.session.squad.kind !== 'game' && <CompareRail session={p.session} frame={p.frame} deps={p.deps} vs={url.vs} />}
      <StatePanels session={p.session} frame={p.frame} deps={p.deps} tape={url.truth} />
    </div>
  );
}
