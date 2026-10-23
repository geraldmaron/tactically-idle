// Walks the slice (HQ, Calls board, Brief, Deploy, Live decide beat, Debrief) once per matrix scenario and
// measures each screen's first viewport with feelProbe. It drives the real UI the way play-loop does
// (no injected game state), seeds only what the app itself reads (the timer setting from localStorage),
// and judges the probes with the verdicts in feel.mjs. The R-rule walk lives in docs/captures/.../capture.mjs
// and is not touched; this is its own driver so the feel rules can be switched on screen by screen.
import { CAMPAIGN_SEED, FIXED_TIME, HEIGHTS, INSET_FIXTURES } from './manifest.mjs';
import { FEEL_SCREENS, exerciseJump, feelProbe, judgeBlocked, judgePaddedChrome, judgeScreen, judgeShift, judgePrimary } from './feel.mjs';

/** The scenario matrix. `paint` scenarios hold art back so the first frame and the load shift can be seen. */
export const SCENARIOS = [
  // Small, short and enlarged-text screens are judged on reach: the protected 4B order and full hook leave
  // no room for two cards or the first live choice, so density is off and the live shortcut counts.
  { id: 'w320', width: 320, height: HEIGHTS[320], paint: true, density: false, shortcut: true },
  { id: 'w390', width: 390, height: HEIGHTS[390], paint: true, cold: true },
  { id: 'w430', width: 430, height: HEIGHTS[430] },
  { id: 'short640', width: 390, height: 640, density: false, shortcut: true },
  { id: 'text200', width: 390, height: HEIGHTS[390], textScale: 2, shortcut: true },
  { id: 'timer-off', width: 390, height: HEIGHTS[390], timer: 'off', stepOut: true },
  { id: 'timer-relaxed', width: 390, height: HEIGHTS[390], timer: 'relaxed', stepOut: true },
  { id: 'timer-standard', width: 390, height: HEIGHTS[390], timer: 'standard', stepOut: true },
  // Every officer unassigned through window.__ti (dev builds), so no squad can deploy. Walks to the Deploy screen only.
  { id: 'blocked', width: 390, height: HEIGHTS[390], blocked: true },
];
// Not seedable by the harness today, so not walked: long names (no rename action) and the empty board
// (reached only by playing every call; F4 skips below two items anyway).

const ART_DELAY_MS = 1200;
const STOP = Symbol('end of a scenario that walks only part of the flow');

/** Scale every --sNN type token by `scale`. The app's type scale is px tokens, so this is the nearest to larger text. */
const scaleType = (scale) => {
  const px = {};
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) if (rule.selectorText === ':root') for (const name of rule.style) if (/^--s\d+$/.test(name)) { const v = parseFloat(rule.style.getPropertyValue(name)); if (v) px[name] = v * scale; }
  }
  const style = document.createElement('style');
  style.textContent = `:root{${Object.entries(px).map(([k, v]) => `${k}:${v}px`).join(';')}}`;
  document.head.append(style);
};

/**
 * @param {{ chromium: any, executablePath: string, baseURL: string, scenarios?: typeof SCENARIOS, log?: (...a: unknown[]) => void }} o
 * @returns {Promise<{ results: object[], cold: object[], failures: string[] }>}
 *   results: { scenario, screen, findings: [{rule,id,detail}], raw }
 */
export async function feelWalk({ chromium, executablePath, baseURL, scenarios = SCENARIOS, log = () => {} }) {
  const browser = await chromium.launch({ executablePath, headless: true });
  const results = [], cold = [], failures = [];
  try {
    for (const sc of scenarios) {
      const context = await browser.newContext({ viewport: { width: sc.width, height: sc.height }, hasTouch: true, deviceScaleFactor: 2 });
      await context.addInitScript((seed) => { Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, writable: true, value(a) { a.fill(seed); return a; } }); }, CAMPAIGN_SEED);
      await context.addInitScript((timer) => { if (timer) try { localStorage.setItem('ti-settings', JSON.stringify({ timer })); } catch { /* storage blocked */ } }, sc.timer ?? null);
      await context.addInitScript(() => {
        window.__cls = 0; window.__paint = {};
        for (const type of ['paint', 'largest-contentful-paint']) try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__paint[e.name || type] = Math.round(e.startTime); }).observe({ type, buffered: true }); } catch { /* unsupported */ }
        try { new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch { /* unsupported */ }
        document.addEventListener('DOMContentLoaded', () => {
          const style = document.createElement('style');
          style.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}';
          document.head.append(style);
        });
      });
      if (sc.paint) await context.route(/\.(webp|png|jpe?g|avif|gif)(\?|$)/, async (route) => { await new Promise((r) => setTimeout(r, ART_DELAY_MS)); await route.continue().catch(() => {}); });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      page.setDefaultTimeout(8000);
      await page.clock.setFixedTime(new Date(FIXED_TIME));
      page.on('dialog', (d) => d.accept());
      const pageErrors = []; page.on('pageerror', (e) => pageErrors.push(String(e)));
      const setInset = (i) => cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: i.top, right: 0, bottom: i.bottom, left: 0 } });
      const none = { top: 0, bottom: 0 };

      /** Measure a screen's first viewport with no inset, then under the bottom-inset fixture for the chrome budget. */
      const measure = async (name) => {
        if (sc.blocked && name !== 'deploy') return;
        const screen = FEEL_SCREENS[name.replace(/-reentry$/, '')];
        try {
          let shift = [];
          if (sc.paint) {
            await page.waitForTimeout(120);
            const before = await page.evaluate(() => window.__cls);
            const raw0 = await page.evaluate(feelProbe, { screen, inset: none });
            await page.waitForTimeout(ART_DELAY_MS + 500);
            shift = judgeShift((await page.evaluate(() => window.__cls)) - before);
            const raw1 = await page.evaluate(feelProbe, { screen, inset: none });
            raw1.plates = raw0.plates; // the first frame's plates are the ones that count
            return finish(name, raw1, shift);
          }
          await page.waitForTimeout(450);
          return finish(name, await page.evaluate(feelProbe, { screen, inset: none }), shift);
        } catch (e) { failures.push(`${sc.id} ${name}: ${String(e).slice(0, 120)}`); }
      };
      const finish = async (name, raw, shift) => {
        if (sc.blocked) {
          const findings = judgeBlocked(raw);
          results.push({ scenario: sc.id, screen: 'deploy-blocked', findings, raw });
          log(sc.id, name, findings.length);
          return;
        }
        // Where a shortcut may stand in for a first choice below the fold, tap it and see where the choice lands.
        if (sc.shortcut && FEEL_SCREENS[name.replace(/-reentry$/, '')]?.essential === 'choices' && judgePrimary(raw.primary).length) {
          raw.jumpResult = await exerciseJump(page);
          await page.evaluate(() => { scrollTo(0, 0); for (const e of document.querySelectorAll('main, .screen, .live, .app')) e.scrollTop = 0; });
        }
        const findings = judgeScreen(raw, { scale: sc.textScale ?? 1, density: sc.density !== false, shortcut: !!sc.shortcut });
        // The chrome budget again under the safe-area fixture (notch and home indicator), where it grows by the insets.
        const inset = INSET_FIXTURES.bottom;
        await setInset(inset); await page.waitForTimeout(80);
        const padded = await page.evaluate(feelProbe, { screen: {}, inset: { top: inset.top, bottom: inset.bottom } });
        await setInset(none);
        const extra = judgePaddedChrome(padded, sc.textScale ?? 1);
        results.push({ scenario: sc.id, screen: name, findings: [...findings, ...shift, ...extra], raw });
        log(sc.id, name, findings.length + shift.length + extra.length);
      };

      const step = async (name, fn) => { try { await fn(); } catch (e) { if (e === STOP) throw e; failures.push(`${sc.id} ${name}: ${String(e).slice(0, 160)}`); throw e; } };
      try {
        const t0 = Date.now();
        await page.goto(baseURL);
        await step('first-run', async () => {
          await page.locator('.first-run').waitFor();
          await page.getByRole('button', { name: 'Continue to headquarters', exact: true }).click();
          await page.locator('nav').waitFor();
          if (sc.textScale) await page.evaluate(scaleType, sc.textScale);
          if (sc.blocked) {
            const n = await page.evaluate(() => Object.values(window.__ti.getState().officers ?? {}).map((o) => window.__ti.send({ type: 'assignToSquad', officerId: o.id, squadId: null }).ok).filter(Boolean).length);
            if (!n) throw new Error('could not unassign any officer through window.__ti');
          }
        });
        if (sc.cold) { const p = await page.evaluate(() => window.__paint); cold.push({ scenario: sc.id, firstContentfulPaintMs: p['first-contentful-paint'] ?? null, largestContentfulPaintMs: p['largest-contentful-paint'] ?? null, note: 'dev server, art held back 1.2s, not gated' }); }
        const tab = (t) => page.locator('nav.bottomnav').getByText(t, { exact: true }).click();
        await step('hq', async () => { await tab('HQ'); await measure('hq'); });
        await step('board', async () => { await tab('Calls'); await page.locator('.cl-card').first().waitFor(); await measure('board'); });
        await step('brief', async () => {
          const welcome = page.locator('.welcome-sheet'); if (await welcome.count()) await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
          await page.locator('.cl-card-button').first().click(); await page.locator('.cl-flow-body[data-step="brief"]').waitFor(); await measure('brief');
        });
        await step('deploy', async () => {
          await page.getByRole('button', { name: 'Choose team', exact: true }).click(); await page.locator('.cl-flow-body[data-step="deploy"]').waitFor();
          await measure('deploy'); // the state the player lands in
          if (sc.blocked) throw STOP;
          if (!(await page.locator('.cl-squads button[aria-pressed="true"]').count())) await page.locator('.cl-squads button.cl-squad:not([aria-label*="not deployable"]):not([aria-label*=" 0 of "])').first().click();
          const buy = page.getByRole('button', { name: /^Buy \d+ radios? · / }); if (await buy.count()) { await buy.first().click(); await page.waitForTimeout(400); }
        });
        await step('live', async () => {
          await page.getByRole('button', { name: /^Deploy [A-Z]/ }).click(); await page.locator('.call-grid').waitFor(); await measure('live');
          if (sc.stepOut) {
            await page.getByRole('button', { name: 'Step out', exact: true }).click();
            await page.waitForFunction(() => window.__ti.getState().activeRun?.decisionPausedAt !== undefined);
            await tab('Calls'); await page.locator('.call-grid').waitFor();
            await measure('live-reentry');
          }
        });
        await step('debrief', async () => {
          for (let n = 0; n < 60; n++) {
            if ((await page.evaluate(() => window.__ti.getState().activeRun?.status)) !== 'active') break;
            const proceed = page.locator('.live-continue button');
            if (await proceed.count()) { await proceed.click(); await page.locator('.call-grid').waitFor(); continue; }
            const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first();
            if (await card.count()) { const review = card.locator('.callbtn-review'); await (await review.count() ? review : card).click(); await page.getByRole('button', { name: /^Confirm / }).click(); await page.waitForTimeout(250); continue; }
            const cont = page.locator('.operation-continuations button'); if (await cont.count()) { await cont.first().click(); continue; }
            break;
          }
          await page.getByRole('button', { name: 'Next call', exact: true }).waitFor({ timeout: 8000 });
          await measure('debrief');
        });
      } catch { /* the failed step is recorded; later screens of this scenario are skipped */ }
      if (pageErrors.length) failures.push(`${sc.id} page errors: ${pageErrors.slice(0, 2).join(' | ').slice(0, 160)}`);
      await context.close();
    }
  } finally { await browser.close(); }
  return { results, cold, failures };
}
