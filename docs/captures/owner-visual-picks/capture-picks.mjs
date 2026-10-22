// Captures the two owner picks (backlog `owner-visual-picks`) from the fixed-seed campaign:
//  1. plates: each tab root with the plate at none, 72, 96 and 128px (--plate-h), top of the screen.
//  2. face: the decide beat and the debrief in the current face and the candidate serif (?face=serif).
// Usage: node capture-picks.mjs <repo> <outDir> <baseURL> [widths]
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const [repo, outDir, baseURL, widthsArg] = process.argv.slice(2);
const require = createRequire(path.join(repo, 'package.json'));
const { chromium } = require('playwright-core');
const SIZES = { 390: 844, 320: 568 };
const widths = (widthsArg ?? '390,320').split(',').map(Number);
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SEED = 41041;
const FIXED_TIME = '2026-10-22T09:00:00';
const PLATES = ['none', 72, 96, 128];
const failures = [];

async function session(browser, width, search = '') {
  const context = await browser.newContext({ viewport: { width, height: SIZES[width] }, hasTouch: true, deviceScaleFactor: 2 });
  await context.addInitScript((seed) => {
    Object.defineProperty(Crypto.prototype, 'getRandomValues', { configurable: true, writable: true, value(array) { array.fill(seed); return array; } });
  }, SEED);
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}';
      document.head.append(style);
    });
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(FIXED_TIME));
  page.setDefaultTimeout(8000);
  page.on('dialog', (d) => d.accept());
  await page.goto(baseURL + search);
  await page.locator('.first-run').waitFor();
  await page.getByRole('button', { name: 'Continue to headquarters', exact: true }).click();
  await page.locator('nav').waitFor();
  return { context, page, tab: (t) => page.locator('nav.bottomnav').getByText(t, { exact: true }).click() };
}

async function plates(browser, width) {
  const dir = path.join(outDir, 'plates', String(width)); await mkdir(dir, { recursive: true });
  const { context, page, tab } = await session(browser, width);
  const roots = [['hq', () => tab('HQ')], ['calls', () => tab('Calls')], ['officers', () => tab('Officers')],
    ['build-upgrades', async () => { await tab('Build'); await page.locator('main').getByText('Upgrades', { exact: true }).first().click(); }],
    ['build-armory', async () => { await tab('Build'); await page.locator('main').getByText('Armory', { exact: true }).first().click(); }]];
  for (const [name, go] of roots) {
    try {
      await go(); await page.waitForTimeout(400);
      for (const plate of PLATES) {
        await page.evaluate((p) => {
          document.getElementById('picks-plate')?.remove();
          const style = document.createElement('style'); style.id = 'picks-plate';
          style.textContent = p === 'none' ? '.tab-plate{display:none!important}' : `:root{--plate-h:${p}px!important}`;
          document.head.append(style);
          document.querySelector('main.screen').scrollTop = 0;
        }, plate);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(dir, `${name}-${plate === 'none' ? 'none' : plate + 'px'}.jpg`), type: 'jpeg', quality: 80 });
      }
      console.log(width, 'plates', name);
    } catch (e) { failures.push(`${width} plates ${name}: ${String(e).slice(0, 160)}`); }
  }
  await context.close();
}

async function face(browser, width, which) {
  const dir = path.join(outDir, 'face', String(width)); await mkdir(dir, { recursive: true });
  const { context, page, tab } = await session(browser, width, which === 'serif' ? '?face=serif' : '');
  try {
    await tab('Calls'); await page.locator('.cl-card').first().waitFor();
    const welcome = page.locator('.welcome-sheet');
    if (await welcome.count()) await welcome.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.locator('.cl-card-button').first().click(); await page.locator('.cl-flow-body[data-step="brief"]').waitFor();
    await page.getByRole('button', { name: 'Choose team', exact: true }).click();
    await page.locator('.cl-squads button.cl-squad:not([aria-label*="not deployable"]):not([aria-label*=" 0 of "])').first().click();
    const buy = page.getByRole('button', { name: /^Buy \d+ radios? · / }); if (await buy.count()) { await buy.first().click(); await page.waitForTimeout(400); }
    await page.getByRole('button', { name: /^Deploy [A-Z]/ }).click(); await page.locator('.call-grid').waitFor();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, `decide-${which}.jpg`), type: 'jpeg', quality: 80 });
    for (let n = 0; n < 40; n++) {
      const run = await page.evaluate(() => window.__ti.getState().activeRun?.status);
      if (run !== 'active') break;
      const proceed = page.locator('.live-continue button');
      if (await proceed.count()) { await proceed.click(); await page.locator('.call-grid').waitFor(); continue; }
      const card = page.locator('.call-grid .callbtn:not(.callbtn-off)').first();
      if (await card.count()) { const review = card.locator('.callbtn-review'); await (await review.count() ? review : card).click(); await page.getByRole('button', { name: /^Confirm / }).click(); await page.waitForTimeout(500); continue; }
      const cont = page.locator('.operation-continuations button'); if (await cont.count()) { await cont.first().click(); continue; }
      break;
    }
    await page.getByRole('button', { name: 'Done', exact: true }).waitFor({ timeout: 8000 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, `debrief-${which}.jpg`), type: 'jpeg', quality: 80 });
    await page.evaluate(() => { const el = document.querySelector('.debrief')?.closest('main.screen') ?? document.querySelector('main.screen'); if (el) el.scrollTop = Math.round(el.clientHeight * 0.85); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(dir, `debrief-${which}-2.jpg`), type: 'jpeg', quality: 80 });
    console.log(width, 'face', which);
  } catch (e) { failures.push(`${width} face ${which}: ${String(e).slice(0, 200)}`); }
  await context.close();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const width of widths) { await plates(browser, width); await face(browser, width, 'sans'); await face(browser, width, 'serif'); }
await browser.close();
if (failures.length) { console.error('Steps failed:', failures.join('; ')); process.exit(2); }
