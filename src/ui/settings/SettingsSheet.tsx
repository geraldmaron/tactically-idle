import { Sheet } from '../components/Sheet';
import { updateSettings } from './prefs';
import { SETTINGS_TEXT } from './labels';
import { SettingsControls, useSettings } from './SettingsControls';

/** The same controls as the first-run screen, saved as each one changes. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  return <Sheet open={open} onClose={onClose} title={SETTINGS_TEXT.settingsTitle} subtitle={SETTINGS_TEXT.settingsSubtitle} className="settings-sheet">
    <p className="settings-hint">{SETTINGS_TEXT.notAgeCheck}</p>
    <SettingsControls value={settings} onChange={updateSettings} />
  </Sheet>;
}
