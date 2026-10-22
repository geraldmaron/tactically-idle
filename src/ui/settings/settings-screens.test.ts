// The launch advisory and Settings: the themes are named plainly, the advisory says it is no age
// check and needs a deliberate tick, support is always in Settings, and no label breaks the house
// rules or names a store rating.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT_DESCRIPTORS, type ContentDescriptor } from '../../content/content-descriptors';
import { drawableKinds } from '../../sim/incidents';
import { blockedAlone, canAvoid, leavesCalls } from './avoidable';
import { FirstRun } from './FirstRun';
import { ADVISORY_THEMES, CARD_THEME_WORDS, CARD_WARNING_TEXT, MENU_TEXT, SETTINGS_TEXT, SUPPORT_TEXT, THEME_LABELS, THEME_ORDER, TIMER_LABELS, WARNING_LABELS, reasonText, settingsSummary } from './labels';
import { DEFAULT_SETTINGS } from './prefs';
import { SettingsControls } from './SettingsControls';

vi.mock('../components/Sheet', () => ({ Sheet: ({ open, title, children }: { open: boolean; title: string; children: unknown }) => open ? createElement('section', { role: 'dialog', 'aria-label': title }, children as never) : null }));
const { MenuSheet } = await import('./SettingsSheet');

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const allLabels = [THEME_LABELS, WARNING_LABELS, TIMER_LABELS].flatMap((group) => Object.values(group).flatMap((l) => [l.name, l.detail]))
  .concat(Object.values(SETTINGS_TEXT), Object.values(MENU_TEXT).flatMap((v) => typeof v === 'string' ? [v] : []), MENU_TEXT.everyCall('death'), Object.entries(SUPPORT_TEXT).filter(([key]) => key !== 'chatUrl').map(([, text]) => text), ADVISORY_THEMES, Object.values(CARD_THEME_WORDS), Object.values(CARD_WARNING_TEXT));

describe('settings labels', () => {
  it('keep the house rules: no em or en dashes, no spaced hyphens, no colons', () => {
    for (const label of allLabels) expect(label, label).not.toMatch(/[–—:]| - /);
  });

  it('never name a store rating or a tier', () => {
    for (const label of allLabels) expect(label, label).not.toMatch(/\b(ESRB|PEGI|IARC|Teen|Everyone|Adults Only|Core|Mature)\b|\bM\b|\b1[268]\+?\b/);
  });

  it('offer a switch for every descriptor, in the card order', () => {
    expect([...THEME_ORDER].sort()).toEqual([...CONTENT_DESCRIPTORS].sort());
    expect(Object.keys(THEME_LABELS).sort()).toEqual([...CONTENT_DESCRIPTORS].sort());
  });

  it('sum up the settings in one line', () => {
    expect(settingsSummary(DEFAULT_SETTINGS)).toBe('Warnings on · Timer relaxed');
    expect(settingsSummary({ avoidThemes: ['child_at_risk'], cardWarnings: 'none', timer: 'off' })).toBe('1 theme avoided · Warnings off · Timer off');
  });
});

describe('settings screens', () => {
  it('the advisory names every theme, says it is no age check, and has one Continue button that works at once', () => {
    const html = renderToStaticMarkup(createElement(FirstRun));
    const shown = text(html);
    for (const theme of ADVISORY_THEMES) expect(shown).toContain(theme);
    expect(shown).toContain(SETTINGS_TEXT.notAgeCheck);
    expect(shown).toContain(SETTINGS_TEXT.leaveCalls);
    expect(html).not.toContain('first-run-ack');
    expect(html.match(new RegExp(`<button[^>]*>${SETTINGS_TEXT.continue}</button>`))?.[0]).not.toContain('disabled');
  });

  it('offers a switch for all six descriptors, plus the warning and timer choices', () => {
    const html = renderToStaticMarkup(createElement(SettingsControls, { value: { ...DEFAULT_SETTINGS, avoidThemes: ['domestic_violence'] }, onChange: () => {} }));
    expect(html.match(/type="checkbox"/g)).toHaveLength(6);
    for (const theme of CONTENT_DESCRIPTORS) expect(text(html)).toContain(THEME_LABELS[theme].name);
    for (const l of [...Object.values(WARNING_LABELS), ...Object.values(TIMER_LABELS)]) expect(text(html)).toContain(l.name);
    expect(html).not.toContain(SETTINGS_TEXT.avoidHeading.replace('themes', 'mechanics'));
  });

  it('disables a switch that would leave no calls and says why under it, in both wordings', () => {
    expect(blockedAlone('injury')).toBe(true);
    const alone = renderToStaticMarkup(createElement(SettingsControls, { value: DEFAULT_SETTINGS, onChange: () => {} }));
    expect(text(alone)).toContain(reasonText('injury', true));
    expect(text(alone)).toContain('Every call can involve injury, so turning this off would leave no calls.');
    expect(alone.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(1);
    // A blocked switch that is already on can be turned off; one blocked only by the other choices gets the other line.
    const stuck = CONTENT_DESCRIPTORS.find((d) => !blockedAlone(d) && !canAvoid(THEME_ORDER.filter((x) => x !== d && !blockedAlone(x)), d));
    if (stuck) {
      const others = THEME_ORDER.filter((x) => x !== stuck && !blockedAlone(x));
      expect(text(renderToStaticMarkup(createElement(SettingsControls, { value: { ...DEFAULT_SETTINGS, avoidThemes: others }, onChange: () => {} })))).toContain(reasonText(stuck, false));
    }
  });

  it('no reachable set of switches leaves the board with no calls, and a disabled switch can not be turned on', () => {
    const seen = new Set<string>();
    const walk = (current: ContentDescriptor[]) => {
      const key = [...current].sort().join();
      if (seen.has(key)) return;
      seen.add(key);
      expect(leavesCalls(current), key).toBe(true);
      expect(drawableKinds({ avoid: current }).length, key).toBeGreaterThan(0);
      for (const d of CONTENT_DESCRIPTORS) {
        if (current.includes(d)) continue;
        if (canAvoid(current, d)) walk([...current, d]);
        else expect(leavesCalls([...current, d]), `${key} + ${d}`).toBe(false);
      }
    };
    walk([]);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('shows the approved lead, 988 line and chat button on the menu\'s support page', () => {
    const html = renderToStaticMarkup(createElement(MenuSheet, { open: true, onClose: () => {}, onOpenSaves: () => {}, initialPage: 'support' }));
    for (const line of [SUPPORT_TEXT.lead, SUPPORT_TEXT.us, SUPPORT_TEXT.elsewhere]) expect(text(html)).toContain(line);
    expect(html).toContain('href="https://chat.988lifeline.org"');
    expect(html).toContain('href="tel:988"');
    expect(html).toContain('href="sms:988"');
    expect(text(html)).toContain('Chat online');
  });

  it('the menu always carries a Support row, and settings are rows', () => {
    const html = text(renderToStaticMarkup(createElement(MenuSheet, { open: true, onClose: () => {}, onOpenSaves: () => {} })));
    for (const label of [MENU_TEXT.campaign, MENU_TEXT.saves, MENU_TEXT.themes, SETTINGS_TEXT.warningsHeading, SETTINGS_TEXT.timerHeading, SETTINGS_TEXT.soundHeading, SETTINGS_TEXT.flashingHeading, MENU_TEXT.peopleColor, MENU_TEXT.talk]) expect(html).toContain(label);
  });

  it('the avoid page shows only themes a player can avoid, and names the ones every call carries', () => {
    const html = renderToStaticMarkup(createElement(MenuSheet, { open: true, onClose: () => {}, onOpenSaves: () => {}, initialPage: 'themes' }));
    const always = THEME_ORDER.filter((theme) => blockedAlone(theme));
    for (const theme of THEME_ORDER) {
      if (always.includes(theme)) expect(text(html)).not.toContain(THEME_LABELS[theme].name);
      else expect(text(html)).toContain(THEME_LABELS[theme].name);
    }
    expect(html).not.toMatch(/disabled=""/);
    if (always.length) expect(text(html)).toContain('Every call can involve');
  });
});
