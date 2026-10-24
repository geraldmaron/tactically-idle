import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CATALOG, ENTITLEMENTS_KEY, activeTheme, bundlePriceCents, canBuy, chooseTheme, entitlementsFrom, formatPrice, has,
  ownedThemes, parseLedger, priceCentsFor, readLedger, recordPurchase, removePurchase, restorePurchases, subscribeLedger,
} from './entitlements';

function fakeStorage() {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
}
const install = (storage: unknown) => Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

describe('catalog and ownership', () => {
  it('formats real-money prices with a dollar sign and cents', () => {
    expect(formatPrice(CATALOG.charter.cents)).toBe('$6.99');
    expect(formatPrice(CATALOG.founder.cents)).toBe('$11.99');
  });

  it('folds the bundle into its parts and one theme, and deduplicates at the feature level', () => {
    expect(entitlementsFrom([])).toEqual({ charter: false, nightWatch: false });
    expect(entitlementsFrom(['founder'])).toEqual({ charter: true, nightWatch: true });
    expect(entitlementsFrom(['charter', 'founder'])).toEqual({ charter: true, nightWatch: true });
    expect(entitlementsFrom(['night_watch'])).toEqual({ charter: false, nightWatch: true });
    expect(ownedThemes(['founder'])).toEqual(['harbour']);
    expect(has(['founder'], 'theme_records')).toBe(false);
  });

  it('prices the bundle as an upgrade for owners of either part and stops offering it when both are owned', () => {
    expect(bundlePriceCents([])).toBe(1199);
    expect(bundlePriceCents(['charter'])).toBe(1199 - 699);
    expect(bundlePriceCents(['night_watch'])).toBe(1199 - 499);
    expect(bundlePriceCents(['charter', 'night_watch'])).toBeNull();
    expect(bundlePriceCents(['founder'])).toBeNull();
    expect(priceCentsFor('founder', ['charter'])).toBe(500);
    expect(canBuy('founder', ['charter', 'night_watch'])).toBe(false);
    expect(canBuy('charter', ['founder'])).toBe(false);
    expect(canBuy('theme_records', ['founder'])).toBe(true);
    expect(canBuy('theme_harbour', ['founder'])).toBe(false);
  });
});

describe('the local ledger', () => {
  beforeEach(() => install(fakeStorage()));
  afterEach(() => { delete (globalThis as { localStorage?: unknown }).localStorage; });

  it('ignores anything it does not know and never throws on a bad file', () => {
    expect(parseLedger('not json')).toEqual({ owned: [], theme: null });
    expect(parseLedger(JSON.stringify({ owned: ['charter', 'gold_coins', 'charter'], theme: 'neon' }))).toEqual({ owned: ['charter'], theme: null });
  });

  it('records a purchase once, keeps it across reads, tells subscribers, and can restore', () => {
    const storage = fakeStorage();
    install(storage);
    let calls = 0;
    const stop = subscribeLedger(() => { calls++; });
    recordPurchase('charter');
    recordPurchase('charter');
    expect(readLedger().owned).toEqual(['charter']);
    expect(JSON.parse(storage.data.get(ENTITLEMENTS_KEY)!).owned).toEqual(['charter']);
    expect(restorePurchases()).toEqual({ found: 1 });
    removePurchase('charter');
    expect(readLedger().owned).toEqual([]);
    expect(calls).toBeGreaterThanOrEqual(3);
    stop();
  });

  it('applies the first theme bought, lets the player switch among owned ones, and drops a look no longer owned', () => {
    recordPurchase('theme_records');
    expect(activeTheme(readLedger())).toBe('records');
    recordPurchase('theme_greenline');
    chooseTheme('greenline');
    expect(activeTheme(readLedger())).toBe('greenline');
    chooseTheme('harbour');
    expect(activeTheme(readLedger())).toBe('greenline');
    removePurchase('theme_greenline');
    expect(activeTheme(readLedger())).toBeNull();
    recordPurchase('founder');
    expect(ownedThemes(readLedger().owned)).toEqual(['harbour', 'records']);
  });

  it('keeps the choice in memory when storage refuses', () => {
    install({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });
    recordPurchase('night_watch');
    expect(entitlementsFrom(readLedger().owned).nightWatch).toBe(true);
  });
});
