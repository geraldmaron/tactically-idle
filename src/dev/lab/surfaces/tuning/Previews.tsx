// What a group's fields do, drawn from the engine under the saved tuning and under the patch (spec
// 3.7 "Previews"): the band curve with this moment's choices on it, force outcomes per tool, the
// officer hit chance per weapon, the follow chance over rapport and agitation, and minutes per
// choice. Groups that change the department between calls say so instead.
import { useMemo } from 'react';
import type { TuningPatch } from '../../../../sim/tuning';
import { percent } from '../../model/label';
import { cx, StackBar } from '../../viz';
import type { StackPart } from '../../viz';
import { circled, TuningCurve } from './Curve';
import type { CurveChoice } from './Curve';
import { cascadeGrid, curvePoints, exposurePreview, forcePreview, meterEvents, thresholdsOf } from './studio';
import type { InstantRow, StudioGroup, StudioLayers } from './studio';

/** The Play node the previews read: its choices (instant tier rows) and how to name it. */
export interface Moment { status: 'none' | 'loading' | 'ended' | 'ready'; rows: readonly InstantRow[]; where: string; who: string }

const CURVE_GROUPS: ReadonlySet<StudioGroup> = new Set(['odds', 'pressure', 'subjects']);

export function GroupPreview({ group, layers, patch, hash, savedHash, moment }: {
  group: StudioGroup; layers: StudioLayers; patch: TuningPatch; hash: string; savedHash: string; moment: Moment;
}) {
  if (group === 'fixed') return null;
  return (
    <div className="lab-tpreview">
      {CURVE_GROUPS.has(group) && <CurvePanel layers={layers} patch={patch} hash={hash} savedHash={savedHash} moment={moment} />}
      {group === 'subjects' && <><MeterPanel layers={layers} /><CascadePanel patch={patch} hash={hash} /></>}
      {group === 'harm' && <><ForcePanel patch={patch} hash={hash} /><ExposurePanel patch={patch} hash={hash} /></>}
      {group === 'time' && <MinutesPanel moment={moment} />}
      {(group === 'strain' || group === 'debrief') && (
        <p className="lab-tpreview-note">{group === 'strain'
          ? 'Strain lands on the officers after each choice and shows in their stress and the shift report. No curve here: the quick check plays the call through, and the instant column shows this moment\'s odds.'
          : 'These fields score the call at its end: trust, strain and what it pays. The quick check counts costly endings with them; the instant column shows this moment\'s odds.'}</p>
      )}
      {(group === 'economy' || group === 'flow') && (
        <p className="lab-tpreview-note">No call-level preview. These fields change the department between calls, so the instant, quick and gate checks stay where they are.</p>
      )}
    </div>
  );
}

function PanelHead({ title, pill }: { title: string; pill: string }) {
  return (
    <header className="lab-tpanel-head">
      <h3 className="lab-tpanel-title">{title}</h3>
      <span className="lab-pill"><span className="lab-pill-seg">{pill}</span></span>
    </header>
  );
}

function CurvePanel({ layers, patch, hash, savedHash, moment }: { layers: StudioLayers; patch: TuningPatch; hash: string; savedHash: string; moment: Moment }) {
  const points = useMemo(() => curvePoints(patch), [hash]);
  const saved = useMemo(() => curvePoints({}), [savedHash]);
  const choices: CurveChoice[] = moment.rows.flatMap((row, i) => row.eligible && row.after.margin !== null
    ? [{ id: row.id, n: i + 1, title: row.title, margin: row.after.margin, before: row.before.likelihood.favorable, after: row.after.likelihood.favorable }] : []);
  return (
    <section className="lab-tpanel lab-tpanel-curve" aria-label="Band chances by margin">
      <PanelHead title="Band chances by margin" pill="exact · engine formula" />
      <TuningCurve points={points} saved={saved} choices={choices} thresholds={thresholdsOf(layers)}
        label={`Band chances by margin, now and saved${choices.length ? `, with ${choices.length} choices at ${moment.where}` : ''}`} />
      <p className="lab-tpanel-foot">
        {moment.status === 'ready' && choices.length > 0 && <>Numbered choices sit at their margins at <b>{moment.where}</b> ({moment.who}).</>}
        {moment.status === 'ready' && choices.length === 0 && <>No choice at <b>{moment.where}</b> has a margin to place.</>}
        {moment.status === 'ended' && <>The Play path ends the call here, so no choices sit on the curve. Rewind in Play to place them.</>}
        {moment.status === 'none' && <>Open a call to place this moment's choices on the curve.</>}
        {moment.status === 'loading' && <>Placing this moment's choices…</>}
      </p>
    </section>
  );
}

const FORCE_TONES: { key: 'fatal' | 'serious' | 'wounded' | 'none'; tone: StackPart['tone']; label: string }[] = [
  { key: 'fatal', tone: 'death', label: 'killed' }, { key: 'serious', tone: 'hurt', label: 'badly hurt' },
  { key: 'wounded', tone: 'costly', label: 'hurt' }, { key: 'none', tone: 'muted', label: 'unhurt' },
];

function ForcePanel({ patch, hash }: { patch: TuningPatch; hash: string }) {
  const rows = useMemo(() => forcePreview(patch), [hash]);
  return (
    <section className="lab-tpanel" aria-label="When force is used">
      <PanelHead title="When force is used" pill="exact · forceDistribution" />
      <div className="lab-tbars">
        {rows.map(row => {
          const parts = (d: typeof row.now) => FORCE_TONES.map(t => ({ key: t.key, value: d[t.key], tone: t.tone, label: t.label }));
          const moved = FORCE_TONES.some(t => Math.abs(row.now[t.key] - row.saved[t.key]) > 1e-9);
          return (
            <div key={row.profile} className={cx('lab-tbar', moved && 'lab-tbar-moved')}>
              <span className="lab-tbar-label">{row.label}</span>
              <StackBar parts={parts(row.now)} baseline={moved ? parts(row.saved) : null} label={row.label} />
              <span className="lab-tbar-value">killed {moved ? `${percent(row.saved.fatal)} → ` : ''}{row.now.fatal > 0 ? percent(row.now.fatal) : 'never'}</span>
            </div>
          );
        })}
      </div>
      <p className="lab-tpanel-foot"><span className="lab-tkey lab-tkey-death" />killed <span className="lab-tkey lab-tkey-hurt" />badly hurt <span className="lab-tkey lab-tkey-costly" />hurt <span className="lab-tkey lab-tkey-muted" />unhurt. The thin bar under a moved row is the saved mix.</p>
    </section>
  );
}

function ExposurePanel({ patch, hash }: { patch: TuningPatch; hash: string }) {
  const data = useMemo(() => exposurePreview(patch), [hash]);
  const pos = (v: number) => `${Math.max(0, Math.min(1, v)) * 100}%`;
  return (
    <section className="lab-tpanel" aria-label="Officer hit chance">
      <PanelHead title="Officer hit chance when a subject attacks" pill="ordinary hand · mid range" />
      <div className="lab-tbars">
        {data.rows.map(row => {
          const moved = Math.abs(row.now - row.saved) > 1e-9;
          return (
            <div key={row.weapon} className={cx('lab-tbar', moved && 'lab-tbar-moved')}>
              <span className="lab-tbar-label">{row.label}</span>
              <span className="lab-thit" role="img" aria-label={`${row.label}: ${moved ? `${percent(row.saved)} → ` : ''}${percent(row.now)}`}>
                <i className="lab-thit-clamp" style={{ left: 0, width: pos(data.floor.now) }} />
                <i className="lab-thit-clamp" style={{ left: pos(data.ceiling.now), right: 0 }} />
                <i className="lab-thit-fill" style={{ width: pos(row.now) }} />
                {moved && <i className="lab-thit-saved" style={{ left: pos(row.saved) }} />}
              </span>
              <span className="lab-tbar-value">{moved ? `${percent(row.saved)} → ` : ''}{percent(row.now)}</span>
            </div>
          );
        })}
      </div>
      <p className="lab-tpanel-foot">Hatched ends: the engine never goes below {percent(data.floor.now)} or above {percent(data.ceiling.now)} after range, cover and the shooter's practice. A tick marks the saved chance.</p>
    </section>
  );
}

const METER_SPAN = 30;

/** One meter move as a bar from the middle: right is up. Agitation up and rapport down read as bad. */
function MeterBar({ meter, value, saved }: { meter: 'agitation' | 'rapport'; value: number; saved: number }) {
  const at = (v: number) => `${50 + (Math.max(-METER_SPAN, Math.min(METER_SPAN, v)) / METER_SPAN) * 50}%`;
  const bad = meter === 'agitation' ? value > 0 : value < 0;
  const moved = value !== saved;
  return (
    <span className="lab-tmeter" role="img" aria-label={`${meter} ${value > 0 ? '+' : ''}${value}${moved ? ` (saved ${saved > 0 ? '+' : ''}${saved})` : ''}`}>
      <span className="lab-tmeter-track">
        <i className={cx('lab-tmeter-fill', bad ? 'lab-tmeter-bad' : 'lab-tmeter-good')} style={value >= 0 ? { left: '50%', width: `calc(${at(value)} - 50%)` } : { left: at(value), width: `calc(50% - ${at(value)})` }} />
        {moved && <i className="lab-tmeter-saved" style={{ left: at(saved) }} />}
      </span>
      <b className={cx('lab-tmeter-value', moved && 'lab-tmeter-moved')}>{value > 0 ? '+' : value < 0 ? '−' : ''}{Math.abs(value)}</b>
    </span>
  );
}

function MeterPanel({ layers }: { layers: StudioLayers }) {
  const rows = meterEvents(layers);
  return (
    <section className="lab-tpanel" aria-label="What moves a subject">
      <PanelHead title="What moves a subject" pill="per event · shifting subject" />
      <table className="lab-tmeters">
        <thead><tr><th scope="col"><span className="lab-tsr">Event</span></th><th scope="col">agitation</th><th scope="col">rapport</th></tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.event}>
              <th scope="row">{row.label}</th>
              <td><MeterBar meter="agitation" value={row.agitation.now} saved={row.agitation.saved} /></td>
              <td><MeterBar meter="rapport" value={row.rapport.now} saved={row.rapport.saved} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lab-tpanel-foot">Points each event moves a shifting subject; steady and volatile subjects scale it. Talk pays reads the rapport built and agitation shed since the call began.</p>
    </section>
  );
}

function CascadePanel({ patch, hash }: { patch: TuningPatch; hash: string }) {
  const grid = useMemo(() => cascadeGrid(patch), [hash]);
  return (
    <section className="lab-tpanel" aria-label="Follow chance">
      <PanelHead title="A group member follows a surrender" pill="exact · cascadeChance" />
      <table className="lab-tgrid">
        <caption className="lab-tgrid-caption">Chance for a member held halfway, by rapport with the team (rows) and agitation (columns).</caption>
        <thead><tr><th scope="col"><span className="lab-tsr">Rapport</span></th>{grid.agitation.map(a => <th key={a} scope="col">agitation {a}</th>)}</tr></thead>
        <tbody>
          {grid.rapport.map((r, i) => (
            <tr key={r}>
              <th scope="row">rapport {r}</th>
              {grid.agitation.map((a, j) => {
                const now = grid.now[i][j], saved = grid.saved[i][j];
                const moved = Math.abs(now - saved) > 1e-9;
                return (
                  <td key={a} className={cx('lab-tgrid-cell', moved && 'lab-tgrid-moved')} style={{ ['--lab-tgrid-p' as string]: now }}
                    title={`Rapport ${r}, agitation ${a}: ${moved ? `${percent(saved)} → ` : ''}${percent(now)}`}>{percent(now)}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function MinutesPanel({ moment }: { moment: Moment }) {
  const rows = moment.rows.filter(row => row.eligible);
  return (
    <section className="lab-tpanel" aria-label="Minutes per choice">
      <PanelHead title="Minutes per choice at this moment" pill="engine · now · expected" />
      {moment.status !== 'ready' || rows.length === 0
        ? <p className="lab-tpanel-foot">{moment.status === 'none' ? 'Open a call to see how long this moment\'s choices take.' : moment.status === 'ended' ? 'The Play path ends the call here. Rewind in Play to see choices.' : 'Reading this moment…'}</p>
        : (
          <ol className="lab-tminutes">
            {rows.map(row => (
              <li key={row.id} className={cx(row.after.minutes !== row.before.minutes && 'lab-tminutes-moved')}>
                <span className="lab-tminutes-n">{circled(moment.rows.indexOf(row) + 1)}</span>
                <span className="lab-tminutes-title">{row.title}</span>
                <span className="lab-tminutes-value">{row.after.minutes !== row.before.minutes ? `${row.before.minutes} → ` : ''}{row.after.minutes} min</span>
              </li>
            ))}
          </ol>
        )}
    </section>
  );
}
