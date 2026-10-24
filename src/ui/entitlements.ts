// The Store's catalog and the player's purchases (docs/world-redesign.md, "Monetization"). Real-money
// prices live here and nowhere else; in-game funding is a coin glyph and a number. Pure data and small
// functions, plus a local ledger in localStorage that stands in for the platform's receipts: in the browser
// build nothing is billed, and a dev-only toggle grants a product so its effect can be seen. The app builds
// replace `readOwned` with StoreKit and Play Billing; everything else reads through this module.
//
// What a purchase does:
// - Department Charter and Night Watch Office reach the sim as `Entitlements` (`syncEntitlements`), read by
//   settlement and rates. Nothing sold enters a roll, a lead, a bond or recovery.
// - Precinct themes remap the accent through `data-precinct` on the document element (store.css), using
//   tokens only.
// - Squad patches and the coffee are recorded and thanked; they change nothing in play.

import { useSyncExternalStore } from 'react';
import type { Entitlements } from '../sim/types';

export type ThemeId = 'harbour' | 'records' | 'greenline';
export type ProductId = 'charter' | 'night_watch' | 'founder' | 'patches' | 'coffee' | `theme_${ThemeId}`;
export type ProductKind = 'lifetime' | 'bundle' | 'theme' | 'patches' | 'tip';

export interface Product {
  id: ProductId;
  kind: ProductKind;
  name: string;
  /** One plain line on what it does, as the Store says it. */
  line: string;
  /** Proposed US price in cents; the owner sets the real ones. */
  cents: number;
}

export const CATALOG: Readonly<Record<ProductId, Product>> = {
  charter: { id: 'charter', kind: 'lifetime', name: 'Department Charter', cents: 699,
    line: 'Patrol earns a quarter more service funding, for good.' },
  night_watch: { id: 'night_watch', kind: 'lifetime', name: 'Night Watch Office', cents: 499,
    line: 'Funding keeps coming in for 7 days while you are away, up from 72 hours.' },
  founder: { id: 'founder', kind: 'bundle', name: 'Founder’s Bundle', cents: 1199,
    line: 'The Charter and the Night Watch Office, plus the Harbour precinct look.' },
  theme_harbour: { id: 'theme_harbour', kind: 'theme', name: 'Harbour', cents: 299, line: 'Cool blue accents for the department.' },
  theme_records: { id: 'theme_records', kind: 'theme', name: 'Records room', cents: 299, line: 'Ivory accents, like a case file.' },
  theme_greenline: { id: 'theme_greenline', kind: 'theme', name: 'Green line', cents: 299, line: 'Mint accents, calm and bright.' },
  patches: { id: 'patches', kind: 'patches', name: 'Squad patch set', cents: 199, line: 'One complete set of squad patches.' },
  coffee: { id: 'coffee', kind: 'tip', name: 'Squad coffee', cents: 199, line: 'A coffee urn for the squad room and a thank-you.' },
};

export const THEME_IDS: readonly ThemeId[] = ['harbour', 'records', 'greenline'];
export const themeProduct = (id: ThemeId): ProductId => `theme_${id}`;
/** The look the Founder's Bundle includes. */
export const FOUNDER_THEME: ThemeId = 'harbour';

export const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/** What the player holds, as product ids. The bundle counts as its parts. */
export interface Ledger { owned: readonly ProductId[]; /** The precinct look in use, if any. */ theme: ThemeId | null }

export function has(owned: readonly ProductId[], id: ProductId): boolean {
  if (owned.includes(id)) return true;
  if (owned.includes('founder')) {
    if (id === 'charter' || id === 'night_watch') return true;
    if (id === themeProduct(FOUNDER_THEME)) return true;
  }
  return false;
}

/** The two lifetime flags the sim reads. Duplicates fold: owning the bundle and the Charter is one Charter. */
export function entitlementsFrom(owned: readonly ProductId[]): Entitlements {
  return { charter: has(owned, 'charter'), nightWatch: has(owned, 'night_watch') };
}

export function ownedThemes(owned: readonly ProductId[]): ThemeId[] {
  return THEME_IDS.filter((id) => has(owned, themeProduct(id)));
}

/** What the Founder's Bundle costs this player: its price less the parts already owned. Owning both parts
 * leaves only the theme, which the Store sells on its own, so the bundle is not offered then. */
export function bundlePriceCents(owned: readonly ProductId[]): number | null {
  if (has(owned, 'founder')) return null;
  const charter = has(owned, 'charter');
  const watch = has(owned, 'night_watch');
  if (charter && watch) return null;
  return CATALOG.founder.cents - (charter ? CATALOG.charter.cents : 0) - (watch ? CATALOG.night_watch.cents : 0);
}

/** Price shown for a product to this player. */
export function priceCentsFor(id: ProductId, owned: readonly ProductId[]): number {
  return id === 'founder' ? bundlePriceCents(owned) ?? CATALOG.founder.cents : CATALOG[id].cents;
}

/** Whether the Store offers a product to buy now. Tips and patches are bought once. */
export function canBuy(id: ProductId, owned: readonly ProductId[]): boolean {
  if (id === 'founder') return bundlePriceCents(owned) !== null;
  return !has(owned, id);
}

/** The accent theme to apply: the chosen one if it is still owned, else none. */
export function activeTheme(ledger: Ledger): ThemeId | null {
  return ledger.theme && ownedThemes(ledger.owned).includes(ledger.theme) ? ledger.theme : null;
}

// ------------------------------------------------------------------ the local ledger

export const ENTITLEMENTS_KEY = 'ti-entitlements';
const EMPTY: Ledger = Object.freeze({ owned: [], theme: null });
let unsaved: Ledger | null = null;
let cache: { raw: string | null; value: Ledger } | null = null;
const listeners = new Set<() => void>();

const isProduct = (value: unknown): value is ProductId => typeof value === 'string' && Object.hasOwn(CATALOG, value);
const isTheme = (value: unknown): value is ThemeId => typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);

/** Anything stored that is not a known product is dropped; a bad file never throws. */
export function parseLedger(raw: string | null): Ledger {
  try {
    const data: unknown = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return EMPTY;
    const record = data as Record<string, unknown>;
    const owned = Array.isArray(record.owned) ? [...new Set(record.owned.filter(isProduct))] : [];
    return { owned, theme: isTheme(record.theme) ? record.theme : null };
  } catch { return EMPTY; }
}

export function readLedger(): Ledger {
  if (unsaved) return unsaved;
  let raw: string | null = null;
  try { raw = globalThis.localStorage?.getItem(ENTITLEMENTS_KEY) ?? null; } catch { /* refused: nothing owned */ }
  if (cache?.raw !== raw) cache = { raw, value: parseLedger(raw) };
  return cache.value;
}

function writeLedger(next: Ledger): void {
  try {
    if (!globalThis.localStorage) throw new Error('no storage');
    globalThis.localStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(next));
    unsaved = null;
  } catch { unsaved = next; }
  applyPrecinct();
  listeners.forEach((listener) => listener());
}

export function subscribeLedger(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLedger(): Ledger {
  return useSyncExternalStore(subscribeLedger, readLedger, readLedger);
}

/** Records a purchase. In the browser build this is the dev toggle; the app builds call it from the
 * platform's confirmed transaction. A bundle bought on top of its parts keeps both records. */
export function recordPurchase(id: ProductId): void {
  const ledger = readLedger();
  if (ledger.owned.includes(id)) return;
  const bought: ThemeId | null = id === 'founder' ? FOUNDER_THEME : id.startsWith('theme_') ? id.slice('theme_'.length) as ThemeId : null;
  const next: Ledger = { owned: [...ledger.owned, id], theme: ledger.theme ?? bought };
  writeLedger(next);
}

/** Removes a record (dev toggle only; a real refund arrives through the platform). */
export function removePurchase(id: ProductId): void {
  const ledger = readLedger();
  writeLedger({ owned: ledger.owned.filter((x) => x !== id), theme: ledger.theme });
}

export function chooseTheme(theme: ThemeId | null): void {
  const ledger = readLedger();
  if (theme && !ownedThemes(ledger.owned).includes(theme)) return;
  writeLedger({ owned: ledger.owned, theme });
}

/** Restore asks the platform for the account's purchases. The browser build has only the local ledger, so
 * it re-reads it and reports what it holds. Never charges, never loses a record. */
export function restorePurchases(): { found: number } {
  cache = null;
  const ledger = readLedger();
  writeLedger(ledger);
  return { found: ledger.owned.length };
}

/** Puts the chosen precinct look on the document; store.css maps it to tokens. */
export function applyPrecinct(): void {
  if (typeof document === 'undefined') return;
  const theme = activeTheme(readLedger());
  if (theme) document.documentElement.dataset.precinct = theme;
  else delete document.documentElement.dataset.precinct;
}
applyPrecinct();

/** Whether the browser build lets the Store grant a product for testing. */
export const DEV_GRANTS = typeof import.meta !== 'undefined' && !!(import.meta as { env?: { DEV?: boolean } }).env?.DEV;
