import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Sheet } from '../components/Sheet';
import { Card, Row, Section, Segmented } from '../components/ui';
import { Icon } from '../icons';
import { useCampaigns } from '../store';
import { campaignStatus } from '../components/SaveManager';
import { usePeopleColor } from '../people/PeopleText';
import { setPeopleColor } from '../people/prefs';
import { CARD_WARNING_SETTINGS, updateSettings, type PlayerSettings } from './prefs';
import { ALWAYS_THEMES, AVOIDABLE_THEMES, canAvoid } from './avoidable';
import { CARD_THEME_WORDS, MENU_TEXT, SETTINGS_TEXT, THEME_LABELS, THEME_ORDER, TIMER_LABELS, WARNING_LABELS, joinThemes } from './labels';
import { SupportPanel, ThemeSwitch, useSettings } from './SettingsControls';
import { SwitchRow } from './SwitchRow';
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
    {page !== 'menu' && <button type="button" className="menu-back" onClick={() => setPage('menu')}><Icon name="chevronLeft" size="md" />{MENU_TEXT.title}</button>}
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
  const chevron = <Icon name="chevronRight" size="md" />;
  const detail = slot ? `Slot ${saved.activeSlotId} · ${status.detail}` : status.detail;
  return <div className="menu-home">
    <Section id="menu-campaign" icon="bookmark" title={MENU_TEXT.campaign}>
      <Card className="inset-list">
        <Row className="menu-link" lead={<Icon name="bookmark" size="md" />} title={slot?.name ?? status.name}
          detail={status.attention ? <span className="menu-attention">{detail}</span> : detail}
          trail={<><span className="menu-trail-word">{MENU_TEXT.saves}</span>{chevron}</>} onClick={onOpenSaves} />
      </Card>
    </Section>
    <Section id="menu-settings" icon="gear" title={SETTINGS_TEXT.settingsTitle}>
      <Card className="inset-list">
        <Row lead={<Icon name="eye" size="md" />} title={MENU_TEXT.themes} detail={avoidSummary(settings.avoidThemes)} trail={chevron} onClick={() => onPage('themes')} />
        <Row lead={<Icon name="warning" size="md" />} title={SETTINGS_TEXT.warningsHeading} detail={WARNING_LABELS[settings.cardWarnings].name} trail={chevron} onClick={() => onPage('warnings')} />
        <Row lead={<Icon name="clock" size="md" />} title={SETTINGS_TEXT.timerHeading} detail={TIMER_LABELS[settings.timer].name} trail={chevron} onClick={() => onPage('timer')} />
        <SwitchRow icon="soundwave" title={SETTINGS_TEXT.soundHeading} checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
        <SwitchRow icon="bolt" title={SETTINGS_TEXT.flashingHeading} checked={settings.flashing} onChange={(flashing) => updateSettings({ flashing })} />
        {/* A display preference kept in this browser, not in the save (src/ui/people). */}
        <SwitchRow icon="people" title={MENU_TEXT.peopleColor} checked={peopleColor} onChange={setPeopleColor} />
      </Card>
    </Section>
    <Section id="menu-support" icon="heart" title={MENU_TEXT.support}>
      <Card className="inset-list">
        <Row lead={<Icon name="phone" size="md" />} title={MENU_TEXT.talk} detail={MENU_TEXT.talkDetail} trail={chevron} onClick={() => onPage('support')} />
      </Card>
    </Section>
    <p className="menu-note">{SETTINGS_TEXT.settingsSubtitle}</p>
  </div>;
}

/** Only the themes a player can avoid are switches; one line names those every call can carry. */
function ThemesPage({ settings }: { settings: PlayerSettings }) {
  return <div className="menu-page">
    <p className="menu-hint">{SETTINGS_TEXT.avoidHint}</p>
    <Card className="inset-list">
      {AVOIDABLE_THEMES.map((theme) => {
        const on = settings.avoidThemes.includes(theme);
        const blocked = !canAvoid(settings.avoidThemes, theme);
        return <ThemeSwitch key={theme} theme={theme} on={on} blocked={blocked}
          onChange={(checked) => updateSettings({ avoidThemes: THEME_ORDER.filter((x) => x === theme ? checked : settings.avoidThemes.includes(x)) })} />;
      })}
    </Card>
    {ALWAYS_THEMES.length > 0 && <p className="menu-hint">{MENU_TEXT.everyCall(joinThemes(ALWAYS_THEMES.map((theme) => CARD_THEME_WORDS[theme])))}</p>}
  </div>;
}

function ChoicePage({ hint, detail, children }: { hint: string | null; detail: string; children: ReactNode }) {
  return <div className="menu-page">
    {hint && <p className="menu-hint">{hint}</p>}
    {children}
    <p className="menu-hint" aria-live="polite">{detail}</p>
  </div>;
}
