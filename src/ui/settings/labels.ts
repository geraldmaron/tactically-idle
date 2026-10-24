// Every player-facing word on the launch advisory and Settings, in one place so a name changes once.
// Owner redesign 2026-10-20 (Xbox Accessibility Guideline 123): no tier, three avoidable themes, the
// rest named as warnings only. House rules: no em or en dashes, no spaced hyphens, no colons, and no
// ESRB or PEGI names (docs/content-rating.md).

import type { ContentDescriptor } from '../../content/content-descriptors';
import type { TimerSetting } from '../../sim/timer-setting';
import type { CardWarningSetting } from './prefs';

/** The order themes appear in on the card and in the avoid list: the sensitive themes first, then
 * what runs through most calls. */
export const THEME_ORDER: readonly ContentDescriptor[] = ['suicide_self_harm', 'child_at_risk', 'domestic_violence', 'death', 'police_gunfire', 'injury'];

export const THEME_LABELS: Readonly<Record<ContentDescriptor, { name: string; detail: string }>> = {
  suicide_self_harm: { name: 'Suicide and self-harm', detail: 'A person on scene is at risk of hurting themselves.' },
  child_at_risk: { name: 'A child in danger', detail: 'A child is inside or in danger.' },
  domestic_violence: { name: 'Domestic violence', detail: 'Harm between partners or family members drives the call.' },
  death: { name: 'Death', detail: 'Someone can die on the call.' },
  police_gunfire: { name: 'Police gunfire', detail: 'Your team can open fire.' },
  injury: { name: 'Injury', detail: 'An officer or a civilian can be hurt.' },
};

/** The themes a call card names, in plain words, for every descriptor. Never plot. Owner approved
 * the wording 2026-10-20 (docs/calls/notes/content-warnings-draft.md). */
export const CARD_THEME_WORDS: Readonly<Record<ContentDescriptor, string>> = {
  death: 'death',
  suicide_self_harm: 'suicide risk',
  injury: 'injury',
  police_gunfire: 'police gunfire',
  child_at_risk: 'a child in danger',
  domestic_violence: 'domestic violence',
};

/** The call card's warning line and the reassurance under it. The line is "Involves A, B and C.",
 * no serial comma. */
export const CARD_WARNING_TEXT = {
  involves: 'Involves',
  leaveIt: 'No penalty for skipping this call.',
} as const;

/** Why a switch can't be turned on while other switches are on. A theme every call carries has no switch and is named by MENU_TEXT.everyCall instead. */
export const BLOCKED_BY_CHOICES_REASON = 'With your other choices, turning this off would leave no calls.';

/** "A", "A and B", "A, B and C". */
export function joinThemes(words: readonly string[]): string {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** What the game contains, named plainly on the launch advisory. */
export const ADVISORY_THEMES = ['Suicide risk', 'Children in danger', 'Domestic violence', 'Death', 'Police use of force, including gunfire', 'Injury'] as const;

export const WARNING_LABELS: Readonly<Record<CardWarningSetting, { name: string; detail: string }>> = {
  all: { name: 'Warn me', detail: 'Each call card names the themes it involves before you accept it. It never says what happens.' },
  none: { name: 'No warnings', detail: 'Call cards carry no theme warnings.' },
};

export const TIMER_LABELS: Readonly<Record<TimerSetting, { name: string; detail: string }>> = {
  off: { name: 'Off', detail: 'Take as long as you like. Waiting on a decision never costs time on the call.' },
  relaxed: { name: 'Relaxed', detail: 'The scene keeps moving while you decide. A stage\'s threat lands after about a minute. It stops while the game is in the background.' },
  standard: { name: 'Standard', detail: 'The scene moves twice as fast. A stage\'s threat lands after about half a minute. It stops while the game is in the background.' },
};

export const SETTINGS_TEXT = {
  advisoryKicker: 'Before your first shift',
  advisoryTitle: 'What this game shows',
  advisoryIntro: 'You run a police tactical team. Its calls include these themes.',
  leaveCalls: 'You can leave any call on the board. Calls expire without a penalty.',
  notAgeCheck: 'These settings are your preferences. We don\'t check your age.',
  continue: 'Continue to headquarters',
  changeLater: 'You can change these later from the menu button at the top of the screen. The menu also has a Support entry.',
  settingsTitle: 'Settings',
  settingsSubtitle: 'Kept in this browser, apart from your saves',
  openSettings: 'Settings',
  avoidHeading: 'Avoid these themes',
  avoidHint: 'Calls with a theme you switch on here stay off your board.',
  warningsHeading: 'Call card warnings',
  timerHeading: 'Call timer',
  timerHint: 'How fast time on the call moves while a decision waits on you.',
  comfortHeading: 'Sound and lights',
  soundHeading: 'Sound',
  soundHint: 'Radio, the crowd and a heartbeat on calls, short chimes when you hire, buy or promote, and a faint hum at HQ and Build. Vibration too, where your phone has it. Quiet when your device asks for reduced motion.',
  soundOn: 'On',
  soundOff: 'Muted',
  flashingHeading: 'Flashing lights',
  flashingHint: 'On a hot call, red and blue lights sweep across the top of the screen, faster as the pressure builds. Turn them off if flashing light bothers you.',
  flashingOn: 'On',
  flashingOff: 'Off',
} as const;

/** The menu sheet's own words (settings/SettingsSheet.tsx). */
export const MENU_TEXT = {
  title: 'Menu',
  campaign: 'Campaign',
  saves: 'Saves',
  themes: 'Themes to avoid',
  noneAvoided: 'None avoided',
  peopleColor: 'Color names by role',
  support: 'Support',
  talk: 'Talk to someone',
  talkDetail: '988 in the US, any hour',
  everyCall: (themes: string) => `Every call can involve ${themes}, so these stay on.`,
} as const;

/** The Settings sheet's sections (settings/SettingsSheet.tsx, canvas F2). */
export const SHEET_TEXT = {
  calls: 'Calls',
  timerHint: 'How fast time moves on a call while a decision waits on you.',
  themesRow: 'Themes kept off the board',
  warningsRow: 'Call card warnings',
  lives: 'Officers\' personal lives',
  livesOn: 'Bond scenes and romances show. Play is the same either way.',
  livesOff: 'Bonds off the clock are hidden. Play is the same either way.',
  notifications: 'Notifications',
  notifyNote: 'You are asked again when you start your first shift. Never for purchases, and never for an officer in distress. This browser keeps your choice; the iOS and Android builds send the buzz.',
  notifyShifts: 'Shift ends',
  notifyShiftsDetail: 'When a proactive shift finishes.',
  notifyDecisions: 'Decisions waiting',
  notifyDecisionsDetail: 'When a person or a case needs your call.',
  notifyDigest: 'Daily digest',
  notifyDigestDetail: 'One summary a day, never more.',
  display: 'Display and accessibility',
  displayDetail: 'Sound, flashing lights, color by role',
  save: 'Your save',
  saves: 'Saves',
  cloud: 'Cloud backup',
  cloudDetail: 'Not set up. It arrives with the app builds. Your saves stay on this device.',
  purchases: 'Allow purchases',
  purchasesOn: 'The Store can sell lifetime items and looks.',
  purchasesOff: 'The Store stays readable and sells nothing.',
  restore: 'Restore from a backup',
  restoreDetail: 'Choose a backup file in Saves',
  exportRow: 'Export this campaign',
  exportDetail: 'A backup file you keep',
  exportTrail: 'Export',
  reset: 'Reset this campaign',
  resetDetail: 'Start over with a new roster',
  wipe: 'Delete saves on this device',
  wipeDetail: 'Every slot, for good',
  resetTitle: 'Reset this campaign?',
  resetBody: 'This slot starts over with a new department and a new roster. Its progress is gone. Your purchases and settings stay. Other save slots are not touched.',
  resetConfirm: 'Reset campaign',
  wipeTitle: 'Delete every save on this device?',
  wipeBody: 'All ten slots are removed for good and a fresh campaign starts in the one you are using. Export first if you want a copy. Your purchases and settings stay.',
  wipeConfirm: 'Delete all saves',
  cancel: 'Cancel',
  footer: 'Settings are kept in this browser, apart from your saves. Purchases are tied to your store account.',
} as const;

/** Support details, shown in Settings at all times and as the debrief line on any situation with
 * suicide or self-harm. 988 wording checked at 988lifeline.org on 2026-10-20; owner approved the
 * strings and the word "suicide" on these surfaces. */
export const SUPPORT_TEXT = {
  heading: 'Support',
  lead: 'If a call brings something up for you, or you\'re thinking about suicide, you can talk to someone.',
  us: 'In the US, call or text 988 to reach the 988 Suicide & Crisis Lifeline. It\'s free and confidential, at any hour.',
  elsewhere: 'Outside the US, contact a crisis line where you live. If you\'re in immediate danger, contact local emergency services.',
  call: 'Call 988',
  text: 'Text 988',
  chat: 'Chat online',
  chatUrl: 'https://chat.988lifeline.org',
  debrief: 'If this call brought something up for you, you can call or text 988 in the US, at any hour. Outside the US, contact a local crisis line. If you\'re in immediate danger, contact local emergency services.',
} as const;

/** One line summing up the settings, for the button that opens them. */
export function settingsSummary(s: { avoidThemes: readonly ContentDescriptor[]; cardWarnings: CardWarningSetting; timer: TimerSetting }): string {
  const n = s.avoidThemes.length;
  return [n ? `${n} ${n === 1 ? 'theme' : 'themes'} avoided` : null, s.cardWarnings === 'all' ? 'Warnings on' : 'Warnings off', `Timer ${TIMER_LABELS[s.timer].name.toLowerCase()}`]
    .filter(Boolean).join(' · ');
}
