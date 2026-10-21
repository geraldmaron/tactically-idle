import { useId, useSyncExternalStore } from 'react';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Segmented } from '../components/ui';
import { CARD_WARNING_SETTINGS, readSettings, subscribeSettings, type PlayerSettings } from './prefs';
import { blockedAlone, canAvoid } from './avoidable';
import { SETTINGS_TEXT, SUPPORT_TEXT, THEME_LABELS, THEME_ORDER, TIMER_LABELS, WARNING_LABELS, reasonText } from './labels';
import './settings.css';

/** The saved settings, re-rendering on every change made on this page. */
export function useSettings(): PlayerSettings {
  return useSyncExternalStore(subscribeSettings, readSettings, readSettings);
}

/** The avoid list, card warnings and timer, shared by the launch advisory and Settings. */
export function SettingsControls({ value, onChange }: { value: PlayerSettings; onChange: (patch: Partial<PlayerSettings>) => void }) {
  const t = SETTINGS_TEXT;
  const id = useId();
  return <div className="settings-controls">
    <fieldset className="settings-group">
      <legend className="settings-heading">{t.avoidHeading}</legend>
      <p className="settings-hint">{t.avoidHint}</p>
      <ul className="settings-topics">
        {THEME_ORDER.map((theme) => {
          const on = value.avoidThemes.includes(theme);
          const blocked = !canAvoid(value.avoidThemes, theme);
          const reason = `${id}-${theme}-reason`;
          return <li key={theme} className="settings-topic" data-blocked={blocked || undefined}>
            <label className="toggle settings-topic-toggle">
              <input type="checkbox" checked={on} disabled={blocked} aria-describedby={blocked ? reason : undefined}
                onChange={(e) => onChange({ avoidThemes: THEME_ORDER.filter((x) => x === theme ? e.target.checked : value.avoidThemes.includes(x)) })} />
              <span className="toggle-ui" aria-hidden="true" />
              <span className="toggle-text"><strong>{THEME_LABELS[theme].name}</strong><small className="dim">{THEME_LABELS[theme].detail}</small></span>
            </label>
            {blocked && <p id={reason} className="settings-reason">{reasonText(theme, blockedAlone(theme))}</p>}
          </li>;
        })}
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

    <fieldset className="settings-group">
      <legend className="settings-heading">{t.soundHeading}</legend>
      <p className="settings-hint">{t.soundHint}</p>
      <Segmented label={t.soundHeading} value={value.sound ? 'on' : 'off'} onChange={(sound) => onChange({ sound: sound === 'on' })}
        options={[{ value: 'on', label: t.soundOn }, { value: 'off', label: t.soundOff }]} />
    </fieldset>
  </div>;
}

/** Where to find help, shown in Settings at all times. */
export function SupportPanel() {
  const s = SUPPORT_TEXT;
  return <section className="settings-support" aria-labelledby="settings-support-title">
    <h3 id="settings-support-title" className="settings-heading">{s.heading}</h3>
    <p>{s.lead}</p>
    <p>{s.us}</p>
    <div className="settings-support-actions">
      <a className="btn btn-secondary btn-md" href="tel:988">{s.call}</a>
      <a className="btn btn-secondary btn-md" href="sms:988">{s.text}</a>
      <a className="btn btn-secondary btn-md" href={s.chatUrl} target="_blank" rel="noreferrer">{s.chat}</a>
    </div>
    <p>{s.elsewhere}</p>
  </section>;
}
