import { useId, useSyncExternalStore } from 'react';
import { CONTENT_DESCRIPTORS, CONTENT_TIERS, MATURE_ONLY, type ContentDescriptor } from '../../content/content-descriptors';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Segmented } from '../components/ui';
import { CONTENT_NOTE_SETTINGS, readSettings, subscribeSettings, type PlayerSettings } from './prefs';
import { NOTE_LABELS, SETTINGS_TEXT, TIER_LABELS, TIMER_LABELS, TOPIC_LABELS } from './labels';
import './settings.css';

/** The saved settings, re-rendering on every change made on this page. */
export function useSettings(): PlayerSettings {
  return useSyncExternalStore(subscribeSettings, readSettings, readSettings);
}

const toggled = (list: readonly ContentDescriptor[], d: ContentDescriptor, on: boolean) =>
  CONTENT_DESCRIPTORS.filter((x) => x === d ? on : list.includes(x));

/** The tier, topic, note and timer controls, shared by the first-run screen and Settings. */
export function SettingsControls({ value, onChange }: { value: PlayerSettings; onChange: (patch: Partial<PlayerSettings>) => void }) {
  const id = useId();
  const t = SETTINGS_TEXT;
  return <div className="settings-controls">
    <fieldset className="settings-group">
      <legend className="settings-heading">{t.tierHeading}</legend>
      <div className="settings-tiers">
        {CONTENT_TIERS.map((tier) => <label key={tier} className="settings-tier">
          <input type="radio" name={`${id}-tier`} value={tier} checked={value.tier === tier} onChange={() => onChange({ tier })} />
          <span className="settings-tier-text"><strong>{TIER_LABELS[tier].name}</strong><small>{TIER_LABELS[tier].detail}</small></span>
        </label>)}
      </div>
    </fieldset>

    <fieldset className="settings-group">
      <legend className="settings-heading">{t.topicsHeading}</legend>
      <p className="settings-hint">{t.topicsHint}</p>
      <ul className="settings-topics">
        {CONTENT_DESCRIPTORS.map((d) => {
          const locked = value.tier === 'core' && MATURE_ONLY[d];
          const shown = !locked && !value.topicsOff.includes(d);
          return <li key={d} className="settings-topic" data-locked={locked || undefined}>
            <label className="toggle settings-topic-toggle">
              <input type="checkbox" checked={shown} disabled={locked} onChange={(e) => onChange({ topicsOff: toggled(value.topicsOff, d, !e.target.checked) })} />
              <span className="toggle-ui" aria-hidden="true" />
              <span className="toggle-text"><strong>{TOPIC_LABELS[d].name}</strong><small className="dim">{locked ? t.leftOutInCore : TOPIC_LABELS[d].detail}</small></span>
            </label>
            {value.contentNotes === 'flagged' && shown && <label className="settings-note-flag">
              <input type="checkbox" checked={value.noteTopics.includes(d)} onChange={(e) => onChange({ noteTopics: toggled(value.noteTopics, d, e.target.checked) })}
                aria-label={`${t.noteFor} for ${TOPIC_LABELS[d].name}`} />
              <span aria-hidden="true">{t.noteFor}</span>
            </label>}
          </li>;
        })}
      </ul>
    </fieldset>

    <fieldset className="settings-group">
      <legend className="settings-heading">{t.notesHeading}</legend>
      <p className="settings-hint">{t.notesHint}</p>
      <Segmented label={t.notesHeading} value={value.contentNotes} onChange={(contentNotes) => onChange({ contentNotes })}
        options={CONTENT_NOTE_SETTINGS.map((s) => ({ value: s, label: NOTE_LABELS[s].name }))} />
      <p className="settings-detail" aria-live="polite">{NOTE_LABELS[value.contentNotes].detail}</p>
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
