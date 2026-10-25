// The player's strong-language choice, applied where text reaches a screen (content/language). The simulation and
// the save keep the raw words; `presentText` and `readScenario` (sim/scenario-registry.ts) read the setting each time,
// so a change shows on the next render. Importing this file installs the presenter.
import { useSyncExternalStore } from 'react';
import { softenLanguage } from '../content/language';
import { presentText, setTextPresenter } from '../sim/scenario-registry';
import { readSettings, softenLanguageOn, subscribeSettings } from './settings/prefs';

setTextPresenter({ key: () => (softenLanguageOn() ? 'soft' : ''), text: (text) => (softenLanguageOn() ? softenLanguage(text) : text) });

/** Re-render when the choice changes; true while strong language is softened. */
export const useSoftenLanguage = (): boolean => useSyncExternalStore(subscribeSettings, () => readSettings().softenLanguage, () => false);

/** A line the simulation recorded (a result, a transcript line, an announcement), as this player should read it. */
export const shown = presentText;
