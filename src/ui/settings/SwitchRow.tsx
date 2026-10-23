import type { ReactNode } from 'react';
import { Icon } from '../icons';
import type { IconName } from '../icons';
import './inset-list.css';
import './switch-row.css';

/** The one switch: a row with a lead, a title and a line, and the switch in the trail, laid out like
 * the link rows beside it. The whole row toggles it. First run, the Menu and its Themes page all
 * use this. A blocked switch stays visible and says why through `describedBy`. */
export function SwitchRow({ icon, title, detail, checked, onChange, blocked, describedBy }: {
  icon: IconName;
  title: ReactNode;
  detail?: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
  blocked?: boolean;
  describedBy?: string;
}) {
  return <label className="ui-row switch-row" data-blocked={blocked || undefined}>
    <span className="ui-row-lead"><Icon name={icon} size="md" /></span>
    <span className="ui-row-main">
      <span className="ui-row-title">{title}</span>
      {detail && <span className="ui-row-detail">{detail}</span>}
    </span>
    <span className="ui-row-trail">
      <input type="checkbox" role="switch" checked={checked} disabled={blocked} aria-describedby={blocked ? describedBy : undefined} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden="true" />
    </span>
  </label>;
}
