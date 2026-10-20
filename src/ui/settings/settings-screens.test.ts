// The launch advisory and Settings: the themes are named plainly, the advisory says it is no age
// check and needs a deliberate tick, support is always in Settings, and no label breaks the house
// rules or names a store rating.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT_DESCRIPTORS } from '../../content/content-descriptors';
import { FirstRun } from './FirstRun';
import { ADVISORY_THEMES, AVOIDABLE_THEMES, SETTINGS_TEXT, SUPPORT_TEXT, THEME_LABELS, TIMER_LABELS, WARNING_LABELS, settingsSummary } from './labels';
import { DEFAULT_SETTINGS } from './prefs';
import { SettingsControls } from './SettingsControls';

vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children }: { open: boolean; title: string; children: unknown }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children as never) : null }));
const { SettingsSheet } = await import('./SettingsSheet');

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
const allLabels = [THEME_LABELS, WARNING_LABELS, TIMER_LABELS].flatMap((group) => Object.values(group).flatMap((l) => [l.name, l.detail]))
  .concat(Object.values(SETTINGS_TEXT), Object.values(SUPPORT_TEXT), ADVISORY_THEMES);

describe('settings labels', () => {
  it('keep the house rules: no em or en dashes, no spaced hyphens, no colons', () => {
    for (const label of allLabels) expect(label, label).not.toMatch(/[–—:]| - /);
  });

  it('never name a store rating or a tier', () => {
    for (const label of allLabels) expect(label, label).not.toMatch(/\b(ESRB|PEGI|IARC|Teen|Everyone|Adults Only|Core|Mature)\b|\bM\b|\b1[268]\+?\b/);
  });

  it('offer exactly the three avoidable themes, each a real descriptor', () => {
    expect([...AVOIDABLE_THEMES]).toEqual(['suicide_self_harm', 'child_at_risk', 'domestic_violence']);
    for (const theme of AVOIDABLE_THEMES) expect(CONTENT_DESCRIPTORS).toContain(theme);
  });

  it('sum up the settings in one line', () => {
    expect(settingsSummary(DEFAULT_SETTINGS)).toBe('Warnings on · Timer relaxed');
    expect(settingsSummary({ avoidThemes: ['child_at_risk'], cardWarnings: 'none', timer: 'off' })).toBe('1 theme avoided · Warnings off · Timer off');
  });
});

describe('settings screens', () => {
  it('the advisory names every theme, says it is no age check, and keeps continue off until the tick', () => {
    const html = renderToStaticMarkup(createElement(FirstRun));
    const shown = text(html);
    for (const theme of ADVISORY_THEMES) expect(shown).toContain(theme);
    expect(shown).toContain(SETTINGS_TEXT.notAgeCheck);
    expect(shown).toContain(SETTINGS_TEXT.leaveCalls);
    expect(shown).toContain(SETTINGS_TEXT.acknowledge);
    expect(html).toMatch(new RegExp(`<button[^>]*disabled=""[^>]*>${SETTINGS_TEXT.continue}</button>`));
  });

  it('offers toggles for the avoidable themes only, plus the warning and timer choices', () => {
    const html = renderToStaticMarkup(createElement(SettingsControls, { value: { ...DEFAULT_SETTINGS, avoidThemes: ['domestic_violence'] }, onChange: () => {} }));
    expect(html.match(/type="checkbox"/g)).toHaveLength(3);
    expect(html.match(/checked=""/g)).toHaveLength(1);
    for (const theme of AVOIDABLE_THEMES) expect(text(html)).toContain(THEME_LABELS[theme].name);
    for (const word of ['Death', 'Injury', 'Police gunfire']) expect(text(html)).not.toContain(word);
    for (const l of [...Object.values(WARNING_LABELS), ...Object.values(TIMER_LABELS)]) expect(text(html)).toContain(l.name);
  });

  it('settings always lead with support, call and text links to 988 and a line for outside the US', () => {
    const html = renderToStaticMarkup(createElement(SettingsSheet, { open: true, onClose: () => {} }));
    expect(html).toContain('href="tel:988"');
    expect(html).toContain('href="sms:988"');
    expect(text(html)).toContain(SUPPORT_TEXT.elsewhere);
    expect(html.indexOf('settings-support')).toBeLessThan(html.indexOf('settings-controls'));
  });
});
