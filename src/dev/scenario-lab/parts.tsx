// Shared pieces of the scenario lab: the odds bar, an outcome table and one option card.
import type { ReactNode } from 'react';
import type { ActionDefinition, ScenarioDefinition } from '../../sim/scenario-types';
import type { ActionView, OutcomeBand } from '../../sim/types';
import { bandsIdentical, capabilityText, checkText, conditionText, effectParts, equipmentText, isOneShot, pct, requirementText } from './describe';
import { BANDS } from './model';

export function OddsBar({ likelihood }: { likelihood: Record<OutcomeBand, number> | null }) {
  if (!likelihood) return <span className="sl-odds sl-odds-none" title="Not evaluated at this state">no odds</span>;
  return (
    <span className="sl-odds" title={BANDS.map(band => `${band} ${pct(likelihood[band])}%`).join(' · ')}>
      <span className="sl-odds-bar" aria-hidden="true">
        {BANDS.map(band => <i key={band} className={`sl-b-${band}`} style={{ width: `${likelihood[band] * 100}%` }} />)}
      </span>
      <span className="sl-odds-num">{BANDS.map(band => <b key={band} className={`sl-t-${band}`}>{pct(likelihood[band])}</b>)}</span>
    </span>
  );
}

export function Outcomes({ action, view, s }: { action: ActionDefinition; view?: ActionView; s: ScenarioDefinition }) {
  return (
    <div className="sl-bands">
      {BANDS.map(band => {
        const preview = view?.outcomePreview[band] ?? action.outcomePreview?.[band];
        return (
          <div key={band} className={`sl-band sl-band-${band}`}>
            <div className="sl-band-head">
              <b className={`sl-t-${band}`}>{band}</b>
              {view && <span className="sl-dim"> {pct(view.likelihood[band])}%</span>}
              {action.resultLabels?.[band] && <span className="sl-tag">{action.resultLabels[band]}</span>}
            </div>
            {preview && <p className="sl-preview" title="Outcome preview the player sees">{preview}</p>}
            <ul className="sl-effects">
              {action.outcomes[band].map((effect, index) => {
                const parts = effectParts(effect, s);
                return (
                  <li key={index}>
                    {parts.when.length > 0 && <span className="sl-when">if {parts.when.join('; ')}</span>}
                    {parts.chips.map((chip, k) => <span key={k} className={`sl-chip${chip.startsWith('END') ? ' sl-chip-end' : chip.startsWith('→') ? ' sl-chip-stage' : ''}`}>{chip}</span>)}
                    {parts.chips.length === 0 && <span className="sl-chip sl-chip-none">no state change</span>}
                    {parts.text && <span className="sl-effect-text">{parts.text}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export type OptionStatus = 'eligible' | 'blocked' | 'hidden' | 'not-offered' | 'unevaluated';
const STATUS_TEXT: Record<OptionStatus, string> = {
  eligible: 'offered',
  blocked: 'shown, not available',
  hidden: 'hidden here',
  'not-offered': 'never a player option',
  unevaluated: 'not evaluated',
};

/** One authored action with the engine's view of it at some state (when there is one). */
export function OptionCard({ action, view, s, status, flatWith, open, buttons, selected, onSelect }: {
  action: ActionDefinition; view?: ActionView; s: ScenarioDefinition; status: OptionStatus;
  flatWith?: string[]; open?: boolean; buttons?: ReactNode; selected?: boolean; onSelect?: () => void;
}) {
  const consequence = view?.consequenceLevel ?? action.consequenceLevel;
  const shown = view ? [...view.details] : [];
  const visible = conditionText(action.visibleWhen, s);
  const requires = requirementText(action.requires, s);
  const gear = equipmentText(action);
  const caps = capabilityText(action);
  return (
    <article className={`sl-option sl-st-${status}${flatWith?.length ? ' sl-flat' : ''}${selected ? ' sl-selected' : ''}`} onClick={onSelect}>
      <header className="sl-option-head">
        <div className="sl-option-title">
          <b>{view?.title ?? action.title}</b>
          <span className="sl-badges">
            <span className={`sl-tag sl-tag-${status}`}>{STATUS_TEXT[status]}</span>
            {consequence && <span className={`sl-tag sl-risk-${consequence}`}>{consequence} consequence</span>}
            {isOneShot(action) && <span className="sl-tag">one-shot</span>}
            {bandsIdentical(action) && <span className="sl-tag sl-tag-same" title="Favourable, mixed and adverse apply the same authored effects (prose aside); only what the engine adds per band (time, strain) differs">same effect every band</span>}
            {flatWith?.length ? <span className="sl-tag sl-tag-flat" title={`Within 5 points of: ${flatWith.join(', ')}`}>≈ flat with {flatWith.length}</span> : null}
          </span>
        </div>
        <OddsBar likelihood={view ? view.likelihood : null} />
      </header>
      <p className="sl-meta">
        <code>{action.id}</code> · {checkText(action)}
        {view ? <> · {view.timeCost} min ({view.timeRange.min}–{view.timeRange.max})</> : null}
        {action.tempo && action.tempo !== 'normal' ? <> · {action.tempo}</> : null} · approach {action.approach}
      </p>
      <p className="sl-summary">{view?.summary ?? action.summary}</p>
      {view && <p className="sl-req">{view.requirementLine}{view.suppliesRequired.length ? ` · uses ${view.suppliesRequired.map(x => `${x.qty} ${x.label}`).join(', ')}` : ''}</p>}
      {view && !view.eligible && view.reason && <p className="sl-reason">{view.reason}</p>}
      {buttons && <div className="sl-buttons" onClick={event => event.stopPropagation()}>{buttons}</div>}
      <details open={open} onClick={event => event.stopPropagation()}>
        <summary>Requirements, gear and outcomes</summary>
        <dl className="sl-dl">
          {visible.length > 0 && <><dt>Visible when</dt><dd>{visible.join('; ')}</dd></>}
          {requires.length > 0 && <><dt>Requires</dt><dd>{requires.join('; ')}</dd></>}
          {gear.length > 0 && <><dt>Equipment</dt><dd>{gear.join('; ')}</dd></>}
          {caps.length > 0 && <><dt>Capabilities</dt><dd>{caps.join('; ')}</dd></>}
          {shown.length > 0 && <><dt>Engine notes</dt><dd>{shown.join(' ')}</dd></>}
          {view && view.contributors.length > 0 && <><dt>Score</dt><dd>{view.contributors.map(c => `${c.label} ${c.value > 0 ? '+' : ''}${Math.round(c.value * 10) / 10}`).join(' · ')}</dd></>}
          {view?.forceRisk && <><dt>Force risk</dt><dd>{JSON.stringify(view.forceRisk)}</dd></>}
        </dl>
        <Outcomes action={action} view={view} s={s} />
      </details>
    </article>
  );
}

/** Banner summarising whether the offered options are real decisions by odds. */
export function FlatBanner({ eligible, pairs, allHigh, title }: { eligible: number; pairs: { a: string; b: string; diff: number }[]; allHigh: boolean; title: (id: string) => string }) {
  const notes: string[] = [];
  if (eligible === 0) notes.push('No option is available here.');
  if (eligible === 1) notes.push('Only one option is available: not a decision.');
  if (allHigh) notes.push('Every option is at least 90% favourable: no risk trade-off between them.');
  for (const pair of pairs) notes.push(`${title(pair.a)} ≈ ${title(pair.b)} (${pct(pair.diff)} points apart)`);
  if (!notes.length) return <p className="sl-ok">Odds separate every offered option by more than 5 points.</p>;
  return <ul className="sl-flat-list">{notes.map((note, index) => <li key={index}>{note}</li>)}</ul>;
}
