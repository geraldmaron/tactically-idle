// Every player-facing word on the first-run and Settings screens, in one place so a name changes
// once. Tiers are a preference, never a store rating: no ESRB or PEGI letters or names
// (docs/content-rating.md). House rules: no em or en dashes, no spaced hyphens, no colons.

import { CONTENT_DESCRIPTORS, MATURE_ONLY, type ContentDescriptor, type ContentTier } from '../../content/content-descriptors';
import type { TimerSetting } from '../../sim/timer-setting';
import type { ContentNoteSetting } from './prefs';

export const TOPIC_LABELS: Readonly<Record<ContentDescriptor, { name: string; detail: string }>> = {
  death: { name: 'Death', detail: 'Someone can die on the call.' },
  suicide_self_harm: { name: 'Suicide and self-harm', detail: 'A person on scene is at risk of hurting themselves.' },
  injury: { name: 'Injury', detail: 'An officer or a civilian can be hurt.' },
  police_gunfire: { name: 'Police gunfire', detail: 'Your team can open fire.' },
  child_at_risk: { name: 'A child at risk', detail: 'A child is inside or in danger.' },
  domestic_violence: { name: 'Domestic violence', detail: 'Harm between partners or family members drives the call.' },
};

const matureOnlyNames = CONTENT_DESCRIPTORS.filter((d) => MATURE_ONLY[d]).map((d) => TOPIC_LABELS[d].name.toLowerCase());
const listed = (names: string[]) => names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

export const TIER_LABELS: Readonly<Record<ContentTier, { name: string; detail: string }>> = {
  core: { name: 'Core', detail: `Leaves out calls that involve ${listed(matureOnlyNames)}.` },
  mature: { name: 'Mature', detail: 'Every call the game has.' },
};

export const NOTE_LABELS: Readonly<Record<ContentNoteSetting, { name: string; detail: string }>> = {
  all: { name: 'Every topic', detail: 'Each call card names the topics it involves before you accept it.' },
  flagged: { name: 'Topics I mark', detail: 'Only the topics you mark below get a note on the call card.' },
  none: { name: 'No notes', detail: 'Call cards carry no topic notes.' },
};

export const TIMER_LABELS: Readonly<Record<TimerSetting, { name: string; detail: string }>> = {
  off: { name: 'Off', detail: 'Take as long as you like. Waiting on a decision never costs time on the call.' },
  relaxed: { name: 'Relaxed', detail: 'Time to read every stage first, then waiting slowly costs time on the call.' },
  standard: { name: 'Standard', detail: 'A short moment to read, then waiting costs time on the call at full speed.' },
};

export const SETTINGS_TEXT = {
  firstRunKicker: 'Before your first shift',
  firstRunTitle: 'What you see on calls',
  notAgeCheck: 'These are your own preferences for what the game shows you. They are not an age check, and nothing here is verified.',
  changeLater: 'You can change any of this later from the saves button at the top of the screen, under Settings.',
  start: 'Start with these',
  skip: 'Skip and keep the defaults',
  settingsTitle: 'Settings',
  settingsSubtitle: 'Kept in this browser, apart from your saves',
  openSettings: 'Settings',
  tierHeading: 'Content',
  topicsHeading: 'Topics',
  topicsHint: 'Switch off any topic you would rather not see. Calls that involve it stay off your board.',
  leftOutInCore: 'Left out in Core',
  noteFor: 'Note',
  notesHeading: 'Topic notes',
  notesHint: 'A one line note names the topics a call involves. It never says what happens.',
  timerHeading: 'Call timer',
  timerHint: 'How fast time on the call moves while a decision waits on you.',
} as const;

/** One line summing up the settings, for the button that opens them. */
export function settingsSummary(s: { tier: ContentTier; topicsOff: readonly ContentDescriptor[]; timer: TimerSetting }): string {
  const off = s.topicsOff.filter((d) => !(s.tier === 'core' && MATURE_ONLY[d])).length;
  return [TIER_LABELS[s.tier].name, off ? `${off} ${off === 1 ? 'topic' : 'topics'} off` : null, `Timer ${TIMER_LABELS[s.timer].name.toLowerCase()}`]
    .filter(Boolean).join(' · ');
}
