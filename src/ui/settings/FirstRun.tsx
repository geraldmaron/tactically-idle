import { useState } from 'react';
import { Button } from '../components/ui';
import { readSettings, updateSettings, type PlayerSettings } from './prefs';
import { ADVISORY_THEMES, SETTINGS_TEXT } from './labels';
import { SettingsControls } from './SettingsControls';

/** The launch advisory, shown once before the department (owner redesign 2026-10-20, after Xbox
 * Accessibility Guideline 123). It names the game's themes, then takes a deliberate tick before the
 * continue button works, so a reflex tap can't skip past it. */
export function FirstRun() {
  const [draft, setDraft] = useState<PlayerSettings>(readSettings);
  const [read, setRead] = useState(false);
  const t = SETTINGS_TEXT;
  return <main className="first-run" aria-labelledby="first-run-title">
    <header className="first-run-head">
      <p className="first-run-kicker">{t.advisoryKicker}</p>
      <h1 id="first-run-title" className="first-run-title">{t.advisoryTitle}</h1>
      <p className="first-run-lead">{t.advisoryIntro}</p>
      <ul className="first-run-themes">{ADVISORY_THEMES.map((theme) => <li key={theme}>{theme}</li>)}</ul>
      <p className="first-run-lead">{t.leaveCalls}</p>
      <p className="first-run-note">{t.notAgeCheck}</p>
    </header>
    <SettingsControls value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
    <p className="settings-hint">{t.changeLater}</p>
    <footer className="first-run-actions">
      <label className="first-run-ack">
        <input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} />
        <span>{t.acknowledge}</span>
      </label>
      {!read && <p className="settings-hint">{t.acknowledgeHint}</p>}
      <Button variant="primary" block disabled={!read} onClick={() => updateSettings({ ...draft, firstRunDone: true })}>{t.continue}</Button>
    </footer>
  </main>;
}
