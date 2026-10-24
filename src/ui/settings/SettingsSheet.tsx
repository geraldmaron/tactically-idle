// Settings and account (canvas F2), opened from the resource bar's menu button. Sections: Calls, Notifications,
// Display and accessibility, Your save, Support. A row with choices opens a page inside the sheet; a yes or
// no setting is a switch on its row and saves as it changes. Export, reset and delete are separate actions,
// and reset and delete each ask first.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { TIMER_SETTINGS } from '../../sim/timer-setting';
import { Sheet } from '../components/Sheet';
import { Button, Card, ErrorState, Row, Section, Segmented, SwitchRow } from '../components/ui';
import { Icon } from '../icons';
import { exportCurrentSave, manageSave, useCampaigns } from '../store';
import { campaignStatus, download } from '../components/SaveManager';
import { usePeopleColor } from '../people/PeopleText';
import { setPeopleColor } from '../people/prefs';
import { CARD_WARNING_SETTINGS, updateSettings, type PlayerSettings } from './prefs';
import { ALWAYS_THEMES, AVOIDABLE_THEMES, canAvoid } from './avoidable';
import { CARD_THEME_WORDS, MENU_TEXT, SETTINGS_TEXT, SHEET_TEXT, THEME_LABELS, THEME_ORDER, TIMER_LABELS, WARNING_LABELS, joinThemes } from './labels';
import { SupportPanel, ThemeSwitch, useSettings } from './SettingsControls';
import './menu.css';

export type MenuPage = 'menu' | 'themes' | 'warnings' | 'display' | 'reset' | 'wipe' | 'support';

export function avoidSummary(avoid: PlayerSettings['avoidThemes']): string {
  if (!avoid.length) return MENU_TEXT.noneAvoided;
  if (avoid.length > 2) return `${avoid.length} avoided`;
  return joinThemes(avoid.map((theme) => THEME_LABELS[theme].name));
}

const PAGE_TITLE: Record<MenuPage, string> = {
  menu: SETTINGS_TEXT.settingsTitle, themes: MENU_TEXT.themes, warnings: SETTINGS_TEXT.warningsHeading, display: SHEET_TEXT.display,
  reset: SHEET_TEXT.resetTitle, wipe: SHEET_TEXT.wipeTitle, support: MENU_TEXT.support,
};

export function MenuSheet({ open, onClose, onOpenSaves, initialPage = 'menu' }: { open: boolean; onClose: () => void; onOpenSaves: () => void; initialPage?: MenuPage }) {
  const [page, setPage] = useState<MenuPage>(initialPage);
  useEffect(() => { if (open) setPage(initialPage); }, [open, initialPage]);
  const settings = useSettings();
  return <Sheet open={open} onClose={onClose} title={PAGE_TITLE[page]} className="menu-sheet" interactionKey={page}>
    {page !== 'menu' && <button type="button" className="menu-back" onClick={() => setPage('menu')}><Icon name="chevronLeft" size="md" />{SETTINGS_TEXT.settingsTitle}</button>}
    {page === 'menu' && <MenuHome settings={settings} onPage={setPage} onOpenSaves={onOpenSaves} />}
    {page === 'themes' && <ThemesPage settings={settings} />}
    {page === 'warnings' && <div className="menu-page">
      <Segmented label={SETTINGS_TEXT.warningsHeading} value={settings.cardWarnings} onChange={(cardWarnings) => updateSettings({ cardWarnings })}
        options={CARD_WARNING_SETTINGS.map((s) => ({ value: s, label: WARNING_LABELS[s].name }))} />
      <p className="menu-hint" aria-live="polite">{WARNING_LABELS[settings.cardWarnings].detail}</p>
    </div>}
    {page === 'display' && <DisplayPage settings={settings} />}
    {page === 'reset' && <ConfirmPage kind="reset" onDone={onClose} onCancel={() => setPage('menu')} />}
    {page === 'wipe' && <ConfirmPage kind="wipe" onDone={onClose} onCancel={() => setPage('menu')} />}
    {page === 'support' && <SupportPanel />}
  </Sheet>;
}

function MenuHome({ settings, onPage, onOpenSaves }: { settings: PlayerSettings; onPage: (page: MenuPage) => void; onOpenSaves: () => void }) {
  const saved = useCampaigns();
  const status = campaignStatus(saved);
  const slot = saved.activeSlotId ? saved.slots[saved.activeSlotId - 1] : null;
  const chevron = <Icon name="chevronRight" size="md" />;
  const detail = slot ? `Slot ${saved.activeSlotId} · ${status.detail}` : status.detail;
  return <div className="menu-home">
    <Section id="menu-calls" icon="calls" title={SHEET_TEXT.calls}>
      <div className="menu-timer">
        <p className="menu-label">{SETTINGS_TEXT.timerHeading}</p>
        <Segmented label={SETTINGS_TEXT.timerHeading} value={settings.timer} onChange={(timer) => updateSettings({ timer })}
          options={TIMER_SETTINGS.map((s) => ({ value: s, label: TIMER_LABELS[s].name }))} />
        <p className="menu-hint" aria-live="polite">{TIMER_LABELS[settings.timer].detail}</p>
      </div>
      <Card className="inset-list">
        <Row lead={<Icon name="eye" size="md" />} title={SHEET_TEXT.themesRow} detail={avoidSummary(settings.avoidThemes)} trail={chevron} onClick={() => onPage('themes')} />
        <Row lead={<Icon name="warning" size="md" />} title={SHEET_TEXT.warningsRow} detail={WARNING_LABELS[settings.cardWarnings].name} trail={chevron} onClick={() => onPage('warnings')} />
        <SwitchRow icon="people" title={SHEET_TEXT.lives} detail={settings.personalLives ? SHEET_TEXT.livesOn : SHEET_TEXT.livesOff} checked={settings.personalLives} onChange={(personalLives) => updateSettings({ personalLives })} />
      </Card>
    </Section>

    <Section id="menu-notifications" icon="bell" title={SHEET_TEXT.notifications} hint={SHEET_TEXT.notifyNote}>
      <Card className="inset-list">
        <SwitchRow icon="clock" title={SHEET_TEXT.notifyShifts} detail={SHEET_TEXT.notifyShiftsDetail} checked={settings.notifyShifts} onChange={(notifyShifts) => updateSettings({ notifyShifts })} />
        <SwitchRow icon="people" title={SHEET_TEXT.notifyCalls} detail={SHEET_TEXT.notifyCallsDetail} checked={settings.notifyCalls} onChange={(notifyCalls) => updateSettings({ notifyCalls })} />
        <SwitchRow icon="calendar" title={SHEET_TEXT.notifyDigest} detail={SHEET_TEXT.notifyDigestDetail} checked={settings.notifyDigest} onChange={(notifyDigest) => updateSettings({ notifyDigest })} />
      </Card>
    </Section>

    <Section id="menu-display" icon="eye" title={SHEET_TEXT.display}>
      <Card className="inset-list">
        <Row lead={<Icon name="soundwave" size="md" />} title={SHEET_TEXT.display} detail={SHEET_TEXT.displayDetail} trail={chevron} onClick={() => onPage('display')} />
      </Card>
    </Section>

    <Section id="menu-save" icon="bookmark" title={SHEET_TEXT.save}>
      <Card className="inset-list">
        <Row lead={<Icon name="bookmark" size="md" />} title={slot?.name ?? status.name}
          detail={status.attention ? <span className="menu-attention">{detail}</span> : detail}
          trail={<><span className="menu-trail-word">{SHEET_TEXT.saves}</span>{chevron}</>} onClick={onOpenSaves} />
        <Row lead={<Icon name="cloud" size="md" />} title={SHEET_TEXT.cloud} detail={SHEET_TEXT.cloudDetail} />
        <SwitchRow icon="bag" title={SHEET_TEXT.purchases} detail={settings.purchases ? SHEET_TEXT.purchasesOn : SHEET_TEXT.purchasesOff} checked={settings.purchases} onChange={(purchases) => updateSettings({ purchases })} />
        <Row lead={<Icon name="refresh" size="md" />} title={SHEET_TEXT.restore} detail={SHEET_TEXT.restoreDetail} trail={chevron} onClick={onOpenSaves} />
        <Row lead={<Icon name="arrowUp" size="md" />} title={SHEET_TEXT.exportRow} detail={SHEET_TEXT.exportDetail}
          trail={<span className="menu-trail-word">{SHEET_TEXT.exportTrail}</span>} onClick={() => download(exportCurrentSave(), 'tactically-idle-campaign.json')} />
      </Card>
      <Card className="inset-list menu-danger">
        <Row lead={<Icon name="refresh" size="md" />} title={SHEET_TEXT.reset} detail={SHEET_TEXT.resetDetail} trail={chevron} onClick={() => onPage('reset')} />
        <Row lead={<Icon name="trash" size="md" />} title={SHEET_TEXT.wipe} detail={SHEET_TEXT.wipeDetail} trail={chevron} onClick={() => onPage('wipe')} />
      </Card>
    </Section>

    <Section id="menu-support" icon="heart" title={MENU_TEXT.support}>
      <Card className="inset-list">
        <Row lead={<Icon name="phone" size="md" />} title={MENU_TEXT.talk} detail={MENU_TEXT.talkDetail} trail={chevron} onClick={() => onPage('support')} />
      </Card>
    </Section>
    <p className="menu-note">{SHEET_TEXT.footer}</p>
  </div>;
}

function DisplayPage({ settings }: { settings: PlayerSettings }) {
  const peopleColor = usePeopleColor();
  return <div className="menu-page">
    <Card className="inset-list">
      <SwitchRow icon="soundwave" title={SETTINGS_TEXT.soundHeading} detail={SETTINGS_TEXT.soundHint} checked={settings.sound} onChange={(sound) => updateSettings({ sound })} />
      <SwitchRow icon="bolt" title={SETTINGS_TEXT.flashingHeading} detail={SETTINGS_TEXT.flashingHint} checked={settings.flashing} onChange={(flashing) => updateSettings({ flashing })} />
      {/* A display preference kept in this browser, not in the save (src/ui/people). */}
      <SwitchRow icon="people" title={MENU_TEXT.peopleColor} checked={peopleColor} onChange={setPeopleColor} />
    </Card>
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

/** Reset and delete each ask once, say what goes and what stays, and run on their own button. */
function ConfirmPage({ kind, onDone, onCancel }: { kind: 'reset' | 'wipe'; onDone: () => void; onCancel: () => void }): ReactNode {
  const saved = useCampaigns();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotId = saved.activeSlotId ?? 1;
  const reset = kind === 'reset';
  const run = async () => {
    setBusy(true);
    setError(null);
    const others = kind === 'wipe' ? saved.slots.flatMap((slot, i) => slot && i + 1 !== saved.activeSlotId ? [i + 1] : []) : [];
    for (const id of others) {
      const gone = await manageSave({ type: 'delete', id, confirmed: true, permanent: true });
      if (!gone.ok) { setBusy(false); setError(gone.reason); return; }
    }
    const fresh = await manageSave({ type: 'new', id: slotId, name: saved.slots[slotId - 1]?.name ?? `Campaign ${slotId}`, overwrite: true, discardUnsaved: true });
    setBusy(false);
    if (!fresh.ok) { setError(fresh.reason); return; }
    onDone();
  };
  return <div className="menu-page menu-confirm">
    <p className="menu-confirm-body"><Icon name="warning" size="md" />{reset ? SHEET_TEXT.resetBody : SHEET_TEXT.wipeBody}</p>
    {error && <ErrorState compact title={error} />}
    <div className="menu-confirm-actions">
      <Button onClick={onCancel} disabled={busy}>{SHEET_TEXT.cancel}</Button>
      <Button variant="danger" onClick={() => void run()} disabled={busy}>{reset ? SHEET_TEXT.resetConfirm : SHEET_TEXT.wipeConfirm}</Button>
    </div>
  </div>;
}
