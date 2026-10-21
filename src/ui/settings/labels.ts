// Every player-facing word on the launch advisory and Settings, in one place so a name changes once.
// Owner redesign 2026-10-20 (Xbox Accessibility Guideline 123): no tier, three avoidable themes, the
// rest named as warnings only. House rules: no em or en dashes, no spaced hyphens, no colons, and no
// ESRB or PEGI names (docs/content-rating.md).

import type { AvoidableTheme, ContentDescriptor } from '../../content/content-descriptors';
import type { TimerSetting } from '../../sim/timer-setting';
import type { CardWarningSetting } from './prefs';

export const THEME_LABELS: Readonly<Record<AvoidableTheme, { name: string; detail: string }>> = {
  suicide_self_harm: { name: 'Suicide and self-harm', detail: 'A person on scene is at risk of hurting themselves.' },
  child_at_risk: { name: 'A child at risk', detail: 'A child is inside or in danger.' },
  domestic_violence: { name: 'Domestic violence', detail: 'Harm between partners or family members drives the call.' },
};

/** DRAFT for owner approval (an Opus session rewrites the wording later): the themes a call card
 * names, in plain words, for every descriptor. Never plot. */
export const CARD_THEME_WORDS: Readonly<Record<ContentDescriptor, string>> = {
  death: 'death',
  suicide_self_harm: 'suicide risk',
  injury: 'injury',
  police_gunfire: 'police use of force',
  child_at_risk: 'a child in danger',
  domestic_violence: 'domestic violence',
};

/** DRAFT for owner approval: the call card's warning line and the reassurance under it. */
export const CARD_WARNING_TEXT = {
  involves: 'Involves',
  leaveIt: 'You can leave this call. Calls you don\'t take end on their own and cost you nothing.',
} as const;

/** What the game contains, named plainly on the launch advisory. */
export const ADVISORY_THEMES = ['Police use of force', 'Death', 'Injury', 'Suicide risk', 'Children in danger', 'Domestic violence'] as const;

export const WARNING_LABELS: Readonly<Record<CardWarningSetting, { name: string; detail: string }>> = {
  all: { name: 'Warn me', detail: 'Each call card names the themes it involves before you accept it. It never says what happens.' },
  none: { name: 'No warnings', detail: 'Call cards carry no theme warnings.' },
};

export const TIMER_LABELS: Readonly<Record<TimerSetting, { name: string; detail: string }>> = {
  off: { name: 'Off', detail: 'Take as long as you like. Waiting on a decision never costs time on the call.' },
  relaxed: { name: 'Relaxed', detail: 'Time to read every stage first, then waiting slowly costs time on the call.' },
  standard: { name: 'Standard', detail: 'A short moment to read, then waiting costs time on the call at full speed.' },
};

export const SETTINGS_TEXT = {
  advisoryKicker: 'Before your first shift',
  advisoryTitle: 'What this game shows',
  advisoryIntro: 'You run a police tactical team. Its calls deal with these themes.',
  leaveCalls: 'You can always leave a call on the board. Calls you don\'t take end on their own and cost you nothing.',
  notAgeCheck: 'The choices below are your own preferences. They are not an age check, and nothing here is verified.',
  acknowledge: 'I have read this',
  acknowledgeHint: 'Tick the box above to continue.',
  continue: 'Continue to headquarters',
  changeLater: 'You can change these later in Settings, from the saves button at the top of the screen. Settings also lists where to find support.',
  settingsTitle: 'Settings',
  settingsSubtitle: 'Kept in this browser, apart from your saves',
  openSettings: 'Settings',
  avoidHeading: 'Avoid these themes',
  avoidHint: 'Calls built around a theme you switch on here stay off your board.',
  warningsHeading: 'Call card warnings',
  timerHeading: 'Call timer',
  timerHint: 'How fast time on the call moves while a decision waits on you.',
} as const;

/** DRAFT for owner approval: support details shown in Settings at all times. */
export const SUPPORT_TEXT = {
  heading: 'Support',
  us: 'If a call brings up something hard, or you are thinking about suicide, the 988 Suicide and Crisis Lifeline is there in the US. Call or text 988.',
  elsewhere: 'Outside the US, contact your local emergency services or a crisis line where you live.',
  call: 'Call 988',
  text: 'Text 988',
} as const;

/** One line summing up the settings, for the button that opens them. */
export function settingsSummary(s: { avoidThemes: readonly AvoidableTheme[]; cardWarnings: CardWarningSetting; timer: TimerSetting }): string {
  const n = s.avoidThemes.length;
  return [n ? `${n} ${n === 1 ? 'theme' : 'themes'} avoided` : null, s.cardWarnings === 'all' ? 'Warnings on' : 'Warnings off', `Timer ${TIMER_LABELS[s.timer].name.toLowerCase()}`]
    .filter(Boolean).join(' · ');
}
