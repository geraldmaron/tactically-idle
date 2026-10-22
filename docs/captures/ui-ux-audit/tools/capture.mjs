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
  // Covered: another element (a raised tab, a toast, a footer) sits on the primary's centre.
  const covered = (el) => { const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && hit !== el && !el.contains(hit); };
  // The visible body of an open sheet, between its head and its footer.
  const sheetBody = [...document.querySelectorAll('.sheet .sheet-body')].find(visible);
  const sheetBodyVisible = sheetBody ? (() => { const r = sheetBody.getBoundingClientRect(); return Math.round(Math.min(r.bottom, vh) - Math.max(r.top, 0)); })() : null;
  return {
    viewport: `${vw}x${vh}`,
    docOverflow: document.documentElement.scrollWidth > vw,
    overflowing,
    chrome: { topbar: h('.topbar'), bottomnav: h('.bottomnav'), sheetFoot: h('.sheet-foot'), stickyFoot: h('.prep-foot, .live-continue, .debrief-foot, .sticky-foot, .opfoot, .cl-flow-foot, .action-bar'), flowHead: h('.cl-head, .flow-head') },
    primary: primary ? { label: label(primary), top: Math.round(primary.getBoundingClientRect().top), covered: covered(primary) } : null,
    sheetBodyVisible,
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
    const page = await context.newPage();
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
        const file = `${name}-s${i}.png`;
        await page.screenshot({ path: path.join(dir, file) });
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
    await step('level', async () => { await page.locator('.topbar-level-button').click(); await shot('03b-level-sheet', { segments: 1 }); await closeSheet(); });
    await step('staff', async () => { await page.locator('.staff-card').first().click(); await shot('04-command-staff-sheet', { segments: 2 }); await closeSheet(); });
    await step('squad', async () => { await tab('Squad'); await shot('05-squad', { segments: 6 }); });
    await step('officer', async () => { await page.locator('.ogrid-tiles button').first().click(); await shot('06-officer-sheet', { segments: 3 });
      for (const t of ['Career', 'Care']) { const b = page.locator('.sheet').getByRole('tab', { name: t, exact: true }).first(); if (await b.count()) { await b.click(); await shot(`06-officer-sheet-${t.toLowerCase()}`, { segments: 1 }); } }
      await closeSheet(); });
    await step('arrange', async () => { const b = page.getByRole('button', { name: /Arrange/ }).first(); await b.click(); await shot('07-arrange-sheet', { segments: 2 }); await closeSheet(); });
    await step('hire', async () => { const b = page.getByRole('button', { name: /Review hire/ }).first(); await b.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(dir, '08-recruit-card.png') }); await b.click(); await shot('08-hire-contract-sheet', { segments: 2 }); await closeSheet(); });
    await step('training', async () => { await page.locator('main').getByText('Training', { exact: true }).first().click(); await shot('09-training', { segments: 3 }); });
    await step('develop', async () => { await tab('Develop'); await shot('10-develop', { segments: 4 }); });
    await step('develop-sheet', async () => { await page.locator('button.dev-node, .dev-node button, button:has(.dev-node-main)').first().click(); await shot('11-develop-sheet', { segments: 2 }); await closeSheet(); });
    await step('gear', async () => { await tab('Gear'); await shot('12-gear', { segments: 5 }); });
    await step('gear-item', async () => { await page.locator('main button:has(img)').first().click(); await shot('13-gear-item-sheet', { segments: 3 }); await closeSheet(); });
    for (const [n, name] of [['14-restock-sheet', 'Restock rules'], ['15-presets-sheet', 'Loadout presets']]) await step(n, async () => { await page.getByRole('button', { name: new RegExp(name) }).first().click(); await shot(n, { segments: 2 }); await closeSheet(); });
    await step('saves', async () => { await page.locator('.topbar button').last().click(); await shot('16-saves-sheet', { segments: 3 });
      await page.locator('.settings-entry').click(); await page.waitForTimeout(300); await shot('17-settings-sheet', { segments: 3 }); await closeSheet(); await closeSheet(); });
    // The calls tab is "Calls" with the desk's four tabs and "Ops" before them.
    const callsTab = () => page.locator('nav').getByRole('button', { name: /Calls|^Ops$/ }).first().click();
    await step('board', async () => { await callsTab(); await page.locator('.cl-card').first().waitFor(); await shot('18-board', { segments: 5 }); });
    await step('brief', async () => { await page.locator('.cl-card-button').first().click(); await page.locator('.cl-flow[data-step="brief"]').waitFor(); await shot('19-prepare-brief', { segments: 5 });
      await page.locator('.cl-head').getByRole('button', { name: 'Map', exact: true }).click(); await shot('19b-brief-map-sheet', { segments: 1 }); await closeSheet(); });
    await step('team', async () => { await page.getByRole('button', { name: 'Choose team', exact: true }).click(); await shot('20-prepare-team-empty', { segments: 2 });
      await page.locator('.cl-squads button.cl-squad').first().click(); await shot('21-prepare-team-picked', { segments: 6 });
      await page.locator('.cl-squad-plan .cl-link').first().click(); await shot('21b-kit-sheet', { segments: 2 }); await closeSheet(); });
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
