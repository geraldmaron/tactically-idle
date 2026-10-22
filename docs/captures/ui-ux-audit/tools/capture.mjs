// Walks every player-facing screen in an isolated browser context and records
// viewport captures through the bottom of each scroll owner, plus a measurement probe. Exits 2 if any step failed. Usage: node capture.mjs <repo> <outDir> <baseURL> [widths]
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [repo, outDir, baseURL, widthsArg] = process.argv.slice(2);
const require = createRequire(path.join(repo, 'package.json'));
const { chromium } = require('playwright-core');
const SIZES = { 390: 844, 320: 568, 430: 932 };
const widths = (widthsArg ?? '390,320,430').split(',').map(Number);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// Before and after captures must show the same campaign. The sim's only random draw is
// randomCampaignSeed (sim/personnel.ts), which reads one Uint32 from crypto.getRandomValues, so the
// page gets that draw pinned to CAMPAIGN_SEED. The clock is fixed so Date-based lapses and ages match too.
const CAMPAIGN_SEED = 41041;
const FIXED_TIME = '2026-10-22T09:00:00';

// Runs in the page: what a thumb and an eye meet on the current viewport.
function probe() {
  const vw = innerWidth, vh = innerHeight;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const label = (el) => (el.getAttribute('aria-label') || el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const inSr = (el) => el.closest('.sr-only, .visually-hidden, svg, .blueprint, [data-blueprint]');
  const interactive = [...document.querySelectorAll('button, a[href], [role=button], [role=tab], [role=radio], [role=switch], input, select, summary')]
    .filter((el) => visible(el) && !inSr(el));
  const small = interactive.map((el) => { const r = el.getBoundingClientRect(); return { label: label(el), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((t) => t.w < 44 || t.h < 44);
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || seen.has(el) || !n.textContent.trim() || inSr(el)) continue; seen.add(el);
    if (!visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 13) texts.push({ text: n.textContent.trim().slice(0, 40), px: fs });
  }
  const app = document.querySelector('.app') ?? document.body;
  const appRight = app.getBoundingClientRect().right;
  const overflowing = [...app.querySelectorAll('*')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > appRight + 1 && !inSr(el) && !el.closest('.choice-rail, [data-scroll-x], .live-strip-faces, .ogrid-scroll'); })
    .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
  const h = (sel) => { const el = [...document.querySelectorAll(sel)].find(visible); return el ? Math.round(el.getBoundingClientRect().height) : 0; };
  const primary = [...document.querySelectorAll('.btn-primary')].find(visible);
  // FNV-1a over the visible copy: two captures of one campaign share it, so a text change shows up here, not only in pixels.
  let copy = 2166136261;
  for (const ch of document.body.innerText) copy = Math.imul(copy ^ ch.charCodeAt(0), 16777619) >>> 0;
  return {
    viewport: `${vw}x${vh}`,
    textHash: copy.toString(16),
    docOverflow: document.documentElement.scrollWidth > vw,
    overflowing,
    chrome: { topbar: h('.topbar, .flow-head'), bottomnav: h('.bottomnav, .chrome-foot > .action-bar'), sheetFoot: h('.sheet-foot'), stickyFoot: h('.prep-foot, .live-continue, .debrief-foot, .sticky-foot, .opfoot') },
    primary: primary ? { label: label(primary), top: Math.round(primary.getBoundingClientRect().top) } : null,
    smallTargets: small.length, smallTargetSamples: small.slice(0, 8),
    smallText: texts.length, smallTextSizes: [...new Set(texts.map((t) => t.px))].sort((a, b) => a - b), smallTextSamples: texts.slice(0, 8),
  };
}

const scroller = (page) => page.evaluate(() => {
  const cands = [...document.querySelectorAll('.sheet-body, .sheet, .debrief, .debrief-layout, main.screen, main, .app')].filter((el) => el.scrollHeight - el.clientHeight > 4 && getComputedStyle(el).overflowY !== 'visible');
  const sheet = cands.find((el) => el.closest('.sheet'));
  const el = sheet ?? cands.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
  if (!el) return null; el.dataset.capScroll = '1'; return { scroll: el.scrollHeight, client: el.clientHeight };
});

async function main() {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const report = {}; const failures = [];
  for (const width of widths) {
    const height = SIZES[width];
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, deviceScaleFactor: 2 });
    await context.addInitScript((seed) => {
      Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, writable: true, value(array) { array.fill(seed); return array; } });
    }, CAMPAIGN_SEED);
    // Motion settles to its final frame, so a shot never catches a transition or pulse mid-way.
    await context.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}';
        document.head.append(style);
      });
    });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(FIXED_TIME));
    page.on('dialog', (d) => d.accept());
    const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
    const dir = path.join(outDir, String(width)); await mkdir(dir, { recursive: true });
    report[width] = { errors };
    const shot = async (name, { segments = 3 } = {}) => {
      await page.waitForTimeout(350);
      await page.evaluate(() => document.querySelectorAll('[data-cap-scroll]').forEach((el) => delete el.dataset.capScroll));
      const s = await scroller(page);
      const pages = s ? Math.min(Math.max(segments, 12), Math.ceil(Math.max(0, s.scroll - s.client) / Math.round(s.client * 0.85)) + 1) : 1;
      const entry = { scrollHeight: s?.scroll ?? null, clientHeight: s?.client ?? null, segments: [] };
      for (let i = 0; i < pages; i++) {
        if (s) { await page.evaluate((y) => { const el = document.querySelector('[data-cap-scroll]'); if (el) el.scrollTop = y; }, i * Math.round(s.client * 0.85)); await page.waitForTimeout(200); }
        const file = `${name}-s${i}.jpg`;
        await page.screenshot({ path: path.join(dir, file), type: 'jpeg', quality: 80 });
        entry.segments.push({ file, probe: await page.evaluate(probe) });
      }
      if (s) await page.evaluate(() => { const el = document.querySelector('[data-cap-scroll]'); if (el) el.scrollTop = 0; });
      report[width][name] = entry;
      console.log(width, name, pages);
    };
    const closeSheet = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(250); };
    page.setDefaultTimeout(8000);
    const step = async (name, fn) => { try { await fn(); } catch (e) { report[width][`${name}-error`] = String(e).slice(0, 300); console.log(width, name, 'ERROR', String(e).slice(0, 160)); failures.push(`${width} ${name}`);
      for (let i = 0; i < 3 && await page.locator('.sheet').count(); i++) await closeSheet(); } };
    const tab = (t) => page.locator('nav.bottomnav').getByText(t, { exact: true }).click();
    
    await page.goto(baseURL);
    await step('first-run', async () => { await page.locator('.first-run').waitFor(); await shot('01-first-run', { segments: 4 });
      await page.getByRole('button', { name: 'Continue to headquarters', exact: true }).click(); await page.locator('nav').waitFor(); });
    await step('hq', async () => { await tab('HQ'); await shot('02-hq', { segments: 5 }); });
    await step('finance', async () => { await page.locator('.topbar .stats button').first().click(); await shot('03-finance-sheet', { segments: 2 }); await closeSheet(); });
    await step('level', async () => { await page.locator('.resource-bar .stat-level').click(); await shot('03b-level-sheet', { segments: 1 }); await closeSheet(); });
    await step('staff', async () => { await page.locator('.staff-row').first().click(); await shot('04-command-staff-sheet', { segments: 2 }); await closeSheet(); });
    await step('squad', async () => { await tab('Officers'); await shot('05-squad', { segments: 6 }); });
    await step('officer', async () => { await page.locator('.officer-row').first().click(); await shot('06-officer-sheet', { segments: 3 });
      for (const t of ['Career', 'Care']) { const b = page.locator('.sheet').getByRole('tab', { name: t, exact: true }).first(); if (await b.count()) { await b.click(); await shot(`06-officer-sheet-${t.toLowerCase()}`, { segments: 1 }); } }
      await closeSheet(); });
    await step('arrange', async () => { const b = page.getByRole('button', { name: /Arrange/ }).first(); await b.click(); await shot('07-arrange-sheet', { segments: 2 }); await closeSheet(); });
    await step('hire', async () => { await page.locator('main').getByText('Hire', { exact: true }).first().click(); await shot('08-hire', { segments: 2 }); const b = page.getByRole('button', { name: /Review hire/ }).first(); await b.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(dir, '08-recruit-card.jpg'), type: 'jpeg', quality: 80 }); await b.click(); await shot('08-hire-contract-sheet', { segments: 2 }); await closeSheet(); });
    await step('training', async () => { await page.locator('main').getByText('Training', { exact: true }).first().click(); await shot('09-training', { segments: 3 }); });
    await step('develop', async () => { await tab('Build'); await page.locator('main').getByText('Upgrades', { exact: true }).first().click(); await shot('10-develop', { segments: 4 }); });
    await step('develop-sheet', async () => { await page.locator('button.dev-node, .dev-node button, button:has(.dev-node-main)').first().click(); await shot('11-develop-sheet', { segments: 2 }); await closeSheet(); });
    await step('gear', async () => { await tab('Build'); await page.locator('main').getByText('Armory', { exact: true }).first().click(); await shot('12-gear', { segments: 5 }); });
    await step('gear-item', async () => { await page.locator('main .inv-tile').first().click(); await shot('13-gear-item-sheet', { segments: 3 }); await closeSheet(); });
    for (const [n, name] of [['14-restock-sheet', 'Restock rules'], ['15-presets-sheet', 'Loadout presets']]) await step(n, async () => { await page.getByRole('button', { name: new RegExp(name) }).first().click(); await shot(n, { segments: 2 }); await closeSheet(); });
    await step('menu', async () => { await page.locator('.resource-bar .menu-btn').click(); await shot('16-menu-sheet', { segments: 2 });
      await page.locator('.menu-sheet').getByRole('button', { name: /Themes to avoid/ }).click(); await page.waitForTimeout(300); await shot('17-themes-page', { segments: 2 }); await closeSheet(); });
    await step('saves', async () => { await page.locator('.resource-bar .menu-btn').click(); await page.waitForTimeout(300); await page.locator('.menu-sheet .menu-link').click(); await page.waitForTimeout(400); await shot('16b-saves-sheet', { segments: 3 }); await closeSheet(); });
    await step('board', async () => { await tab('Calls'); await page.locator('.cl-card').first().waitFor(); await shot('18-board', { segments: 5 }); });
    // A call card opens its brief directly (no Prepare button); the first call on a fresh board may bring the welcome sheet.
    await step('brief', async () => { const welcome = page.locator('.welcome-sheet'); if (await welcome.count()) await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.locator('.cl-card-button').first().click(); await page.locator('.cl-flow-body[data-step="brief"]').waitFor(); await shot('19-prepare-brief', { segments: 5 }); });
    await step('team', async () => { await page.getByRole('button', { name: 'Choose team', exact: true }).click(); await shot('20-prepare-team-empty', { segments: 2 });
      await page.locator('.cl-squads button.cl-squad:not([aria-label*="not deployable"]):not([aria-label*=" 0 of "])').first().click(); await shot('21-prepare-team-picked', { segments: 6 });
      const buy = page.getByRole('button', { name: /^Buy \d+ radios? · / }); if (await buy.count()) { await buy.first().click(); await page.waitForTimeout(400); } });
    await step('live', async () => { await page.getByRole('button', { name: /^Deploy [A-Z]/ }).click(); await page.locator('.call-grid').waitFor(); await shot('22-live-decide-1', { segments: 4 });
      const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first(); const review = card.locator('.callbtn-review');
      await (await review.count() ? review : card).click(); await shot('23-review-sheet', { segments: 3 });
      await page.getByRole('button', { name: /^Confirm / }).click(); await shot('24-result-beat', { segments: 3 }); });
    await step('live-rest', async () => {
      let n = 0, stage = 2;
      for (; n < 40; n++) {
        const run = await page.evaluate(() => window.__ti.getState().activeRun?.status);
        if (run !== 'active') break;
        const proceed = page.locator('.live-continue button');
        if (await proceed.count()) { await proceed.click(); await page.locator('.call-grid').waitFor(); if (stage <= 3) await shot(`25-live-decide-${stage++}`, { segments: 3 }); continue; }
        const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first();
        if (await card.count()) { const review = card.locator('.callbtn-review'); await (await review.count() ? review : card).click(); await page.getByRole('button', { name: /^Confirm / }).click(); await page.waitForTimeout(300); continue; }
        const cont = page.locator('.operation-continuations button'); if (await cont.count()) { await cont.first().click(); continue; }
        break;
      }
      await page.getByRole('button', { name: 'Done', exact: true }).waitFor({ timeout: 8000 });
      await shot('26-debrief', { segments: 6 });
      await page.getByRole('button', { name: 'Done', exact: true }).click(); await page.waitForTimeout(400);
      await shot('27-board-after', { segments: 3 }); });
    await step('hq-after', async () => { await tab('HQ'); await shot('28-hq-after-call', { segments: 5 }); });
    await context.close();
  }
  await browser.close();
  await writeFile(path.join(outDir, 'probe.json'), JSON.stringify(report, null, 1));
  if (failures.length) { console.error('Steps failed:', failures.join(', ')); process.exit(2); }
}
main().catch((e) => { console.error(e); process.exit(1); });
