// The group's dials (spec 3.7, 7.5): each one a slider in plain words beside the raw fields it
// writes, with default, saved and now for each. A dial whose fields were edited apart in the
// advanced fields reads "custom" and offers to move them together again.
import { useState } from 'react';
import type { TuningPatch, TuningPath } from '../../../../sim/tuning';
import { TUNING_META } from '../../../../sim/tuning-meta';
import { dialText, getPath, linkedWrite, MACRO_DIALS, partnerOf, togetherValue } from '../../model/macros';
import type { DialLayers, MacroDial } from '../../model/macros';
import { cx, Dial, Glyph } from '../../viz';
import { RawPath } from './Fields';
import { fieldState, formatValue, sameValue, unitWord } from './studio';
import type { StudioLayers, StudioGroup } from './studio';

export interface DialActions { write(patch: TuningPatch, source: string): void; revert(paths: readonly TuningPath[]): void }

const nowOf = (layers: StudioLayers): DialLayers => ({ defaults: layers.defaults, current: layers.current });
const savedOf = (layers: StudioLayers): DialLayers => ({ defaults: layers.defaults, current: layers.saved });
const scaleOf = (dial: MacroDial) => (dial.kind === 'chance' ? 100 : 1);
const isPending = (paths: readonly TuningPath[], layers: StudioLayers) => paths.some(path => !sameValue(getPath(layers.current, path), getPath(layers.saved, path)));
/** A dial is unsaved when its own position moved: Difficulty and the complications window share
 * two fields, and moving one leaves the other where it was. */
const dialPending = (dial: MacroDial, layers: StudioLayers) => {
  const now = dial.read(nowOf(layers)), saved = dial.read(savedOf(layers));
  return typeof now === 'number' && typeof saved === 'number' ? Math.abs(now - saved) > 1e-9 : now !== saved || isPending(dial.writes, layers);
};
/** Back to tuning.json: the dial's saved position written over its fields (a shared field keeps the
 * other dial's move), or its fields dropped from the patch when the saved position isn't a number. */
const revertDial = (dial: MacroDial, layers: StudioLayers, actions: DialActions) => {
  const saved = dial.read(savedOf(layers));
  if (typeof saved === 'number') actions.write(dial.write(saved, nowOf(layers)), '');
  else actions.revert(dial.writes);
};

export function GroupDials({ group, layers, actions }: { group: StudioGroup; layers: StudioLayers; actions: DialActions }) {
  const dials = MACRO_DIALS.filter(dial => dial.group === group);
  const seen = new Set<string>();
  if (!dials.length) return null;
  return (
    <div className="lab-tdials">
      {dials.map(dial => {
        if (dial.pair) {
          if (seen.has(dial.pair)) return null;
          seen.add(dial.pair);
          return <PairCard key={dial.pair} dial={dial} layers={layers} actions={actions} />;
        }
        return <DialCard key={dial.id} dial={dial} layers={layers} actions={actions} />;
      })}
    </div>
  );
}

/** The slider for one dial, in the dial's own unit (chances as percents). */
function DialSlider({ dial, layers, actions, linked = false, showLabel = false }: { dial: MacroDial; layers: StudioLayers; actions: DialActions; linked?: boolean; showLabel?: boolean }) {
  const value = dial.read(nowOf(layers));
  const saved = dial.read(savedOf(layers));
  const scale = scaleOf(dial);
  if (value === 'custom') {
    return (
      <div className="lab-tdial-custom">
        <p><Glyph name="field" size={13} />Custom: these fields were edited apart in the advanced fields, so no single position fits them.</p>
        <button type="button" className="lab-button" onClick={() => actions.write(dial.write(togetherValue(dial, nowOf(layers)), nowOf(layers)), dial.id)}>Make them move together</button>
      </div>
    );
  }
  const ticks = [{ value: dial.neutral * scale, label: 'default' }];
  if (typeof saved === 'number' && Math.abs(saved - dial.neutral) > 1e-9) ticks.push({ value: saved * scale, label: 'saved' });
  return (
    <div className="lab-tdial-slider">
      {showLabel && <span className="lab-tdial-sub"><span>{dial.label}</span><b className={cx('lab-tdial-value', dialPending(dial, layers) && 'lab-tdial-value-pending')}>{dialText(dial, value)}</b></span>}
      <Dial label={dial.label} value={Math.round(value * scale * 1e6) / 1e6} min={dial.range[0] * scale} max={dial.range[1] * scale} step={Math.round(dial.step * scale * 1e6) / 1e6}
        ticks={ticks} format={v => dialText(dial, v / scale)}
        onChange={v => actions.write(linked ? linkedWrite(dial, v / scale, nowOf(layers)) : dial.write(v / scale, nowOf(layers)), linked ? dial.pair ?? dial.id : dial.id)} />
    </div>
  );
}

function DialHead({ title, value, pending, onRevert }: { title: string; value: string | null; pending: boolean; onRevert: () => void }) {
  return (
    <header className="lab-tdial-head">
      <h3 className="lab-tdial-title">{title}</h3>
      {value !== null && <b className={cx('lab-tdial-value', pending && 'lab-tdial-value-pending')}>{value}</b>}
      {pending && <button type="button" className="lab-icon-button lab-tdial-revert" onClick={onRevert} title="Put these fields back to tuning.json" aria-label={`Undo ${title} back to tuning.json`}><Glyph name="undo" size={13} /></button>}
    </header>
  );
}

function DialCard({ dial, layers, actions }: { dial: MacroDial; layers: StudioLayers; actions: DialActions }) {
  const value = dial.read(nowOf(layers));
  const pending = dialPending(dial, layers);
  return (
    <section className={cx('lab-tdial', pending && 'lab-tdial-pending')} id={`lab-dial-${dial.id}`} aria-label={dial.label}>
      <div className="lab-tdial-main">
        <DialHead title={dial.label} value={value === 'custom' ? 'custom' : dialText(dial, value)} pending={pending} onRevert={() => revertDial(dial, layers, actions)} />
        <p className="lab-tdial-help">{dial.help}</p>
        <DialSlider dial={dial} layers={layers} actions={actions} />
      </div>
      <Writes paths={dial.writes} layers={layers} />
    </section>
  );
}

/** Two dials on one card (the upset chances), moved together while linked. */
function PairCard({ dial, layers, actions }: { dial: MacroDial; layers: StudioLayers; actions: DialActions }) {
  const partner = partnerOf(dial);
  const [linked, setLinked] = useState(true);
  const dials = partner ? [dial, partner] : [dial];
  const paths = dials.flatMap(entry => entry.writes);
  const pending = dials.some(entry => dialPending(entry, layers));
  return (
    <section className={cx('lab-tdial', pending && 'lab-tdial-pending')} id={`lab-dial-${dial.pair}`} aria-label="Upsets">
      <div className="lab-tdial-main">
        <DialHead title="Upsets" value={null} pending={pending} onRevert={() => actions.revert(paths)} />
        <p className="lab-tdial-help">Chances that ignore the squad entirely: a setback for the best squad, a lucky break for the weakest. Never below 0.5%, because forced results aim inside them and the gate checks that no style guarantees a clean ending.</p>
        <label className="lab-tdial-link">
          <input type="checkbox" checked={linked} onChange={event => setLinked(event.target.checked)} />
          <span>Move both together</span>
        </label>
        {dials.map(entry => <DialSlider key={entry.id} dial={entry} layers={layers} actions={actions} linked={linked} showLabel />)}
      </div>
      <Writes paths={paths} layers={layers} />
    </section>
  );
}

/** The raw fields a dial writes: plain label first, the raw path after it, then default, saved, now. */
export function Writes({ paths, layers }: { paths: readonly TuningPath[]; layers: StudioLayers }) {
  return (
    <table className="lab-twrites">
      <caption className="lab-twrites-caption"><Glyph name="writes" size={12} />Writes</caption>
      <thead>
        <tr><th scope="col"><span className="lab-tsr">Field</span></th><th scope="col">default</th><th scope="col">saved</th><th scope="col">now</th></tr>
      </thead>
      <tbody>
        {paths.map(path => {
          const meta = TUNING_META.find(entry => entry.path === path);
          if (!meta) return null;
          const state = fieldState(meta, layers);
          return (
            <tr key={path} className={cx(state.unsaved && 'lab-twrites-pending')}>
              <th scope="row"><span className="lab-twrites-label">{meta.label}{unitWord(meta) && <span className="lab-tunit"> ({unitWord(meta)})</span>}</span><RawPath path={path} /></th>
              <td>{formatValue(state.def, meta, true)}</td>
              <td className={cx(state.overridden && 'lab-twrites-over')}>{formatValue(state.saved, meta, true)}</td>
              <td className="lab-twrites-now">{formatValue(state.now, meta, true)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
