import { useState } from 'react';
import { Button, Card, Row, Section } from '../components/ui';
import { readSettings, updateSettings, type PlayerSettings } from './prefs';
import { ADVISORY_THEMES, SETTINGS_TEXT } from './labels';
import { SettingsControls } from './SettingsControls';
import { ScreenBanner } from '../art/Plates';
import { Icon, type IconName } from '../icons';
import '../screens/city/city-onboarding.css';

/** One mark per theme the advisory names. Typed by the list, so a new theme needs its mark. */
const THEME_ICONS: Readonly<Record<(typeof ADVISORY_THEMES)[number], IconName>> = {
  'Suicide risk': 'heart',
  'Children in danger': 'child',
  'Domestic violence': 'house',
  'Death': 'pulse',
  'Police use of force, including gunfire': 'shield',
  'Injury': 'bandage',
};

/** The launch advisory, shown once before the department (owner redesign 2026-10-20, after Xbox
 * Accessibility Guideline 123). It names the game's themes and sets the filters, the card warnings
 * and the timer on one screen, then one Continue button. Built from the pieces the other screens
 * use: the painted banner, framed sections and inset rows. The officers wait for the cold open that
 * follows (screens/city/ColdOpen.tsx), so the first call is the first time the player meets them. */
export function FirstRun() {
  const [draft, setDraft] = useState<PlayerSettings>(readSettings);
  const t = SETTINGS_TEXT;
  return <main className="first-run" aria-labelledby="first-run-title">
    <ScreenBanner id="hq" kicker={t.advisoryKicker} title={t.advisoryTitle} level="h1" titleId="first-run-title" line={t.advisoryIntro} />
    <Section icon="calls" title={t.themesHeading} well>
      <ul className="first-run-themes">{ADVISORY_THEMES.map((theme) => <li key={theme}>
        <Icon name={THEME_ICONS[theme]} size="md" /><span>{theme}</span>
      </li>)}</ul>
    </Section>
    <Card className="inset-list">
      <Row lead={<Icon name="door" size="md" />} title={t.skipTitle} detail={t.leaveCalls} />
      <Row lead={<Icon name="info" size="md" />} title={t.ageTitle} detail={t.notAgeCheck} />
    </Card>
    <SettingsControls value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
    <p className="settings-hint">{t.changeLater}</p>
    <footer className="first-run-actions">
      <Button variant="primary" block onClick={() => updateSettings({ ...draft, firstRunDone: true })}>{t.continue}</Button>
    </footer>
  </main>;
}
