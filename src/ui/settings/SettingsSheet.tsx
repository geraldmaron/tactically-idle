import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Sheet } from '../components/Sheet';
import { Row, Segmented } from '../components/ui';
import { Icon } from '../icons';
import { useCampaigns } from '../store';
import { campaignStatus } from '../components/SaveManager';
import { usePeopleColor } from '../people/PeopleText';
import { setPeopleColor } from '../people/prefs';
import { CARD_WARNING_SETTINGS, updateSettings, type PlayerSettings } from './prefs';
import { ALWAYS_THEMES, AVOIDABLE_THEMES, canAvoid } from './avoidable';
import { BLOCKED_BY_CHOICES_REASON, CARD_THEME_WORDS, MENU_TEXT, SETTINGS_TEXT, THEME_LABELS, THEME_ORDER, TIMER_LABELS, WARNING_LABELS, joinThemes } from './labels';
import { SupportPanel, useSettings } from './SettingsControls';
import './menu.css';

export type MenuPage = 'menu' | 'themes' | 'warnings' | 'timer' | 'support';

export function avoidSummary(avoid: PlayerSettings['avoidThemes']): string {
  if (!avoid.length) return MENU_TEXT.noneAvoided;
  if (avoid.length > 2) return `${avoid.length} avoided`;
  return joinThemes(avoid.map((theme) => THEME_LABELS[theme].name));
}

/** The one menu, from the resource bar (docs/ui-ux-audit.md, "Menu"): the campaign and its saves,
 * settings as rows saved as each one changes, and support. A row with choices opens a page inside
 * the sheet; a yes or no setting is a switch on its row. */
export function MenuSheet({ open, onClose, onOpenSaves, initialPage = 'menu' }: { open: boolean; onClose: () => void; onOpenSaves: () => void; initialPage?: MenuPage }) {
  const [page, setPage] = useState<MenuPage>(initialPage);
  useEffect(() => { if (open) setPage(initialPage); }, [open, initialPage]);
  const settings = useSettings();
  const title = page === 'menu' ? MENU_TEXT.title : page === 'themes' ? MENU_TEXT.themes : page === 'warnings' ? SETTINGS_TEXT.warningsHeading : page === 'timer' ? SETTINGS_TEXT.timerHeading : MENU_TEXT.support;
  return <Sheet open={open} onClose={onClose} title={title} className="menu-sheet" interactionKey={page}>
    {page !== 'menu' && <button type="button" className="menu-back" onClick={() => setPage('menu')}><Icon name="chevronLeft" size={18} />{MENU_TEXT.title}</button>}
    {page === 'menu' && <MenuHome settings={settings} onPage={setPage} onOpenSaves={onOpenSaves} />}
    {page === 'themes' && <ThemesPage settings={settings} />}
    {page === 'warnings' && <ChoicePage hint={null} detail={WARNING_LABELS[settings.cardWarnings].detail}>
      <Segmented label={SETTINGS_TEXT.warningsHeading} value={settings.cardWarnings} onChange={(cardWarnings) => updateSettings({ cardWarnings })}
        options={CARD_WARNING_SETTINGS.map((s) => ({ value: s, label: WARNING_LABELS[s].name }))} />
    </ChoicePage>}
    {page === 'timer' && <ChoicePage hint={SETTINGS_TEXT.timerHint} detail={TIMER_LABELS[settings.timer].detail}>
      <Segmented label={SETTINGS_TEXT.timerHeading} value={settings.timer} onChange={(timer) => updateSettings({ timer })}
        options={TIMER_SETTINGS.map((s) => ({ value: s, label: TIMER_LABELS[s].name }))} />
    </ChoicePage>}
    {page === 'support' && <SupportPanel />}
  </Sheet>;
}

function MenuHome({ settings, onPage, onOpenSaves }: { settings: PlayerSettings; onPage: (page: MenuPage) => void; onOpenSaves: () => void }) {
  const saved = useCampaigns();
  const status = campaignStatus(saved);
  const slot = saved.activeSlotId ? saved.slots[saved.activeSlotId - 1] : null;
  const peopleColor = usePeopleColor();
  const chevron = <Icon name="chevronRight" size={18} />;
  return <div className="menu-home">
    <section className="menu-group" aria-labelledby="menu-campaign">
      <h3 id="menu-campaign" className="menu-heading">{MENU_TEXT.campaign}</h3>
      <Row className={`menu-row${status.attention ? ' menu-row-attention' : ''}`} title={slot?.name ?? status.name}
        detail={slot ? `Slot ${saved.activeSlotId} · ${status.detail}` : status.detail}
        trail={<button type="button" className="menu-link" onClick={onOpenSaves}>{MENU_TEXT.saves}</button>} />
    </section>
    <section className="menu-group" aria-labelledby="menu-settings">
      <h3 id="menu-settings" className="menu-heading">{SETTINGS_TEXT.settingsTitle}</h3>
      <Row className="menu-row" title={MENU_TEXT.themes} detail={avoidSummary(settings.avoidThemes)} trail={chevron} onClick={() => onPage('themes')} />
      <Row className="menu-row" title={SETTINGS_TEXT.warningsHeading} detail={WARNING_LABELS[settings.cardWarnings].name} trail={chevron} onClick={() => onPage('warnings')} />
      <Row className="menu-row" title={SETTINGS_TEXT.timerHeading} detail={TIMER_LABELS[settings.timer].name} trail={chevron} onClick={() => onPage('timer')} />
      <MenuSwitch label={SETTINGS_TEXT.soundHeading} checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
      <MenuSwitch label={SETTINGS_TEXT.flashingHeading} checked={settings.flashing} onChange={(flashing) => updateSettings({ flashing })} />
      {/* A display preference kept in this browser, not in the save (src/ui/people). */}
      <MenuSwitch label={MENU_TEXT.peopleColor} checked={peopleColor} onChange={setPeopleColor} />
    </section>
    <section className="menu-group" aria-labelledby="menu-support">
      <h3 id="menu-support" className="menu-heading">{MENU_TEXT.support}</h3>
      <Row className="menu-row" title={MENU_TEXT.talk} detail={MENU_TEXT.talkDetail} trail={chevron} onClick={() => onPage('support')} />
    </section>
    <p className="menu-note">{SETTINGS_TEXT.settingsSubtitle}</p>
  </div>;
}

/** A yes or no setting: the switch sits at the end of its row and the whole row toggles it. */
function MenuSwitch({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return <label className="ui-row menu-row menu-switch">
    <span className="ui-row-main">
      <span className="ui-row-title">{label}</span>
      {detail && <span className="ui-row-detail">{detail}</span>}
    </span>
    <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span className="toggle-ui" aria-hidden="true" />
  </label>;
}

/** Only the themes a player can avoid are switches; one line names those every call can carry. */
function ThemesPage({ settings }: { settings: PlayerSettings }) {
  return <div className="menu-page">
    <p className="menu-hint">{SETTINGS_TEXT.avoidHint}</p>
    {AVOIDABLE_THEMES.map((theme) => {
      const on = settings.avoidThemes.includes(theme);
      const blocked = !canAvoid(settings.avoidThemes, theme);
      return <div key={theme}>
        <MenuSwitchBlocked theme={theme} on={on} blocked={blocked}
          onChange={(checked) => updateSettings({ avoidThemes: THEME_ORDER.filter((x) => x === theme ? checked : settings.avoidThemes.includes(x)) })} />
        {blocked && <p className="settings-reason">{BLOCKED_BY_CHOICES_REASON}</p>}
      </div>;
    })}
    {ALWAYS_THEMES.length > 0 && <p className="menu-hint">{MENU_TEXT.everyCall(joinThemes(ALWAYS_THEMES.map((theme) => CARD_THEME_WORDS[theme])))}</p>}
  </div>;
}

function MenuSwitchBlocked({ theme, on, blocked, onChange }: { theme: (typeof THEME_ORDER)[number]; on: boolean; blocked: boolean; onChange: (on: boolean) => void }) {
  return <label className="ui-row menu-row menu-switch" data-blocked={blocked || undefined}>
    <span className="ui-row-main">
      <span className="ui-row-title">{THEME_LABELS[theme].name}</span>
      <span className="ui-row-detail">{THEME_LABELS[theme].detail}</span>
    </span>
    <input type="checkbox" role="switch" checked={on} disabled={blocked} onChange={(e) => onChange(e.target.checked)} />
    <span className="toggle-ui" aria-hidden="true" />
  </label>;
}

function ChoicePage({ hint, detail, children }: { hint: string | null; detail: string; children: ReactNode }) {
  return <div className="menu-page">
    {hint && <p className="menu-hint">{hint}</p>}
    {children}
    <p className="menu-hint" aria-live="polite">{detail}</p>
  </div>;
}
