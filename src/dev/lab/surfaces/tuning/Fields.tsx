// Advanced fields (spec 3.7, 7.4): every field of the group's tables with a plain label, its raw
// path after it, help, the read-mode badge, a slider and number box in its own unit, default,
// saved and now, and revert. Read-only fields say why; unused ones wait behind "Show unused".
// The "Can't tune here" group lists the read-only fields and the tables outside the registry.
import { useEffect, useState } from 'react';
import type { TuningPath } from '../../../../sim/tuning';
import type { PatchProblem } from '../../../../sim/tuning';
import type { FieldMeta } from '../../../../sim/tuning-meta';
import { stepDecimals } from '../../model/macros';
import { cx, Glyph } from '../../viz';
import { displayUnit, fieldState, formatValue, groupFields, isEditable, MODE_BADGE, READONLY, tableOf, tableWords } from './studio';
import type { DisplayUnit, StudioGroup, StudioLayers } from './studio';

export const fieldDomId = (path: TuningPath) => `lab-tfield-${path.replace(/[^\w-]/g, '-')}`;

/** A raw path in code type that wraps only after its dots. */
export function RawPath({ path }: { path: string }) {
  const parts = path.split('.');
  return <code className="lab-raw">{parts.map((part, i) => <span key={i}>{part}{i < parts.length - 1 && <>.<wbr /></>}</span>)}</code>;
}
const round = (value: number, decimals: number) => { const f = 10 ** decimals; return Math.round(value * f) / f; };

/** Editable fields all carry a step; a missing one still rounds the box sensibly. */
const places = (unit: DisplayUnit): DisplayUnit => (unit.decimals < 0 ? { ...unit, decimals: 2 } : unit);

export interface FieldActions { set(path: TuningPath, value: unknown): void; revert(path: TuningPath): void }

export function AdvancedFields({ group, layers, problems, selected, actions }: {
  group: StudioGroup; layers: StudioLayers; problems: readonly PatchProblem[]; selected: string | null; actions: FieldActions;
}) {
  const { shown, unused } = groupFields(group);
  const [showUnused, setShowUnused] = useState(false);
  useEffect(() => { if (selected && unused.some(meta => meta.path === selected)) setShowUnused(true); }, [selected, group]);
  const tables = [...new Set(shown.map(meta => tableOf(meta.path)))];
  return (
    <div className="lab-tfields">
      {tables.map(table => (
        <section key={table} className="lab-ttable" aria-label={tableWords(table)}>
          <h4 className="lab-ttable-head">{tableWords(table)}<code className="lab-raw">{table}</code></h4>
          {shown.filter(meta => tableOf(meta.path) === table).map(meta => (
            <FieldRow key={meta.path} meta={meta} layers={layers} selected={selected === meta.path} actions={actions}
              problem={problems.find(p => p.path === meta.path || (p.path === table && meta.path.startsWith(`${table}.`) && fieldState(meta, layers).unsaved))?.reason ?? null} />
          ))}
        </section>
      ))}
      {unused.length > 0 && (
        <div className="lab-tunused">
          <button type="button" className="lab-button lab-button-quiet" aria-expanded={showUnused} onClick={() => setShowUnused(open => !open)}>
            <Glyph name="caret" size={12} />{showUnused ? 'Hide' : 'Show'} unused ({unused.length})
          </button>
          {showUnused && (
            <ul className="lab-tunused-list">
              {unused.map(meta => (
                <li key={meta.path} id={fieldDomId(meta.path)} className={cx(selected === meta.path && 'lab-tfield-selected')}>
                  <span className="lab-tfield-label">{meta.label}</span><RawPath path={meta.path} />
                  <p className="lab-tfield-why">{meta.why}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function FieldRow({ meta, layers, selected, problem, actions }: { meta: FieldMeta; layers: StudioLayers; selected: boolean; problem: string | null; actions: FieldActions }) {
  const state = fieldState(meta, layers);
  const editable = isEditable(meta);
  const badge = MODE_BADGE[meta.mode];
  return (
    <div id={fieldDomId(meta.path)} className={cx('lab-tfield', state.unsaved && 'lab-tfield-pending', selected && 'lab-tfield-selected', !editable && 'lab-tfield-locked')}>
      <div className="lab-tfield-name">
        <span className="lab-tfield-label">{meta.label}</span>
        <RawPath path={meta.path} />
        <span className={`lab-tbadge lab-tbadge-${meta.mode}`} title={badge.help}>{badge.label}</span>
      </div>
      {editable && (Array.isArray(state.now) && !state.unsaved && !state.overridden
        ? <dl className="lab-tfield-values lab-tfield-values-list"><div><dt>default</dt><dd>{formatValue(state.def, meta, true)} <span className="lab-muted">(saved and now the same)</span></dd></div></dl>
        : <dl className={cx('lab-tfield-values', Array.isArray(state.now) && 'lab-tfield-values-list')}>
          <div><dt>default</dt><dd>{formatValue(state.def, meta, true)}</dd></div>
          <div><dt>saved</dt><dd className={cx(state.overridden && 'lab-twrites-over')}>{formatValue(state.saved, meta, true)}</dd></div>
          <div><dt>now</dt><dd className="lab-twrites-now">{formatValue(state.now, meta, true)}</dd></div>
        </dl>)}
      {editable && <span className="lab-tfield-revert">
        {state.unsaved && <button type="button" className="lab-icon-button" onClick={() => actions.revert(meta.path)} title="Back to tuning.json" aria-label={`Put ${meta.label} back to tuning.json`}><Glyph name="undo" size={13} /></button>}
      </span>}
      <div className="lab-tfield-help">
        <p>{meta.help}{!editable && meta.why ? ` ${meta.why}` : ''}</p>
        {problem && <p className="lab-tfield-problem"><Glyph name="error" size={12} />Not applied: {problem}</p>}
      </div>
      <div className="lab-tfield-control">
        {!editable ? <span className="lab-tfield-fixed"><Glyph name="lock" size={12} />{formatValue(state.now, meta)}</span>
          : typeof state.now === 'number' ? <NumberControl meta={meta} value={state.now} onChange={value => actions.set(meta.path, value)} />
            : Array.isArray(state.now) && state.now.every(item => typeof item === 'number')
              ? <ListControl meta={meta} value={state.now as number[]} onChange={value => actions.set(meta.path, value)} />
              : <span className="lab-tfield-fixed">{formatValue(state.now, meta)}</span>}
      </div>
    </div>
  );
}

/** A number in the field's display unit; the box commits once it holds a whole number entry. */
function NumberBox({ value, decimals, label, onCommit, min, max, step }: { value: number; decimals: number; label: string; onCommit: (v: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = round(value, decimals + 2);
  return (
    <input className="lab-input lab-input-num lab-tfield-num" type="number" aria-label={label} value={draft ?? String(shown)} min={min} max={max} step={step}
      onChange={event => {
        const text = event.target.value;
        setDraft(text);
        const n = Number(text);
        if (text.trim() !== '' && Number.isFinite(n) && !/[.\-]$/.test(text)) onCommit(n);
      }}
      onBlur={() => setDraft(null)} onKeyDown={event => { if (event.key === 'Enter') setDraft(null); }} />
  );
}

function NumberControl({ meta, value, onChange }: { meta: FieldMeta; value: number; onChange: (raw: number) => void }) {
  const unit = places(displayUnit(meta));
  const f = unit.factor;
  const rawDecimals = stepDecimals(meta.step ?? 0.01) + 3;
  const shown = round(value * f, unit.decimals + 2);
  const lo = Math.min((meta.min ?? Math.min(0, value)) * f, shown), hi = Math.max((meta.max ?? Math.max(1, value * 2)) * f, shown);
  const step = round((meta.step ?? 0.01) * f, unit.decimals + 2) || undefined;
  const commit = (display: number) => onChange(round(display / f, rawDecimals));
  return (
    <span className="lab-tnum">
      <input type="range" className="lab-tnum-slider" min={lo} max={hi} step={step} value={shown} aria-label={`${meta.label}, slider`} onChange={event => commit(Number(event.target.value))} />
      <NumberBox value={value * f} decimals={unit.decimals} label={`${meta.label}, exact value`} onCommit={commit} min={lo} max={hi} step={step} />
      <span className="lab-tnum-unit">{unit.prefix || unit.suffix.trim()}</span>
    </span>
  );
}

function ListControl({ meta, value, onChange }: { meta: FieldMeta; value: number[]; onChange: (raw: number[]) => void }) {
  const unit = places(displayUnit(meta));
  const f = unit.factor;
  const rawDecimals = stepDecimals(meta.step ?? 0.01) + 3;
  return (
    <span className="lab-tlist">
      {value.map((item, i) => (
        <label key={i} className="lab-tlist-item">
          <span>{meta.items?.[i] ?? `#${i + 1}`}</span>
          <NumberBox value={item * f} decimals={unit.decimals} label={`${meta.label}, ${meta.items?.[i] ?? `value ${i + 1}`}`} step={(meta.step ?? 0.01) * f}
            onCommit={n => onChange(value.map((old, j) => (j === i ? round(n / f, rawDecimals) : old)))} />
        </label>
      ))}
      <span className="lab-tnum-unit">{unit.prefix || unit.suffix.trim()}</span>
    </span>
  );
}

/** What the lab leaves alone: read-only fields with their reason, and the tables outside the registry. */
export function FixedPanel({ layers, selected }: { layers: StudioLayers; selected: string | null }) {
  const fields = groupFields('fixed').shown;
  return (
    <div className="lab-tfields">
      <section className="lab-ttable" aria-label="Read-only fields">
        <h4 className="lab-ttable-head">Fields the lab keeps read-only</h4>
        <p className="lab-tfixed-intro">They sit inside tunable tables, but changing them would break issued calls or the game's structure, not its balance.</p>
        {fields.map(meta => (
          <FieldRow key={meta.path} meta={meta} layers={layers} selected={selected === meta.path} problem={null} actions={{ set: () => {}, revert: () => {} }} />
        ))}
      </section>
      <section className="lab-ttable" aria-label="Tables outside the registry">
        <h4 className="lab-ttable-head">Tables the lab can't reach</h4>
        <p className="lab-tfixed-intro">These aren't wrapped for tuning in this version. Each says why; changing one is an engine change, not a tuning change.</p>
        {READONLY.map(table => {
          const badge = MODE_BADGE[table.mode];
          return (
            <div key={table.name} className="lab-tfield lab-tfield-locked lab-treadonly">
              <div className="lab-tfield-name">
                <span className="lab-tfield-label">{tableWords(table.name)}</span>
                <code className="lab-raw">{table.name}</code>
                <span className={`lab-tbadge lab-tbadge-${table.mode}`} title={badge.help}>{badge.label}</span>
              </div>
              <div className="lab-tfield-help">
                <p>{table.why}</p>
                <details className="lab-tvalues">
                  <summary>Show values</summary>
                  <dl>
                    {Object.entries(table.values as Record<string, unknown>).map(([key, value]) => (
                      <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value).slice(0, 240) : String(value)}</dd></div>
                    ))}
                  </dl>
                </details>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
