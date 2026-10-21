import { useSyncExternalStore } from 'react';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Segmented } from '../components/ui';
import { CARD_WARNING_SETTINGS, readSettings, subscribeSettings, type PlayerSettings } from './prefs';
import { AVOIDABLE_THEMES } from '../../content/content-descriptors';
import { SETTINGS_TEXT, SUPPORT_TEXT, THEME_LABELS, TIMER_LABELS, WARNING_LABELS } from './labels';
import './settings.css';

/** The saved settings, re-rendering on every change made on this page. */
export function useSettings(): PlayerSettings {
  return useSyncExternalStore(subscribeSettings, readSettings, readSettings);
}

/** The avoid list, card warnings and timer, shared by the launch advisory and Settings. */
export function SettingsControls({ value, onChange }: { value: PlayerSettings; onChange: (patch: Partial<PlayerSettings>) => void }) {
  const t = SETTINGS_TEXT;
  return <div className="settings-controls">
    <fieldset className="settings-group">
      <legend className="settings-heading">{t.avoidHeading}</legend>
      <p className="settings-hint">{t.avoidHint}</p>
      <ul className="settings-topics">
        {AVOIDABLE_THEMES.map((theme) => <li key={theme} className="settings-topic">
          <label className="toggle settings-topic-toggle">
            <input type="checkbox" checked={value.avoidThemes.includes(theme)}
              onChange={(e) => onChange({ avoidThemes: AVOIDABLE_THEMES.filter((x) => x === theme ? e.target.checked : value.avoidThemes.includes(x)) })} />
            <span className="toggle-ui" aria-hidden="true" />
            <span className="toggle-text"><strong>{THEME_LABELS[theme].name}</strong><small className="dim">{THEME_LABELS[theme].detail}</small></span>
          </label>
        </li>)}
      </ul>
    </fieldset>

    <fieldset className="settings-group">
      <legend className="settings-heading">{t.warningsHeading}</legend>
      <Segmented label={t.warningsHeading} value={value.cardWarnings} onChange={(cardWarnings) => onChange({ cardWarnings })}
        options={CARD_WARNING_SETTINGS.map((s) => ({ value: s, label: WARNING_LABELS[s].name }))} />
      <p className="settings-detail" aria-live="polite">{WARNING_LABELS[value.cardWarnings].detail}</p>
    </fieldset>

    <fieldset className="settings-group">
      <legend className="settings-heading">{t.timerHeading}</legend>
      <p className="settings-hint">{t.timerHint}</p>
      <Segmented label={t.timerHeading} value={value.timer} onChange={(timer) => onChange({ timer })}
        options={TIMER_SETTINGS.map((s) => ({ value: s, label: TIMER_LABELS[s].name }))} />
      <p className="settings-detail" aria-live="polite">{TIMER_LABELS[value.timer].detail}</p>
    </fieldset>
  </div>;
}

/** Where to find help, shown in Settings at all times. */
export function SupportPanel() {
  const s = SUPPORT_TEXT;
  return <section className="settings-support" aria-labelledby="settings-support-title">
    <h3 id="settings-support-title" className="settings-heading">{s.heading}</h3>
    <p>{s.us}</p>
    <div className="settings-support-actions">
      <a className="btn btn-secondary btn-md" href="tel:988">{s.call}</a>
      <a className="btn btn-secondary btn-md" href="sms:988">{s.text}</a>
    </div>
    <p>{s.elsewhere}</p>
  </section>;
}
