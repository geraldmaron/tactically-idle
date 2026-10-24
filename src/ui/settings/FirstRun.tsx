import { useState } from 'react';
import { Button } from '../components/ui';
import { readSettings, updateSettings, type PlayerSettings } from './prefs';
import { ADVISORY_THEMES, SETTINGS_TEXT } from './labels';
import { SettingsControls } from './SettingsControls';
import { PlateArt, plateUrl } from '../art/Plates';
import '../screens/city/city-onboarding.css';

/** The launch advisory, shown once before the department (owner redesign 2026-10-20, after Xbox
 * Accessibility Guideline 123). It names the game's themes and sets the filters, the card warnings
 * and the timer on one screen, then one Continue button. The officers wait for the cold open that
 * follows (screens/city/ColdOpen.tsx), so the first call is the first time the player meets them. */
export function FirstRun() {
  const [draft, setDraft] = useState<PlayerSettings>(readSettings);
  const t = SETTINGS_TEXT;
  return <main className="first-run" aria-labelledby="first-run-title">
    <div className="first-run-art plate" aria-hidden="true"><PlateArt src={plateUrl('banner_hq')} />
      <span className="first-run-brand">Tactically Idle</span>
    </div>
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
      <Button variant="primary" block onClick={() => updateSettings({ ...draft, firstRunDone: true })}>{t.continue}</Button>
    </footer>
  </main>;
}
