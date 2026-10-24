// The Store (canvas F1): one line of promise, the Founder's Bundle on its plate, the two lifetime
// purchases with what they do for this department today, looks and thanks, and restore. Real-money
// prices appear here and nowhere else (ui/entitlements.ts is the only source). In the browser build a
// purchase explains where purchases open, and a dev-only list grants a product so its effect can be seen.
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  CATALOG, DEV_GRANTS, FOUNDER_THEME, THEME_IDS, bundlePriceCents, canBuy, chooseTheme, formatPrice, has,
  priceCentsFor, recordPurchase, removePurchase, restorePurchases, themeProduct, useLedger, activeTheme,
  type ProductId, type ThemeId,
} from '../entitlements';
import { PlateArt, plateUrl } from '../art/Plates';
import { Funds } from '../components/Funds';
import { Button, Card, Row, Section, SwitchRow } from '../components/ui';
import { Icon } from '../icons';
import { useSettings } from '../settings/SettingsControls';
import { charterGainPerHour, fundingWindowHours } from '../storefront/store-model';
import { useGame } from '../store';
import './store.css';

/** Where a purchase opens in this build. Said once, under the product the player tried. */
const BROWSER_NOTICE = 'Purchases open in the App Store and Google Play builds.';

const LOOK_NAME: Record<ThemeId, string> = { harbour: CATALOG.theme_harbour.name, records: CATALOG.theme_records.name, greenline: CATALOG.theme_greenline.name };

export function StoreScreen() {
  const game = useGame();
  const ledger = useLedger();
  const { purchases } = useSettings();
  const [tried, setTried] = useState<ProductId | null>(null);
  const [restored, setRestored] = useState<string | null>(null);
  const owned = ledger.owned;
  const gain = charterGainPerHour(game);
  const windowHours = fundingWindowHours();
  const look = activeTheme(ledger);
  const bundleCents = bundlePriceCents(owned);

  const buy = (id: ProductId) => setTried(id);
  const price = (id: ProductId, label?: string): ReactNode => <PriceButton id={id} owned={owned} allowed={purchases} onBuy={buy} label={label} />;
  const note = (id: ProductId) => tried === id && purchases && canBuy(id, owned) ? <p className="store-note" role="status"><Icon name="info" size="sm" />{BROWSER_NOTICE}</p> : null;

  return <div className="page store-page">
    <header className="store-head">
      <h1 className="store-title">Store</h1>
      <p className="store-promise">Every call, district and officer is free. These buy funding pace and looks, once, for good.</p>
    </header>

    {!purchases && <p className="store-off" role="status"><Icon name="lock" size="md" />Purchases are off. Turn them on under Your save in Settings. You can still read everything here.</p>}

    <section className="store-hero plate plate-grain" aria-labelledby="store-founder" data-owned={has(owned, 'founder') || undefined}>
      <PlateArt src={plateUrl('hub_hq')} />
      <span className="store-kicker">Lifetime bundle</span>
      <h2 id="store-founder" className="store-hero-title">{CATALOG.founder.name}</h2>
      <p className="store-hero-line">{has(owned, 'founder') ? 'Yours. Thank you for backing the department.' : bundleCents === null ? 'You hold both lifetime purchases. The Harbour look is sold below.' : CATALOG.founder.line}</p>
      <ul className="store-parts" aria-label="What the bundle holds">
        <li data-owned={has(owned, 'charter') || undefined}><Icon name="trend" size="sm" />Charter</li>
        <li data-owned={has(owned, 'night_watch') || undefined}><Icon name="moon" size="sm" />Night Watch</li>
        <li data-owned={has(owned, themeProduct(FOUNDER_THEME)) || undefined}><Icon name="star" size="sm" />{LOOK_NAME[FOUNDER_THEME]} look</li>
      </ul>
      <div className="store-hero-foot">
        {bundleCents !== null && bundleCents < CATALOG.founder.cents && <span className="store-upgrade">Upgrade price, you hold part of it</span>}
        {has(owned, 'founder') || bundleCents !== null ? price('founder') : <span className="store-owned"><Icon name="check" size={16} />Both owned</span>}
      </div>
      {note('founder')}
    </section>

    <Section id="store-lifetime" icon="medal" title="Lifetime" count="Bought once, yours for good">
      <div className="store-list">
        <ProductCard art="scene_patrol_garage" name={CATALOG.charter.name} line={CATALOG.charter.line} trail={price('charter')} owned={has(owned, 'charter')}
          effect={<><Funds value={gain} format="signed" className="store-gain" /> an hour for your department now</>} note={note('charter')} />
        <ProductCard art="scene_command_room" name={CATALOG.night_watch.name} line={CATALOG.night_watch.line} trail={price('night_watch')} owned={has(owned, 'night_watch')}
          effect={<><WindowBar free={windowHours.free} watch={windowHours.watch} on={has(owned, 'night_watch')} /></>} note={note('night_watch')} />
      </div>
      <p className="store-fine">Neither changes a roll, a lead, a bond or how fast anyone recovers.</p>
    </Section>

    <Section id="store-looks" icon="star" title="Looks and thanks" count="Cosmetic. Nothing here changes how a call plays">
      <ul className="store-looks" aria-label="Precinct looks">
        {THEME_IDS.map((id) => {
          const product = themeProduct(id);
          const mine = has(owned, product);
          const inUse = look === id;
          return <li key={id} className="store-look" data-owned={mine || undefined} data-use={inUse || undefined}>
            <span className="store-swatch" data-look={id} aria-hidden="true"><i /><i /><i /></span>
            <span className="store-look-name">{LOOK_NAME[id]}</span>
            {mine
              ? <Button size="sm" variant={inUse ? 'quiet' : 'secondary'} selected={inUse} onClick={() => chooseTheme(inUse ? null : id)}>{inUse ? 'In use' : 'Use'}</Button>
              : price(product)}
            {note(product)}
          </li>;
        })}
      </ul>
      <Card className="inset-list">
        <Row lead={<Icon name="flag" size="md" />} title={CATALOG.patches.name} detail={CATALOG.patches.line} trail={price('patches')} />
        {note('patches')}
        <Row lead={<Icon name="mug" size="md" />} title={CATALOG.coffee.name} detail={has(owned, 'coffee') ? 'The urn is on the counter. Thank you.' : CATALOG.coffee.line} trail={price('coffee')} />
        {note('coffee')}
      </Card>
    </Section>

    <Section id="store-restore" icon="refresh" title="Restore purchases" count="Tied to your App Store or Google Play account">
      <div className="store-restore">
        <p className="store-fine">If you reinstall or change phones, restore brings back everything you bought. It never charges you.</p>
        <Button icon="refresh" onClick={() => { const { found } = restorePurchases(); setRestored(found ? `Restored ${found} ${found === 1 ? 'purchase' : 'purchases'} on this device.` : 'Nothing to restore on this device yet.'); }}>Restore purchases</Button>
        {restored && <p className="store-note" role="status"><Icon name="checkcircle" size="sm" />{restored}</p>}
      </div>
    </Section>

    {DEV_GRANTS && <Section id="store-dev" icon="wrench" title="Test grants" count="Dev build only. Grants a product so you can see it work" className="store-dev">
      <Card className="inset-list">
        {(Object.keys(CATALOG) as ProductId[]).map((id) => (
          <SwitchRow key={id} icon="key" title={CATALOG[id].name} detail={has(owned, id) && !owned.includes(id) ? 'Held through the bundle' : formatPrice(CATALOG[id].cents)}
            checked={owned.includes(id)} onChange={(on) => on ? recordPurchase(id) : removePurchase(id)} />
        ))}
      </Card>
    </Section>}

    <p className="store-footer">Prices are proposed for the US and shown here and nowhere else in the game. Ownership never touches a call.</p>
  </div>;
}

function PriceButton({ id, owned, allowed, onBuy, label }: { id: ProductId; owned: readonly ProductId[]; allowed: boolean; onBuy: (id: ProductId) => void; label?: string }) {
  if (!canBuy(id, owned)) return <span className="store-owned"><Icon name="check" size={16} />Owned</span>;
  const cents = priceCentsFor(id, owned);
  return <button type="button" className="store-price" disabled={!allowed} onClick={() => onBuy(id)}
    aria-label={`${label ?? CATALOG[id].name}, ${formatPrice(cents)}${allowed ? '' : ', purchases are off'}`}>
    {formatPrice(cents)}
  </button>;
}

function ProductCard({ art, name, line, effect, trail, owned, note }: { art: string; name: string; line: string; effect: ReactNode; trail: ReactNode; owned: boolean; note: ReactNode }) {
  return <div className="store-card" data-owned={owned || undefined}>
    <span className="store-card-art plate"><PlateArt src={plateUrl(art)} /></span>
    <span className="store-card-main">
      <span className="store-card-name">{name}</span>
      <span className="store-card-line">{line}</span>
      <span className="store-card-effect">{effect}</span>
    </span>
    <span className="store-card-trail">{trail}</span>
    {note}
  </div>;
}

/** 72 hours of funding while away against 7 days: two bars on one scale, the one in force lit. */
function WindowBar({ free, watch, on }: { free: number; watch: number; on: boolean }) {
  return <span className="store-window" data-on={on || undefined} role="img" aria-label={`Funding window: ${free} hours free, ${watch / 24} days with Night Watch Office${on ? '. Active' : ''}`}>
    <span className="store-window-row"><span className="store-window-label">Free</span><i style={{ width: `${(free / watch) * 100}%` }} /><b>{free} h</b></span>
    <span className="store-window-row" data-kind="watch"><span className="store-window-label">Night Watch</span><i style={{ width: '100%' }} /><b>{watch / 24} days</b></span>
  </span>;
}
