// The first-run screen and Settings controls: every topic and setting shows by its plain name, the
// screen says it is no age check, and nothing breaks the house rules or names a store rating.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CONTENT_DESCRIPTORS } from '../../content/content-descriptors';
import { FirstRun } from './FirstRun';
import { NOTE_LABELS, SETTINGS_TEXT, TIER_LABELS, TIMER_LABELS, TOPIC_LABELS, settingsSummary } from './labels';
import { DEFAULT_SETTINGS } from './prefs';
import { SettingsControls } from './SettingsControls';

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const allLabels = [TOPIC_LABELS, TIER_LABELS, NOTE_LABELS, TIMER_LABELS].flatMap((group) => Object.values(group).flatMap((l) => [l.name, l.detail]))
  .concat(Object.values(SETTINGS_TEXT));

describe('settings labels', () => {
  it('keep the house rules: no em or en dashes, no spaced hyphens, no colons', () => {
    for (const label of allLabels) expect(label, label).not.toMatch(/[–—:]| - /);
  });

  it('never name a store rating', () => {
    for (const label of allLabels) expect(label, label).not.toMatch(/\b(ESRB|PEGI|IARC|Teen|Everyone|Adults Only)\b|\bM\b|\b1[268]\+?\b/);
    expect([TIER_LABELS.core.name, TIER_LABELS.mature.name]).toEqual(['Core', 'Mature']);
  });

  it('sums up the settings in one line', () => {
    expect(settingsSummary(DEFAULT_SETTINGS)).toBe('Mature · Timer relaxed');
    expect(settingsSummary({ tier: 'core', topicsOff: ['death', 'injury'], timer: 'off' })).toBe('Core · 1 topic off · Timer off');
  });
});

describe('settings screens', () => {
  it('first run shows every control and says it is not an age check', () => {
    const html = renderToStaticMarkup(createElement(FirstRun));
    const shown = text(html);
    expect(shown).toContain(SETTINGS_TEXT.notAgeCheck);
    for (const d of CONTENT_DESCRIPTORS) expect(shown).toContain(TOPIC_LABELS[d].name);
    for (const l of [TIER_LABELS.core, TIER_LABELS.mature, ...Object.values(NOTE_LABELS), ...Object.values(TIMER_LABELS)]) expect(shown).toContain(l.name);
    expect(shown).toContain(SETTINGS_TEXT.start);
    expect(shown).toContain(SETTINGS_TEXT.skip);
  });

  it('locks the mature-only topics under Core and offers a note mark only for topics on the board', () => {
    const html = renderToStaticMarkup(createElement(SettingsControls, { value: { ...DEFAULT_SETTINGS, tier: 'core', contentNotes: 'flagged', topicsOff: ['police_gunfire'] }, onChange: () => {} }));
    expect(html.match(/disabled=""/g)).toHaveLength(4);
    expect(text(html).match(new RegExp(SETTINGS_TEXT.leftOutInCore, 'g'))).toHaveLength(4);
    expect(html.match(/aria-label="Note for /g)).toHaveLength(1);
    expect(html).toContain('aria-label="Note for Injury"');
  });
});
