import { useId, useSyncExternalStore } from 'react';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Card, Section, Segmented, SwitchRow } from '../components/ui';
import { CARD_WARNING_SETTINGS, readSettings, subscribeSettings, type PlayerSettings } from './prefs';
import { ALWAYS_THEMES, AVOIDABLE_THEMES, canAvoid } from './avoidable';
import { BLOCKED_BY_CHOICES_REASON, CARD_THEME_WORDS, MENU_TEXT, SETTINGS_TEXT, SUPPORT_TEXT, THEME_LABELS, THEME_ORDER, TIMER_LABELS, WARNING_LABELS, joinThemes } from './labels';
import './settings.css';

/** The saved settings, re-rendering on every change made on this page. */
export function useSettings(): PlayerSettings {
  return useSyncExternalStore(subscribeSettings, readSettings, readSettings);
}

/** One theme the player can avoid: its switch, and under a blocked one the reason it can't be turned on. */
export function ThemeSwitch({ theme, on, blocked, onChange }: { theme: (typeof THEME_ORDER)[number]; on: boolean; blocked: boolean; onChange: (on: boolean) => void }) {
  const reason = `${useId()}-${theme}-reason`;
  return <div className="theme-switch">
    <SwitchRow icon="eye" title={THEME_LABELS[theme].name} detail={THEME_LABELS[theme].detail} checked={on} blocked={blocked} describedBy={reason} onChange={onChange} />
    {blocked && <p id={reason} className="settings-reason">{BLOCKED_BY_CHOICES_REASON}</p>}
  </div>;
}

/** The avoid list, card warnings, timer, sound and flashing lights, as the launch advisory shows them.
 * Settings in the Menu offers the same choices through the same switch rows. */
export function SettingsControls({ value, onChange }: { value: PlayerSettings; onChange: (patch: Partial<PlayerSettings>) => void }) {
  const t = SETTINGS_TEXT;
  return <div className="settings-controls">
    <Section id="first-run-avoid" icon="eye" title={t.avoidHeading} hint={t.avoidHint}>
      <Card className="inset-list">
        {AVOIDABLE_THEMES.map((theme) => <ThemeSwitch key={theme} theme={theme} on={value.avoidThemes.includes(theme)} blocked={!canAvoid(value.avoidThemes, theme)}
          onChange={(on) => onChange({ avoidThemes: AVOIDABLE_THEMES.filter((x) => x === theme ? on : value.avoidThemes.includes(x)) })} />)}
      </Card>
      {ALWAYS_THEMES.length > 0 && <p className="settings-hint">{MENU_TEXT.everyCall(joinThemes(ALWAYS_THEMES.map((theme) => CARD_THEME_WORDS[theme])))}</p>}
    </Section>

    <Section id="first-run-warnings" icon="warning" title={t.warningsHeading}>
      <Segmented label={t.warningsHeading} value={value.cardWarnings} onChange={(cardWarnings) => onChange({ cardWarnings })}
        options={CARD_WARNING_SETTINGS.map((s) => ({ value: s, label: WARNING_LABELS[s].name }))} />
      <p className="settings-detail" aria-live="polite">{WARNING_LABELS[value.cardWarnings].detail}</p>
    </Section>

    <Section id="first-run-timer" icon="clock" title={t.timerHeading} hint={t.timerHint}>
      <Segmented label={t.timerHeading} value={value.timer} onChange={(timer) => onChange({ timer })}
        options={TIMER_SETTINGS.map((s) => ({ value: s, label: TIMER_LABELS[s].name }))} />
      <p className="settings-detail" aria-live="polite">{TIMER_LABELS[value.timer].detail}</p>
    </Section>

    <Section id="first-run-comfort" icon="soundwave" title={t.comfortHeading}>
      <Card className="inset-list">
        <SwitchRow icon="soundwave" title={t.soundHeading} detail={t.soundHint} checked={value.sound} onChange={(sound) => onChange({ sound })} />
        <SwitchRow icon="bolt" title={t.flashingHeading} detail={t.flashingHint} checked={value.flashing} onChange={(flashing) => onChange({ flashing })} />
      </Card>
    </Section>
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
