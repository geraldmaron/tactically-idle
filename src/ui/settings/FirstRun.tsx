import { useState } from 'react';
import { Button } from '../components/ui';
import { DEFAULT_SETTINGS, readSettings, updateSettings, type PlayerSettings } from './prefs';
import { SETTINGS_TEXT } from './labels';
import { SettingsControls } from './SettingsControls';

/** Shown once, at first launch, before the department (docs/content-rating.md "First run and
 * settings"). Choices stay on this screen until the player starts; skipping keeps the defaults. */
export function FirstRun() {
  const [draft, setDraft] = useState<PlayerSettings>(readSettings);
  const t = SETTINGS_TEXT;
  return <main className="first-run" aria-labelledby="first-run-title">
    <header className="first-run-head">
      <p className="first-run-kicker">{t.firstRunKicker}</p>
      <h1 id="first-run-title" className="first-run-title">{t.firstRunTitle}</h1>
      <p className="first-run-note">{t.notAgeCheck}</p>
    </header>
    <SettingsControls value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
    <p className="settings-hint">{t.changeLater}</p>
    <footer className="first-run-actions">
      <Button variant="primary" block onClick={() => updateSettings({ ...draft, firstRunDone: true })}>{t.start}</Button>
      <Button variant="ghost" block onClick={() => updateSettings({ ...DEFAULT_SETTINGS, firstRunDone: true })}>{t.skip}</Button>
    </footer>
  </main>;
}
