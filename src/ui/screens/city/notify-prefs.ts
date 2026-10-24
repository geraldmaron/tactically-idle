// The three notification categories asked once, when the first shift starts (docs/world-redesign.md,
// "Notifications": asked when the player starts something they want to hear about; declining changes
// nothing). One store: the player settings (src/ui/settings/prefs.ts), which Settings shows too. The browser
// build delivers no notifications yet; it records the choice for the builds that do.
import { readSettings, updateSettings } from '../../settings/prefs';
import { useSettings } from '../../settings/SettingsControls';

export interface NotifyPrefs {
  /** Shifts and training finish. */
  finished: boolean;
  /** A call drops in the player's city. */
  calls: boolean;
  /** One daily digest instead of the two above. */
  digest: boolean;
  /** The player has answered the first-shift ask, either way. */
  asked: boolean;
}

export const DEFAULT_NOTIFY: Readonly<NotifyPrefs> = Object.freeze({ finished: true, calls: true, digest: false, asked: false });

/** Before the ask is answered the ask shows its suggested picks; after, the stored choice. */
export const fromSettings = (s: Pick<ReturnType<typeof readSettings>, 'notifyShifts' | 'notifyCalls' | 'notifyDigest' | 'notifyAsked'>): NotifyPrefs =>
  s.notifyAsked ? { finished: s.notifyShifts, calls: s.notifyCalls, digest: s.notifyDigest, asked: true } : { ...DEFAULT_NOTIFY };

export function readNotify(): NotifyPrefs {
  return fromSettings(readSettings());
}

export function writeNotify(patch: Partial<NotifyPrefs>): void {
  updateSettings({
    ...(patch.finished !== undefined ? { notifyShifts: patch.finished } : {}),
    ...(patch.calls !== undefined ? { notifyCalls: patch.calls } : {}),
    ...(patch.digest !== undefined ? { notifyDigest: patch.digest } : {}),
    ...(patch.asked !== undefined ? { notifyAsked: patch.asked } : {}),
  });
}

export const useNotifyPrefs = (): NotifyPrefs => fromSettings(useSettings());

/** Test seam (the settings store keeps its own). */
export function resetNotifyMemory(): void {}
