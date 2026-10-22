// The whole visual kit on one page, for review and contact sheets: /harness.html?only=icons.
// Dev-only; the harness is its sole importer. docs/visual-kit.md lists the same names with their use.
import { Icon, ICON_NAMES } from '../icons';
import type { IconName } from '../icons';
import { CallTypeBadge } from './CallTypeBadge';
import { OutcomeMark, StatusMark, MARK_STATUSES, OUTCOME_BANDS } from './marks';
import { Spot, SPOT_NAMES } from './spots';
import { BRANCH_ICON, CALL_TYPE_ICON, GEAR_CATEGORY_ICON, OFFICER_STATUS_ICON, OUTCOME_ICON, RESOURCE_ICON, SKILL_ICON, TAB_ICON } from './kit';
import type { IncidentType } from '../../sim/scenario-types';
import { RESULT_LABEL } from '../screens/OperationFeedback';

const CALL_TYPES = Object.keys(CALL_TYPE_ICON) as IncidentType[];
const NAV: IconName[] = ['stepOut', 'map', 'tap', 'more', 'filter', 'sort', 'play', 'arrowLeft', 'arrowRight', 'arrowUp', 'arrowDown', 'chevronLeft', 'chevronRight', 'chevronUp', 'chevronDown', 'chevronsUp'];

/** A labelled table of key to icon name. */
function Table({ title, rows }: { title: string; rows: Record<string, IconName> }) {
  return (
    <section className="kg-sec">
      <h2>{title}</h2>
      <ul className="kg-table">
        {Object.entries(rows).map(([key, name]) => (
          <li key={key}>
            <Icon name={name} size={24} />
            <span className="kg-txt">
              <span className="kg-key">{key}</span>
              {key === name ? null : <code>{name}</code>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function KitGallery() {
  const plate = (type: string) => `${import.meta.env.BASE_URL}art/plates/scene_${type}.webp`;
  return (
    <div className="kg">
      <style>{css}</style>
      <h1>Visual kit</h1>
      <p className="kg-note">{ICON_NAMES.length} icons, 4 call-type badges, {MARK_STATUSES.length} status marks, {OUTCOME_BANDS.length} outcome marks, {SPOT_NAMES.length} spots. Names and uses: docs/visual-kit.md.</p>

      <Table title="Tabs" rows={TAB_ICON} />
      <Table title="Resource bar" rows={RESOURCE_ICON} />
      <Table title="Skills" rows={SKILL_ICON} />
      <Table title="Officer status" rows={OFFICER_STATUS_ICON} />
      <Table title="Outcomes" rows={OUTCOME_ICON} />
      <Table title="Gear categories" rows={GEAR_CATEGORY_ICON} />
      <Table title="Upgrade branches" rows={BRANCH_ICON} />
      <Table title="Call types" rows={CALL_TYPE_ICON} />
      <Table title="Navigation and actions" rows={Object.fromEntries(NAV.map((n) => [n, n]))} />

      <section className="kg-sec">
        <h2>Call-type badges</h2>
        <ul className="kg-badges">
          {CALL_TYPES.map((t) => (
            <li key={t}>
              <CallTypeBadge type={t} size={20} />
              <CallTypeBadge type={t} size={28} />
              <CallTypeBadge type={t} size={40} />
              <CallTypeBadge type={t} size={24} label />
            </li>
          ))}
          <li>
            <CallTypeBadge type="unknown_type" size={28} />
            <CallTypeBadge type={null} size={24} label />
          </li>
        </ul>
        <h3>On the scene plates</h3>
        <div className="kg-plates">
          {CALL_TYPES.map((t) => (
            <div key={t} className="kg-plate" style={{ backgroundImage: `url(${plate(t)})` }}>
              <span className="kg-plate-chip"><CallTypeBadge type={t} size={22} label /></span>
            </div>
          ))}
        </div>
        <h3>Without colour</h3>
        <ul className="kg-badges kg-gray">
          {CALL_TYPES.map((t) => (
            <li key={t}><CallTypeBadge type={t} size={28} label /></li>
          ))}
        </ul>
      </section>

      <section className="kg-sec">
        <h2>Status marks</h2>
        <ul className="kg-marks">
          {MARK_STATUSES.map((s) => (
            <li key={s}><StatusMark status={s} /></li>
          ))}
        </ul>
        <h3>Without colour</h3>
        <ul className="kg-marks kg-gray">
          {MARK_STATUSES.map((s) => (
            <li key={s}><StatusMark status={s} /></li>
          ))}
        </ul>
      </section>

      <section className="kg-sec">
        <h2>Outcome marks</h2>
        <ul className="kg-marks">
          {OUTCOME_BANDS.map((b) => (
            <li key={b}><OutcomeMark band={b} label={RESULT_LABEL[b]} /></li>
          ))}
        </ul>
        <h3>Without colour</h3>
        <ul className="kg-marks kg-gray">
          {OUTCOME_BANDS.map((b) => (
            <li key={b}><OutcomeMark band={b} label={RESULT_LABEL[b]} size={20} /></li>
          ))}
        </ul>
      </section>

      <section className="kg-sec">
        <h2>Empty-state spots</h2>
        <div className="kg-spots">
          {SPOT_NAMES.map((n) => (
            <figure key={n}>
              <Spot name={n} width={240} />
              <figcaption><code>{n}</code></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="kg-sec">
        <h2>Every icon</h2>
        <ul className="kg-grid">
          {ICON_NAMES.map((n) => (
            <li key={n}>
              <Icon name={n} size={24} />
              <code>{n}</code>
            </li>
          ))}
        </ul>
        <h3>At 16 and 20 px</h3>
        <div className="kg-small">
          {ICON_NAMES.map((n) => <Icon key={n} name={n} size={16} />)}
        </div>
        <div className="kg-small">
          {ICON_NAMES.map((n) => <Icon key={n} name={n} size={20} />)}
        </div>
      </section>
    </div>
  );
}

const css = `
.kg { max-width: 430px; margin: 0 auto; color: var(--text); font: 14px/1.4 var(--font-ui); }
.kg h1 { font: 600 22px var(--font-cond); margin: 0 0 4px; }
.kg h2 { font: 600 16px var(--font-cond); margin: 0 0 8px; color: var(--text); }
.kg h3 { font: 500 12px var(--font-ui); margin: 12px 0 6px; color: var(--muted); }
.kg-note { margin: 0 0 16px; color: var(--text-dim); font-size: 12px; }
.kg-sec { padding: 16px 0; border-top: 1px solid var(--line); }
.kg ul { list-style: none; margin: 0; padding: 0; }
.kg code { font: 12px var(--font-ui); color: var(--muted); overflow-wrap: anywhere; }
.kg-table { display: grid; grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)); gap: 4px 12px; }
.kg-table li { display: flex; gap: 8px; align-items: center; min-height: 40px; min-width: 0; }
.kg-table .icon { flex: none; color: var(--text); }
.kg-txt { display: grid; min-width: 0; }
.kg-key { font-size: 14px; color: var(--text); overflow-wrap: anywhere; }
.kg-badges { display: grid; gap: 10px; }
.kg-badges li { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; min-width: 0; }
.kg-plates { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.kg-plate { position: relative; aspect-ratio: 16 / 9; border-radius: 8px; background: var(--panel) center / cover no-repeat; overflow: hidden; }
.kg-plate-chip { position: absolute; left: 6px; bottom: 6px; right: 6px; display: flex; }
.kg-plate-chip .ct-badge { padding: 3px 8px 3px 3px; border-radius: 6px; background: rgba(11, 17, 28, 0.82); max-width: 100%; }
.kg-plate-chip .ct-badge-label { font-size: 12px; }
.kg-gray { filter: grayscale(1); }
.kg-marks { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 10px 12px; }
.kg-spots { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.kg-spots figure { margin: 0; padding: 8px; background: var(--panel); border-radius: 12px; min-width: 0; }
.kg-spots figcaption { margin-top: 4px; text-align: center; }
.kg-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 12px 6px; }
.kg-grid li { display: grid; justify-items: center; gap: 4px; text-align: center; min-width: 0; }
.kg-small { display: flex; flex-wrap: wrap; gap: 8px; color: var(--text-dim); margin-top: 8px; }
`;
