import { Sheet } from '../components/Sheet';
import { updateSettings } from './prefs';
import { SETTINGS_TEXT } from './labels';
import { SettingsControls, SupportPanel, useSettings } from './SettingsControls';

/** Support first, then the same controls as the launch advisory, saved as each one changes. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  return <Sheet open={open} onClose={onClose} title={SETTINGS_TEXT.settingsTitle} subtitle={SETTINGS_TEXT.settingsSubtitle} className="settings-sheet">
    <SupportPanel />
    <p className="settings-hint">{SETTINGS_TEXT.notAgeCheck}</p>
    <SettingsControls value={settings} onChange={updateSettings} />
  </Sheet>;
}
